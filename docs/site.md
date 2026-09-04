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
| Payments | Stripe Checkout + billing portal + webhook. | Supabase Edge Functions |
| Hosting | Serves the site. | Vercel project `theraglee-site` |
| Domain | `theraglee.com`. | Registered at Network Solutions, served by Vercel |

## Membership tiers

Access is decided by the database, not the browser, so it can't be bypassed
by editing the page. Every piece of content carries a `min_level`:

| Level | Tier | Who |
|---|---|---|
| 0 | Visitor | No account. Browses therapists, articles, quotes, tips, fun facts, affirmations. |
| 1 | Free | Registered, no card. Adds personalised daily content, journal, checklists, 7-day challenges. |
| 2 | Basic | Paid. Adds 62 quizzes, 17 worksheets, challenges up to 365 days. |
| 3 | Premium | Paid. Adds goals, mood tracking, mandalas, playlists, resource map, therapist outreach. |

Therapist membership is separate and not tiered — one flat level, gated on
licence verification *and* an active subscription. It includes:

- a verified, searchable listing
- a Theraglee tracking phone number, so the therapist's own line stays private
- a contact form that routes messages without exposing their email address
- referral reporting: calls, messages, website clicks, shares and profile views
- the names and topics of members who opted in to being contacted
- a 55-item clinician library (worksheets, CBT, ACT, DBT, couples, kids, games)
- Assign Remind — built, but **held in preview here** (see below)

If either the licence or the membership lapses, the listing comes down on its own
and the library and member list close, while the therapist keeps their own inbox
and their referral history.

### Licence verification

There is no national API for behavioural-health licences — each state runs its own
board, and most publish only a human web lookup. `verify-license` therefore has
three routes, in order: a primary-source-verification vendor (fully automatic,
needs `LICENSE_VERIFY_URL` and `LICENSE_VERIFY_API_KEY`); a state endpoint where
one exists; otherwise an administrator confirms against the board's own lookup.
Every check, whichever route, is written to `license_verifications` as the audit
record behind the badge, and licences are re-checked before they expire.

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

## Content

All of it was imported from the Word documents in the parent folder:

- 62 self-assessment quizzes (253 questions, 247 result bands)
- 374 journal prompts
- 17 interactive worksheets
- 4 checklists
- 3 challenges (two 30-day, one free 7-day)
- 2 articles
- 12 printable mandalas (drawn in the browser from a seed)
- 140 daily items — affirmations, tips, fun facts, quotes

The daily items are **placeholders written for launch**, because the
"Daily Affirmations", "Daily Inspirational Quotes", "Daily Mental Health Tips"
and "Daily Mental Health Fun Facts" folders were empty. Replace them with your
own writing when you have it.

## Admin

Sign in with **scanchol@hotmail.com** and you are made an administrator
automatically. Then go to `/admin.html` for:

- the therapist licence verification queue
- Stripe price IDs and the on/off switch for payments
- content counts

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
