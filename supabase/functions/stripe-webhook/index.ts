// Stripe -> Supabase sync.
//
// verify_jwt is intentionally false: Stripe cannot present a Supabase JWT.
// Authenticity is established by verifying the Stripe webhook signature below;
// any request without a valid signature is rejected.
//
// Two endpoints in the Stripe Dashboard can point at this one function:
//   - the account endpoint (STRIPE_WEBHOOK_SECRET): subscriptions, invoices,
//     checkout, identity, disputes, Radar;
//   - the Connect endpoint (STRIPE_CONNECT_WEBHOOK_SECRET, "listen to events on
//     connected accounts"): account.updated for therapists' payout accounts.
//
// Every event is recorded in stripe_events. A record is only marked processed
// after its handler succeeds, so a failed delivery is retried by Stripe instead
// of being swallowed as a duplicate.
import { admin, loadConfig } from "../_shared/supabase.ts";
import { type Stripe, stripeClient } from "../_shared/stripe.ts";
import {
  connectStatus, identityStatusFor, isPlanKey, isStaleSubscription, planForPrice, subscriptionPatch,
} from "../_shared/billing.ts";

const idOf = (x: unknown): string | null =>
  typeof x === "string" ? x : (x && typeof x === "object" && "id" in x ? String((x as { id: string }).id) : null);

/* --------------------------------------------------------- subscriptions */

async function syncSubscription(stripe: Stripe, subscriptionId: string) {
  // Always read the current object rather than trusting the event payload:
  // deliveries can arrive out of order, and the latest state is what matters.
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = idOf(sub.customer)!;

  let userId = (sub.metadata?.supabase_user_id as string) || null;
  if (!userId) {
    const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.id ?? null;
  }
  if (!userId) { console.error("no profile for customer", customerId); return; }

  const { data: profile } = await admin
    .from("profiles").select("stripe_subscription_id").eq("id", userId).maybeSingle();
  if (isStaleSubscription(profile?.stripe_subscription_id, sub)) {
    console.log("ignoring stale subscription", sub.id, "current is", profile?.stripe_subscription_id);
    return;
  }

  const cfg = await loadConfig();
  const priceId = sub.items?.data?.[0]?.price?.id;
  // Prefer the price id; fall back to the plan we stamped in metadata at checkout.
  const stamped = sub.metadata?.plan;
  const plan = planForPrice(cfg, priceId) ?? (isPlanKey(stamped) ? stamped : null);
  const { patch, unpublishTherapist } = subscriptionPatch(sub, customerId, plan);

  if (unpublishTherapist) {
    await admin.from("therapist_profiles").update({ published: false }).eq("user_id", userId);
  }
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(`profile update failed: ${error.message}`);
}

/* ----------------------------------------------------- session payments */

async function checkoutCompleted(stripe: Stripe, s: Stripe.Checkout.Session) {
  if (s.mode === "subscription" && s.subscription) {
    const subId = idOf(s.subscription)!;
    // Make sure the subscription itself carries the member link for later events.
    if (s.metadata?.supabase_user_id) {
      const sub = await stripe.subscriptions.retrieve(subId);
      if (!sub.metadata?.supabase_user_id) {
        await stripe.subscriptions.update(subId, {
          metadata: { ...sub.metadata, supabase_user_id: s.metadata.supabase_user_id, plan: s.metadata.plan ?? "" },
        });
      }
    }
    await syncSubscription(stripe, subId);
    return;
  }

  if (s.mode === "payment" && s.metadata?.kind === "session") {
    const paid = s.payment_status === "paid";
    const { error } = await admin.from("session_payments").update({
      status: paid ? "paid" : "pending",
      payment_intent_id: idOf(s.payment_intent),
      payer_email: s.customer_details?.email ?? null,
      amount_cents: s.amount_total ?? undefined,
      paid_at: paid ? new Date().toISOString() : null,
    }).eq("checkout_session_id", s.id);
    if (error) throw new Error(`session payment update failed: ${error.message}`);
  }
}

async function chargeRefunded(ch: Stripe.Charge) {
  const pi = idOf(ch.payment_intent);
  if (!pi) return;
  const full = ch.refunded || (ch.amount_refunded >= ch.amount);
  await admin.from("session_payments").update({
    status: full ? "refunded" : "partially_refunded",
    refunded_cents: ch.amount_refunded,
    refunded_at: new Date().toISOString(),
  }).eq("payment_intent_id", pi);
}

/* --------------------------------------------------------------- alerts */

async function alert(kind: string, stripeId: string, customerId: string | null, summary: string, raw: unknown) {
  let userId: string | null = null;
  if (customerId) {
    const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.id ?? null;
  }
  await admin.from("billing_alerts").insert({ kind, stripe_id: stripeId, customer_id: customerId, user_id: userId, summary, raw });
}

/* ------------------------------------------------------------- identity */

async function identityUpdated(vs: Stripe.Identity.VerificationSession) {
  const status = identityStatusFor(vs.status);
  const patch: Record<string, unknown> = {
    identity_status: status,
    identity_session_id: vs.id,
    identity_last_error: vs.last_error?.reason ?? null,
    ...(status === "verified" ? { identity_verified_at: new Date().toISOString() } : {}),
  };
  const therapistId = vs.metadata?.therapist_id;
  const q = therapistId
    ? admin.from("therapist_profiles").update(patch).eq("id", therapistId)
    : admin.from("therapist_profiles").update(patch).eq("identity_session_id", vs.id);
  const { error } = await q;
  if (error) throw new Error(`identity update failed: ${error.message}`);
}

/* -------------------------------------------------------------- connect */

async function accountUpdated(acct: Stripe.Account) {
  const { error } = await admin.from("therapist_profiles").update({
    stripe_account_status: connectStatus(acct),
    charges_enabled: !!acct.charges_enabled,
    payouts_enabled: !!acct.payouts_enabled,
  }).eq("stripe_account_id", acct.id);
  if (error) throw new Error(`account update failed: ${error.message}`);
}

/* ----------------------------------------------------------------- main */

async function verifiedEvent(stripe: Stripe, raw: string, sig: string): Promise<Stripe.Event | null> {
  const secrets = [Deno.env.get("STRIPE_WEBHOOK_SECRET"), Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")]
    .filter((s): s is string => !!s);
  for (const secret of secrets) {
    try { return await stripe.webhooks.constructEventAsync(raw, sig, secret); } catch { /* try the next */ }
  }
  return null;
}

Deno.serve(async (req) => {
  const stripe = stripeClient();
  if (!stripe || !Deno.env.get("STRIPE_WEBHOOK_SECRET")) {
    return new Response("billing not configured", { status: 503 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  const raw = await req.text();
  const event = await verifiedEvent(stripe, raw, sig);
  if (!event) {
    console.error("signature verification failed");
    return new Response("invalid signature", { status: 400 });
  }

  // Idempotency: Stripe retries, and we must not double-apply — but a delivery
  // whose handler failed must be allowed to run again.
  const { data: seen } = await admin.from("stripe_events").select("processed_at").eq("id", event.id).maybeSingle();
  if (seen?.processed_at) return new Response("ok (duplicate)", { status: 200 });
  if (!seen) {
    await admin.from("stripe_events").insert({ id: event.id, type: event.type, account: event.account ?? null });
  }

  try {
    const obj = event.data.object as any;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await checkoutCompleted(stripe, obj as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(stripe, (obj as Stripe.Subscription).id);
        break;

      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        // Stripe has already moved the subscription's status (past_due, active…);
        // re-reading it keeps us exactly in step, whatever order events arrive in.
        const subId = idOf(obj.subscription) ?? idOf(obj.parent?.subscription_details?.subscription);
        if (subId) await syncSubscription(stripe, subId);
        break;
      }

      case "identity.verification_session.verified":
      case "identity.verification_session.requires_input":
      case "identity.verification_session.processing":
      case "identity.verification_session.canceled":
        await identityUpdated(obj as Stripe.Identity.VerificationSession);
        break;

      case "account.updated":
        await accountUpdated(obj as Stripe.Account);
        break;

      case "charge.refunded":
        await chargeRefunded(obj as Stripe.Charge);
        break;

      case "charge.dispute.created": {
        const d = obj as Stripe.Dispute;
        const pi = idOf(d.payment_intent);
        if (pi) await admin.from("session_payments").update({ status: "disputed" }).eq("payment_intent_id", pi);
        await alert("dispute", d.id, null,
          `Dispute of ${(d.amount / 100).toFixed(2)} ${d.currency.toUpperCase()} (${d.reason}) on charge ${idOf(d.charge)}`, d);
        break;
      }

      case "radar.early_fraud_warning.created": {
        const w = obj as Stripe.Radar.EarlyFraudWarning;
        await alert("early_fraud_warning", w.id, null,
          `Radar early fraud warning (${w.fraud_type}) on charge ${idOf(w.charge)} — consider refunding before it becomes a dispute`, w);
        break;
      }

      default:
        // Recorded in stripe_events, nothing to apply.
        break;
    }
  } catch (err) {
    console.error("handler error", event.type, err);
    await admin.from("stripe_events").update({ error: String((err as Error)?.message ?? err) }).eq("id", event.id);
    return new Response("handler error", { status: 500 });
  }

  await admin.from("stripe_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", event.id);
  return new Response("ok", { status: 200 });
});
