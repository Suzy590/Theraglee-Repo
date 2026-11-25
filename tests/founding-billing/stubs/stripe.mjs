// Stands in for npm:stripe@17.7.0 in tests/founding-billing/check.mjs:
// `new Stripe(key)` hands back whatever the test put on globalThis.
export default class Stripe {
  constructor() { return globalThis.__fakeStripe; }
}
