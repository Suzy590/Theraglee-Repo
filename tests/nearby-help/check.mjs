// Exercises site/assets/nearby-help.js, the logic behind the "Nearby help"
// tab on Goals & tracking, and site/api/nearby.js, the function that relays
// SAMHSA's locator, under plain Node with canned replies (no network).
//
//   node tests/nearby-help/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import {
  overpassQuery, geocodeUrl, isZip, miles, kindOf, address, website, phone,
  telHref, toPlaces, bbox, samhsaKind, samhsaPlaces, mergePlaces, isExcluded, fmtMiles, kindInfo, KINDS, RADIUS_MI,
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
  assert.ok(q.includes("nwr[healthcare=counselling];"));
  // Therapists are never asked for.
  assert.ok(!/psychotherapist|psychologist|therapist|psychology|psychotherapy/.test(q));
});

test("miles is a great-circle distance", () => {
  assert.equal(miles(45, -122, 45, -122), 0);
  // One degree of latitude is about 69 miles.
  assert.ok(Math.abs(miles(45, -122, 46, -122) - 69.1) < 0.2);
});

test("kinds of help", () => {
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
    { type: "way", id: 2, center: { lat: 45.51, lon: -122.6 }, tags: { name: "Near", healthcare: "counselling" } },
    { type: "node", id: 3, lat: 45.51, lon: -122.6, tags: { name: "near", healthcare: "counselling" } },
    { type: "node", id: 4, lat: 45.52, lon: -122.6, tags: { healthcare: "counselling" } },
    { type: "node", id: 6, lat: 45.50, lon: -122.6, tags: { name: "A Therapist", healthcare: "psychotherapist" } },
    { type: "node", id: 7, lat: 45.50, lon: -122.6, tags: { name: "Planned Parenthood", healthcare: "counselling" } },
    { type: "relation", id: 5, tags: { name: "No point" } },
  ] };
  const p = toPlaces(json, 45.5, -122.6);
  assert.deepEqual(p.map(x => x.name), ["Near", "Far"]);
  assert.equal(p[0].id, "way/2");
  assert.equal(p[0].kind, "counseling");
  assert.equal(toPlaces(json, 45.5, -122.6, 1).length, 1);
  assert.deepEqual(toPlaces(null, 0, 0), []);
  // "Far" is about 7 miles off, so a 5-mile radius drops it.
  assert.deepEqual(toPlaces(json, 45.5, -122.6, 60, 5).map(x => x.name), ["Near"]);
});

const row = (o) => ({ name1: "A", name2: "", street1: "1 Main St", street2: "", city: "Ojai",
  state: "CA", zip: "93023", phone: "805-555-0100", intake1: "", website: "example.org",
  latitude: "34.36", longitude: "-119.05", typeFacility: "MH", TC: "Mental health treatment",
  SET: "Outpatient; Telemedicine/telehealth therapy", FT: "", EMS: "", ...o });

test("SAMHSA rows get a kind", () => {
  assert.equal(samhsaKind(row({ EMS: "Crisis intervention team" })), "crisis");
  assert.equal(samhsaKind(row({ FT: "Psychiatric hospital" })), "psychiatry");
  assert.equal(samhsaKind(row({})), "clinic");
  assert.equal(samhsaKind(row({ typeFacility: "SA", TC: "Substance use treatment" })), "addiction");
  assert.equal(samhsaKind(row({ typeFacility: "OTP", TC: "" })), "addiction");
  assert.equal(samhsaKind({}), "other");
});

test("samhsaPlaces builds tiles, trims to the radius, closest first", () => {
  const json = { rows: [
    row({ name1: "Far Clinic", latitude: "34.46" }),
    row({ name1: "County Behavioral Health", name2: "Adult Clinic", latitude: "34.355" }),
    row({ name1: "Out of range", latitude: "35.5" }),
    row({ name1: "", latitude: "34.35" }),
    row({ name1: "No point", latitude: null }),
  ] };
  const p = samhsaPlaces(json, 34.35, -119.05);
  assert.deepEqual(p.map(x => x.name), ["County Behavioral Health — Adult Clinic", "Far Clinic"]);
  assert.equal(p[0].address, "1 Main St, Ojai, CA 93023");
  assert.equal(p[0].website, "https://example.org/");
  assert.equal(p[0].setting, "Outpatient · Telemedicine/telehealth therapy");
  assert.equal(p[0].source, "samhsa");
  assert.deepEqual(samhsaPlaces(null, 0, 0), []);
  // One facility listed for two programs becomes one place.
  const twice = samhsaPlaces({ rows: [
    row({ name1: "Path", typeFacility: "SA", TC: "Substance use treatment", SET: "Residential" }),
    row({ name1: "Path", EMS: "Crisis intervention team", SET: "Outpatient", website: "" }),
  ] }, 34.35, -119.05);
  assert.equal(twice.length, 1);
  assert.equal(twice[0].kind, "crisis");
  assert.equal(twice[0].setting, "Residential · Outpatient");
  assert.equal(twice[0].website, "https://example.org/");
});

test("mergePlaces drops community-map repeats of SAMHSA listings", () => {
  const s = [{ name: "Hope Center — Adults", lat: 34.35, lon: -119.05, miles: 1 }];
  const o = [
    { name: "Hope Center", lat: 34.40, lon: -119.0, miles: 3 },         // same name
    { name: "Hope Ctr Front Desk", lat: 34.3501, lon: -119.0501, miles: 1 }, // same spot
    { name: "Valley Counseling Center", lat: 34.36, lon: -119.05, miles: 0.5 },
  ];
  assert.deepEqual(mergePlaces(s, o).map(x => x.name), ["Valley Counseling Center", "Hope Center — Adults"]);
  assert.equal(mergePlaces(s, o, 1).length, 1);
  assert.deepEqual(mergePlaces(), []);
});

test("therapists and Planned Parenthood are never listed", () => {
  assert.ok(isExcluded({ name: "Planned Parenthood - Ventura Health Center" }));
  assert.ok(isExcluded({ name: "Clinic" }, { operator: "Planned Parenthood of California Central Coast" }));
  assert.ok(isExcluded({ name: "Jane Doe, LMFT" }));
  assert.ok(isExcluded({ name: "Dr. Sam Lee PsyD" }));
  assert.ok(isExcluded({ name: "Pat Kim (LCSW)" }));
  assert.ok(isExcluded({ name: "Calm Rooms" }, { healthcare: "psychotherapist" }));
  assert.ok(isExcluded({ name: "Calm Rooms" }, { office: "therapist" }));
  assert.ok(isExcluded({ name: "Calm Rooms" }, { "healthcare:speciality": "psychotherapy" }));
  assert.ok(!isExcluded({ name: "County Behavioral Health" }, { "healthcare:speciality": "psychiatry;psychotherapy" }));
  assert.ok(!isExcluded({ name: "Hope Counseling Center" }, { healthcare: "counselling" }));
  assert.ok(!isExcluded({ name: "Aspen Recovery" }));
  assert.ok(isExcluded({ name: "WW Studio" }, { healthcare: "counselling", "healthcare:counselling": "dietitian" }));
  assert.equal(KINDS.some(k => k[0] === "therapist"), false);
  // Both sources, and the merge, apply it.
  assert.deepEqual(samhsaPlaces({ rows: [row({ name1: "Planned Parenthood" })] }, 34.35, -119.05), []);
  const pp = { name: "Planned Parenthood", lat: 34.35, lon: -119.05, miles: 0 };
  assert.deepEqual(mergePlaces([pp], [{ ...pp, name: "Jo Ray, LPC" }]), []);
});

test("distances read naturally", () => {
  assert.equal(fmtMiles(0.05), "under 0.1 mi");
  assert.equal(fmtMiles(2.345), "2.3 mi");
  assert.equal(fmtMiles(14.6), "15 mi");
});

/* ---- site/api/nearby.js, with fetch stubbed ---- */
const { default: handler } = await import("../../site/api/nearby.js");
const call = async (query, reply) => {
  const seen = [];
  globalThis.fetch = async (url) => { seen.push(String(url)); return reply(); };
  const out = { status: 0, body: null, headers: {} };
  const res = {
    status(c) { out.status = c; return res; },
    json(b) { out.body = b; return res; },
    setHeader(k, v) { out.headers[k] = v; },
  };
  await handler({ query }, res);
  return { ...out, seen };
};
const ok = (body) => () => ({ ok: true, status: 200, json: async () => body });

await (async () => {
  let r = await call({ lat: "abc", lon: "1" }, ok({}));
  assert.equal(r.status, 400); assert.equal(r.seen.length, 0);
  r = await call({ lat: "34.35771", lon: "-119.05421" }, ok({ rows: [{
    name1: "X", latitude: "34.3", longitude: "-119.0", typeFacility: "MH", secret: "dropped",
    services: [{ f2: "TC", f3: "Mental health treatment" }, { f2: "SET", f3: "Outpatient" }],
  }] }));
  assert.equal(r.status, 200);
  const u = new URL(r.seen[0]);
  assert.equal(u.hostname, "findtreatment.gov");
  assert.equal(u.searchParams.get("sAddr"), "34.36,-119.05");
  assert.equal(u.searchParams.get("limitValue"), "40234");
  assert.equal(r.body.rows[0].TC, "Mental health treatment");
  assert.equal(r.body.rows[0].SET, "Outpatient");
  assert.equal(r.body.rows[0].secret, undefined);
  assert.match(r.headers["Cache-Control"], /s-maxage=86400/);
  r = await call({ lat: "34", lon: "-119" }, () => ({ ok: false, status: 500 }));
  assert.equal(r.status, 502);
  r = await call({ lat: "34", lon: "-119" }, () => { throw new Error("down"); });
  assert.equal(r.status, 504);
  n++; console.log("ok - /api/nearby relays SAMHSA and reports failures");
})();

console.log(`\n${n} checks passed`);
