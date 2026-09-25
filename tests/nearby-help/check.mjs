// Exercises site/assets/nearby-help.js, the logic behind the "Nearby help"
// tab on Goals & tracking, under plain Node with a canned Overpass reply.
//
//   node tests/nearby-help/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import {
  overpassQuery, geocodeUrl, isZip, miles, kindOf, address, website, phone,
  telHref, toPlaces, bbox, fmtMiles, kindInfo, KINDS, RADIUS_MI,
} from "../../site/assets/nearby-help.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

test("zip codes are searched as postal codes, towns as free text", () => {
  assert.ok(isZip("97201") && isZip("97201-1234") && !isZip("9720") && !isZip("Portland"));
  const z = new URL(geocodeUrl(" 97201-1234 "));
  assert.equal(z.searchParams.get("postalcode"), "97201");
  assert.equal(z.searchParams.get("countrycodes"), "us");
  assert.equal(z.searchParams.get("q"), null);
  assert.equal(new URL(geocodeUrl("Portland, OR")).searchParams.get("q"), "Portland, OR");
});

test("the Overpass query searches the box around the point", () => {
  const [s, w, n, e] = bbox(45.5, -122.6);
  assert.ok(Math.abs(miles(45.5, -122.6, n, -122.6) - RADIUS_MI) < 0.2);
  assert.ok(Math.abs(miles(45.5, -122.6, 45.5, e) - RADIUS_MI) < 0.3);
  assert.ok(s < 45.5 && w < -122.6);
  const q = overpassQuery(45.5, -122.6);
  assert.match(q, /^\[out:json\]\[timeout:\d+\]\[bbox:[-\d.,]+\];/);
  assert.match(q, /out center tags;$/);
  assert.ok(q.includes("nwr[healthcare=psychotherapist];"));
});

test("miles is a great-circle distance", () => {
  assert.equal(miles(45, -122, 45, -122), 0);
  // One degree of latitude is about 69 miles.
  assert.ok(Math.abs(miles(45, -122, 46, -122) - 69.1) < 0.2);
});

test("kinds of help", () => {
  assert.equal(kindOf({ healthcare: "psychotherapist" }), "therapist");
  assert.equal(kindOf({ healthcare: "psychologist" }), "therapist");
  assert.equal(kindOf({ healthcare: "counselling" }), "counseling");
  assert.equal(kindOf({ healthcare: "counselling", "healthcare:counselling": "addiction" }), "addiction");
  assert.equal(kindOf({ amenity: "clinic", "healthcare:speciality": "psychiatry" }), "psychiatry");
  assert.equal(kindOf({ amenity: "social_facility", "social_facility:for": "mental_health" }), "crisis");
  assert.equal(kindOf({ name: "Crisis Center", healthcare: "counselling" }), "crisis");
  assert.equal(kindOf({}), "other");
  for (const [k] of KINDS) assert.equal(kindInfo(k).key, k);
  assert.equal(kindInfo("nope").key, "other");
});

test("address, phone and website come out clean", () => {
  assert.equal(address({ "addr:housenumber": "12", "addr:street": "Main St", "addr:unit": "4",
    "addr:city": "Salem", "addr:state": "OR", "addr:postcode": "97301" }),
    "12 Main St, Unit 4, Salem, OR 97301");
  assert.equal(address({}), "");
  assert.equal(phone({ phone: "+1 503-555-0100;+1 503-555-0101" }), "+1 503-555-0100");
  assert.equal(telHref("+1 (503) 555-0100"), "tel:+15035550100");
  assert.equal(website({ website: "example.org" }), "https://example.org/");
  assert.equal(website({ "contact:website": "http://a.example/x" }), "http://a.example/x");
  assert.equal(website({ website: "javascript:alert(1)" }), "");
  assert.equal(website({}), "");
});

test("toPlaces keeps named places, drops repeats, and sorts closest first", () => {
  const json = { elements: [
    { type: "node", id: 1, lat: 45.60, lon: -122.6, tags: { name: "Far", healthcare: "counselling" } },
    { type: "way", id: 2, center: { lat: 45.51, lon: -122.6 }, tags: { name: "Near", healthcare: "psychotherapist" } },
    { type: "node", id: 3, lat: 45.51, lon: -122.6, tags: { name: "near", healthcare: "psychotherapist" } },
    { type: "node", id: 4, lat: 45.52, lon: -122.6, tags: { healthcare: "psychotherapist" } },
    { type: "relation", id: 5, tags: { name: "No point" } },
  ] };
  const p = toPlaces(json, 45.5, -122.6);
  assert.deepEqual(p.map(x => x.name), ["Near", "Far"]);
  assert.equal(p[0].id, "way/2");
  assert.equal(p[0].kind, "therapist");
  assert.equal(toPlaces(json, 45.5, -122.6, 1).length, 1);
  assert.deepEqual(toPlaces(null, 0, 0), []);
  // "Far" is about 7 miles off, so a 5-mile radius drops it.
  assert.deepEqual(toPlaces(json, 45.5, -122.6, 60, 5).map(x => x.name), ["Near"]);
});

test("distances read naturally", () => {
  assert.equal(fmtMiles(0.05), "under 0.1 mi");
  assert.equal(fmtMiles(2.345), "2.3 mi");
  assert.equal(fmtMiles(14.6), "15 mi");
});

console.log(`\n${n} checks passed`);
