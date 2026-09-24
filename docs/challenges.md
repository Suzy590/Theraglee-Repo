# Challenges — themed, any length, two new themes every day

A challenge is a **theme** with a bank of daily to-dos: "Fostering Gratitude",
"Slowing Down the Mental Chatter", "Redirecting Unhelpful Thoughts". A member
picks a theme, chooses **how many days** it runs (7, 21, 30, 90, 120, 150, 180,
365, or a custom number from 8 to 364), and then sees one to-do for each day.
They check a day off once it is done, and the page shows how it is going: 48 of
180 completed, which day today is, how many are still to do, how many were
checked off in the last seven days, and when the last day falls. There are no
streaks, on purpose; a missed day is just a day.

**Two new themes are added every day**, never repeating one the library already
has, though two can sit close together (worry and grounding, say) as long as
they take different angles. Challenges are everyday practices for wellbeing.
Nothing in them diagnoses, screens for or treats a mental health condition, and
every page says so.

## How access works

| Piece | Where | How |
|---|---|---|
| Browsing the themes | `content_catalog` (kind `challenge`), `site/challenges.html` | open to visitors; the view is readable signed out |
| Reading a theme's to-dos and starting it | `challenge_templates` + `challenge_days` | `min_level = 1`: every registered member, every theme |
| How long it runs | `user_challenges.total_days` | Free members run any theme for 7 days; Basic and Premium choose any length up to 365. `guard_challenge_length()` on `user_challenges` refuses a longer run from a Free member, whatever the page sends. |
| Ticking a day | `user_challenge_progress` (one row per run, per day, with `completed_on`) | RLS `own rows` |
| Which to-do a day shows | the page: day *d* shows to-do `(d - 1) mod N` of the theme's *N* | so a 90-day run of a 30-to-do theme visits each to-do three times |
| Design your own | `user_challenges` with no `template_id`; the member writes `custom_days` as they go | same length rule |
| The dashboard | "Challenges in progress" on `site/dashboard.html` | `n of N days` per active run |
| Print-ready copy | `documents/challenges/<slug>.html`, the whole bank numbered | built by `tools/build_documents.py` |

`challenge_templates.total_days` is the **size of the bank** (how many
`challenge_days` rows the theme has), not a run length; the run length lives on
`user_challenges`. Every theme carries a description, one or two sentences on
what it is designed to accomplish, because that is what a member reads on the
tile before choosing it.

## Where a challenge lives

The rows live in the database and the repo copy is `data/challenges.json`, one
theme per line with the keys `slug, title, description, category, tags,
min_level, published_at, tasks`. The two are kept in step the same way as
checklists and articles: edit the JSON, run the check, generate the SQL, apply
it, regenerate `documents/`.

```bash
node tests/challenges-fixture/check.mjs                 # data checks
python3 tools/challenges_sql.py --since 2026-09-25      # SQL for a day's two (an upsert on slug)
python3 tools/challenges_sql.py slug-a slug-b           # or by slug
python3 tools/build_documents.py                        # the print-ready copies in documents/
```

The generated SQL goes in a migration named
`supabase/migrations/<YYYYMMDD>170000_challenges_<YYYY_MM_DD>.sql` and is
applied to the project (`oekqzuguruyqkafsqhos`) with the Supabase MCP
`apply_migration` tool, the Supabase CLI, or
`.github/workflows/apply-content-migrations.yml` once the `SUPABASE_DB_URL`
secret is set. The template half is an upsert on `slug`, so applying it twice is
harmless and an edited theme keeps its id, along with every member's runs and
ticks. The to-do half deletes and re-inserts that theme's `challenge_days`, so
a member's day 12 always shows the current wording of to-do 12.

`published_at` says when a theme joined the library: `2026-09-24T17:00:00+00:00`
for the first twenty, and the day's date at 17:00:00+00:00 for everything since.

## The daily routine

A scheduled routine ("Theraglee daily challenges", created 2026-09-24) runs
every day at 17:00 UTC (1 pm Eastern) and writes two new themes the library
does not have yet. It fires into the session that set it up, so it has the
Supabase connection and puts the day's rows in the database itself.

**The database step is the one that reaches members.** `site/challenges.html`
reads the themes from the database, so the two new ones are live as soon as
the migration is applied. The pull request keeps the repo copy, the counts and
the printable documents in step.

Each day's session:

1. Reads this file, `CLAUDE.md`, and the title, description, theme and tags of
   every challenge already in `data/challenges.json`, so the day's two are
   genuinely new and match the voice. Also reads `CATEGORIES` and `TAGS` in
   `tests/challenges-fixture/check.mjs`.
2. Writes two new themes and appends them to `data/challenges.json` with
   today's date at 17:00:00+00:00.
3. Runs `node tests/challenges-fixture/check.mjs` and fixes anything it flags.
4. Generates the day's migration with `tools/challenges_sql.py --since <today>`
   and applies it to the database.
5. Confirms with a query that both slugs are in `challenge_templates` with
   thirty `challenge_days` rows each.
6. Runs `python3 tools/build_documents.py` and bumps the challenge counts in
   `README.md` and `docs/site.md`.
7. Commits to its own `claude/...` branch, pushes, opens a draft pull request
   titled `Daily challenges for <YYYY-MM-DD>`, and watches it: if a check fails
   it fixes it and pushes again. The owner merges it.

The owner asked for each day's pull request to merge itself, the way the daily
articles run does. A Claude Code session in auto mode is not allowed to write
a merge-without-review step into a routine, so that step is added by hand:
open the Routines list on claude.ai, edit "Theraglee daily challenges", and
replace steps 9 to 11 with the merge steps from the "Theraglee daily articles"
routine (open the pull request, wait for green checks, mark it ready for
review, merge it with the merge method "merge", and tell the owner nothing is
needed from them).

If a day is missed the next day does not double up; the library simply gets two
that day.

## Themes

A challenge belongs to one theme, the small word above the title on the tile.
The list is `CATEGORIES` in `tests/challenges-fixture/check.mjs`; add a theme
there before using it. Ground worth covering, two at a time:

patience with children · money without the dread · a kinder relationship with
food, never about weight · noticing small pleasures · finishing what you start ·
asking for help · listening better · creative play · learning to say what you
feel · a gentler commute · the week after a loss · easing back into work ·
keeping in touch with far-away family · making decisions faster · celebrating
small wins · getting outside · being a good neighbor · slowing down at meals ·
apologizing well · handling criticism · saying thank you at work · caring for
someone without disappearing · noticing your own progress · easing perfectionism

## Writing a challenge

The check enforces the shape; this is the intent behind it.

- **One theme per challenge, named for the practice, not for a number of
  days.** "Fostering Gratitude", not "30-Day Gratitude Challenge": the member
  picks the length. Under 60 characters, no closing period.
- **The description is one or two sentences** (15 to 55 words) on what the
  challenge is designed to accomplish and who it is for. It never repeats the
  title.
- **Thirty to-dos** (the check allows up to sixty). Each is one small action a
  member could do that day, written as an instruction: 20 to 220 characters,
  starts with a capital, ends with a period or a question mark. "Write down
  three things that went right today, however small." Never "reflect on
  gratitude".
- **The to-dos stand alone and in any order.** Days cycle when a run is longer
  than the bank, so a to-do never says "day 12" or "yesterday you…". The last
  one or two can look back over "this challenge", because the member reaches
  them at the end of any length that fits the bank.
- **Every to-do is new.** The check refuses a to-do that already appears in any
  other challenge, and two challenges that share a quarter of their to-dos. Two
  themes can be close (worry and grounding) as long as the to-dos differ.
- **Nothing that measures the reader.** No scores, no streaks, no "if you
  missed a day". A missed day is a day.
- **No invented evidence.** No studies, no percentages, nothing
  "science-backed" or "clinically proven". Say what to do and, when it helps,
  why it tends to help.
- **Never about the reader's diagnosis.** No labels for people, nothing that
  reads as screening or treatment. The page already carries the notice that a
  challenge is not a diagnosis or a treatment.
- **Anything tagged Grief, Loss, Trauma or Panic names 988** in one of its
  to-dos, spelled as call or text.
- **US English** (`CLAUDE.md` has the table).
- **One theme from `CATEGORIES` and one to three tags from `TAGS`**, the same
  tag vocabulary the worksheets, articles and checklists use.
