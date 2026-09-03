# How a Theraglee template is put together

Every template in this folder is the same five blocks in the same order. Only
the middle block changes between categories — that is the whole design system.

```html
<body data-doc="…">      1. Sets the accent colour for the whole document.
  <article class="sheet">
    <header class="masthead">   2. Logo left, brand line right.
    <header class="cover">      3. Eyebrow chip, title, standfirst, meta row.
    …category body…             4. The one block that differs per category.
    <footer class="colophon">   5. Crisis line + wordmark.
  </article>
</body>
```

## `data-doc` values

| Value | Category | Accent |
|---|---|---|
| `challenge` | Mental health challenges | lime `#6AB21E` |
| `article` | Articles | green `#187C1A` |
| `checklist` | Checklists | green `#187C1A` |
| `journal` | Journal prompts | green on sand |
| `quiz` | Quizzes / self-assessments | green `#187C1A` |
| `worksheet` | Worksheets | green on sand |

## The eyebrow carries the category

The masthead's right-hand text is the brand line (`a little lighter, every day`),
never the category. The category lives in the `.eyebrow` chip above the title,
and it should carry a fact as well as a name — `30-DAY CHALLENGE`,
`ARTICLE · 5 MIN READ`, `DAILY CHECKLIST`. Do not repeat that fact again in the
meta row underneath.

## Shared pieces you can use in any template

| Class | What it is |
|---|---|
| `.badge` / `.badge.grey` / `.badge.warn` | Small pill for tags, counts, tiers |
| `.section` + `h2.sec` | A titled block with a rule running off the heading |
| `.note` / `.note.warn` | Tinted callout box |
| `.lines[data-rows="n"]` | Ruled write-on area, 1–8 rows |
| `.blank` | A short inline rule for one-word answers |
| `.tickbox` | An empty square to tick |
| `table.grid` | Bordered table with a tinted header band |
| `.no-print` | Hidden when printed |

## Writing new documents

Copy the template, fill it in, and keep it inside `documents/<category>/` so the
`../../brand/theraglee.css` path resolves. Anything generated from the content
library is produced by `tools/build_documents.py` instead — edit the renderer
there rather than hand-editing generated files.
