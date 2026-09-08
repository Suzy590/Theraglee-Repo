// Creates a Stripe Checkout Session for a membership plan.
//
// Auth is enforced in-body (we validate the caller's Supabase JWT ourselves) so
// that we can return friendly JSON errors instead of a bare 401.
//
// What this does beyond a plain Checkout call:
//   - refuses to start a checkout while payments are switched off (admins can
//     still test), and refuses the wrong plan for the account type;
//   - reuses the member's Stripe customer, created with an idempotency key;
//   - sends someone who already has a live subscription to the billing portal
//     to change plan, instead of selling them a second subscription;
//   - turns on Stripe Tax (with address collection) when the admin has enabled it;
//   - only redirects back to origins we own.
import { CORS, json, readBody } from "../_shared/http.ts";
import { admin, allowedOrigins, callerFrom, loadConfig } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { isActive, isPlanKey, minuteBucket, PLANS, priceKeyFor, safeReturnOrigin } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const stripe = stripeClient();
    if (!stripe) {
      return json({ error: "billing_not_configured",
        message: "Stripe is not connected yet. Add STRIPE_SECRET_KEY in Supabase → Edge Functions → Secrets." }, 503);
    }

    const caller = await callerFrom(req);
    if (!caller) return json({ error: "unauthorized", message: "Please sign in first." }, 401);
    const { user, profile } = caller;
    const isAdmin = profile.role === "admin";

    const body = await readBody(req);
    const plan = body.plan ?? "basic";
    const interval = body.interval === "yearly" ? "yearly" : "monthly";
    if (!isPlanKey(plan)) return json({ error: "bad_plan", message: `Unknown plan "${plan}".` }, 400);
    const planCfg = PLANS[plan];

    const cfg = await loadConfig();
    if (cfg.stripe_enabled !== "true" && !isAdmin) {
      return json({ error: "payments_off", message: "Payments are not switched on yet." }, 503);
    }
    if (planCfg.audience === "therapist" && profile.role !== "therapist") {
      return json({ error: "wrong_account",
        message: "Therapist membership needs a therapist account." }, 400);
    }
    if (planCfg.audience === "member" && profile.role === "therapist") {
      return json({ error: "wrong_account",
        message: "This is a therapist account — member plans are for members." }, 400);
    }

    const priceId = cfg[priceKeyFor(plan, interval)];
    if (!priceId) {
      return json({ error: "price_missing",
        message: `No Stripe price is set for ${plan} (${interval}). Add it in the admin screen.` }, 503);
    }

    const site = safeReturnOrigin(body.return_url, allowedOrigins()) ?? Deno.env.get("SITE_URL") ?? "";
    if (!site) return json({ error: "site_url_missing", message: "SITE_URL is not set." }, 500);
    const home = planCfg.audience === "therapist" ? "therapist-dashboard.html" : "account.html";

    // Reuse the customer if we already made one for this member.
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile.email ?? undefined,
        name: profile.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      }, { idempotencyKey: `customer-${user.id}` });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Already subscribed? Change plan through the portal rather than buying twice.
    if (profile.stripe_subscription_id && isActive(profile.subscription_status)) {
      const returnUrl = `${site}/${home}`;
      try {
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
          flow_data: {
            type: "subscription_update",
            subscription_update: { subscription: profile.stripe_subscription_id },
          },
        });
        return json({ url: portal.url, portal: true });
      } catch (err) {
        // The portal configuration may not allow plan switches yet; fall back
        // to the plain portal so the member can still manage things.
        console.warn("portal subscription_update flow unavailable", (err as Error)?.message);
        const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
        return json({ url: portal.url, portal: true });
      }
    }

    const taxOn = cfg.stripe_tax_enabled === "true";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: taxOn ? "required" : "auto",
      ...(taxOn
        ? { automatic_tax: { enabled: true }, customer_update: { address: "auto", name: "auto" } }
        : {}),
      ...(taxOn && planCfg.audience === "therapist" ? { tax_id_collection: { enabled: true } } : {}),
      success_url: `${site}/${home}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/pricing.html?checkout=cancelled`,
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
      metadata: { supabase_user_id: user.id, plan },
    }, { idempotencyKey: `checkout-${user.id}-${plan}-${interval}-${minuteBucket()}` });

    return json({ url: session.url });
  } catch (err) {
    console.error("checkout error", err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
