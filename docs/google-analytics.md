# Google Analytics — the admin screen's Google Analytics tab

The admin screen (`site/admin.html`, **Google Analytics** tab, at
`/admin.html#analytics`) connects the site to a Google Analytics 4 property
and shows its reports in the Today look, without leaving the admin screen.

Two zones:

1. **Google Analytics** — the settings. The **measurement ID** (the tag on the
   pages), the **property ID** (the reports), and the switch **Load the tag on
   every page**. **Test the connection** asks the Edge Function to read one
   number from the property and says which service account read it.
2. **What visitors did** — the reports for a window of 7, 30, 90 or 365 days:
   how many people are on the site right now (the last 30 minutes), six
   headline numbers each against the window before (people, new people,
   visits, pages opened, time per visit, and the share of visits that stayed
   a while), a line of people per day, the pages opened most, how people
   arrived (Google's channel groups) and what they used (phone, desktop,
   tablet).

## The pieces

| Piece | Where |
|---|---|
| The tab | `site/assets/admin-analytics.js`, mounted by `analytics()` in `site/admin.html` |
| The tag on the pages | `site/assets/analytics-tag.js`, placed by `chrome()` in `site/assets/app.js` on every page |
| The settings | `app_config` rows `ga_measurement_id`, `ga_property_id`, `ga_tag_enabled`, seeded by `supabase/migrations/20261022120000_google_analytics.sql`, written by the tab through `admin_set_config()` |
| The reports | `supabase/functions/google-analytics` (admin only; actions `summary` and `test`), with the report requests, the parsing and the error wording in `supabase/functions/_shared/analytics.ts` |
| The service account key | Supabase secret `GA_SERVICE_ACCOUNT_JSON`, never a row in the database |
| The check | `node tests/google-analytics/check.mjs` |

## Setting it up

### 1. Make the property and get the two ids

In [Google Analytics](https://analytics.google.com/), **Admin → Create →
Property**, a GA4 property for `theraglee.com`, with a **web** data stream
for `https://theraglee.com`.

- **Measurement ID**: Admin → Data streams → the web stream. It starts with
  `G-`.
- **Property ID**: Admin → Property details, the number at the top right.
  It is digits only, not the `G-` id.

Paste both on the tab and press **Save settings**. Leave the switch off for
now.

### 2. Give the reports a way in

The reports are read by a Google Cloud **service account**, a robot account
that only reads analytics.

1. In [Google Cloud](https://console.cloud.google.com/), make a project (or
   use one you already have) and under **APIs & Services → Library** enable
   the **Google Analytics Data API**.
2. **IAM & Admin → Service accounts → Create service account**. No roles are
   needed on the Cloud project. Open it, **Keys → Add key → Create new key →
   JSON**; a file downloads.
3. Back in Google Analytics, **Admin → Property access management → Add
   users**, paste the service account's email (it ends in
   `.iam.gserviceaccount.com`) with the **Viewer** role.
4. In Supabase, **Edge Functions → Secrets**, add `GA_SERVICE_ACCOUNT_JSON`
   with the whole contents of the downloaded file, unchanged.
5. Deploy the function, with the Supabase CLI linked to the project:

   ```bash
   supabase functions deploy google-analytics
   ```

   `supabase/config.toml` carries its setting (the JWT is checked inside the
   function, as with the other admin functions).

Press **Test the connection** on the tab. It answers with the service
account's email and the property id, or says what is missing in words that
name the step above to go back to.

### 3. Turn the tag on, once the privacy policy allows it

Nothing is counted until the switch **Load the tag on every page** is on.
Before it goes on, the Privacy Policy has to change: `site/privacy.html`
says the site runs no third-party analytics (sections 2, 5 and 6), and a
policy that says that while the tag loads is a deceptive practice under the
FTC Act. `docs/legal-pages.md` lists the statements that have to change
and the review that goes with them: name Google Analytics as a service
provider, say what it collects, and say how a visitor opts out. Bump the
policy's **Effective** date in the same pull request.

With the policy updated, turn the switch on and save. From the next page
anyone opens, `analytics-tag.js` reads the settings and adds Google's
`gtag.js` to the page. The first reports arrive a day or so later; Google's
reports can run a day behind.

## What the tag does and does not do

`shouldLoadTag()` in `site/assets/analytics-tag.js` decides, and the test
pins it down:

- The tag loads only when the switch is on and the measurement id looks like
  a GA4 id.
- A browser that sends **Global Privacy Control** or **Do Not Track** gets no
  tag at all. The policy promises to honor opt-out signals; this is how.
- An administrator's own pages are never counted, as with every count on the
  admin screen.
- The tag is configured with Consent Mode: ad storage, ad user data and ad
  personalization denied, Google signals off. It measures pages, not people
  for advertising. Do not turn Google signals on in Google Analytics either.

The tag is a script from `googletagmanager.com`; the pages have no
Content-Security-Policy header, so nothing else has to change for it to
load.

## Reading the numbers

- **People** is Google's *active users*: one per browser cookie, so a member
  on a phone and a laptop is two people.
- **Visits** is *sessions*. **Stayed a while** is Google's *engagement rate*:
  the share of visits that lasted ten seconds, saw two pages or fired an
  event.
- **The window before** is the same number of days ending the day this
  window starts, so "up 20% on the window before" compares like with like.
- The **What members are using** panel on the Content tab counts things
  members did in the database; this tab counts pages anyone opened in a
  browser. They answer different questions and will not match.

## When it says no

| The tab says | Do this |
|---|---|
| Google Analytics is not connected yet. Add GA_SERVICE_ACCOUNT_JSON… | Step 2.4 |
| GA_SERVICE_ACCOUNT_JSON is not valid JSON / is missing client_email… | Paste the whole key file again, unchanged |
| Enter the GA4 property id on this tab first | Step 1, then Save settings |
| The service account cannot read this property | Step 2.3: add it as a Viewer in **Property access management** |
| The Google Analytics Data API is not enabled | Step 2.1 |
| Google Analytics has no property with that id | The property id is digits only; check Admin → Property details |
| Google did not accept the service account key | Make a new key (step 2.2) and replace the secret |

## Changing it

- A new report or metric: add the request in `reportRequests()` and its
  shape in `summarize()` in `_shared/analytics.ts`, a card or list in
  `admin-analytics.js`, and a check in `tests/google-analytics/check.mjs`.
  The five requests go in one `batchRunReport` call, and Google allows five
  per batch, so a sixth needs a second call.
- The windows are `WINDOW_DAYS` in `_shared/analytics.ts` and `WINDOWS` in
  `admin-analytics.js`; the test holds them together.
- Run `node tests/google-analytics/check.mjs` after any change, and
  redeploy the function when `supabase/functions/` changed.
