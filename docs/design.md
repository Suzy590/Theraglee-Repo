# Page design: the Today look

The member dashboard's **Today** tab sets the look for every member page. The
other dashboard tabs follow it, and so should any page or tab added later.

## The pieces

All of these live in `site/assets/styles.css`, so any page that loads it can
use them.

| Piece | Class | What it looks like |
| --- | --- | --- |
| Zone | `.zone` | A soft green panel with rounded corners that holds a section. |
| Zone heading | `.zone-head` | A large `h2` with one muted line under it. |
| Card | `.card` / `.tile` | A white box with a soft shadow, sitting inside a zone. |
| Label | `.kicker` | Small gray capitals above a card's text ("Quote", "Tip"). |
| Pill | `.badge` | A small rounded tag ("Premium membership", "Today's affirmation"). |
| Feature line | `.hero-line` (dashboard) | Large italic serif text, as in the affirmation. |

## How a tab or page is laid out

1. The top left of the dashboard stays the same on every tab: the date and
   membership pill, "Hello, name", and under it the Theraglee Match Mode
   switch with ON or OFF beside it. While it is on, a "What therapists see"
   link to the right of ON opens the line therapists read (and a way to change
   it) on hover or tap, and under the switch a circled "i", "How Theraglee
   Match Mode works", opens the consent wording the same way.
2. To the right of the greeting, each tab shows one white card with a pill
   naming the tab and a short italic line (`.tab-intro`, all of them inside
   `.dash-intro` in `site/dashboard.html`; `showTab()` turns on the one for
   the open tab). Today shows its affirmation there instead.
3. Below that, across the full width, the tab's content sits in one or more
   zones in the left two thirds (`.tab-body`), with the feature showcase
   running down the right third (`.showcase-slot`, filled by `chrome()`; see
   `site.md`). Mental Health Goals is the one tab without a slot: its trail
   and map take the full width.

```html
<section class="zone" aria-labelledby="journal-zone-title">
  <div class="zone-head">
    <h2 id="journal-zone-title">Journal</h2>
    <p class="muted">One plain sentence on what this section is for.</p>
  </div>
  <div class="card">…</div>
</section>
```

Headings further down a zone use `h2` too and come out a size smaller on
their own; add `class="zone-sub"` on the dashboard for the usual spacing.

## The Fun tab

The Fun tab keeps the same zone and tiles, with a little more play: the zone
sits on a faint dotted ground, and each tile carries a small picture (Pip,
a question bubble, a mini mandala) on a pale tint above its title, with an
"Open" arrow under the note. On hover the picture lifts and tips (the mandala
turns) and the arrow slides. All of it is in `site/dashboard.html` (`.fun-zone`,
`.fun-tile`, `FUN_ART`, `funTiles()`), and the motion is off for anyone whose
system asks for reduced motion. Keep new Fun tiles in that shape rather than
adding a plain tile beside them.

## Pages outside the dashboard

Challenges and Mandalas show the same pattern on a page of their own: the
page's `h1` and a muted line of introduction, then each section in a `.zone`
with its `.zone-head`, cards inside. The feature showcase takes the right
third of every such page on its own (`chrome()` puts it there), so a page's
content has two thirds of the width to work with. A new member page starts
the same way. (Mental Health Goals used to be such a page; it is a dashboard
tab now, with its wellness note above its one zone, which holds the
three-level card and the trail map.)

## Adding a new dashboard tab

- Add its button to `#tabs` and its name to `PANELS` in `site/dashboard.html`.
- Add a `.tab-intro` card for it inside `.dash-intro`, beside the others,
  with `data-panel` set to the tab's name.
- Wrap its content in a `.zone` with a `.zone-head`, as above, inside a
  `.tab-body`, and put an empty `.showcase-slot` after it for the showcase.
- Put forms, lists and grids inside white cards, not straight on the green.
