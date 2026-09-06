// One Stripe client for every function, pinned to a single API version so the
// object shapes the code relies on (for example current_period_end living on
// the subscription item) do not change underneath us.
import Stripe from "npm:stripe@17.7.0";

export const API_VERSION = "2025-02-24.acacia";

/** Returns null when STRIPE_SECRET_KEY is not set, so callers can answer 503. */
export function stripeClient(): Stripe | null {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: API_VERSION,
    appInfo: { name: "Theraglee", url: "https://theraglee.com" },
  });
}

export type { Stripe };
