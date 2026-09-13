# Clinician library — five new resources of every kind, every day

The **Library** tab on the therapist dashboard (`site/therapist-dashboard.html`)
is a set of worksheets and exercises a verified therapist with an active
membership can use with clients. The rows live in the `therapist_resources`
table, and each one has a `kind`: `worksheet`, `cbt`, `act`, `dbt`, `couples`,
`kids` or `game` (the `resource_kind` enum, and the chips on the tab). Assign
Remind picks from the same table when a therapist sets homework.

Every day, five new resources are added **for every kind in the library**.
If a new kind ever appears in the library, five of that kind join the daily
five too. The library started with 55 resources on 2026-09-01.

## Where a resource lives

The rows live in the database, and the repo copy is
`data/therapist-resources.json`. The two are kept in step the same way as
articles: edit the JSON, run the check, generate the SQL, apply it.

```bash
node tests/therapist-resources-fixture/check.mjs               # data checks
python3 tools/therapist_resources_sql.py --since 2026-09-13    # SQL for a day's resources (an upsert on slug)
python3 tools/therapist_resources_sql.py slug-a slug-b         # or by slug
```

The generated SQL goes in a migration named
`supabase/migrations/<YYYYMMDDHHMMSS>_therapist_resources_<YYYY_MM_DD>.sql`
and is applied to the project (`oekqzuguruyqkafsqhos`) with the Supabase CLI or
the Supabase MCP `apply_migration` tool. It is an upsert on `slug`, so applying
it twice is harmless, and an edited resource keeps its id and every Assign
Remind assignment that points at it.

The GitHub workflow `.github/workflows/apply-content-migrations.yml` applies
`*_therapist_resources_*.sql` files on push the same way it applies article
files, once the `SUPABASE_DB_URL` repository secret is set (see
`docs/articles.md`, "Getting the SQL into the database").

## The daily routine

A scheduled routine ("Theraglee daily clinician library", created 2026-09-13)
starts a fresh session every day at 15:00 UTC (11 am Eastern) and runs until
the owner says to stop. Each day's session:

1. Reads this file, `CLAUDE.md`, and the titles of the resources already in
   `data/therapist-resources.json` (to match the voice and avoid repeating a
   tool).
2. Asks the database which kinds are in the library today
   (`select distinct kind from therapist_resources`) and, when the database
   is unreachable, takes the kinds from the JSON instead. A kind not yet in
   `KINDS` in `tests/therapist-resources-fixture/check.mjs` is added there
   and to `KINDS` in `site/therapist-dashboard.html` so it gets a chip.
3. Writes five new resources of every kind and appends them to the JSON with
   today's date at 15:00:00+00:00 as `created_at`.
4. Runs `node tests/therapist-resources-fixture/check.mjs` and fixes anything
   it flags.
5. Generates the day's migration with
   `tools/therapist_resources_sql.py --since <today>` and applies it.
6. Confirms with a query that the day's rows are in `therapist_resources` and
   counts the rows per kind.
7. Bumps the resource count in `README.md` and `docs/site.md`.
8. Commits everything to the branch the session was given, pushes it, and
   opens one draft pull request titled
   `Daily clinician library for <YYYY-MM-DD>`.

If a day is missed the next day does not double up; the library simply gets
its five per kind that day.

## Writing a resource

The check enforces the shape; this is the intent behind it. Look at the
existing rows before writing: the voice is a colleague's note to another
clinician, not a leaflet for a client.

- **Title** under 60 characters, in title case, no trailing period. Name the
  tool, not the problem: "Worry Postponement Schedule", not "Managing Worry".
- **Summary** is one sentence, 30 to 140 characters, describing what the
  resource is. It is the line under the title on the tile.
- **Goal** is one line, 20 to 140 characters, that finishes "Use it to…" in
  the clinician's mind.
- **Audience** is one or more of Adults, Teens, Children, Couples, Groups.
  A parent-coaching sheet is for Adults; a couples tool is for Couples.
- **Duration** is plain words: "20 minutes", "Full session", "One week",
  "Five minutes daily for several weeks".
- **Clinician notes** (`body_md`) are one paragraph of 100 to 600 characters,
  in plain text: how to run it, what usually trips people up, what to watch
  for. Speak to the clinician about their client. No markup, no line breaks.
- **Client prompts** (`fields`) are 3 to 10 text boxes, ids `f0`, `f1`, … in
  order, type `textarea`, each label under 120 characters and written for
  the client in the first or second person as fits the tool.
- **Tags** are 2 to 4 short lowercase phrases (acronyms and proper names such
  as `CBT-I`, `Gottman`, `DEAR MAN` keep their case). Reuse a tag already in
  the file when one fits so the search stays useful.
- **Match the kind.** `cbt`, `act` and `dbt` resources are recognizable
  tools from those approaches, named as a clinician trained in them would
  name them. `couples` tools name both partners' parts. `kids` tools are
  drawn, decorated, built or played, and say what the parent does. `game`
  entries have rules, turns and a debrief. `worksheet` is the general
  category for everything else.
- **Safety.** A tool that touches crisis, self-harm or risk names 988 (call
  or text) in a client prompt, and the clinician notes say to complete it in
  session rather than as homework.
- **No invented evidence.** No "a 2023 study found", no percentages, no
  "clinically proven". Say what the tool does and where it tends to help.
- **Never label a person by a diagnosis.** Describe behavior and patterns.
- **US English** (`CLAUDE.md` has the table). The check catches the common
  ones.
- **Do not repeat a tool that is already in the library** under a new name.
  Read the titles first; a day's five per kind should each cover different
  ground from each other and from what is there.
