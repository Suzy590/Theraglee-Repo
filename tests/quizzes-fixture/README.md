# Quiz data checks

`check.mjs` reads `data/quizzes.txt` and fails if a quiz is malformed: a
repeated slug or title, a stray `|` inside a line, a question without four
options scored 4, 3, 2, 1, bands that leave a score uncovered, an unknown tag,
a heavy topic without the 988 line, UK spelling, or copy that diagnoses the
reader.

```bash
node tests/quizzes-fixture/check.mjs             # the library (expects 312)
node tests/quizzes-fixture/check.mjs draft.txt   # a draft file, any count
```

The sixty-two quizzes imported from the original Word documents are listed in
`LEGACY` inside the check and keep their looser shape; every quiz written since
follows the house rules. The tag vocabulary lives in the check itself (`TAGS`).
Add a tag there before using it in the data, so the library's filters stay tidy.
