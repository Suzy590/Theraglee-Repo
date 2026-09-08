// A client pays a therapist for a session through Theraglee.
//
// One-off Checkout in payment mode, as a destination charge to the therapist's
// connected account with Theraglee's platform fee held back. Anyone can pay
// (a member's account is attached when they are signed in), the therapist must
// have a live listing, a payout account that can take charges, and a session
// fee set on their dashboard.
//
// Sales tax is not calculated on these payments: counseling services are
// generally exempt from US sales tax, and the therapist — not Theraglee — is
// the merchant (on_behalf_of). Membership subscriptions are the taxable product.
import { CORS, json, readBody } from "../_shared/http.ts";
import { admin, allowedOrigins, callerFrom, loadConfig } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { isValidSessionFee, minuteBucket, platformFee, safeReturnOrigin } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "billing_not_configured", message: "Payments are not available yet." }, 503);

    const cfg = await loadConfig();
    const caller = await callerFrom(req); // optional: guests can pay too
    const isAdmin = caller?.profile.role === "admin";
    if ((cfg.stripe_enabled !== "true" && !isAdmin) || cfg.connect_enabled !== "true") {
      return json({ error: "payments_off", message: "Session payments are not switched on yet." }, 503);
    }

    const body = await readBody(req);
    const therapistId = typeof body.therapist_id === "string" ? body.therapist_id : null;
    if (!therapistId) return json({ error: "bad_request", message: "Which therapist?" }, 400);

    const { data: T } = await admin.from("therapist_profiles")
      .select("id, slug, first_name, last_name, credentials, published, verification, accepts_payments, charges_enabled, stripe_account_id, session_fee_cents")
      .eq("id", therapistId).maybeSingle();

    if (!T || !T.published || T.verification !== "verified") {
      return json({ error: "not_found", message: "That listing is not available." }, 404);
    }
    if (!T.accepts_payments || !T.charges_enabled || !T.stripe_account_id || !isValidSessionFee(T.session_fee_cents)) {
      return json({ error: "not_accepting", message: "This therapist is not taking payments through Theraglee right now." }, 400);
    }

    const amount = T.session_fee_cents as number;
    const fee = platformFee(amount, Number(cfg.platform_fee_percent ?? "10"), Number(cfg.platform_fee_min_cents ?? "100"));
    const site = safeReturnOrigin(body.return_url, allowedOrigins()) ?? Deno.env.get("SITE_URL") ?? "";
    const name = `${T.first_name} ${T.last_name}${T.credentials ? ", " + T.credentials : ""}`;
    const back = `${site}/therapist.html?slug=${encodeURIComponent(T.slug)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "book",
      ...(caller?.user.email ? { customer_email: caller.user.email } : {}),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: {
            name: `Session with ${name}`,
            description: "Paid through Theraglee. Scheduling is arranged directly with the therapist.",
          },
        },
      }],
      payment_intent_data: {
        application_fee_amount: fee,
        transfer_data: { destination: T.stripe_account_id },
        on_behalf_of: T.stripe_account_id,
        description: `Therapy session with ${name}`,
        metadata: { kind: "session", therapist_id: T.id, payer_user_id: caller?.user.id ?? "" },
      },
      metadata: { kind: "session", therapist_id: T.id, payer_user_id: caller?.user.id ?? "" },
      success_url: `${back}&payment=success`,
      cancel_url: `${back}&payment=canceled`,
    }, { idempotencyKey: `session-${T.id}-${caller?.user.id ?? "guest"}-${minuteBucket()}` });

    const { error } = await admin.from("session_payments").upsert({
      checkout_session_id: session.id,
      therapist_id: T.id,
      payer_user_id: caller?.user.id ?? null,
      amount_cents: amount,
      fee_cents: fee,
      currency: "usd",
      status: "pending",
    }, { onConflict: "checkout_session_id" });
    if (error) console.error("session_payments insert failed", error.message);

    return json({ url: session.url });
  } catch (err) {
    console.error("session checkout error", err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
