# Nearby help

The **Nearby help** tab on the Premium Goals & tracking page (`goals.html#map`)
shows a map of mental health services around a zip code or town, a tile for
each one, and the national resources underneath.

| Piece | File |
| --- | --- |
| Finding, sorting and labeling places (no DOM, no network) | `site/assets/nearby-help.js` |
| The tab itself: search box, map, tiles | `site/assets/nearby-ui.js` |
| `GET /api/nearby?lat=&lon=`, the Vercel Function that relays SAMHSA | `site/api/nearby.js` |
| Test (no network) | `node tests/nearby-help/check.mjs` |

## How a search works

1. **Find the point.** The zip code or town goes to OpenStreetMap's Nominatim,
   US only. "Use my location" skips this step.
2. **Draw the map** straight away (Leaflet from cdnjs, OpenStreetMap tiles). It
   needs only the point, so a slow listing source never leaves the tab blank.
3. **Fetch places from two sources at once**, adding each to the map and the
   tiles as it answers:
   - **SAMHSA's treatment locator** (findtreatment.gov), the main source:
     licensed mental health and substance use facilities within 25 miles. It
     doesn't allow browsers on other sites to call it, so the page asks
     `/api/nearby`, which asks the locator, trims the reply, and is cached at
     Vercel's edge for a day. The point is rounded to about a kilometer first.
     SAMHSA lists a facility once per program; `samhsaPlaces` folds those
     into one tile.
   - **OpenStreetMap's Overpass API**, a bonus: counseling services and
     mental health centers. Its public servers are often too busy, so each in
     `OVERPASS` gets 12 seconds and the tab carries on without them. Answers
     are kept in `sessionStorage` for the visit.
4. **Exclusions.** Individual therapists (psychotherapists, psychologists,
   therapist offices) and Planned Parenthood are never listed, from either
   source. `isExcluded` in `nearby-help.js` decides, and the Overpass query
   doesn't ask for therapist tags at all. Members are pointed to the Theraglee
   directory for therapists instead.
5. `mergePlaces` drops community-map listings SAMHSA already has, sorts closest
   first and keeps the nearest 100 (`MAX_PLACES`). The first 12 tiles show,
   with a "Show all" button for the rest. Clicking a tile opens its pin;
   clicking a pin highlights its tile.

The member's zip code on their profile is searched when the tab opens. Nothing
from the search is stored in Supabase.

## Things to keep in mind

- Neither source is checked by Theraglee, so the tab says so and always links
  to SAMHSA's locator, 211 and 988.
- If `/api/nearby` starts failing, check the function's logs in Vercel; the
  locator's address and parameters are at the top of `site/api/nearby.js`.
- Which kind a place is (`kindOf`) decides its label and pin color. Add a new
  kind to `KINDS` and a test case together.
- OpenStreetMap's usage policies ask for attribution (shown on the map) and
  light use. If traffic grows, move to a paid tile and Overpass provider.
  SAMHSA's locator is a free public service with no key.
  OpenStreetMap is already named in the privacy policy's service providers.
