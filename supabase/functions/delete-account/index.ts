// A member or therapist deletes their own account from the account page.
//
// Deleting the account also ends the membership, and the member keeps what
// they paid for:
//   - with a live Stripe subscription, renewal is turned off
//     (cancel_at_period_end) and the request is recorded on the profile; the
//     stripe-webhook function deletes the account when the subscription ends.
//     `when: "now"` skips the wait: the subscription is canceled at once and
//     the account deleted on the spot.
//   - with no live subscription (free, complimentary, lapsed), the account is
//     deleted on the spot; a subscription still open in Stripe (past_due,
//     unpaid) is canceled first so no retry charges the card.
// `action: "keep"` withdraws a pending request and turns renewal back on.
import { CORS, json, readBody } from "../_shared/http.ts";
import { admin, callerFrom, deleteAccount } from "../_shared/supabase.ts";
import { type Stripe, stripeClient } from "../_shared/stripe.ts";
import { deletionPlan, isActive, isDeleteWhen } from "../_shared/billing.ts";

const BLOCKED =
  "This account has payment records we are required to keep, so we need to close it by hand. " +
  "Email hello@theraglee.com and we will finish within 45 days.";

/** The subscription as Stripe has it right now; null when there is none left to read. */
async function currentSubscription(stripe: Stripe | null, id: string | null): Promise<Stripe.Subscription | null> {
  if (!stripe || !id) return null;
  try { return await stripe.subscriptions.retrieve(id); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const caller = await callerFrom(req);
    if (!caller) return json({ error: "unauthorized", message: "Please sign in first." }, 401);
    const { profile, user } = caller;
    if (profile.role === "admin") {
      return json({ error: "admin", message: "Admin accounts are not deleted from this screen." }, 400);
    }

    const body = await readBody(req);
    const stripe = stripeClient();
    const sub = await currentSubscription(stripe, profile.stripe_subscription_id);

    if (body.action === "keep") {
      if (sub && stripe && isActive(sub.status) && sub.cancel_at_period_end) {
        await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
      }
      const { error } = await admin.from("profiles").update({ deletion_requested_at: null }).eq("id", user.id);
      if (error) throw new Error(error.message);
      return json({ kept: true });
    }

    const when = isDeleteWhen(body.when) ? body.when : "period_end";
    const plan = deletionPlan(sub, when);

    if (plan.action === "schedule") {
      if (plan.setCancel && stripe && sub) {
        await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
      }
      const { error } = await admin.from("profiles")
        .update({ deletion_requested_at: new Date().toISOString(), cancel_at_period_end: true })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      return json({ scheduled: true, ends_at: plan.endsAt });
    }

    if (plan.cancelStripe && stripe && sub) {
      try { await stripe.subscriptions.cancel(sub.id); } catch (err) {
        console.error("could not cancel subscription", sub.id, err);
        return json({ error: "stripe", message: "We could not end your membership just now. Please try again in a minute." }, 502);
      }
    }
    const failed = await deleteAccount(user.id);
    if (failed) {
      console.error("account deletion blocked", user.id, failed);
      // Leave a trace for the administrator, with the request recorded.
      await admin.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", user.id);
      return json({ error: "blocked", message: BLOCKED }, 409);
    }
    return json({ deleted: true });
  } catch (err) {
    console.error(err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
