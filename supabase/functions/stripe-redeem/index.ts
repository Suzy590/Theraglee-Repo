// A paying member or therapist enters a discount code on their account page.
//
// New subscribers type codes on the Stripe Checkout page itself
// (allow_promotion_codes in stripe-checkout); this is for people who already
// pay. Only codes an admin made on /admin.html are accepted, and only for
// the kind of account the code was made for. Stripe then enforces the rest:
// the number of uses, the last day, and which products it discounts.
import { CORS, json, readBody } from "../_shared/http.ts";
import { admin, callerFrom, loadConfig } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";
import {
  codeFitsRole, hasLiveStripeSub, isPlanKey, isValidCode, normalizeCode, planForPrice, subscriptionPatch,
} from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "billing_not_configured", message: "Billing is not connected yet." }, 503);

    const caller = await callerFrom(req);
    if (!caller) return json({ error: "unauthorized", message: "Please sign in first." }, 401);
    const { profile } = caller;

    const code = normalizeCode((await readBody(req)).code);
    if (!code) return json({ error: "bad_code", message: "Enter a code." }, 400);
    // Letters and digits only, so nothing in it can act as an ilike wildcard.
    if (!isValidCode(code)) return json({ error: "bad_code", message: "That code is not valid for this account." }, 400);

    if (!hasLiveStripeSub(profile)) {
      return json({ error: "no_subscription",
        message: "Codes apply to a paid membership. Choose a plan and enter the code on the checkout page." }, 400);
    }

    const { data: row } = await admin.from("discount_codes").select("*").ilike("code", code).maybeSingle();
    const expired = row?.expires_at && new Date(row.expires_at).getTime() < Date.now();
    if (!row || !row.active || expired || !codeFitsRole(row.audience, profile.role)) {
      return json({ error: "bad_code", message: "That code is not valid for this account." }, 400);
    }

    const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id!);
    if ((sub.discounts ?? []).length) {
      return json({ error: "has_discount", message: "Your membership already has a discount." }, 409);
    }

    let updated;
    try {
      updated = await stripe.subscriptions.update(sub.id, { discounts: [{ promotion_code: row.stripe_promotion_id }] });
    } catch (err) {
      // Used up, expired or switched off in Stripe.
      console.warn("redeem refused by Stripe", (err as Error)?.message);
      return json({ error: "bad_code", message: "That code can no longer be used." }, 400);
    }

    const cfg = await loadConfig();
    const stamped = updated.metadata?.plan;
    const plan = planForPrice(cfg, updated.items?.data?.[0]?.price?.id) ?? (isPlanKey(stamped) ? stamped : null);
    const customerId = typeof updated.customer === "string" ? updated.customer : updated.customer.id;
    await admin.from("profiles").update(subscriptionPatch(updated, customerId, plan).patch).eq("id", profile.id);
    return json({ ok: true });
  } catch (err) {
    console.error("redeem error", err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
