# Library fixture

Exercises `site/assets/library.js` (favorites, save for later, progress) against
an in-memory stub of `app.js`, so the logic can be checked without Supabase and
without a signed-in member.

```bash
cp ../../site/assets/library.js ../../site/assets/styles.css assets/
python3 -m http.server 8898
```

Open `http://localhost:8898/`. Assertions render at the bottom of the page and
are also written to `document.title`, so it works headless:

```bash
chromium --headless --virtual-time-budget=8000 --dump-dom http://localhost:8898/ \
  | grep -o '<title>[^<]*'
```

Two gotchas worth keeping in mind if you extend it: ES modules need a real
origin (`file://` will not load them), and `setTimeout` does not advance under
`--virtual-time-budget`, so the fixture flushes microtasks instead of sleeping.
