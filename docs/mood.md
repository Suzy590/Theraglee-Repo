# The Mood tab

The member dashboard has a **Mood** tab (`dashboard.html#mood`), open to every
signed-in member. The admin screen (`admin.html#mood`) and the therapist
practice dashboard (`therapist-dashboard.html#mood`) have the same tab, drawn by
the same code, for that account's own check-in. Every copy reads and writes the
signed-in account's own `mood_logs` rows, so a day submitted on one tab shows as
submitted on the others. It does three things:

1. **The day's mood.** One tap on one of five faces (`mood_logs.mood`, 1 to 5).
2. **What might be shaping it.** Once the face is tapped, the member rates nine
   factors for how each feels *today*, one tap each on a 1 to 10 scale, where
   1 is terrible and 10 is fantastic: sleep, home life stress, school/work
   stress, nutrition, hunger in this moment, loneliness, overall thoughts,
   level of physical activity and social interaction. Then the weather, from
   ten emoji. These taps are only marked on screen. A **Submit** button at the
   bottom stays grayed out until all ten are answered; pressing it saves them
   together and shows "All done for today". The face tap itself saves straight
   away, so a day with only a face still counts as a day logged.
3. **Your mood patterns.** Until there are 7 days with a mood (in a row or not)
   the tab says how many days are logged and how many are left. From day 7 it
   says which factors move with the mood.

## One submitted check-in a day

Once submitted, the day is final: the answers clear from the screen, the faces
are locked, and "All done for today" stays until the member's next calendar
day, which starts at their own midnight (the page uses the browser's local date
for `logged_on`). The next day opens blank. A page left open past midnight
redraws itself for the new day the next time it is looked at, and a tap or
Submit made on yesterday's page resets it instead of saving to yesterday.
Ratings picked but not submitted are never saved, so they are never shown
again. The
database enforces this too:
`supabase/migrations/20260925130000_mood_submit_once_a_day.sql` adds
`mood_logs.submitted_at` and a trigger that refuses any change to a submitted
day's mood, factors, weather, date or `submitted_at`, from any page. The
`notes` column stays editable.

Every rating runs the same way, so a higher number is always the better day:
10 for stress means no stress, 10 for loneliness means connected.

## Where it lives

| Piece | Where |
|---|---|
| The tab | `site/assets/mood-ui.js`, mounted by `site/dashboard.html`, `site/admin.html` and `site/therapist-dashboard.html` when their Mood tab opens |
| Styles | `site/assets/mood.css`, linked from all three pages |
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

The account page's data export includes every column because it selects `*`.
The Premium **Goals & tracking** page no longer has a Mood tab (removed
2026-09-25); it links to the dashboard's Mood tab instead. Before 2026-09-25
"today" was the UTC date, which in the US turns over in the evening, so an
evening check-in from before then may sit on the following day.
