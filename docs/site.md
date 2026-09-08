# Theraglee — how the site is put together

Live site: **https://theraglee.com** (also reachable at
`https://theraglee-site.vercel.app`)

Moving the domain off HostGator is written up step by step in
[`hosting-migration.md`](hosting-migration.md).

> This file used to live at `site/README.md`. It moved here because `site/` is
> deployed verbatim — see "Everything in `site/` is public" below.

## The pieces

| Piece | What it does | Where |
|---|---|---|
| Front end | Every page you see. Plain HTML/CSS/JavaScript — no build tools needed. | `site/` |
| Database + logins | Members, therapists, all content, all progress. | Supabase project `oekqzuguruyqkafsqhos` |
| Payments | Stripe: Checkout, billing portal, Tax, Identity, Radar, Connect. See [`stripe.md`](stripe.md). | `supabase/functions/`, deployed as Supabase Edge Functions |
| Hosting | Serves the site. | Vercel project `theraglee-site` |
| Domain | `theraglee.com`. | Registered at Network Solutions, served by Vercel |

## Membership tiers

Access is decided by the database, not the browser, so it can't be bypassed
by editing the page. Every piece of content carries a `min_level`:

| Level | Tier | Who |
|---|---|---|
| 0 | Visitor | No account. Browses therapists, articles, quotes, tips, fun facts, affirmations, and uses all 360 free discovery tools. |
| 1 | Free | Registered, no card. Adds the progress dashboard with favorites, personalized daily content, the journal and its prompts, checklists with progress, 7-day challenges, articles by email every morning, and the switch that lets therapists reach out. |
| 2 | Basic | Paid. Adds 62 quizzes, 17 worksheets, challenges up to 365 days, and Pip, the downloadable desktop pet. |
| 3 | Premium | Paid. Adds goals, mood tracking, 150 sets of mental health trivia, mandalas, playlists, resource map, personalized therapist recommendations. |

A member can edit only their own profile details from the browser — name, zip,
topics, the morning-email settings, onboarding, and the therapist reach-out
switch. `tier`, `role`, the Stripe columns and the unsubscribe token are
writable only by the service role (the Stripe webhook and the daily digest)
and from the Supabase dashboard, so a member cannot promote themselves
(`supabase/migrations/20260907090000_profiles_member_column_guard.sql`).

Therapist membership is separate and not tiered — one flat level, gated on
license verification *and* an active subscription. It includes:

- a verified, searchable listing
- a Theraglee tracking phone number, so the therapist's own line stays private
- a contact form that routes messages without exposing their email address
- referral reporting: calls, messages, website clicks, shares and profile views
- the names and topics of members who opted in to being contacted (any registered member can)
- a 55-item clinician library (worksheets, CBT, ACT, DBT, couples, kids, games)
- Assign Remind — built, but **held in preview here** (see below)

If either the license or the membership lapses, the listing comes down on its own
and the library and member list close, while the therapist keeps their own inbox
and their referral history.

### License verification

There is no national API for behavioral-health licenses — each state runs its own
board, and most publish only a human web lookup. `verify-license` therefore has
three routes, in order: a primary-source-verification vendor (fully automatic,
needs `LICENSE_VERIFY_URL` and `LICENSE_VERIFY_API_KEY`); a state endpoint where
one exists; otherwise an administrator confirms against the board's own lookup.
Every check, whichever route, is written to `license_verifications` as the audit
record behind the badge, and licenses are re-checked before they expire.

`state_boards` holds the lookup URL per state. Only California is filled in so
far — confirmed rather than guessed. Any state left blank falls back to a search
link in the admin screen.

## Changing the site

The readable source is `site/`, and **a push to the default branch deploys it**.
Vercel is linked to this GitHub repository with `site/` as the root directory,
so editing a file and pushing is the whole process.

This replaced the old two-step flow, where the files were copied into the
`site_files` table in Supabase and Vercel was redeployed by hand. `site_files`
is no longer what gets served.

### Everything in `site/` is public

`site/` is deployed verbatim, so every file in it is readable by anyone — not
just the HTML. This file used to be `site/README.md` and was served at
`/README.md` with a `200`, which published the address that is auto-granted
administrator and the SQL that lifts the AssignRemind gate.

**No `.md` file is ever published.** Documentation lives in `docs/`, which is
outside the deployed directory and therefore cannot be served at all. That is
the real guarantee; `site/.vercelignore` also excludes `*.md` as a backstop for
anything dropped in later.

`vercel.json` is the one non-asset file that ships, because Vercel reads the
redirects and headers from it. It holds nothing sensitive.

### Write in US English

Theraglee is a US site — members are matched to therapists by state board, and
the directory lists TRICARE and Medicare. Copy, UI labels, code comments and
class names all use US spelling: *color*, *behavior*, *license*, *favorite*,
*counseling*, *personalized*, *judgment*, *center*, *canceled*, *gray*,
*labeled*, *program*, *practice*.

Two deliberate exceptions, both stored values rather than words on a page:

- `ar_assignments.state` is `'cancelled'`, with a `cancelled_at` column, and
  Stripe returns `?checkout=cancelled`. Those strings are a data contract and
  keep the old spelling; only the labels a member reads were changed.
- `.badge.grey` is still defined in both stylesheets as an alias of
  `.badge.gray`, so markup published before the switch still renders. New
  markup uses `.gray`.

## What the Free membership includes, and where each piece lives

The pricing card promises seven things to a registered member. None of them is
gated by tier, so Basic and Premium have them too:

| Promise | Where it lives | How access is decided |
|---|---|---|
| Dashboard to track your progress | `dashboard.html` — counts, challenges in progress, picked-up items | `requireAuth()`: any signed-in member |
| Keep favorites in your dashboard | `favorites` table via `assets/library.js`; "Your favorites" on the dashboard | RLS `own rows` |
| Tons of journal prompts | 374 `daily_content` rows of kind `journal_prompt`, `journal.html` | `min_level = 1` |
| Articles sent to your inbox | the `daily-digest` Edge Function, below | `profiles.daily_email` |
| 7-day mental health challenges | `challenge_templates` (the 7-day one is `min_level = 1`); Free can also design a 7-day one | `min_level` |
| Checklists with progress tracked | 4 `checklists` at `min_level = 1`, `checklist_progress` + `item_progress` | `min_level`, RLS `own rows` |
| Dashboard switch: let therapists reach out | `profiles.visible_to_therapists`, toggled on `dashboard.html` and `account.html` | `member_opted_in()` |

## The morning email

Every registered member can get a short email each morning: an article they
have not been sent lately, plus whichever of the daily picks (affirmation,
quote, tip, fun fact, journal prompt) they chose. It is **on by default for new
accounts**, with an unsubscribe link in every email and a switch on the
dashboard and on the account page. Members pick what goes in it under
Account → Profile → Daily email.

| Piece | Where |
|---|---|
| Sender | Edge Function `daily-digest` (source in `supabase/functions/daily-digest/`) |
| Schedule | pg_cron job `daily-digest`, every day at 13:00 UTC (9 am Eastern) |
| Rules | `supabase/migrations/20260906120000_daily_digest.sql` — `digest_recipients()`, `digest_article()`, `digest_sends` |
| Scheduler key | `app_secrets.digest_key`, sent as the `x-digest-key` header. Readable only by the database and the service role. |

How an article is chosen: one the member's level allows, never sent to them
before if there is one, otherwise the one they were sent longest ago — and
nothing from the last 30 days. When every article is too recent the email goes
out without one, so a small library does not repeat itself daily. **There are
two articles right now**; every article added to `articles` becomes another
morning email.

Nobody gets two emails in a day (`digest_sends` has a unique index on user and
date), and a failed send is retried at most once more that day.

The function needs these secrets on the Supabase project (Settings → Edge
Functions → Secrets). Until `RESEND_API_KEY` is set, the scheduled run returns
`email_not_configured` and sends nothing:

| Secret | What it is |
|---|---|
| `RESEND_API_KEY` | Resend API key. The same one `contact-therapist` uses. |
| `MAIL_FROM` | Optional. Defaults to `Theraglee <notifications@theraglee.com>`; the domain must be verified in Resend. |
| `SITE_URL` | Optional. Defaults to `https://theraglee.com`; used for the links in the email. |

To preview what a member would receive without sending, call the function with
the key and `dry_run`:

```bash
KEY=$(psql "$DATABASE_URL" -Atc "select value from app_secrets where key='digest_key'")
curl -s -X POST https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/daily-digest \
  -H "x-digest-key: $KEY" -H "Content-Type: application/json" \
  -d '{"dry_run": true, "user_id": "<profile id>"}'
```

Drop `dry_run` to actually send to that one member (this ignores the
once-a-day rule so you can test against your own inbox); drop `user_id` too and
it does exactly what the scheduled run does.

## The 360 free discovery tools

`site/discover.html` hosts three hundred and sixty short, interactive self-discovery tools, twenty per topic,
that every visitor can use, signed in or not. They are the free, open front
door to the library: reflections, sorters, dials, card picks, guided writing,
breathing timers, seven-day logs, feelings wheels, plan builders, perspective
cards, two-by-two grids, rankings, point budgets and week maps, across eighteen
topics (anxiety, worry, racing thoughts, low mood, stress and burnout, sleep,
relationships, boundaries, self-esteem, emotions, anger, grief and change,
loneliness, focus, habits, values and meaning, work and school, calm and
grounding).

They deliberately live in the site rather than in the database:

| File | What it holds |
|---|---|
| `site/assets/discover-tools.js` | The 360 tools as data. Each has a stable v5 UUID derived from its slug. |
| `site/assets/discover.js` | The engine: renders each of the 16 interaction kinds, keeps state, writes the closing reflection. No imports, so it can be tested without Supabase. |
| `site/assets/discover.css` | Layout for the interaction kinds. |
| `site/discover.html` | The index (search and topic filter) and the tool page (`?slug=`). |

Because they ship with the site, there is no `min_level` to check and nothing
to unlock. `explore.html` merges them into the library under the **Free
discovery tools** chip with `kind = 'discover'` and `min_level = 0`.

What a visitor gets versus a member:

| | Visitor | Registered member |
|---|---|---|
| Use all 360 tools | yes | yes |
| Answers remembered | in this browser only (`localStorage`, key `tg.discover.<slug>`) | in this browser, plus Started / Completed in `item_progress` with `item_type = 'discover'` |
| Favorite, save for later, save to my dashboard | the buttons are shown, and each one opens the free sign-up page (`login.html?mode=signup&why=save&next=…`), which returns to the tool afterwards | yes: favorites via `favorites`, "save to my dashboard" records the tool as started in `item_progress` |
| Shows on the dashboard | no dashboard | yes: favorites, saved for later, picked up but not finished |

None of the tools diagnoses, screens for, or treats anything. Every result is
framed as "what you noticed", the closing note points to a licensed
professional, and `tests/discover-fixture/check.mjs` fails the build if the copy
uses diagnostic language. See `tests/discover-fixture/README.md` for the checks.

To add a tool, append an entry to `discover-tools.js`, give it an id with
`uuid5(NAMESPACE_URL, 'https://theraglee.com/discover/<slug>')`, and run the
check. Never change an id once it has shipped; members' favorites point at it.

## Content

All of it was imported from the Word documents in the parent folder:

- 62 self-assessment quizzes (253 questions, 247 result bands)
- 374 journal prompts
- 17 interactive worksheets
- 4 checklists
- 3 challenges (two 30-day, one free 7-day)
- 2 articles
- 12 printable mandalas (drawn in the browser from a seed)
- 150 mental health trivia sets (1,500 questions), written for the site rather than imported
- 140 daily items — affirmations, tips, fun facts, quotes

The daily items are **placeholders written for launch**, because the
"Daily Affirmations", "Daily Inspirational Quotes", "Daily Mental Health Tips"
and "Daily Mental Health Fun Facts" folders were empty. Replace them with your
own writing when you have it.

## Mental health trivia (Premium)

`site/trivia.html` is where Premium members play **150 sets of mental health
trivia** — ten multiple-choice questions each, 1,500 questions in all, across
fifteen topics (anxiety and worry; mood and depression; stress and burnout;
sleep and rest; mindfulness and meditation; the brain and emotions;
relationships and communication; self-esteem and self-compassion; grief, loss
and change; trauma and resilience; habits, motivation and change; therapy and
how it works; history and science of psychology; myths, stigma and mental
health literacy; everyday wellbeing). Each topic has four easy, three medium
and three hard sets.

A set is played one question at a time. Every answer is marked straight away
with a one- or two-sentence explanation, so a wrong guess still teaches
something, and the score at the end comes with the full answer key. Options are
shuffled on every play, so a replay is still a fair test. The keyboard works
too: 1–4 to answer, Enter for the next question.

The trivia asks about mental health as a *subject* — its science, history,
terms and techniques — and never about the player. No score is framed as
saying anything about the person, and `tests/trivia-fixture/check.mjs` fails
the build if the copy addresses the player's own health, uses retired phrasings
such as "committed suicide", or slips into UK spelling.

Like the discovery tools, the sets live in the site rather than the database:

| File | What it holds |
|---|---|
| `site/assets/trivia-sets.js` | The 150 sets as data. Each has a stable v5 UUID derived from its slug. |
| `site/assets/trivia.js` | The pure parts: shuffling, scoring, the score bands. No imports, so it can be tested without Supabase. |
| `site/trivia.html` | The index (search, topic, difficulty and played/perfect filters, best scores) and the play page (`?slug=`). |
| `supabase/migrations/20260908120000_trivia_scores.sql` | The `trivia_scores` table and `record_trivia_score()`, so best scores follow a member across devices. |

How access is decided: the page checks `my_access()` and shows an upgrade ask
below Premium, and `explore.html` lists every set at `min_level = 3` so it
locks like any catalog row. Because `site/` is public, the question file itself
is readable by anyone who fetches it, as with Pip's downloads — the gate is on
the experience and the score-keeping, not on the text of the questions. The
`trivia_scores` policies are the real lock on the database side: only a member
at level 3 or above can write a score.

Scores: the page always keeps best scores in the browser
(`localStorage`, key `tg.trivia.<slug>`) and, once the migration has been
applied, also in `trivia_scores`, merging the two. Until the migration is
applied the table read fails quietly and the browser copy is all there is.
Started / Completed goes to `item_progress` with `item_type = 'trivia'`, and
favorites and "save for later" work like every other activity, so trivia sets
show on the dashboard and under the library's member views.

To add a set, append an entry to `trivia-sets.js`, give it an id with
`uuid5(NAMESPACE_URL, 'https://theraglee.com/trivia/<slug>')`, and run the
check. Never change an id once it has shipped.

## The desktop pet

`site/pet.html` is where Basic and Premium members download **Pip**, a small
desktop companion. Free members and signed-out visitors get an upgrade ask on
the same page instead; the dashboard tile that leads there is flagged `ownGate`
so it opens the page rather than jumping straight to the plans.

The apps themselves are built from source in [`pet/`](../pet/README.md) — Swift
for the Mac, C# for Windows — and the two downloads are checked into
`site/downloads/`, which Vercel publishes with the rest of the site.

Because `site/` is public, those two URLs are reachable by anyone who has them.
The membership gate is a courtesy, not a lock. Making it a real one would mean
serving the files from Supabase Storage behind a signed URL issued only to
members at level 2 or above.

## Admin

Sign in with **scanchol@hotmail.com** and you are made an administrator
automatically. Then go to `/admin.html` for:

- the therapist license verification queue (with each therapist's ID-check state)
- Stripe price IDs, the platform fee, and the on/off switches for payments,
  sales tax, the identity requirement and session payments
- content counts

## Privacy Policy and Terms of Service

`site/privacy.html` and `site/terms.html`, served at `/privacy` and `/terms`.
How they are kept current, what they assert about the site, and what still
needs filling in is written up in [`legal-pages.md`](legal-pages.md).

## Safety

The crisis banner (988) is on every page, and every page carries the
"not medical advice, not a diagnosis" disclaimer. Quiz results are always
framed as self-reflection, never as findings.


## Assign Remind is moving out

Assign Remind is the only part of Theraglee that handles a clinician's patient
information, so it is moving to its own HIPAA-covered project at
assignremind.com rather than putting the whole site behind ~$1,000/month of
compliance infrastructure.

Until it moves it is **held in preview here**: the screens work, but the database
refuses to accept a client record, and the reminder scheduler is switched off.
That is deliberate — a warning someone can click past is not adequate protection
against a real patient record landing on infrastructure with no BAA behind it.

The standalone build is in the `AssignRemind` folder next to this one, with a
runbook. To lift the gate on Theraglee (only appropriate for non-PHI use):

```sql
update app_config set value = 'live' where key = 'assignremind_status';
```
