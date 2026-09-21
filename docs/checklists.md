# Checklists — two new ones every day

A checklist is the quickest thing in the library: eight or so lines to tick,
each one an action with a short reason beside it. A member opens one, ticks
what is true today, and the page keeps that day's progress. **Two new
checklists are added every day**, each on a different theme, so the library
keeps growing without ever repeating itself.

## How access works

| Piece | Where | How |
|---|---|---|
| Reading and ticking | `checklists` table, `site/checklist.html` | `min_level = 1` — every registered member, free tier included |
| Today's ticks | `checklist_progress` (one row per member, per checklist, per day) | RLS `own rows` |
| Counting toward the dashboard | `item_progress` (ticked / total) | RLS `own rows` |
| Favorite and save for later | `favorites`, `item_type = 'checklist'` | RLS `own rows` |
| The library tile | `content_catalog`, `site/explore.html` | the tile shows the title, the **description** and the theme |
| Print-ready copy | `documents/checklists/<slug>.html` | built by `tools/build_documents.py` |

Every checklist carries a description: one or two sentences saying what that
checklist is designed to accomplish. It is what a member reads on the tile
before opening it, and it sits under the title on the page itself, so it is
worth writing well — it is the whole pitch for the list.

## Where a checklist lives

The rows live in the database and the repo copy is `data/checklists.json`. The
two are kept in step the same way as articles and worksheets: edit the JSON,
run the check, generate the SQL, apply it, regenerate `documents/`.

```bash
node tests/checklists-fixture/check.mjs                 # data checks
python3 tools/checklists_sql.py --since 2026-09-21      # SQL for a day's two (an upsert on slug)
python3 tools/checklists_sql.py slug-a slug-b           # or by slug
python3 tools/build_documents.py                        # the print-ready copies in documents/
```

The generated SQL goes in a migration named
`supabase/migrations/<YYYYMMDD>160000_checklists_<YYYY_MM_DD>.sql` and is
applied to the project (`oekqzuguruyqkafsqhos`) with the Supabase CLI, the
Supabase MCP `apply_migration` tool, or
`.github/workflows/apply-content-migrations.yml` once the `SUPABASE_DB_URL`
secret is set. It is an upsert on `slug`, so applying it twice is harmless and
an edited checklist keeps its id, along with every member's ticks and favorites.

`published_at` says when a checklist joined the library. It is null for the four
imported from the original Word documents and set to the day's date at
16:00:00+00:00 for everything written since.

## The daily routine

A scheduled routine ("Theraglee daily checklists", created 2026-09-21) runs every
day at 16:00 UTC (noon Eastern) and writes two new checklists on two themes the
library does not have yet. It fires into the session that set it up, so it has
the Supabase connection and can put the day's rows in the database itself.

**The database step is the one that reaches members.** `site/checklist.html` and
the library read from the `checklists` table, so the two new checklists are live
as soon as the migration is applied, whether or not the day's pull request has
been merged. The pull request keeps the repo copy, the counts and the printable
documents in step; it waits for the owner to merge.

Each day's session:

1. Reads this file, `CLAUDE.md`, and the title, theme and tags of every
   checklist already in `data/checklists.json` — for voice, and so the day's
   two are genuinely new.
2. Writes two new checklists on two different themes and appends them to
   `data/checklists.json` with today's date at 16:00:00+00:00.
3. Runs `node tests/checklists-fixture/check.mjs` and fixes anything it flags.
4. Generates the day's migration with `tools/checklists_sql.py --since <today>`
   and applies it to the database.
5. Confirms with a query that the two rows are in `checklists`.
6. Runs `python3 tools/build_documents.py` and bumps the checklist counts in
   `README.md` and `docs/site.md`.
7. Commits to its own `claude/...` branch, pushes, opens a draft pull request
   titled `Daily checklists for <YYYY-MM-DD>`, and watches it: if a check fails
   it fixes it and pushes again. The owner merges it.

To have each day's pull request merge itself the way the daily articles run
does, add that step to the routine's instructions from the Routines list on
claude.ai — a Claude Code session in auto mode is not allowed to write a
merge-without-review step into a routine.

If a day is missed the next day does not double up; the library simply gets two
that day.

## Themes

A checklist belongs to one theme, the word that follows "Checklist" on the
library tile. The list of themes is `CATEGORIES` in
`tests/checklists-fixture/check.mjs`; add a theme there before using it. Ground
worth covering, a couple of themes at a time:

nervousness before something that matters · winding down in the evening ·
getting out of bed on a heavy morning · coming back from a panic wave ·
saying no · a hard conversation you have been putting off · the Sunday dread ·
the first day back after time off · studying without spiraling · money worry ·
loneliness on a long weekend · a friend who is struggling · doom-scrolling ·
anger that arrives fast · the week after a loss · a flare of the inner critic ·
returning to exercise · a medical appointment that frightens you · parenting on
no sleep · caring for someone who needs a lot · moving to a new place · a first
therapy session · a birthday that lands hard · the hour before sleep will not come

## Writing a checklist

The check enforces the shape; this is the intent behind it.

- **One clear job per checklist.** A member should be able to say when they
  would open it: before an interview, at 10 pm, on the second bad morning in a
  row. Vague lists get ticked once and never again.
- **Five to twelve items**, eight is the sweet spot. Each one is
  `Action — why it helps`: a short action a member could do in a minute, an em
  dash, then one sentence on what it does. The action half is under 60
  characters, because that is the part a member scans.
- **Things you do, not things you are.** "Put both feet flat on the floor", not
  "feel more grounded". No item that asks a member to judge themselves.
- **The description is one or two sentences** (15 to 55 words) on what the
  checklist is designed to accomplish. It says who it is for and when to open
  it; it never repeats the title back.
- **A title under 60 characters**, no closing period, plain words — "Winding
  Down for the Evening", not "Evening Optimization Protocol".
- **One to three tags** from the fixed vocabulary in the check, the same one the
  worksheets and articles use, plus one theme from `CATEGORIES`.
- **No invented evidence.** No studies, no percentages, nothing
  "science-backed". Say what a step does and why it tends to help.
- **Never about the reader's diagnosis.** No labels for people, nothing that
  reads as screening. The page already carries the "not medical advice" notice.
- **Anything tagged Grief, Loss, Trauma or Panic names 988** in one of its
  items, spelled as call or text.
- **US English** (`CLAUDE.md` has the table).
- **Never a checklist the library already has.** Read the titles and themes
  first. The check refuses two lists that share half their actions, but a new
  angle on old ground is better than a new name for it.
