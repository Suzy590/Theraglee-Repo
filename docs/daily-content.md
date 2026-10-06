# Daily cards

The dashboard shows one affirmation, quote, tip and fun fact ("Did you know")
a day, picked by `public.daily_pick_for()` from `public.daily_content`. The
landing page shows the same four under its hero, in a "Today on Theraglee"
zone (`site/index.html#today`): a visitor gets the open deck (`min_level = 0`,
since `daily_pick()` sees no user), a signed-in member the same personalized
pick as their dashboard. The zone stays hidden until at least one card is back.

## How a card is picked

Each member gets a deck per kind. If at least seven cards share a tag with the
member's recent topics (their `activity_log` tags, or the topics they picked on
their profile), the deck is those cards; otherwise it is every card of that
kind. The day's card walks through the deck, so it changes every day and only
repeats once the whole deck has been shown.

A deck smaller than seven is why the cards once stopped changing; see
`supabase/migrations/20260928120000_daily_pick_min_deck.sql`.

## Adding cards

The repo copy is `data/daily-content.json`: one row per card with `kind`
(`affirmation`, `quote`, `tip` or `fun_fact`), `body`, `tags`, and `author`
for quotes. The first 140 cards were seeded before the file existed and live
only in the database.

1. Add rows to `data/daily-content.json`.
2. `python3 tools/daily_content_sql.py > /tmp/cards.sql` and paste the output
   into a new migration under `supabase/migrations/`. A card whose kind and
   body already exist is skipped, so the whole file can be re-emitted safely.
3. Apply the migration.

## Writing rules

- US English, never mention streaks, never diagnose or promise a cure.
- Tags are lowercase topic words (`anxiety`, `sleep`, `boundaries`, …). Keep
  every common topic at seven or more cards per kind so it gets its own deck.
- Quotes must be real and correctly credited. When the source is doubtful,
  credit `attributed to <Name>`; proverbs are credited by origin
  (`Japanese proverb`).
- Fun facts must be well supported; hedge correlational findings and don't
  invent numbers.
