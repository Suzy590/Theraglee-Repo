# Trivia fixture

Checks the 150 mental health trivia sets in `site/assets/trivia-sets.js` and
the pure helpers in `site/assets/trivia.js`. Neither file touches Supabase, so
nothing here needs a network or a signed-in member.

```bash
node tests/trivia-fixture/check.mjs
```

It asserts there are exactly 150 sets, ten per topic, ten questions each with
four distinct options and an in-range answer; that every slug, id, title and
question is unique; that each id is the v5 UUID of
`https://theraglee.com/trivia/<slug>`; that the copy uses US spelling; and
that the copy never addresses the player's own health ("you have a
condition", "your diagnosis"), never uses "committed suicide" or other
retired phrasings, and never offers "all of the above". It also runs every set
through `playOrder()` and `score()` so a shuffle can never lose the answer.

## Adding a set

Append an entry to `trivia-sets.js` under its topic, keep the shape at the top
of that file, and give it an id with
`uuid5(NAMESPACE_URL, 'https://theraglee.com/trivia/<slug>')`:

```bash
python3 -c "import uuid; print(uuid.uuid5(uuid.NAMESPACE_URL, 'https://theraglee.com/trivia/my-new-set'))"
```

Then run the check. Never change an id once it has shipped; members' favorites
and scores point at it.
