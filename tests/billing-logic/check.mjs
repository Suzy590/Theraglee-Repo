// Exercises supabase/functions/_shared/billing.ts under plain Node — the
// module has no imports, so Node's built-in TypeScript stripping is enough.
//
//   node tests/billing-logic/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import {
  connectStatus, identityStatusFor, isActive, isStaleSubscription, isValidSessionFee,
  planForPrice, platformFee, priceKeyFor, safeReturnOrigin, subscriptionPatch,
} from "../../supabase/functions/_shared/billing.ts";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

test("isActive mirrors sub_active()", () => {
  assert.equal(isActive("active"), true);
  assert.equal(isActive("trialing"), true);
  assert.equal(isActive("past_due"), false);
  assert.equal(isActive("canceled"), false);
  assert.equal(isActive(null), false);
});

test("price keys follow the admin screen's names", () => {
  assert.equal(priceKeyFor("basic", "monthly"), "price_basic_monthly");
  assert.equal(priceKeyFor("therapist", "yearly"), "price_therapist_yearly");
});

const cfg = {
  price_basic_monthly: "price_b_m", price_basic_yearly: "price_b_y",
  price_premium_monthly: "price_p_m", price_premium_yearly: "",
  price_therapist_monthly: "price_t_m", price_therapist_yearly: "price_t_y",
};

test("planForPrice finds the plan for a price id and ignores blanks", () => {
  assert.equal(planForPrice(cfg, "price_b_y"), "basic");
  assert.equal(planForPrice(cfg, "price_p_m"), "premium");
  assert.equal(planForPrice(cfg, "price_t_y"), "therapist");
  assert.equal(planForPrice(cfg, ""), null);
  assert.equal(planForPrice(cfg, "price_unknown"), null);
});

const sub = (over = {}) => ({
  id: "sub_1", status: "active", cancel_at_period_end: false,
  items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_b_m" } }] },
  ...over,
});

test("an active member subscription sets the tier", () => {
  const { patch, unpublishTherapist } = subscriptionPatch(sub(), "cus_1", "basic");
  assert.equal(patch.tier, "basic");
  assert.equal(patch.subscription_status, "active");
  assert.equal(patch.current_period_end, new Date(1_800_000_000 * 1000).toISOString());
  assert.equal(unpublishTherapist, false);
});

test("a lapsed member subscription drops to free", () => {
  const { patch } = subscriptionPatch(sub({ status: "canceled" }), "cus_1", "premium");
  assert.equal(patch.tier, "free");
});

test("period end is read from the subscription when present", () => {
  const { patch } = subscriptionPatch(sub({ current_period_end: 1_700_000_000 }), "cus_1", "basic");
  assert.equal(patch.current_period_end, new Date(1_700_000_000 * 1000).toISOString());
});

test("therapist subscriptions confirm the role and unpublish when lapsed", () => {
  const live = subscriptionPatch(sub(), "cus_1", "therapist");
  assert.equal(live.patch.role, "therapist");
  assert.equal("tier" in live.patch, false);
  assert.equal(live.unpublishTherapist, false);
  const gone = subscriptionPatch(sub({ status: "unpaid" }), "cus_1", "therapist");
  assert.equal(gone.unpublishTherapist, true);
});

test("an unknown plan never downgrades a live subscription", () => {
  assert.equal("tier" in subscriptionPatch(sub(), "cus_1", null).patch, false);
  assert.equal(subscriptionPatch(sub({ status: "canceled" }), "cus_1", null).patch.tier, "free");
});

test("stale events for a superseded subscription are ignored", () => {
  assert.equal(isStaleSubscription("sub_2", sub({ status: "canceled" })), true);
  assert.equal(isStaleSubscription("sub_2", sub({ status: "active" })), false);
  assert.equal(isStaleSubscription("sub_1", sub({ status: "canceled" })), false);
  assert.equal(isStaleSubscription(null, sub({ status: "canceled" })), false);
});

test("connect status collapses the account into one word", () => {
  assert.equal(connectStatus({ charges_enabled: true, payouts_enabled: true }), "enabled");
  assert.equal(connectStatus({ charges_enabled: false, details_submitted: false }), "onboarding");
  assert.equal(connectStatus({ charges_enabled: false, details_submitted: true }), "restricted");
  assert.equal(connectStatus({ charges_enabled: true, payouts_enabled: false,
    requirements: { disabled_reason: "requirements.past_due" } }), "restricted");
});

test("platform fee is a percentage with a floor, capped at the amount", () => {
  assert.equal(platformFee(10_000, 10, 100), 1_000);
  assert.equal(platformFee(500, 10, 100), 100);
  assert.equal(platformFee(50, 10, 100), 50);
  assert.equal(platformFee(10_000, 0, 0), 0);
  assert.equal(platformFee(0, 10, 100), 0);
  assert.equal(platformFee(10_000, NaN, NaN), 0);
});

test("session fee bounds", () => {
  assert.equal(isValidSessionFee(500), true);
  assert.equal(isValidSessionFee(100_000), true);
  assert.equal(isValidSessionFee(499), false);
  assert.equal(isValidSessionFee(12.5), false);
  assert.equal(isValidSessionFee(null), false);
});

test("identity statuses map onto the stored column", () => {
  assert.equal(identityStatusFor("verified"), "verified");
  assert.equal(identityStatusFor("requires_input"), "requires_input");
  assert.equal(identityStatusFor("processing"), "pending");
  assert.equal(identityStatusFor("canceled"), "canceled");
  assert.equal(identityStatusFor(undefined), "pending");
});

test("only origins we own are used as return targets", () => {
  const allowed = ["https://theraglee.com", "https://theraglee-site.vercel.app/"];
  assert.equal(safeReturnOrigin("https://theraglee.com", allowed), "https://theraglee.com");
  assert.equal(safeReturnOrigin("https://theraglee-site.vercel.app/x", allowed), "https://theraglee-site.vercel.app");
  assert.equal(safeReturnOrigin("https://evil.example", allowed), null);
  assert.equal(safeReturnOrigin("https://theraglee.com.evil.example", allowed), null);
  assert.equal(safeReturnOrigin("not a url", allowed), null);
  assert.equal(safeReturnOrigin(null, allowed), null);
});

console.log(`\n${n} checks passed`);
