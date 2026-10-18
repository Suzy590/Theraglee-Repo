# The therapist-facing pages and the Match Mode explainer

Six hand-written pages pitch Theraglee to therapists and explain Match Mode
to members, and one generated article sits beside them. They follow the Today look (`design.md`): a soft green `.zone`
per section with white `.card`s inside.

| Page | File | Address |
| --- | --- | --- |
| List your practice | `site/for-therapists.html` | `/for-therapists` |
| How Match Mode works, for therapists | `site/for-therapists/match-mode/index.html` | `/for-therapists/match-mode` |
| Theraglee vs. the directories | `site/for-therapists/compare/index.html` | `/for-therapists/compare` |
| Leaving Psychology Today? | `site/for-therapists/leaving-psychology-today/index.html` | `/for-therapists/leaving-psychology-today` |
| Is Psychology Today still worth it? (generated) | `data/seo-pages.json` → `site/for-therapists/is-psychology-today-worth-it/index.html` | `/for-therapists/is-psychology-today-worth-it` |
| Our privacy promise | `site/privacy-promise.html` | `/privacy-promise` (canonical `/privacy-promise.html`) |
| What is Theraglee Match Mode? (members) | `site/match-mode.html` | `/match-mode` (canonical `/match-mode.html`) |

The pages in folders carry `<base href="/">` and absolute asset paths, like
the generated landing pages. The clean addresses for the other two are
redirects in `site/vercel.json`.

**Leaving Psychology Today?** is the landing page for ads and group posts aimed
at therapists who are unhappy with the big directories. It is built around
the complaints therapists make about them (one or two inquiries a year, a
profile to re-do every month, clients who contact three therapists at once,
venture-funded platforms in the searches, checkbox profiles, unchecked
licenses) and what Theraglee does about each, and it says plainly that the
member community is still growing rather than promising referrals. Send paid
traffic here or to the comparison page, not to the home page.

**Is Psychology Today still worth it?** is the article a therapist finds when
they search that question. It is a row in `pages` in `data/seo-pages.json`
(its `back` field points the top link at the therapist pitch instead of the
member article list; a `for-therapists/` path also drops the feature showcase),
so `python3 tools/build_seo_pages.py` rebuilds it, and it is fair to
Psychology Today on purpose: the section that mentions Theraglee declares the
interest first. Keep it that way; a one-sided article will not be shared in
the groups it is written for.

## Where they are linked from

- The header's **For Therapists** button opens the first page; its hero links
  to the Match Mode explainer, the pricing section, the comparison and the
  page for therapists leaving Psychology Today.
- The footer links all six (`footer()` in `site/assets/app.js`).
- Every **featured Theraglee Match Mode** card in the feature showcase
  (`site/assets/showcase.js`) opens `match-mode.html`, for visitors and
  members alike.
- The landing page's Match Mode section, and the blurb under the Match Mode
  switch on the dashboard and account page (`MATCH_BLURB` in
  `site/assets/match.js`), link to `match-mode.html`.

## Prices are not hardcoded

The numbers printed in the HTML ($29/month, $290/year, $20/month founding)
are only what shows until `app_config` loads. `site/assets/therapist-rates.js`
fills every `.tg-rate-monthly`, `.tg-rate-yearly` and `.tg-rate-founding`
from the admin screen's Stripe setup tab, hides `.tg-founding` and turns each
`.tg-founding-cta` into a plain "Start your listing" button when the founding
offer is off, has no price, or is past its deadline (`foundingOffer()` in
`site/assets/plans.js`). Change the price on the admin screen, then update the
printed fallback here so the two agree before the page's script runs.

## Things to keep true

- **Match Mode copy must match the build.** What a therapist sees is the
  `member_discovery` view: pseudonym, age range, gender, topics, who the sessions are for, session
  preference, insurance and the first three digits of the zip code; never a
  name, exact location, email or anything the member wrote. Switching Match
  Mode off removes the member from the view at once. `match-mode-consent.md`
  is the source; change the pages in the same pull request as the code.
- **The comparison table is hand-maintained.** Re-verify every competitor
  figure quarterly and update both `<time class="cmp-last-verified">`
  elements. Never add a competitor without checking its current pricing.
- **Legal review.** The privacy-promise wording ("never sold, never used for
  advertising, never used to train AI") on the privacy promise page and the
  member explainer awaits counsel's sign-off. Remove the italic
  "pending final legal review" lines (`.pp-pending`, `.mm-pending`) only after
  the lawyer's written blessing. The "Is this therapy?" answer on the member
  explainer is a compliance safeguard: keep it verbatim.
- **FAQ structured data** on `match-mode.html`,
  `for-therapists/match-mode/index.html` and
  `for-therapists/leaving-psychology-today/index.html` is generated from the
  visible question cards by `python3 tools/build_seo_pages.py` (the
  `FAQ_PAGES` list), which also adds all six pages to `site/sitemap.xml`.
  Re-run it after changing a question.
