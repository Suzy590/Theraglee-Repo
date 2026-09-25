# Mandalas — two new shaped ones every day

The mandalas page (`site/mandalas.html`, Premium) has round mandalas and
**shaped** ones: an animal, a plant or a symbol, with the mandala's rings of
petals, dots and scallops clipped inside the outline and plain colorable parts
(eyes, legs, a stem) around it. **Two new shaped mandalas are added every day,
each in an animal or plant shape the library does not have yet**, so the
gallery keeps getting more varied.

`docs/site.md` ("Mandalas: print or color online") explains the page, saving
and sharing. This file is about adding figures.

## How a figure is stored

A `mandalas` row is `slug`, `title`, `seed`, `shape` (and `min_level`, 3 by
default). Nothing else is stored: the browser draws the figure from the seed,
inside the outline named by `shape`, with `site/assets/mandala.js`. The
outlines are the `SHAPES` table in `site/assets/mandala-shapes.js`.

A member's saved coloring is a map from region index to color, so **a figure
that draws differently loses every coloring made on it**. That makes three
things a data contract once a row uses them:

- the drawing code in `mandala.js`;
- every outline in `SHAPES`, including its `heart` and the order of its parts;
- the seed and shape of every row.

Add a new outline rather than reshaping one that shipped.
`node tests/mandala-fixture/check.mjs` fails if any shipped figure draws
differently: it keeps a hash of each migration's batch of shaped rows in
`BATCHES`.

## Drawing a new outline

An outline is a list of parts on the same 200 x 200 page as the round mandalas,
painted in order:

| Layer | What it is | Examples |
|---|---|---|
| `back` | a plain colorable shape behind the pattern | legs, a stem, ears, a quill |
| `pattern` | filled with the mandala's rings, centered on `heart` | a body, a shell, a flower head, a leaf |
| `front` | a plain colorable shape on top of the pattern | eyes, a beak, a nose, a bud |

Parts that share a `g` are one group for **Whole ring** (both eyes, four legs).
`lines` are strokes that never take a color (whiskers, antennae) and `dots` are
small filled ink dots. Give each outline a `label` and a `kind` of `animal`,
`plant` or `symbol` (the gallery filters use it).

Paths are absolute `M`, `L`, `C`, `Q` and `Z` only, so the drawing code can
test which pattern shapes land inside. The helpers at the top of
`mandala-shapes.js` save most of the work:

| Helper | Draws |
|---|---|
| `sym(start, segs)` | a left-right symmetric outline from its right half (cubic segments down the right side) |
| `ellipse(cx, cy, rx, ry, rot)`, `circle(cx, cy, r)` | ellipses and circles, optionally turned |
| `polar(cx, cy, radiusFn)` | an outline traced by a radius function (sunflower petals, a sun, a treetop) |
| `poly(points)` | a closed outline through points |
| `star`, `crescent`, `snowflake`, `cloud`, `drop` | the shapes they name |

What makes an outline work, learned the hard way:

- **Recognizable at a glance.** Front features do most of the work: an owl
  needs its eyes and beak, a rose its curled bud, a feather its shaft. Look at
  the picture and keep changing the outline until someone would name it without
  the title.
- **Keep it inside 4 to 196** on both axes, and leave the pattern part big
  enough for a few rings (at least about 70 across).
- **Put `heart` where the pattern has room**, inside a pattern part and not
  under a front part: a center hidden under an eye or an ear leaves a spot that
  cannot be colored.
- **Pattern parts should not overlap each other.** Their outlines are drawn on
  top, so an overlap draws a line straight through the pattern. One outline
  with the whole silhouette is usually better than several.
- **Plain parts should be real shapes to color**, not slivers. A stem 8 wide is
  fine, a line 2 wide is not; use `lines` for anything that thin.
- Only pattern shapes that clearly show inside the outline become regions, so
  every region can be tapped. That is automatic; the checker below confirms it.

Look at what is already in `SHAPES` before starting: it is the best reference
for proportions, and it tells you what is taken.

## Checking a figure

```bash
node tools/mandala_check.mjs --preview /tmp/fox.png fox     # draw an outline with three seeds, to look at
node tools/mandala_check.mjs --png /tmp/new.png fox otter   # pick a passing seed for each, and save a picture
node tools/mandala_check.mjs fox:11101                      # check one figure
node tests/mandala-fixture/check.mjs                        # the data contract
```

`tools/mandala_check.mjs` runs each figure in headless Chromium. A figure passes
when every region can be tapped and fills, nothing inside the outline is left
uncolorable, and it has 45 to 130 shapes to color. Given a shape without a
seed, it tries seeds until one passes and prints it with `"ok": true`; if none
does, the outline needs rework (usually the `heart`, or a pattern part that is
too thin).

## Ideas not used yet

Animals: lion, dog, cow, pig, sheep, frog, duck, swan, dolphin,
seahorse, jellyfish, crab, starfish, bee, ladybug, dragonfly, peacock,
flamingo, hummingbird, parrot, koala, panda, giraffe, camel, squirrel, mouse,
raccoon, llama, sloth, otter, seal, chick, hen, goldfish, kangaroo, tiger,
wolf, zebra, walrus.

Plants: oak leaf, fern, palm tree, pine tree, daisy, lily, iris,
poppy, lavender, bonsai, strawberry, cherries, pear, lemon, pumpkin, carrot,
succulent, water lily, monstera leaf, ginkgo leaf, pinecone, dandelion, potted
plant, bamboo, orchid, hibiscus, grapes, mushroom cluster, holly.

Cross each one off this list in the same commit that adds it, and add fresh
ideas when the list runs low. Never add an outline for something the library
already has under another name.

## The daily routine

A scheduled routine ("Theraglee daily mandalas", created 2026-09-25) runs every
day at 18:10 UTC (2 pm Eastern). The owner asked for two new mandalas a day in
various animal or plant shapes, added to the library and merged automatically,
with nothing needed from them.

Each day's session:

1. Reads this file, `CLAUDE.md`, and the `SHAPES` table, so the day's two are
   new and match the style of the others.
2. Adds **two new outlines** to `SHAPES`, one animal and one plant unless the
   idea list makes two of one kind better, each from the list above or a fresh
   idea. It previews them with `--preview`, looks at the picture, and reworks
   each outline until it is recognizable.
3. Picks a seed for each with `tools/mandala_check.mjs --png`, and confirms both
   lines say `"ok": true`.
4. Names each one: a title under 40 characters with the animal or plant in it
   and a calm word ("Sleepy Otter", "Autumn Maple"), a slug from the title, and
   checks with a query that neither slug nor title is already in the
   `mandalas` table.
5. Writes `supabase/migrations/<YYYYMMDD>181000_mandalas_<YYYY_MM_DD>.sql`
   (the same shape as `20260925040000_more_symbol_mandalas.sql`: a comment
   header and one `insert ... on conflict (slug) do nothing`), adds the day's
   batch to `BATCHES` in `tests/mandala-fixture/check.mjs` with the hash the
   check prints, and runs the check until it passes.
6. Bumps the mandala counts in `docs/site.md` (the Premium list and the
   Mandalas section) and crosses the two ideas off the list above.
7. Commits, pushes its own `claude/mandalas-<YYYY-MM-DD>` branch, opens a pull
   request titled `Daily mandalas for <YYYY-MM-DD>`, and merges it itself once
   its checks are green.
8. **Only after the merge has deployed** (the new outline keys show up in
   `https://theraglee.com/assets/mandala-shapes.js`), applies the migration to
   the database (`oekqzuguruyqkafsqhos`). The order matters: a row whose outline
   the live site does not know yet is drawn as a plain round mandala, and a
   member who starts coloring it would lose that coloring when the outline
   arrives.
9. Confirms with a query that both rows are there, and tells the owner in plain
   words what was added.
