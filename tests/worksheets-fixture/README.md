# Worksheet data checks

`check.mjs` reads `data/worksheets.json` and fails if a worksheet is malformed:
a repeated slug or title, a field id out of sequence, a table without columns,
a section split in two, an unknown tag, a heavy topic without the 988 line, UK
spelling, or copy that diagnoses the reader.

```bash
node tests/worksheets-fixture/check.mjs
```

The tag vocabulary lives in the check itself (`TAGS`). Add a tag there before
using it in the data, so the library's filters stay tidy.
