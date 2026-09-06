# Privacy Policy and Terms of Service — how they are kept current

The two legal pages live at `site/privacy.html` and `site/terms.html` and are
served at `/privacy` and `/terms` (aliases: `/privacy-policy`,
`/consumer-health-data`, `/terms-of-service`, `/tos`, all in `site/vercel.json`).
The footer on every page links to both, plus a direct link to the consumer
health data section, which Washington's My Health My Data Act asks to be
reachable from the home page.

Both pages carry two dates at the top:

- **Effective** — when the current wording started to apply. Change it only
  when the wording changes.
- **Last reviewed** — when someone last checked the wording against the law and
  against how the site actually works. Change it on every review, even when
  nothing needed to change.

## Facts the policy states about the site

The privacy policy is only as good as its accuracy. It states the following as
fact; if any of these change, the policy must change in the same pull request.

| Statement in the policy | Where it comes from |
| --- | --- |
| No advertising trackers, pixels, session replay or third-party analytics | Nothing of the kind is loaded from `site/`. Adding Vercel Analytics, Google Analytics, a Meta pixel, etc. requires updating sections 2, 5 and 6 and honoring opt-out signals |
| Service providers: Supabase, Vercel, Stripe, Resend, a telephony provider, a license-verification service, Google Fonts, OpenStreetMap | `docs/site.md`, `site/admin.html`, the `<link>` tags on every page, `site/goals.html` |
| No AI chatbot, AI companion or AI therapy; personalization is rule-based | `daily_pick` is a database function. If a conversational or generative feature is ever added, Illinois, Nevada, Utah, California, New York, Oregon, Tennessee and Washington all have laws that apply — read them first |
| Personal data is not used to train AI or LLMs | Connecticut requires this disclosure either way |
| Therapists see only name, topics and zip code, and only with opt-in | `site/account.html` (Privacy tab) and the `visible_to_therapists` column |
| Calls to tracking numbers are counted, not recorded | `site/admin.html`; if call recording is ever switched on, state two-party consent laws apply |
| Idle sign-out after 15 minutes | `idleLogoff()` in `site/assets/app.js` |
| Account deletion completed within 45 days | The Delete button in `site/account.html` currently only shows a message; an administrator must complete deletions by hand until that is automated. The 45-day promise is the legal deadline in every state |
| Data export from the account page | `site/account.html` (Privacy tab) |
| Members must be 18 or older | `site/login.html` consent line; there is no age check beyond that |
| Retention periods (45 days to delete, 90 for backups, 7 years for payments and verification records, 30 days for logs) | These are commitments, not yet enforced by code. Keep the database, backups and log retention in line with them |
| Renewal reminders 15–45 days before yearly renewals; 30 days' notice of price changes | Turn on Stripe's "upcoming renewal" customer email for yearly plans, and email members before any price change |

## Things the owner still needs to fill in

- **Legal entity and state.** Both pages say "Theraglee" and "the state in which
  Theraglee has its principal place of business." Replace with the registered
  entity name (for example "Theraglee LLC, a Texas limited liability company")
  and name the state in the governing-law paragraph of the Terms.
- **Mailing address.** State privacy laws and the DMCA expect a postal address.
  Add it to the "How to reach us" section of both pages.
- **Contact email.** Both pages use `hello@theraglee.com`. Make sure that
  address is set up and read (`docs/hosting-migration.md`, step 8).

## Review schedule

Review both pages **at least every three months** and whenever a feature
changes what the site collects. A scheduled Claude routine ("Theraglee legal
pages monthly review", in the claude.ai Routines list) runs on the first of
every month, checks the law and the site, and opens a pull request; the pull
request still needs a person to read and merge it.

What a review covers:

1. **Federal.** FTC Act section 5 enforcement themes; the FTC Health Breach
   Notification Rule (16 CFR 318); COPPA (16 CFR 312, amended 2025); ROSCA and
   any revived FTC negative-option rule; the TAKE IT DOWN Act; any federal
   comprehensive privacy law, which does not exist as of September 2026.
2. **State comprehensive privacy laws.** As of September 2026: California,
   Colorado, Connecticut, Delaware, Indiana, Iowa, Kentucky, Maryland,
   Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode
   Island, Tennessee, Texas, Utah, Virginia. Watch for new states and for
   amendments (Connecticut's July 2026 amendments added the LLM-training
   disclosure and lowered thresholds; several states now ban selling sensitive
   data outright).
3. **Consumer health data laws.** Washington My Health My Data Act, Nevada
   SB 370, Connecticut's health data provisions, and New York's Health
   Information Privacy Act if it is enacted. These have no size threshold and
   are the laws most likely to reach Theraglee directly.
4. **Minors.** COPPA, state age-appropriate design codes and teen-data rules.
   Theraglee avoids most of these by being 18+; keep it that way or re-review.
5. **AI and mental health.** Illinois WOPR Act, Nevada AB 406, Utah HB 452,
   California SB 243 and AB 489, New York GBL Article 47, Tennessee SB 1580,
   Oregon SB 1546, Washington's chatbot law. Relevant only if a conversational
   feature is added, but the "no AI therapy" statement should stay accurate.
6. **Subscriptions.** California's Automatic Renewal Law (as amended July
   2025), New York GBL 527-a, and the roughly 30 other state auto-renewal laws.
7. **Breach notification.** State deadlines (California moved to 30 days in
   2026) and the FTC rule.
8. **The site itself.** Re-check every row in the facts table above.

When a review changes wording, bump **Effective**, and if the change is
material, email members 30 days before it takes effect, as both pages promise.

## Writing rules

- US English, plain language, short sentences. The pages are read by people
  in distress; they should be readable, not intimidating.
- Every statement must be true of the site as deployed. A privacy policy that
  overstates protections is itself a deceptive practice under the FTC Act.
- Keep the "short version" boxes in sync with the full text.
- Keep the two pages' `<style>` blocks identical; they share a layout.
