# Theraglee document design system

Stylized, print-ready templates for the six Theraglee content families —
**mental health challenges, articles, checklists, journal prompts, quizzes and
worksheets** — plus a document rendered for every item currently in the content
library.

Palette, typography and radii are taken verbatim from the live site's
`assets/styles.css`, so a printed worksheet and the web app read as the same
brand.

**Start here:** open [`documents/index.html`](documents/index.html) for the
library, or [`brand/brand-guide.html`](brand/brand-guide.html) for the system
itself.

---

## What's in here

```
brand/
  theraglee.css        The whole design system — one file, six categories
  brand-guide.html     Visual reference: palette, type, components, rules
  assets/              Logo, favicons, the sunburst mark as SVG
templates/
  _skeleton.md         How a template is put together
  challenge.html       Six blank templates, one per category
  article.html
  checklist.html
  journal.html
  quiz.html
  worksheet.html
data/                  Content exported from Supabase (the build input)
tools/
  build_documents.py   Renders data/ into documents/
documents/
  index.html           Browsable library of all 99 documents
  CONTENT-HEALTH.md    Source-data defects found while building
  challenges/ articles/ checklists/ journal-prompts/ quizzes/ worksheets/
```

## How the design system works

Every document is the same five blocks — masthead, cover, body, colophon, and
the sheet that wraps them. Only the body differs by category.

Category personality comes from a single hook: `data-doc` on `<body>` re-points
three accent variables, and one component unique to that category does the rest.

| `data-doc` | Signature component | Feel |
|---|---|---|
| `challenge` | Numbered day rail with a connecting line | A journey you return to |
| `article` | Reading measure, serif lede, labelled callouts | Editorial |
| `checklist` | Banded rows, action over explanation | Crisp, scannable |
| `journal` | Serif prompts over ruled space | Quiet, spacious |
| `quiz` | Scored options, tally box, banded results | Structured |
| `worksheet` | Numbered sections, generous fill space | Warm clinical |

Everything else — the masthead, the eyebrow chip, badges, notes, write-on lines,
tables, and the print rules — is shared. That is what keeps six document types
looking like one family.

Two conventions worth knowing:

- **The masthead never names the category.** It carries the brand line; the
  eyebrow chip below the title names the category.
- **The eyebrow carries a fact as well as a name** — `30-DAY CHALLENGE`,
  `ARTICLE · 5 MIN READ` — and that fact is not repeated in the meta row.

## Building the documents

```bash
python3 tools/build_documents.py            # write documents/
python3 tools/build_documents.py --inline   # also write self-contained copies
```

No dependencies beyond Python 3.9+. `--inline` additionally writes
`documents/_standalone/`, where each file embeds its own CSS and logo so it can
be emailed or hosted on its own.

Documents in `documents/` are generated. To change how they look, edit
`brand/theraglee.css` or the renderer in `tools/build_documents.py` and rebuild
— don't hand-edit the output.

## Printing

The stylesheet has a real print mode: the sheet loses its border, shadow and
radius, the page goes full-bleed at Letter with 14 mm margins, and every atomic
unit (a day, a checklist row, a question, a score band, a form field) carries
`break-inside: avoid` so nothing is orphaned across a page break.

Print from any browser, or:

```bash
chromium --headless --no-pdf-header-footer \
  --print-to-pdf=out.pdf documents/challenges/7-day-mental-health-reset.html
```

## Where the content comes from

`data/` is an export of the Supabase content library
(project `oekqzuguruyqkafsqhos`):

| File | Source table | Rows |
|---|---|---|
| `articles.json` | `articles` | 2 |
| `checklists.json` | `checklists` | 4 |
| `challenges.json` | `challenge_templates` + `challenge_days` | 3 (67 days) |
| `worksheets.json` | `worksheets` | 17 |
| `quizzes.txt` | `quizzes` + `quiz_questions` + `quiz_bands` | 62 (253 q, 247 bands) |
| `journal-prompts.txt` | `daily_content` where `kind = 'journal_prompt'` | 372 |

The 372 journal prompts are grouped into 11 themed collections at build time
(keyword rules live in `THEMES` in the generator), which is why 99 documents come
out of 460 source rows.

`quizzes.txt` is a compact pipe-delimited format rather than JSON — `Q|` a quiz,
`P|` a question, `O|value|label` an option, `B|min|max|label|interpretation` a
score band — because JSON escaping tripled the size of the file for no benefit.

### A note on the source data

Several rows carry import artifacts: authoring prompts saved as worksheet
titles, words run together where hyphens and line breaks were stripped, and
`section`/`label` pairs that are off by one. **Nothing in this repo rewrites the
author's words.** Two structural repairs are applied so documents render
sensibly, and both — along with every other defect found — are listed in
[`documents/CONTENT-HEALTH.md`](documents/CONTENT-HEALTH.md) so they can be
fixed at the source.

Re-exporting from Supabase after fixing them and re-running the build is enough
to pick the corrections up.
