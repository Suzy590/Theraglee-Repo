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
supabase/
  functions/           The Stripe Edge Functions (checkout, portal, webhook,
                       identity, connect, session payments) — see docs/stripe.md
  migrations/          Schema changes that go with them
documents/
  index.html           Browsable library of all 518 documents
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
| `article` | Reading measure, serif lede, labeled callouts | Editorial |
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
| `worksheets.json` | `worksheets` | 186 |
| `quizzes.txt` | `quizzes` + `quiz_questions` + `quiz_bands` | 312 (1,503 q, 1,247 bands) |
| `journal-prompts.txt` | `daily_content` where `kind = 'journal_prompt'` | 372 |

The 372 journal prompts are grouped into 11 themed collections at build time
(keyword rules live in `THEMES` in the generator), which is why 518 documents come
out of 879 source rows.

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

---

## The site itself (`site/`)

`site/` is the live site. Vercel is linked to this repository with `site/` as
its root directory, so **a push to the default branch deploys it** — the "swap
to the normal Git → Vercel flow" that [`docs/site.md`](docs/site.md) had been
asking for. The old route, copying files into the `site_files` table in Supabase
and redeploying by hand, is retired.

Everything in `site/` is served verbatim and is therefore public. Documentation
lives in [`docs/`](docs/), outside the deployed directory, so it cannot be
served; `site/.vercelignore` excludes `*.md` as a backstop.

Moving the domain from HostGator to Vercel is written up in
[`docs/hosting-migration.md`](docs/hosting-migration.md).

### Payments

Memberships, sales tax, therapist identity checks, fraud screening and session
payments all run on Stripe, through the Edge Functions in `supabase/functions/`.
[`docs/stripe.md`](docs/stripe.md) explains how the pieces fit and walks
through switching each one on. The pure decision logic is covered by
`tests/billing-logic/check.mjs`.

### Member library: favorites, save for later, progress

`site/assets/library.js` is the one place these three member behaviors live, so
every activity page behaves the same way and the dashboard has a single source
to read from.

| Behavior | Where it is stored |
|---|---|
| Favorite | `favorites` with `list = 'favorite'` |
| Save for later | `favorites` with `list = 'later'` |
| Started / completed | `item_progress (answered, total)` → generated `status` |

`item_progress.status` is a **generated column** — `not_started` at zero answers,
`completed` once `answered >= total`, `started` in between — so it can never
disagree with the counts it is derived from.

An activity counts as **started** at one answer and **completed** when every
answer is in. Worksheets count filled fields (a table field counts once any cell
is filled), quizzes count answered questions, checklists count ticked items.
Articles have no questions, so they carry an explicit **Mark as read**.

The favorite control is the **"ee" from the wordmark with its smile** —
`brand/assets/favorite.svg`, traced from `logo.png` so the curves are the real
letterforms rather than an approximation. It reads as a small face and stays
legible down to 16px.

Members see **Favorites**, **Saved for later** and **Picked up but not finished**
on the dashboard, and can filter the library by the same views on Explore.

Logic is covered by `tests/library-fixture/` — see its README.
