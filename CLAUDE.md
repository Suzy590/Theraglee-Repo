# Theraglee — repo conventions

## Write in US English

Theraglee is a US site. Everything written here — page copy, UI labels, code
comments, CSS class names, docs — uses US spelling:

| Use | Not |
| --- | --- |
| color, coloring | colour, colouring |
| behavior, behavioral | behaviour, behavioural |
| license (noun and verb) | licence |
| favorite, favorites | favourite, favourites |
| counseling | counselling |
| personalized | personalised |
| judgment | judgement |
| center, centered | centre, centred |
| canceled, canceling | cancelled, cancelling |
| gray | grey |
| labeled | labelled |
| program | programme |
| practice (noun and verb) | practise |

Two deliberate exceptions, both stored values rather than words on a page:

- `ar_assignments.state` is `'cancelled'`, with a `cancelled_at` column, and
  Stripe returns `?checkout=cancelled`. These are a data contract — do not
  rename them. Only the labels a member reads use `Canceled`.
- `.badge.grey` remains in `site/assets/styles.css` and `brand/theraglee.css`
  as an alias of `.badge.gray`, so markup published before the switch still
  renders. Write `.gray` in new markup.

## `documents/` is generated

Never hand-edit `documents/`. It is built from `data/` by the generator:

```bash
python3 tools/build_documents.py
```

Change `tools/build_documents.py` (or the source rows in `data/`), then re-run
it and commit the regenerated output.

## The search landing pages are generated

`site/tools/`, `site/articles/` and `site/sitemap.xml` are built from
`data/seo-pages.json`, and the FAQ structured data on `site/index.html` and
`site/for-therapists.html` is rebuilt from the questions visible on those pages.
Never hand-edit that output:

```bash
python3 tools/build_seo_pages.py
```

`docs/seo.md` is the guide.

The free tool list the Sunday email draws from is generated too, from the
browser's own copy in `site/assets/discover-tools.js`:

```bash
node tools/discover_tools_sql.mjs
```

`docs/weekly-tool-email.md` is the guide.

## `site/` is deployed verbatim

A push to the default branch deploys `site/` via Vercel, and every file in it is
publicly readable. Documentation belongs in `docs/`, never in `site/`.

## `supabase/` is the source of truth for the backend

The Stripe Edge Functions live in `supabase/functions/` and their schema changes
in `supabase/migrations/`. Change them here, run
`node tests/billing-logic/check.mjs`, and deploy with the Supabase CLI — never
edit a function in the Supabase Dashboard, or the next deploy will overwrite it.
`docs/stripe.md` is the guide.

## Checklists grow by two a day

Every checklist carries a description — one or two sentences on what that
checklist is designed to accomplish — and two new ones on new themes are added
every day, never repeating a list the library already has. The repo copy is
`data/checklists.json`; check it with `node tests/checklists-fixture/check.mjs`,
generate the SQL with `python3 tools/checklists_sql.py`, and follow
`docs/checklists.md` for the daily routine and the writing rules.

## Challenges are themed, and two new themes arrive every day

A challenge is a theme ("Fostering Gratitude") with 365 daily to-dos, one for
every day of a year; the member picks how many days it runs (7 to 365). Never
name one for a number of days, and never mention streaks. The repo copy
is `data/challenges.json`; check it with `node tests/challenges-fixture/check.mjs`,
generate the SQL with `python3 tools/challenges_sql.py`, and follow
`docs/challenges.md` for the daily routine and the writing rules.

## Articles are free, and five arrive every day

Every article is `min_level = 0` (the database enforces it). The repo copy is
`data/articles.json`; check it with `node tests/articles-fixture/check.mjs`,
generate the SQL with `python3 tools/articles_sql.py`, and follow
`docs/articles.md` for the daily routine and the writing rules.

## Mandalas grow by two a day, and a shipped figure never changes

A mandala is drawn in the browser from its `seed` and, for a shaped one, the
outline named by `shape` in `site/assets/mandala-shapes.js`. A saved coloring
points at region indexes, so never change `site/assets/mandala.js`'s drawing,
an outline a row uses, or a row's seed or shape; add a new outline instead.
`node tests/mandala-fixture/check.mjs` guards this, and
`node tools/mandala_check.mjs` checks new figures in a browser. Two new ones
in animal or plant shapes arrive every day; follow `docs/mandalas.md` for the
routine and for how to draw an outline. Merge before applying the migration,
never the other way round.

## Mood factors are a data contract

The Mood tab on the dashboard stores its nine 1 to 10 factors and the weather in
`mood_logs`. The weather keys in `site/assets/mood-patterns.js` must match the
check in the migration; `node tests/mood-patterns/check.mjs` guards this.
`docs/mood.md` is the guide.
