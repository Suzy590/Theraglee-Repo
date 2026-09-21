# Checklist data checks

`check.mjs` reads `data/checklists.json` and fails if a checklist is malformed:
a repeated slug or title, a missing or over-long description, an unknown theme
or tag, an item that is not written as `Action — why it helps`, a day that did
not get its two new checklists, a heavy topic without the 988 line, UK spelling,
or copy that diagnoses the reader.

It also refuses a checklist that repeats one already in the library: any two
that share half their actions are the same list under a new name.

```bash
node tests/checklists-fixture/check.mjs
```

The tag vocabulary (`TAGS`, shared with the worksheets and articles) and the
theme list (`CATEGORIES`) live in the check itself. Add one there before using
it in the data, so the library's filters stay tidy.
