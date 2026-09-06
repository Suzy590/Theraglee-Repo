# Discover fixture

Checks the 360 free discovery tools in `site/assets/discover-tools.js` and the
engine that renders them, `site/assets/discover.js`. Neither file touches
Supabase, so nothing here needs a network or a signed-in member.

Two layers:

**1. Data check (Node, no browser).** Asserts there are exactly 360 tools (at least 20 per topic), every
slug, id and title is unique, ids are v5 UUIDs, every kind has the fields it
needs, every topic has at least one tool, the copy uses US spelling, and the
copy never uses diagnostic language (`diagnos…`, `disorder`, `symptom`,
`treatment`, "you have a condition" and so on; "not a diagnosis" is allowed).

```bash
node tests/discover-fixture/check.mjs
```

**2. Browser fixture.** Mounts every tool with the real engine, drives it to a
finished reflection through the DOM (clicking chips, moving sliders, typing
answers), and asserts the reflection renders, the not-a-diagnosis note is
present, user-typed text is escaped, and Start over clears state. Serve the
repo root (ES modules need a real origin):

```bash
python3 -m http.server 8899
```

Open `http://localhost:8899/tests/discover-fixture/`. Results render on the page
and in `document.title`, so it also works headless:

```bash
chromium --headless --virtual-time-budget=60000 --dump-dom \
  http://localhost:8899/tests/discover-fixture/ | grep -o '<title>[^<]*'
```

**Previewing a tool.** `preview.html` renders any tools by slug with the real
engine and stylesheet but no Supabase, which is handy for checking layout:

```
http://localhost:8899/tests/discover-fixture/preview.html?slugs=box-breathing,feelings-wheel
```

Breathing tools rely on `setInterval`, which does not advance under
`--virtual-time-budget`, so the fixture checks their controls render and
finishes them by setting the saved cycle count instead.
