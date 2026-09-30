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

1. The top of the dashboard stays the same on every tab: the date and
   membership pill, "Hello, name" with the Theraglee Match Mode switch under
   it, and to the right one box holding the "Let therapists reach out to you"
   card and the "Therapists read" line side by side.
2. Under that, across the full width, each tab shows one white card with a pill
   naming the tab and a short italic line (`.tab-intro` in
   `site/dashboard.html`). Today shows its affirmation and daily cards there
   instead.
3. Below that, the tab's content sits in one or more zones:

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

## Pages outside the dashboard

Challenges, Goals & tracking and Mandalas show the same pattern on a page of
their own: the page's `h1` and a muted line of introduction, then each section
in a `.zone` with its `.zone-head`, cards inside. Goals & tracking keeps its
wellness note above the zone, and the zone's heading follows the tab that is
open. A new member page starts the same way.

## Adding a new dashboard tab

- Add its button to `#tabs` and its name to `PANELS` in `site/dashboard.html`.
- Add a `.tab-intro` card for it beside the others.
- Wrap its content in a `.zone` with a `.zone-head`, as above.
- Put forms, lists and grids inside white cards, not straight on the green.
