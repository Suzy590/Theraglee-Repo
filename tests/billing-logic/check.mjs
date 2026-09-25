// Exercises supabase/functions/_shared/billing.ts under plain Node — the
// module has no imports, so Node's built-in TypeScript stripping is enough.
//
//   node tests/billing-logic/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import {
  codeFitsRole, connectStatus, hasLiveStripeSub, keepsComp, parseDiscountInput, planChangeError,
  priceKeysForAudience, deadlineEnd, foundingOffer, identityStatusFor, isActive, isInterval,
  isStaleSubscription, isValidSessionFee, planForPrice, platformFee, priceKeyFor,
  safeReturnOrigin, subscriptionPatch,
} from "../../supabase/functions/_shared/billing.ts";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

test("isActive mirrors sub_active()", () => {
  assert.equal(isActive("active"), true);
  assert.equal(isActive("trialing"), true);
  assert.equal(isActive("past_due"), false);
  assert.equal(isActive("canceled"), false);
  assert.equal(isActive(null), false);
  // An admin-granted complimentary membership counts as active.
  assert.equal(isActive("comped"), true);
});

test("only a live Stripe subscription counts as paying through Stripe", () => {
  assert.equal(hasLiveStripeSub({ stripe_subscription_id: "sub_1", subscription_status: "active" }), true);
  assert.equal(hasLiveStripeSub({ stripe_subscription_id: "sub_1", subscription_status: "canceled" }), false);
  // A comp keeps the id of an old, ended subscription; that is not paying.
  assert.equal(hasLiveStripeSub({ stripe_subscription_id: "sub_1", subscription_status: "comped" }), false);
  assert.equal(hasLiveStripeSub({ stripe_subscription_id: null, subscription_status: "active" }), false);
});

test("late events for an ended subscription leave a comp alone", () => {
  assert.equal(keepsComp("comped", { id: "sub_old", status: "canceled" }), true);
  assert.equal(keepsComp("comped", { id: "sub_new", status: "active" }), false);
  assert.equal(keepsComp("active", { id: "sub_1", status: "canceled" }), false);
});

test("admins move members between Basic and Premium, therapists stay therapists", () => {
  assert.equal(planChangeError("member", "premium", "monthly"), null);
  assert.equal(planChangeError("member", "basic", "yearly"), null);
  assert.equal(planChangeError("therapist", "therapist", "yearly"), null);
  assert.ok(planChangeError("member", "therapist", "monthly"));
  assert.ok(planChangeError("therapist", "premium", "monthly"));
  assert.ok(planChangeError("member", "free", "monthly"));
  assert.ok(planChangeError("member", "basic", "founding"));
  assert.ok(planChangeError("admin", "premium", "monthly"));
});

test("discount codes: valid forms parse, bad ones say why", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const ok = parseDiscountInput({ code: " spring25 ", kind: "percent", value: "25", duration: "repeating",
    months: "3", audience: "member", max_redemptions: "50", expires_on: "2026-12-31" }, now);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { code: "SPRING25", percentOff: 25, amountOffCents: null, duration: "repeating",
    durationInMonths: 3, audience: "member", maxRedemptions: 50,
    expiresAt: Date.UTC(2026, 11, 31, 23, 59, 59, 999) / 1000 | 0 });

  const amt = parseDiscountInput({ code: "TEN", kind: "amount", value: "9.99", duration: "forever" }, now);
  assert.equal(amt.ok, true);
  assert.equal(amt.value.amountOffCents, 999);
  assert.equal(amt.value.audience, "all");
  assert.equal(amt.value.maxRedemptions, null);
  assert.equal(amt.value.expiresAt, null);
  assert.equal(amt.value.durationInMonths, null);

  const bad = (b) => assert.equal(parseDiscountInput({ code: "OK123", kind: "percent", value: 10,
    duration: "once", ...b }, now).ok, false);
  bad({ code: "no spaces" });
  bad({ code: "AB" });
  bad({ value: 0 });
  bad({ value: 101 });
  bad({ value: 12.5 });
  bad({ kind: "amount", value: "0" });
  bad({ kind: "amount", value: "1000.01" });
  bad({ kind: "free" });
  bad({ duration: "weekly" });
  bad({ duration: "repeating", months: 0 });
  bad({ audience: "everyone" });
  bad({ max_redemptions: "0" });
  bad({ expires_on: "2026-09-24" });
  bad({ expires_on: "tomorrow" });
});

test("a code's audience decides who may use it and which prices it covers", () => {
  assert.equal(codeFitsRole("all", "therapist"), true);
  assert.equal(codeFitsRole("member", "member"), true);
  assert.equal(codeFitsRole("member", "therapist"), false);
  assert.equal(codeFitsRole("therapist", "member"), false);
  assert.deepEqual(priceKeysForAudience("therapist"),
    ["price_therapist_monthly", "price_therapist_yearly", "price_therapist_founding"]);
  assert.deepEqual(priceKeysForAudience("member"),
    ["price_basic_monthly", "price_basic_yearly", "price_premium_monthly", "price_premium_yearly"]);
  assert.equal(priceKeysForAudience("all").length, 7);
});

test("price keys follow the admin screen's names", () => {
  assert.equal(priceKeyFor("basic", "monthly"), "price_basic_monthly");
  assert.equal(priceKeyFor("therapist", "yearly"), "price_therapist_yearly");
  assert.equal(priceKeyFor("therapist", "founding"), "price_therapist_founding");
  // Only therapists have a founding rate.
  assert.equal(priceKeyFor("basic", "founding"), null);
  assert.equal(priceKeyFor("premium", "founding"), null);
});

test("isInterval accepts the three billing choices and nothing else", () => {
  assert.equal(isInterval("monthly"), true);
  assert.equal(isInterval("yearly"), true);
  assert.equal(isInterval("founding"), true);
  assert.equal(isInterval("weekly"), false);
  assert.equal(isInterval(undefined), false);
});

const cfg = {
  price_basic_monthly: "price_b_m", price_basic_yearly: "price_b_y",
  price_premium_monthly: "price_p_m", price_premium_yearly: "",
  price_therapist_monthly: "price_t_m", price_therapist_yearly: "price_t_y",
  price_therapist_founding: "price_t_f",
};

test("planForPrice finds the plan for a price id and ignores blanks", () => {
  assert.equal(planForPrice(cfg, "price_b_y"), "basic");
  assert.equal(planForPrice(cfg, "price_p_m"), "premium");
  assert.equal(planForPrice(cfg, "price_t_y"), "therapist");
  assert.equal(planForPrice(cfg, "price_t_f"), "therapist");
  assert.equal(planForPrice(cfg, ""), null);
  assert.equal(planForPrice(cfg, "price_unknown"), null);
  // A blank founding price never matches an empty id.
  assert.equal(planForPrice({ ...cfg, price_therapist_founding: "" }, ""), null);
});

test("deadlineEnd is the end of the day, UTC, and rejects junk", () => {
  assert.equal(deadlineEnd("2026-12-31").toISOString(), "2026-12-31T23:59:59.999Z");
  assert.equal(deadlineEnd(" 2026-12-31 ").toISOString(), "2026-12-31T23:59:59.999Z");
  assert.equal(deadlineEnd(""), null);
  assert.equal(deadlineEnd(null), null);
  assert.equal(deadlineEnd("12/31/2026"), null);
  assert.equal(deadlineEnd("soon"), null);
});

const founding = (over = {}) => ({
  founding_enabled: "true", price_therapist_founding: "price_t_f",
  display_therapist_founding: "20", founding_spots: "150", founding_deadline: "2026-12-31",
  ...over,
});
const before = new Date("2026-09-18T12:00:00Z");
const after = new Date("2027-01-01T00:00:00Z");

test("the founding offer is open only with the switch on, a price, and time left", () => {
  const open = foundingOffer(founding(), before);
  assert.equal(open.open, true);
  assert.equal(open.closedBecause, null);
  assert.equal(open.priceId, "price_t_f");
  assert.equal(open.rate, "20");
  assert.equal(open.spots, 150);
  assert.equal(open.deadline, "2026-12-31");

  const off = foundingOffer(founding({ founding_enabled: "false" }), before);
  assert.equal(off.open, false);
  assert.equal(off.closedBecause, "off");
  assert.equal(foundingOffer(founding({ founding_enabled: "" }), before).closedBecause, "off");
  assert.equal(foundingOffer({}, before).closedBecause, "off");

  const noPrice = foundingOffer(founding({ price_therapist_founding: "  " }), before);
  assert.equal(noPrice.open, false);
  assert.equal(noPrice.closedBecause, "no_price");

  const expired = foundingOffer(founding(), after);
  assert.equal(expired.open, false);
  assert.equal(expired.closedBecause, "expired");
  // Still open on the last day itself.
  assert.equal(foundingOffer(founding(), new Date("2026-12-31T23:00:00Z")).open, true);
});

test("a blank deadline never expires and a blank or bad cap means no cap", () => {
  assert.equal(foundingOffer(founding({ founding_deadline: "" }), after).open, true);
  assert.equal(foundingOffer(founding({ founding_deadline: "whenever" }), after).open, true);
  assert.equal(foundingOffer(founding({ founding_spots: "" }), before).spots, null);
  assert.equal(foundingOffer(founding({ founding_spots: "0" }), before).spots, null);
  assert.equal(foundingOffer(founding({ founding_spots: "lots" }), before).spots, null);
  assert.equal(foundingOffer(founding({ founding_spots: " 25 " }), before).spots, 25);
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
