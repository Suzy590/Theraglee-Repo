# Nearby help

The **Nearby help** tab on the Premium Goals & tracking page (`goals.html#map`)
shows a map of mental health services around a zip code or town, a tile for
each one, and the national resources underneath.

| Piece | File |
| --- | --- |
| Finding, sorting and labeling places (no DOM, no network) | `site/assets/nearby-help.js` |
| The tab itself: search box, map, tiles | `site/assets/nearby-ui.js` |
| Test | `node tests/nearby-help/check.mjs` |

## How a search works

1. The zip code or town goes to OpenStreetMap's **Nominatim** geocoder, US
   only. A five-digit zip is sent as a postal code, anything else as free text.
   "Use my location" skips this step.
2. The **Overpass API** is asked for mental health places inside the box that
   holds a 25-mile circle (`RADIUS_MI`): therapists, psychologists, counseling,
   psychiatry, addiction services and mental health social facilities. The
   public servers in `OVERPASS` are tried in turn, 20 seconds each, because any
   one of them can be busy. Answers are kept in `sessionStorage` for the visit.
3. `toPlaces` drops unnamed places and repeats, trims the box to the circle,
   sorts closest first and keeps the nearest 60 (`MAX_PLACES`).
4. The map is Leaflet (from cdnjs) on OpenStreetMap tiles. The first 12 tiles
   show, with a "Show all" button for the rest. Clicking a tile opens its pin;
   clicking a pin highlights its tile.

The member's zip code on their profile is searched when the tab opens. Nothing
from the search is stored in Supabase.

## Things to keep in mind

- The listings are community-made, so the tab says they aren't checked by
  Theraglee and always links to SAMHSA's locator, 211 and 988.
- Which kind a place is (`kindOf`) decides its label and pin color. Add a new
  kind to `KINDS` and a test case together.
- OpenStreetMap's usage policies ask for attribution (shown on the map) and
  light use. If traffic grows, move to a paid tile and Overpass provider.
  OpenStreetMap is already named in the privacy policy's service providers.
