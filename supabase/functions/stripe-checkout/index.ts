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
//   - sells the therapist founding-member rate only while that offer is open
//     (switch on, price set, deadline not passed, spots left);
//   - only redirects back to origins we own.
import { CORS, json, readBody } from "../_shared/http.ts";
import { admin, allowedOrigins, callerFrom, loadConfig } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";
import {
  foundingOffer, hasLiveStripeSub, isInterval, isPlanKey, minuteBucket, PLANS, priceKeyFor, safeReturnOrigin,
} from "../_shared/billing.ts";
import type { Stripe } from "../_shared/stripe.ts";

/**
 * How many live subscriptions already sit on the founding price. Stops
 * counting once it reaches `cap`, so a sold-out offer costs one page.
 */
async function foundingTaken(stripe: Stripe, priceId: string, cap: number): Promise<number> {
  let taken = 0;
  for (const status of ["active", "trialing"] as const) {
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.subscriptions.list({ price: priceId, status, limit: 100, starting_after: startingAfter });
      taken += page.data.length;
      if (taken >= cap || !page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    if (taken >= cap) break;
  }
  return taken;
}

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
    const interval = isInterval(body.interval) ? body.interval : "monthly";
    if (!isPlanKey(plan)) return json({ error: "bad_plan", message: `Unknown plan "${plan}".` }, 400);
    const planCfg = PLANS[plan];

    const cfg = await loadConfig();
    if (cfg.stripe_enabled !== "true" && !isAdmin) {
      return json({ error: "payments_off", message: "Payments are not switched on yet." }, 503);
    }
    // The administrator can open the practice dashboard too, and may test a
    // therapist checkout from it the same way they can test with payments off.
    if (planCfg.audience === "therapist" && profile.role !== "therapist" && !isAdmin) {
      return json({ error: "wrong_account",
        message: "Therapist membership needs a therapist account." }, 400);
    }
    if (planCfg.audience === "member" && profile.role === "therapist") {
      return json({ error: "wrong_account",
        message: "This is a therapist account — member plans are for members." }, 400);
    }

    const priceKey = priceKeyFor(plan, interval);
    if (!priceKey) return json({ error: "bad_plan", message: `${plan} has no ${interval} rate.` }, 400);
    const priceId = cfg[priceKey];
    if (!priceId) {
      return json({ error: "price_missing",
        message: `No Stripe price is set for ${plan} (${interval}). Add it in the admin screen.` }, 503);
    }

    // The founding-member rate is only sold while the offer is open. The
    // switch, price and deadline are checked here; the spot count is checked
    // below, after we know the caller is not already subscribed.
    // An admin can test the founding checkout while the switch is still off,
    // the same way they can test with payments off.
    const offer = interval === "founding" ? foundingOffer(cfg) : null;
    if (offer && !offer.open && !(isAdmin && offer.closedBecause === "off")) {
      const why = offer.closedBecause === "expired" ? "The founding-member offer has ended."
        : "The founding-member offer is not open right now.";
      return json({ error: "founding_closed", message: why }, 409);
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
    // A complimentary membership has no subscription to change, so it goes on
    // to a normal checkout; the paid subscription then replaces the comp.
    if (hasLiveStripeSub(profile)) {
      const returnUrl = `${site}/${home}`;
      try {
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
          flow_data: {
            type: "subscription_update",
            subscription_update: { subscription: profile.stripe_subscription_id! },
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

    if (offer?.spots) {
      const taken = await foundingTaken(stripe, offer.priceId, offer.spots);
      if (taken >= offer.spots) {
        return json({ error: "founding_full",
          message: "All founding-member spots are taken. The regular rate is still available." }, 409);
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
      subscription_data: { metadata: { supabase_user_id: user.id, plan, interval } },
      metadata: { supabase_user_id: user.id, plan, interval },
    }, { idempotencyKey: `checkout-${user.id}-${plan}-${interval}-${minuteBucket()}` });

    return json({ url: session.url });
  } catch (err) {
    console.error("checkout error", err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
