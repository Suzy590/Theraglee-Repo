# Articles fixture

Data checks for `data/articles.json`, the repo copy of the `articles` table.
Run from the repo root:

```bash
node tests/articles-fixture/check.mjs
```

It fails the build if any article is malformed, a slug or title repeats, an
article is not free (`min_level` must be 0 — the database enforces the same
with a check constraint), the excerpt is a cut of the opening rather than a
written summary, the body is outside 600 to 1300 words or lacks section
headings, a heavy topic is missing the 988 line, the copy invents a study or a
percentage, or it slips into UK spelling. The two articles imported from the
original Word documents are listed as legacy and keep their shape.

How to write an article that passes is in `docs/articles.md`.
