# The mood check-in

The member dashboard shows the mood check-in on its **Today** tab, below the
daily cards, open to every signed-in member. It had a Mood tab of its own until
2026-09-29; `dashboard.html#mood` still opens Today and scrolls to it. An admin
checks in there too, like any member: the admin screen's Mood tab was removed
on 2026-09-29, and `admin.html#mood` now goes to `dashboard.html#mood`. The
therapist practice dashboard's Mood tab was removed the same day, and
`therapist-dashboard.html#mood` now opens its Home tab. The check-in reads and
writes the signed-in account's own `mood_logs` rows. It does three things:

1. **The day's mood.** One tap on one of five faces (`mood_logs.mood`, 1 to 5).
2. **What might be shaping mood.** Shown from the start, below the faces, the member rates nine
   factors for how each feels *today*, one tap each on a 1 to 10 scale, where
   1 is terrible and 10 is fantastic: sleep, home life stress, school/work
   stress, nutrition, hunger in this moment, loneliness, overall thoughts,
   level of physical activity and social interaction. Then the weather, from
   ten emoji, and below it how the weather affected them that day, on the same
   1 to 10 scale (`mood_logs.weather_feel`). These taps are only marked on screen. A **Submit** button at the
   bottom stays grayed out until a face is tapped and all eleven are answered; pressing it saves them
   together and shows "All done for today". The face tap itself saves straight
   away, so a day with only a face still counts as a day logged.
3. **Your mood patterns.** Until there are 7 days with a mood (in a row or not)
   the tab says how many days are logged and how many are left. From day 7 it
   says which factors, and whether the weather, move with the mood.

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
10 for stress means no stress, 10 for loneliness means connected, 10 for the
weather means it felt fantastic to the member.

## Where it lives

| Piece | Where |
|---|---|
| The tab | `site/assets/mood-ui.js`, mounted by `site/dashboard.html` when its Today tab first opens |
| Styles | `site/assets/mood.css`, linked from `site/dashboard.html` |
| Factors, weather, and the analysis | `site/assets/mood-patterns.js` (no imports) |
| Columns | `supabase/migrations/20260925120000_mood_factors.sql` adds `sleep`, `home_stress`, `work_stress`, `nutrition`, `hunger`, `loneliness`, `thoughts`, `activity`, `social` (1 to 10) and `weather` to `mood_logs`; `20261008190000_mood_weather_feel.sql` adds `weather_feel` (1 to 10) and extends the submitted-day lock to it |
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
- The weather is a category, not a 1 to 10 rating, so Pearson's r does not
  apply to it. `eta()` computes the correlation ratio instead: how much of the
  day-to-day variation in mood sits between kinds of weather rather than within
  them, 0 to 1, on the same scale as |r|. It counts only kinds of weather seen
  on 2 or more days (a kind seen once would explain its own day perfectly and
  inflate the figure), and needs 7 such days across two or more kinds. The
  result is `weatherLink` and sits on the chart as a **Weather** row beside the
  nine factors, with the same *modest* / *moderate* / *strong* labels. Eta has
  no direction, so the bar is never the "opposite" color.
- A one-line key under the chart heading says what the colors mean: a green
  bar is a factor that rises with the mood, a tan one a factor that moves
  against it, and a longer bar is a closer link.
- **How the weather affected you** (`WEATHER_FEEL`, column `weather_feel`) is
  a 1 to 10 rating, so it is analyzed exactly like a factor: Pearson's r
  against the mood once it has 7 rated days that are not all the same. It is
  returned as `weatherFeel`, kept out of `factors`, `findings` and `focus`, and
  charted as its own row, "How the weather affected you". A line under the
  chart heading says that "Weather" is the kind of weather and this row is
  the member's own rating of it.
- The weather sentences come after the factor findings, in this order:
  1. When the rating's |r| is 0.3 or more: "On days the weather felt better to
     you, your mood tended to be better too (a … link)", or the lower-mood
     wording when r is negative.
  2. When the kind of weather's eta is 0.3 or more: "Your mood moves with the
     kind of weather (a … link)", naming the kind with the best average mood
     and the one with the lowest. Each kind carries the average `weather_feel`
     on its days (`types[].feel`); when the lowest-mood kind is also the kind
     the member rated lowest, the sentence says so with that average.
  3. When the rating is linked but the kind of weather has a figure below 0.3:
     a sentence that the member's experience of the weather, more than the
     forecast, may be what matters.
  4. Whenever either is linked, once: the weather is not the member's to
     change, but knowing the harder days helps them plan for those.
  Any other weather type with 2 or more days is then mentioned on its own
  when its average mood is at least 0.5 (on the 1 to 5 scale) away from the
  member's usual.
- Neither the weather nor the weather rating is ever offered as the place to
  focus: only one of the nine factors is.
- Under 14 days the tab calls the findings early hints.
- The summary is worked out again from the member's saved check-ins (up to
  the last 365 days) every time the tab opens and after every tap or Submit,
  so it stays current past day 7; the card says so.

Under the zone heading, a short paragraph tells the member that after 7 days
of check-ins (not necessarily in a row) Theraglee summarizes their possible
patterns, and that this is information only, not a diagnosis.

Every view of the patterns carries the note that this is for information only,
does not diagnose or treat any mental health condition, and that a link is not a
cause.

## Also reading `mood_logs`

The account page's data export includes every column because it selects `*`.
The Premium **Goals & tracking** page no longer has a Mood tab (removed
2026-09-25) or a Playlists tab (moved to the dashboard 2026-09-26); it links
to the dashboard's mood check-in (on Today) and Playlists tab instead. Before 2026-09-25
"today" was the UTC date, which in the US turns over in the evening, so an
evening check-in from before then may sit on the following day.
