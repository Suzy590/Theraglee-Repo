# The Mood tab

The member dashboard has a **Mood** tab (`dashboard.html#mood`), open to every
signed-in member. It does three things:

1. **The day's mood.** One tap on one of five faces (`mood_logs.mood`, 1 to 5).
2. **What might be shaping it.** Once the face is tapped, the member rates nine
   factors for how each feels *today*, one tap each on a 1 to 10 scale, where
   1 is terrible and 10 is fantastic: sleep, home life stress, school/work
   stress, nutrition, hunger in this moment, loneliness, overall thoughts,
   level of physical activity and social interaction. Then the weather, from
   ten emoji. Every tap saves on its own; any of them can be skipped.
3. **Your mood patterns.** Until there are 7 days with a mood (in a row or not)
   the tab says how many days are logged and how many are left. From day 7 it
   says which factors move with the mood.

Every rating runs the same way, so a higher number is always the better day:
10 for stress means no stress, 10 for loneliness means connected.

## Where it lives

| Piece | Where |
|---|---|
| The tab | `site/assets/mood-ui.js`, mounted by `site/dashboard.html` when the tab opens; styles in the dashboard's `<style>` |
| Factors, weather, and the analysis | `site/assets/mood-patterns.js` (no imports) |
| Columns | `supabase/migrations/20260925120000_mood_factors.sql` adds `sleep`, `home_stress`, `work_stress`, `nutrition`, `hunger`, `loneliness`, `thoughts`, `activity`, `social` (1 to 10) and `weather` to `mood_logs` |
| Test | `node tests/mood-patterns/check.mjs` |

The weather keys are a data contract: the migration's `check` lists them, and
the test fails if `WEATHER` in `mood-patterns.js` stops matching it. To add a
weather type, add it to both, in a new migration.

## How the patterns are found

`analyze()` in `mood-patterns.js`:

- For each factor with at least 7 rated days whose ratings are not all the
  same, it computes Pearson's correlation (r) between that factor and the mood.
- A factor is reported when |r| is 0.3 or more: *modest* from 0.3, *moderate*
  from 0.5, *strong* from 0.7. A negative r is reported as mood tending to be
  lower on the better days, which is rare and worth noticing.
- Of the factors that rise with mood, the one with the lowest average rating is
  named as a place to focus: it moves with the mood and has the most room to
  improve.
- A weather type with 2 or more days is mentioned when its average mood is at
  least 0.5 (on the 1 to 5 scale) away from the member's usual.
- Under 14 days the tab calls the findings early hints.

Every view of the patterns carries the note that this is for information only,
does not diagnose or treat any mental health condition, and that a link is not a
cause.

## Also reading `mood_logs`

The Premium **Goals & tracking** page (`goals.html#mood`) still shows the 30-day
chart and notes from the same rows, and the account page's data export includes
the new columns because it selects `*`. Both pages use the same UTC date for
"today", so they read and write the same row.
