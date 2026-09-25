// Pure billing logic shared by the Stripe Edge Functions.
//
// Deliberately has no imports, so `tests/billing-logic/check.mjs` can load it
// under plain Node and exercise every branch without Deno, Supabase or Stripe.

/**
 * `comped` is not a Stripe status: it marks a complimentary membership an
 * admin granted from /admin.html, with no subscription behind it.
 */
export const COMPED = "comped";
export const ACTIVE_STATUSES = ["active", "trialing", COMPED] as const;

/** Mirrors `public.sub_active()` in Postgres — keep the two in step. */
export const isActive = (status: string | null | undefined): boolean =>
  !!status && (ACTIVE_STATUSES as readonly string[]).includes(status);

/** Whether a profile is paying through a live Stripe subscription (as
 *  opposed to a complimentary membership, or none). */
export const hasLiveStripeSub = (
  p: { stripe_subscription_id?: string | null; subscription_status?: string | null },
): boolean => !!p.stripe_subscription_id && p.subscription_status !== COMPED && isActive(p.subscription_status);

export type PlanKey = "basic" | "premium" | "therapist";
/** `founding` is the therapist founding-member rate: monthly billing at a
 *  locked-in price, sold only while the offer is open (see `foundingOffer`). */
export type Interval = "monthly" | "yearly" | "founding";

/**
 * The three paid plans. `taxCode` is the Stripe Tax product tax code each
 * product should carry in the Dashboard:
 *   txcd_10103000  Software as a service (SaaS) — personal use
 *   txcd_10103001  Software as a service (SaaS) — business use
 * (Not the "electronic download" variants txcd_10103100/101: nothing is downloaded.)
 */
export const PLANS: Record<PlanKey, {
  monthly: string; yearly: string; founding?: string; audience: "member" | "therapist"; taxCode: string;
}> = {
  basic:     { monthly: "price_basic_monthly",     yearly: "price_basic_yearly",     audience: "member",    taxCode: "txcd_10103000" },
  premium:   { monthly: "price_premium_monthly",   yearly: "price_premium_yearly",   audience: "member",    taxCode: "txcd_10103000" },
  therapist: { monthly: "price_therapist_monthly", yearly: "price_therapist_yearly",
               founding: "price_therapist_founding", audience: "therapist", taxCode: "txcd_10103001" },
};

export const isPlanKey = (k: unknown): k is PlanKey =>
  typeof k === "string" && Object.prototype.hasOwnProperty.call(PLANS, k);

export const isInterval = (k: unknown): k is Interval =>
  k === "monthly" || k === "yearly" || k === "founding";

/**
 * app_config key holding the Stripe price id for a plan + interval. Returns
 * null for a combination that does not exist (only therapists have a
 * founding rate).
 */
export const priceKeyFor = (plan: PlanKey, interval: Interval): string | null =>
  interval === "yearly" ? PLANS[plan].yearly
  : interval === "founding" ? (PLANS[plan].founding ?? null)
  : PLANS[plan].monthly;

/** Reverse lookup: which plan does this price id belong to? */
export function planForPrice(config: Record<string, string>, priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PLANS) as PlanKey[]) {
    const p = PLANS[plan];
    const keys = [p.monthly, p.yearly, ...(p.founding ? [p.founding] : [])];
    if (keys.some((k) => config[k] === priceId)) return plan;
  }
  return null;
}

/* ------------------------------------------------------ Founding offer */

/**
 * The therapist founding-member offer, as the admin screen stores it:
 *   founding_enabled            'true' | 'false'  — the switch
 *   price_therapist_founding    the Stripe price id (monthly, the locked-in rate)
 *   display_therapist_founding  the dollar amount shown on the site
 *   founding_spots              how many therapists may take it ('' = no cap)
 *   founding_deadline           last day to join, YYYY-MM-DD ('' = no deadline)
 *
 * `open` is what the site and the checkout act on. `closedBecause` says why
 * it is not open: `off` (switch), `no_price` (nothing pasted yet) or
 * `expired` (deadline passed). The cap on spots is enforced separately by
 * the checkout, which counts live subscriptions on the founding price.
 */
export interface FoundingOffer {
  open: boolean;
  closedBecause: "off" | "no_price" | "expired" | null;
  priceId: string;
  rate: string;
  spots: number | null;
  deadline: string;
}

/** Parses YYYY-MM-DD as the end of that day in UTC; null when unset or malformed. */
export function deadlineEnd(deadline: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((deadline ?? "").trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function foundingOffer(config: Record<string, string>, now: Date = new Date()): FoundingOffer {
  const priceId = (config.price_therapist_founding ?? "").trim();
  const spotsRaw = parseInt(config.founding_spots ?? "", 10);
  const spots = Number.isFinite(spotsRaw) && spotsRaw > 0 ? spotsRaw : null;
  const deadline = (config.founding_deadline ?? "").trim();
  const end = deadlineEnd(deadline);

  let closedBecause: FoundingOffer["closedBecause"] = null;
  if (config.founding_enabled !== "true") closedBecause = "off";
  else if (!priceId) closedBecause = "no_price";
  else if (end && now.getTime() > end.getTime()) closedBecause = "expired";

  return {
    open: closedBecause === null,
    closedBecause,
    priceId,
    rate: (config.display_therapist_founding ?? "").trim(),
    spots,
    deadline,
  };
}

/** The subset of a Stripe Subscription the sync logic needs. */
export interface SubscriptionLike {
  id: string;
  status: string;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null; price?: { id?: string } }> } | null;
}

export interface SubscriptionSync {
  patch: Record<string, unknown>;
  unpublishTherapist: boolean;
}

/**
 * Turns a subscription into the `profiles` row update.
 *
 * - An active therapist subscription confirms the therapist role; a lapsed one
 *   also pulls the public listing down.
 * - An active member subscription sets the tier; a lapsed one drops to free.
 * - A subscription whose plan cannot be identified is treated as lapsed only
 *   when it is no longer active, so an unknown-but-live subscription never
 *   downgrades anyone by accident.
 */
export function subscriptionPatch(sub: SubscriptionLike, customerId: string, plan: PlanKey | null): SubscriptionSync {
  const live = isActive(sub.status);
  // current_period_end moved onto the subscription item in newer API versions.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;

  const patch: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };

  let unpublishTherapist = false;
  if (plan === "therapist") {
    patch.role = "therapist";
    unpublishTherapist = !live;
  } else if (plan) {
    patch.tier = live ? plan : "free";
  } else if (!live) {
    patch.tier = "free";
  }
  return { patch, unpublishTherapist };
}

/**
 * Whether an incoming subscription event should be ignored because the member
 * already moved on to a different subscription (for example the old one's
 * `deleted` event arriving after the new one's `created`).
 */
export const isStaleSubscription = (
  currentSubscriptionId: string | null | undefined, sub: SubscriptionLike,
): boolean => !!currentSubscriptionId && currentSubscriptionId !== sub.id && !isActive(sub.status);

/**
 * Whether a subscription event must leave a complimentary membership alone:
 * a late event for an old, ended subscription should not take away access an
 * admin granted since. A live subscription still wins — the member paid.
 */
export const keepsComp = (
  currentStatus: string | null | undefined, sub: SubscriptionLike,
): boolean => currentStatus === COMPED && !isActive(sub.status);

/* ------------------------------------------------------- Admin changes */

export type MemberPlan = "free" | "basic" | "premium";

/**
 * Which plan an admin may put an account on. Members move between Basic and
 * Premium; therapists have the one therapist plan. Admin accounts are never
 * changed from the screen. Returns an error message, or null when allowed.
 */
export function planChangeError(role: string, plan: unknown, interval: unknown): string | null {
  if (role === "admin") return "Admin accounts are not managed from this screen.";
  if (interval !== "monthly" && interval !== "yearly") return "Pick monthly or yearly.";
  if (role === "therapist") return plan === "therapist" ? null : "Therapist accounts can only be on the therapist plan.";
  if (plan === "basic" || plan === "premium") return null;
  return plan === "therapist" ? "Member accounts cannot be put on the therapist plan." : "Pick Basic or Premium.";
}

/* ------------------------------------------------------ Discount codes */

export type CodeAudience = "all" | "member" | "therapist";
export type CodeDuration = "once" | "repeating" | "forever";

export interface DiscountInput {
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
  duration: CodeDuration;
  durationInMonths: number | null;
  audience: CodeAudience;
  maxRedemptions: number | null;
  /** Unix seconds (end of the chosen day, UTC), or null for no expiry. */
  expiresAt: number | null;
}

const intIn = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

/** Stripe promotion codes are letters and digits; we store them upper case. */
export const normalizeCode = (v: unknown): string =>
  typeof v === "string" ? v.trim().toUpperCase() : "";

export const isValidCode = (code: string): boolean => /^[A-Z0-9]{3,30}$/.test(code);

/**
 * Validates the admin's "new discount code" form. `kind` is percent or
 * amount; `value` is the percent (1–100) or the dollars off (whole or cents).
 */
export function parseDiscountInput(
  body: Record<string, unknown>, now: Date = new Date(),
): { ok: true; value: DiscountInput } | { ok: false; message: string } {
  const code = normalizeCode(body.code);
  if (!isValidCode(code)) return { ok: false, message: "Codes are 3 to 30 letters and numbers, no spaces." };

  let percentOff: number | null = null, amountOffCents: number | null = null;
  if (body.kind === "percent") {
    percentOff = intIn(body.value, 1, 100);
    if (percentOff === null) return { ok: false, message: "A percent off is a whole number from 1 to 100." };
  } else if (body.kind === "amount") {
    const dollars = typeof body.value === "number" ? body.value : Number(String(body.value ?? "").trim() || NaN);
    const cents = Math.round(dollars * 100);
    if (!Number.isFinite(dollars) || cents < 1 || cents > 100_000) {
      return { ok: false, message: "A dollar amount off is from $0.01 to $1,000." };
    }
    amountOffCents = cents;
  } else return { ok: false, message: "Pick a percent or a dollar amount off." };

  const duration = body.duration;
  if (duration !== "once" && duration !== "repeating" && duration !== "forever") {
    return { ok: false, message: "Pick how long the discount lasts." };
  }
  const durationInMonths = duration === "repeating" ? intIn(body.months, 1, 36) : null;
  if (duration === "repeating" && durationInMonths === null) {
    return { ok: false, message: "A discount for a number of months lasts 1 to 36 months." };
  }

  const audience = body.audience ?? "all";
  if (audience !== "all" && audience !== "member" && audience !== "therapist") {
    return { ok: false, message: "Pick who the code is for." };
  }

  const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
  const maxRedemptions = blank(body.max_redemptions) ? null : intIn(body.max_redemptions, 1, 1_000_000);
  if (!blank(body.max_redemptions) && maxRedemptions === null) {
    return { ok: false, message: "The number of uses is a whole number, 1 or more." };
  }

  let expiresAt: number | null = null;
  if (!blank(body.expires_on)) {
    const end = deadlineEnd(String(body.expires_on));
    if (!end) return { ok: false, message: "The last day to use it is a date (YYYY-MM-DD)." };
    if (end.getTime() <= now.getTime()) return { ok: false, message: "The last day to use it has already passed." };
    expiresAt = Math.floor(end.getTime() / 1000);
  }

  return { ok: true, value: {
    code, percentOff, amountOffCents, duration, durationInMonths,
    audience: audience as CodeAudience, maxRedemptions, expiresAt,
  } };
}

/** Whether a code made for `audience` may be used on an account with `role`. */
export const codeFitsRole = (audience: string, role: string): boolean =>
  audience === "all" || (audience === "therapist" ? role === "therapist" : role !== "therapist");

/** The app_config price keys a code for `audience` should be limited to. */
export function priceKeysForAudience(audience: CodeAudience): string[] {
  const plans = (Object.keys(PLANS) as PlanKey[])
    .filter((k) => audience === "all" || PLANS[k].audience === audience);
  return plans.flatMap((k) => [PLANS[k].monthly, PLANS[k].yearly, ...(PLANS[k].founding ? [PLANS[k].founding!] : [])]);
}

/* ----------------------------------------------------------- Connect */

export type ConnectStatus = "none" | "onboarding" | "enabled" | "restricted";

export interface AccountLike {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: { disabled_reason?: string | null; currently_due?: string[] | null } | null;
}

/** Collapses a connected account into the one word the dashboard shows. */
export function connectStatus(acct: AccountLike): ConnectStatus {
  if (acct.charges_enabled && acct.payouts_enabled) return "enabled";
  if (acct.requirements?.disabled_reason) return "restricted";
  if (acct.details_submitted && !acct.charges_enabled) return "restricted";
  return "onboarding";
}

/**
 * Theraglee's cut of a session payment, in cents. A percentage with a floor,
 * never more than the payment itself.
 */
export function platformFee(amountCents: number, percent: number, minCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const pct = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  const floor = Number.isFinite(minCents) ? Math.max(0, minCents) : 0;
  return Math.min(amountCents, Math.max(floor, Math.round(amountCents * pct / 100)));
}

export const SESSION_FEE_MIN_CENTS = 500;      // $5
export const SESSION_FEE_MAX_CENTS = 100_000;  // $1,000

export const isValidSessionFee = (cents: unknown): cents is number =>
  Number.isInteger(cents) && (cents as number) >= SESSION_FEE_MIN_CENTS && (cents as number) <= SESSION_FEE_MAX_CENTS;

/* ---------------------------------------------------------- Identity */

export type IdentityStatus = "unverified" | "pending" | "verified" | "requires_input" | "canceled";

/** Maps a Stripe VerificationSession status onto the column we store. */
export function identityStatusFor(sessionStatus: string | null | undefined): IdentityStatus {
  switch (sessionStatus) {
    case "verified": return "verified";
    case "requires_input": return "requires_input";
    case "canceled": return "canceled";
    case "processing": return "pending";
    default: return "pending";
  }
}

/* ---------------------------------------------------------- Redirects */

/**
 * Only ever send someone back to an origin we own. Returns the origin (no
 * trailing slash) when `candidate` is on the allow-list, otherwise null.
 */
export function safeReturnOrigin(candidate: unknown, allowed: string[]): string | null {
  if (typeof candidate !== "string" || !candidate) return null;
  let origin: string;
  try { origin = new URL(candidate).origin; } catch { return null; }
  if (origin === "null") return null;
  return allowed.some((a) => a.replace(/\/+$/, "") === origin) ? origin : null;
}

/** Idempotency-key bucket: the same key for the same minute, so a double click
 *  replays the first response instead of creating a second object. */
export const minuteBucket = (now = Date.now()): number => Math.floor(now / 60_000);
