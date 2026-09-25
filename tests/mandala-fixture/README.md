# Mandala fixture

Checks the drawings in `site/assets/mandala.js` and the outlines in
`site/assets/mandala-shapes.js`. Nothing here touches Supabase.

```bash
node tests/mandala-fixture/check.mjs
```

A saved coloring is a map from region index to color, so a drawing that
changes moves every coloring made on it. The check asserts:

- every round mandala (seeds 1 to 6000, which covers all 200 round rows) draws
  exactly as it did before shaped mandalas arrived;
- every batch of shaped mandalas (42 in `20260924180000_shaped_mandalas.sql`,
  12 in `20260924190000_more_animal_mandalas.sql`, 12 in
  `20260925020000_more_plant_mandalas.sql`) draws exactly as it
  shipped, and every shaped row belongs to a batch in `BATCHES`;
- every outline has a pattern part, a known `kind`, and a `heart` inside the
  pattern; every shaped row in the migrations names an outline that exists,
  has a unique slug, and has between 40 and 160 shapes to color.

To add shaped mandalas, add rows in a new migration (and, for a new outline, a
new key in `SHAPES`), then add the batch to `BATCHES` with the hash the check
prints. Never reshape an outline or move its `heart` once a row
uses it.
