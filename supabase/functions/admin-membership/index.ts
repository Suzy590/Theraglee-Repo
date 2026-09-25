// Membership management for the admin screen (/admin.html).
//
// Admin only: the caller's JWT is checked in-body and their profile must have
// role = 'admin'. Every action is one POST with an `action` field:
//
//   add          invite a new member or therapist by email, optionally on a
//                complimentary plan
//   change_plan  move an account to another plan. A live Stripe subscription
//                is switched to the new price (Stripe prorates); anyone else
//                gets a complimentary membership
//   end          end a membership: `when` = now | period_end. A Stripe
//                subscription is canceled in Stripe; a complimentary one ends
//                at once
//   resume       undo an end that was scheduled for the end of the period
//   create_code  make a discount code (a Stripe coupon + promotion code)
//   list_codes   the codes, with how many times each has been used
//   end_code     switch a code off so nobody can use it again
//   apply_code   put a code on an account's live Stripe subscription
//
// The profile is updated straight from the Stripe object each call returns,
// so the screen is right at once; the webhook then sees the same state.
import { CORS, json, readBody } from "../_shared/http.ts";
import { admin, allowedOrigins, callerFrom, loadConfig } from "../_shared/supabase.ts";
import { type Stripe, stripeClient } from "../_shared/stripe.ts";
import {
  codeFitsRole, COMPED, hasLiveStripeSub, isPlanKey, parseDiscountInput, planChangeError, planForPrice,
  priceKeyFor, priceKeysForAudience, safeReturnOrigin, subscriptionPatch,
} from "../_shared/billing.ts";
import type { CodeAudience, Interval, PlanKey } from "../_shared/billing.ts";

type Profile = {
  id: string; email: string | null; full_name: string | null; role: string; tier: string;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
  subscription_status: string | null; cancel_at_period_end: boolean | null;
};

const fail = (message: string, status = 400, error = "bad_request") => json({ error, message }, status);

async function target(userId: unknown): Promise<Profile | null> {
  if (typeof userId !== "string" || !userId) return null;
  const { data } = await admin.from("profiles")
    .select("id,email,full_name,role,tier,stripe_customer_id,stripe_subscription_id,subscription_status,cancel_at_period_end")
    .eq("id", userId).maybeSingle();
  return data as Profile | null;
}

/** Writes a Stripe subscription's state onto the profile, as the webhook would. */
async function syncFrom(sub: Stripe.Subscription, userId: string, cfg: Record<string, string>) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const stamped = sub.metadata?.plan;
  const plan = planForPrice(cfg, sub.items?.data?.[0]?.price?.id) ?? (isPlanKey(stamped) ? stamped : null);
  const { patch, unpublishTherapist } = subscriptionPatch(sub, customerId, plan);
  if (unpublishTherapist) await admin.from("therapist_profiles").update({ published: false }).eq("user_id", userId);
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(`profile update failed: ${error.message}`);
}

/** A complimentary membership: no Stripe subscription, access as if paid. */
async function comp(p: Profile, plan: PlanKey) {
  const patch: Record<string, unknown> = {
    subscription_status: COMPED, cancel_at_period_end: false, current_period_end: null,
  };
  if (plan !== "therapist") patch.tier = plan;
  const { error } = await admin.from("profiles").update(patch).eq("id", p.id);
  if (error) throw new Error(error.message);
}

const needStripe = () => fail("Stripe is not connected yet. Add STRIPE_SECRET_KEY in Supabase → Edge Functions → Secrets.",
  503, "billing_not_configured");

/* ------------------------------------------------------------- members */

async function addMember(body: Record<string, any>) {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address.");
  const type = body.type === "therapist" ? "therapist" : "member";
  const fullName = String(body.full_name ?? "").trim().slice(0, 120);
  const plan = body.plan ?? "free";
  if (type === "member" && !["free", "basic", "premium"].includes(plan)) return fail("Pick Free, Basic or Premium.");
  if (type === "therapist" && !["none", "therapist"].includes(plan)) return fail("Pick no membership or a complimentary one.");

  const site = safeReturnOrigin(body.return_url, allowedOrigins()) ?? Deno.env.get("SITE_URL") ?? "";
  const home = type === "therapist" ? "therapist-dashboard.html" : "dashboard.html";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || undefined, role: type },
    ...(site ? { redirectTo: `${site}/${home}` } : {}),
  });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return fail(taken ? "An account with that email already exists." : error.message, taken ? 409 : 400);
  }
  const userId = data.user?.id;
  if (!userId) return fail("The invite was sent, but no account came back.", 500, "server_error");

  // handle_new_user created the profile in the same transaction as the user.
  const p = await target(userId);
  if (!p) return fail("The account was created, but its profile was not found.", 500, "server_error");
  if (plan === "basic" || plan === "premium" || plan === "therapist") await comp(p, plan);
  return json({ ok: true, user_id: userId });
}

async function changePlan(stripe: Stripe | null, body: Record<string, any>) {
  const p = await target(body.user_id);
  if (!p) return fail("That account was not found.", 404, "not_found");
  const plan = body.plan, interval = body.interval ?? "monthly";
  const why = planChangeError(p.role, plan, interval);
  if (why) return fail(why);

  if (!hasLiveStripeSub(p)) {
    await comp(p, plan as PlanKey);
    return json({ ok: true, complimentary: true });
  }

  // They pay through Stripe: switch the subscription's price, prorated.
  if (!stripe) return needStripe();
  const cfg = await loadConfig();
  const priceId = cfg[priceKeyFor(plan as PlanKey, interval as Interval)!];
  if (!priceId) return fail(`No Stripe price is set for ${plan} (${interval}). Add it on the Stripe setup tab.`, 503);
  const sub = await stripe.subscriptions.retrieve(p.stripe_subscription_id!);
  const item = sub.items.data[0];
  // A founding-rate therapist asked onto "monthly" keeps the locked-in rate.
  const onFounding = !!cfg.price_therapist_founding && item?.price?.id === cfg.price_therapist_founding;
  if (item?.price?.id === priceId || (onFounding && interval === "monthly")) return json({ ok: true, unchanged: true });
  const updated = await stripe.subscriptions.update(sub.id, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: "create_prorations",
    metadata: { ...sub.metadata, plan, interval },
  });
  await syncFrom(updated, p.id, cfg);
  return json({ ok: true });
}

async function endMembership(stripe: Stripe | null, body: Record<string, any>) {
  const p = await target(body.user_id);
  if (!p) return fail("That account was not found.", 404, "not_found");
  if (p.role === "admin") return fail("Admin accounts are not managed from this screen.");
  const when = body.when === "period_end" ? "period_end" : "now";

  if (p.subscription_status === COMPED) {
    const { error } = await admin.from("profiles").update({
      subscription_status: "canceled", cancel_at_period_end: false, current_period_end: null,
      ...(p.role === "therapist" ? {} : { tier: "free" }),
    }).eq("id", p.id);
    if (error) throw new Error(error.message);
    if (p.role === "therapist") await admin.from("therapist_profiles").update({ published: false }).eq("user_id", p.id);
    return json({ ok: true });
  }

  if (!p.stripe_subscription_id) return fail("This account has no membership to end.");
  if (!stripe) return needStripe();
  const sub = await stripe.subscriptions.retrieve(p.stripe_subscription_id);
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    return fail("This membership has already ended.");
  }
  const cfg = await loadConfig();
  const updated = when === "now"
    ? await stripe.subscriptions.cancel(sub.id)
    : await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
  await syncFrom(updated, p.id, cfg);
  return json({ ok: true });
}

async function resume(stripe: Stripe | null, body: Record<string, any>) {
  const p = await target(body.user_id);
  if (!p) return fail("That account was not found.", 404, "not_found");
  if (!hasLiveStripeSub(p) || !p.cancel_at_period_end) return fail("Nothing is scheduled to end.");
  if (!stripe) return needStripe();
  const updated = await stripe.subscriptions.update(p.stripe_subscription_id!, { cancel_at_period_end: false });
  await syncFrom(updated, p.id, await loadConfig());
  return json({ ok: true });
}

/* ------------------------------------------------------ discount codes */

async function createCode(stripe: Stripe, body: Record<string, any>, adminId: string) {
  const parsed = parseDiscountInput(body);
  if (!parsed.ok) return fail(parsed.message);
  const d = parsed.value;

  const { data: clash } = await admin.from("discount_codes").select("id").ilike("code", d.code).maybeSingle();
  if (clash) return fail("That code already exists. Pick another.", 409);

  // A code for one kind of membership only discounts that kind's products.
  let products: string[] | undefined;
  if (d.audience !== "all") {
    const cfg = await loadConfig();
    const prices = priceKeysForAudience(d.audience as CodeAudience).map((k) => cfg[k]).filter(Boolean);
    if (!prices.length) {
      return fail(`Paste the ${d.audience} price IDs on the Stripe setup tab first, so the code can be limited to them.`);
    }
    const ids = await Promise.all(prices.map(async (id) => {
      const price = await stripe.prices.retrieve(id);
      return typeof price.product === "string" ? price.product : price.product.id;
    }));
    products = [...new Set(ids)];
  }

  const coupon = await stripe.coupons.create({
    name: d.code,
    ...(d.percentOff !== null ? { percent_off: d.percentOff } : { amount_off: d.amountOffCents!, currency: "usd" }),
    duration: d.duration,
    ...(d.durationInMonths ? { duration_in_months: d.durationInMonths } : {}),
    ...(products ? { applies_to: { products } } : {}),
    metadata: { created_from: "theraglee-admin", audience: d.audience },
  });
  let promo: Stripe.PromotionCode;
  try {
    promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: d.code,
      ...(d.maxRedemptions ? { max_redemptions: d.maxRedemptions } : {}),
      ...(d.expiresAt ? { expires_at: d.expiresAt } : {}),
    });
  } catch (err) {
    await stripe.coupons.del(coupon.id).catch(() => {});
    return fail(String((err as Error)?.message ?? err));
  }

  const { data: row, error } = await admin.from("discount_codes").insert({
    code: d.code, stripe_coupon_id: coupon.id, stripe_promotion_id: promo.id,
    percent_off: d.percentOff, amount_off_cents: d.amountOffCents,
    duration: d.duration, duration_in_months: d.durationInMonths, audience: d.audience,
    max_redemptions: d.maxRedemptions, expires_at: d.expiresAt ? new Date(d.expiresAt * 1000).toISOString() : null,
    created_by: adminId,
  }).select().single();
  if (error) {
    await stripe.promotionCodes.update(promo.id, { active: false }).catch(() => {});
    throw new Error(error.message);
  }
  return json({ ok: true, code: row });
}

async function listCodes(stripe: Stripe | null) {
  const { data: rows, error } = await admin.from("discount_codes").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const out = await Promise.all((rows ?? []).map(async (r) => {
    if (!stripe) return { ...r, times_redeemed: null };
    try {
      const promo = await stripe.promotionCodes.retrieve(r.stripe_promotion_id);
      return { ...r, times_redeemed: promo.times_redeemed, active: r.active && promo.active };
    } catch {
      return { ...r, times_redeemed: null };
    }
  }));
  return json({ codes: out });
}

async function endCode(stripe: Stripe, body: Record<string, any>) {
  const { data: row } = await admin.from("discount_codes").select("*").eq("id", body.code_id ?? "").maybeSingle();
  if (!row) return fail("That code was not found.", 404, "not_found");
  await stripe.promotionCodes.update(row.stripe_promotion_id, { active: false });
  await admin.from("discount_codes").update({ active: false }).eq("id", row.id);
  return json({ ok: true });
}

async function applyCode(stripe: Stripe, body: Record<string, any>) {
  const p = await target(body.user_id);
  if (!p) return fail("That account was not found.", 404, "not_found");
  const { data: row } = await admin.from("discount_codes").select("*").eq("id", body.code_id ?? "").maybeSingle();
  if (!row || !row.active) return fail("That code is not active.");
  if (!codeFitsRole(row.audience, p.role)) {
    return fail(`That code is for ${row.audience === "therapist" ? "therapists" : "members"} only.`);
  }
  if (!hasLiveStripeSub(p)) {
    return fail("This account has no paid subscription to discount. Give them the code to enter at checkout instead.");
  }
  const updated = await stripe.subscriptions.update(p.stripe_subscription_id!, {
    discounts: [{ promotion_code: row.stripe_promotion_id }],
  });
  await syncFrom(updated, p.id, await loadConfig());
  return json({ ok: true });
}

/* --------------------------------------------------------------- serve */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const caller = await callerFrom(req);
    if (!caller) return fail("Please sign in first.", 401, "unauthorized");
    if (caller.profile.role !== "admin") return fail("This is for site administrators.", 403, "forbidden");

    const body = await readBody(req);
    const stripe = stripeClient();
    switch (body.action) {
      case "add":         return await addMember(body);
      case "change_plan": return await changePlan(stripe, body);
      case "end":         return await endMembership(stripe, body);
      case "resume":      return await resume(stripe, body);
      case "list_codes":  return await listCodes(stripe);
      case "create_code": return stripe ? await createCode(stripe, body, caller.user.id) : needStripe();
      case "end_code":    return stripe ? await endCode(stripe, body) : needStripe();
      case "apply_code":  return stripe ? await applyCode(stripe, body) : needStripe();
      default:            return fail(`Unknown action "${body.action}".`);
    }
  } catch (err) {
    console.error("admin-membership error", err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
