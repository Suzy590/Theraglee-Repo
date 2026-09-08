# Stripe at Theraglee

This is the guide to everything money-related on the site: what Stripe does for
Theraglee, where the code lives, and the step-by-step to switch it on.

If you only read one thing, read **Switching it on**, in order. Nothing charges
anyone until the last step.

## What Stripe does for Theraglee

| Stripe product | What it does here | Where |
|---|---|---|
| **Billing + Payments** | The Basic, Premium and Therapist memberships. Stripe's hosted Checkout page takes the card, Stripe bills it every month or year, and the member manages or cancels from Stripe's hosted billing portal. | `stripe-checkout`, `stripe-portal`, `stripe-webhook` |
| **Tax** | Works out and collects US sales tax on memberships, state by state, once you tell Stripe where you are registered. | `stripe-checkout` (`stripe_tax_enabled` switch) |
| **Identity** | A therapist photographs their government ID and takes a selfie before their listing can publish, so the person holding the license is the person on the profile. Theraglee never sees the document. | `stripe-identity`, `stripe-webhook`, publish guard in Postgres |
| **Radar** | Stripe's fraud screening on every card. Runs on its own; rules live in the Dashboard. Early warnings and disputes are written to `billing_alerts`. | `stripe-webhook` |
| **Connect** | A client pays a verified therapist for a session from the therapist's profile. Theraglee keeps a percentage and Stripe pays the rest into the therapist's own bank account. | `stripe-connect`, `stripe-session-checkout`, `stripe-webhook` |

The plan behind these choices came from Stripe's own integration planner, run
with Theraglee's description. In its words: web, not mobile; hosted Checkout
rather than a custom form; flat-rate prices; freemium (a free tier with no card,
paid tiers above it); the Customer Portal for self-service; Smart Retries plus
Stripe's failed-payment emails for recovery; Stripe Tax with collection. That is
exactly the shape of what is built.

## Where the code lives

```
supabase/
  config.toml                       per-function settings for the Supabase CLI
  migrations/
    20260906230000_stripe_tax_identity_connect.sql
  functions/
    _shared/
      billing.ts                    the pure decisions (which plan, which tier,
                                    fee maths) — tested by tests/billing-logic
      supabase.ts, stripe.ts, http.ts
    stripe-checkout/                member or therapist buys a membership
    stripe-portal/                  manage / cancel a membership
    stripe-webhook/                 Stripe tells us what happened; we update Postgres
    stripe-identity/                therapist ID check
    stripe-connect/                 therapist payout account
    stripe-session-checkout/        client pays a therapist
site/
  assets/app.js                     startCheckout, openPortal, startIdentity,
                                    connectAction, startSessionPayment
  pricing.html, account.html        member side
  therapist-dashboard.html          therapist side (Membership tab)
  therapist.html                    "Pay for a session" button
  admin.html                        price IDs and the on/off switches
```

Until this change the three original functions existed only inside Supabase.
They are now in the repository, so a change is reviewed here first and deployed
from here.

Run the logic tests with:

```bash
node tests/billing-logic/check.mjs
```

## How a membership flows

1. A signed-in member clicks a plan on `pricing.html`. The browser calls
   `stripe-checkout` with the plan and interval.
2. The function checks the account type matches the plan, finds (or creates)
   the member's Stripe customer, and creates a Checkout Session. If the member
   already has a live subscription it opens the billing portal's "change plan"
   flow instead, so nobody pays for two memberships.
3. Stripe hosts the payment page and sends the member back to `account.html`
   (or the therapist dashboard).
4. Stripe posts `checkout.session.completed` and the subscription events to
   `stripe-webhook`. The webhook checks the signature, re-reads the subscription
   from Stripe (so events arriving out of order cannot roll a member backwards),
   and updates `profiles`: tier, status, renewal date. For a therapist, a lapsed
   subscription also unpublishes the listing.
5. Access is decided by the database from those columns
   (`level_for()`), never by the browser.

Every event lands in `stripe_events`. A row is marked `processed_at` only after
its handler succeeds, so a delivery that failed is retried by Stripe rather than
being mistaken for a duplicate.

## What changed from the first version

The original integration was sound: hosted Checkout, the portal, a signed
webhook with an idempotency table. Reviewing it against Stripe's plan turned up
these gaps, all fixed in this change:

- **A failed webhook was lost.** The event was recorded *before* it was handled,
  so if the handler crashed, Stripe's retry was answered "duplicate" and the
  member never got their upgrade. Now the record is marked processed only on
  success.
- **A second checkout sold a second subscription.** A member with a live plan
  who clicked another plan would have ended up with two. They now go to the
  portal to switch.
- **Out-of-order events could downgrade someone.** The old subscription's
  `deleted` event arriving after the new one's `created` would have dropped the
  member to free. The webhook now re-reads the current subscription and ignores
  events for a subscription the member has moved on from.
- **The license checker's automatic path did nothing.** The Edge Functions write
  with Supabase's service role, and the publish guard treated that as "not an
  admin" and silently discarded the change. The guard now lets the service role
  through. (Service-role keys never leave the server.)
- **Return URLs were trusted.** Any origin the browser sent was used as the
  success URL. Only origins Theraglee owns are accepted now.
- **No tax, no idempotency keys, no customer address.** Added: Stripe Tax with
  address collection behind a switch, idempotency keys on every create call,
  `client_reference_id` and metadata on every object.
- **Payments could be started with the switch off.** The "Accept payments"
  switch was only checked in the browser. The function checks it too (admins
  are let through so you can test before opening the doors).

## Switching it on

Do these in order. Each step is a few minutes. Steps 1–6 get memberships
working; 7–10 add Tax, Radar, Identity and Connect.

### 0. Pick the right Stripe account

The Stripe account connected to the assistant during this work is named
**AssignRemind**, and it is a live account. If Theraglee should bill under its
own name, create a separate Stripe account for Theraglee (or rename this one)
before going further — the business name, statement descriptor and support
email on the account are what members see on their card statements.

Whichever account you use, do everything below in a **sandbox** first
(Dashboard → the account switcher → *Sandboxes*). A sandbox has its own keys
and its own webhook secrets; nothing in it is real money.

### 1. Apply the database migration

> **Done on 2026-09-06.** The migration is applied to the live project; only
> repeat this if you restore the database from an older backup.

Open the Supabase Dashboard → **SQL Editor**, paste the whole of
`supabase/migrations/20260906230000_stripe_tax_identity_connect.sql`, and run
it. It only adds columns, tables and switches — nothing is removed. (Or ask the
assistant to apply it for you.)

### 2. Deploy the six functions

> **Done on 2026-09-06.** All six functions are deployed (checkout, portal and
> webhook as version 2; identity, connect and session-checkout as version 1).
> Repeat this whenever the code in `supabase/functions/` changes.

With the Supabase CLI installed and signed in:

```bash
supabase link --project-ref oekqzuguruyqkafsqhos
supabase functions deploy stripe-checkout stripe-portal stripe-webhook \
  stripe-identity stripe-connect stripe-session-checkout
```

`supabase/config.toml` already carries the per-function settings (JWT checks
are done inside the functions, as before).

### 3. Set the secrets

Supabase Dashboard → **Edge Functions → Secrets**:

| Secret | Where it comes from |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → *Secret key* (`sk_test_…` in a sandbox, `sk_live_…` live) |
| `STRIPE_WEBHOOK_SECRET` | Step 5, the first endpoint |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Step 5, the second endpoint (only needed for Connect) |
| `SITE_URL` | `https://theraglee.com` |
| `ALLOWED_ORIGINS` | Optional. Extra origins allowed to start a checkout, comma separated, for preview deployments. |

### 4. Create the products and paste the price IDs

Stripe Dashboard → **Product catalog → Add product**, six prices in three
products:

| Product | Prices | Tax code (Step 7) |
|---|---|---|
| Theraglee Basic | monthly, yearly | *Software as a service (SaaS) – personal use* (`txcd_10103001`) |
| Theraglee Premium | monthly, yearly | same |
| Theraglee Therapist membership | monthly, yearly | *Software as a service (SaaS) – business use* (`txcd_10103000`) |

Each price has an ID starting `price_`. Paste the six IDs into
`/admin.html` → **Stripe setup**, and check the shown prices in the same screen
match. Save.

### 5. Point Stripe at the webhook

Stripe Dashboard → **Developers → Webhooks → Add endpoint**.

**Endpoint 1 — your account.** URL:
`https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/stripe-webhook`.
Select these events:

```
checkout.session.completed
checkout.session.async_payment_succeeded
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
invoice.paid
invoice.payment_failed
invoice.payment_action_required
identity.verification_session.verified
identity.verification_session.requires_input
identity.verification_session.processing
identity.verification_session.canceled
charge.refunded
charge.dispute.created
radar.early_fraud_warning.created
```

Copy its *Signing secret* into `STRIPE_WEBHOOK_SECRET`.

**Endpoint 2 — connected accounts** (Connect only). Same URL, but choose
*Listen to events on Connected accounts*, and select `account.updated`. Copy its
signing secret into `STRIPE_CONNECT_WEBHOOK_SECRET`.

### 6. Turn on the billing portal, then test a membership

Stripe Dashboard → **Settings → Billing → Customer portal**: allow customers to
update payment methods, cancel (at the end of the period), and switch between
the three membership products. Save.

Now, signed in as the admin, go to `/pricing.html` and buy a plan with a test
card (`4242 4242 4242 4242`, any future date, any CVC). Admins can check out
even while "Accept payments" is off. You should land back on your account page
as a paid member within a few seconds; the Membership tab shows the renewal
date and a **Manage billing** button.

When that works: `/admin.html` → **Stripe setup** → tick **Accept payments** →
Save. Memberships are live.

### 7. Stripe Tax

1. Dashboard → **Tax → Get started**: confirm the origin address and pick the
   default product tax category (*SaaS – personal use*).
2. **Registrations**: add each state where Theraglee is registered to collect
   sales tax. Stripe's threshold monitoring tells you when a new state comes due.
3. Put the tax codes from Step 4 on the three products.
4. `/admin.html` → tick **Collect sales tax with Stripe Tax** → Save.

Checkout then asks for a billing address and adds the right tax. Leave the
switch off until the Dashboard side is done, or checkout will refuse to open.

### 8. Radar

Radar is on for every card already. Two rules worth adding under
**Radar → Rules** (the free tier allows them):

- *Block if* `:cvc_check: = 'fail'`
- *Request 3D Secure if* `:risk_level: = 'elevated'`

Disputes and early-fraud warnings appear in the `billing_alerts` table; a
refund issued within a day of an early-fraud warning usually prevents the
dispute.

### 9. Stripe Identity

1. Dashboard → **Identity → Get started** and complete the short application.
   Identity is priced per check (about $1.50, plus the selfie).
2. Once approved, therapists see **Verify my identity** on their Membership
   tab. The result is stored on their profile and shows in the admin queue.
3. When you want the check to be mandatory: `/admin.html` → tick **Require the
   Stripe Identity check before a listing publishes** → Save. From then on a
   listing cannot go live without a passed check, and the therapist dashboard
   says so.

### 10. Stripe Connect (session payments)

1. Dashboard → **Connect → Get started**: complete the platform profile and the
   branding for the onboarding form (name, color, icon).
2. Create the second webhook endpoint from Step 5.
3. `/admin.html`: set **Theraglee keeps (%)** and the minimum, tick **Let
   therapists take session payments**, Save.

A verified therapist then sees **Set up payouts** on their Membership tab.
Stripe collects their bank details and identity (this is separate from Step 9,
and required by law for anyone receiving payouts). Once Stripe reports the
account as ready, the therapist sets a session price and ticks *Show "Pay for a
session" on my profile*; the button appears on their public page.

Money flow: the client pays on a Stripe page; Stripe moves the amount minus
Theraglee's fee to the therapist's balance and pays it out on Stripe's normal
schedule. Every payment is a row in `session_payments`, visible to the
therapist, the payer, and admins.

Two things to know before turning this on. Theraglee, as the platform, is
liable for refunds and disputes on these payments, and pays Stripe's processing
fee (which is why there is a minimum platform fee). And sales tax is not
calculated on sessions: counseling services are generally exempt, and the
therapist is the merchant of record.

## The switches

All in `app_config`, all editable from `/admin.html`:

| Key | Off means | On means |
|---|---|---|
| `stripe_enabled` | Nobody but an admin can start a checkout. | Memberships and session payments can be bought. |
| `stripe_tax_enabled` | No tax collected. | Checkout collects a billing address and adds tax. |
| `identity_required` | ID check is optional. | A listing cannot publish without a passed ID check. |
| `connect_enabled` | No payouts setup, no "Pay for a session". | Therapists can onboard and take payments. |
| `platform_fee_percent`, `platform_fee_min_cents` | | Theraglee's share of a session payment. |

## What is stored where

| Table / column | Written by | Meaning |
|---|---|---|
| `profiles.tier`, `subscription_status`, `current_period_end`, `cancel_at_period_end`, `stripe_customer_id`, `stripe_subscription_id` | webhook | The membership, as Stripe last reported it |
| `therapist_profiles.identity_status`, `identity_session_id`, `identity_verified_at`, `identity_last_error` | webhook, `stripe-identity` | ID check state: `unverified`, `pending`, `verified`, `requires_input`, `canceled` |
| `therapist_profiles.stripe_account_id`, `stripe_account_status`, `charges_enabled`, `payouts_enabled` | webhook, `stripe-connect` | Payout account: `none`, `onboarding`, `enabled`, `restricted` |
| `therapist_profiles.accepts_payments`, `session_fee_cents` | the therapist | Their choice to take payments, and the price ($5–$1,000) |
| `session_payments` | `stripe-session-checkout`, webhook | One row per session payment: `pending`, `paid`, `refunded`, `partially_refunded`, `disputed` |
| `billing_alerts` | webhook | Disputes and Radar early-fraud warnings, for admins |
| `stripe_events` | webhook | Every event received; `processed_at` set once handled, `error` if not |

The Stripe-managed columns are frozen for everyone except the functions and
admins by the `therapist_guard` trigger, so a therapist cannot mark themselves
verified or paid-out from the browser.

## If something goes wrong

- **"Payments are not switched on yet"** — the `stripe_enabled` switch is off
  (or, for sessions, `connect_enabled`). Admins bypass the first.
- **"No Stripe price is set for …"** — a price ID is missing in the admin screen.
- **Paid but still on the free tier** — open Stripe → Developers → Webhooks and
  look at the endpoint's recent deliveries. A red one shows the error; the same
  text is in `stripe_events.error`. Fix, then click *Resend* in Stripe.
- **Checkout will not open with Tax on** — the Dashboard side of Step 7 is
  incomplete (usually the origin address). Untick the switch until it is.
- **Signature verification failed** — the webhook secret in Supabase does not
  match the endpoint (sandbox and live have different secrets).
