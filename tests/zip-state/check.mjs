// Checks site/assets/zip-state.js, the zip-code-to-state table the Find a
// therapist page uses, and that the copy inside
// supabase/migrations/20261005120000_therapist_search_by_zip_and_delivery.sql
// (public.zip_state) is the same table, so the page and the database agree
// on which state a zip code is in.
//
//   node tests/zip-state/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZIP_STATE_RANGES, zipDigits, zipState, zipArea } from "../../site/assets/zip-state.js";
import { STATES } from "../../site/assets/lists.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

test("every range is three digits, in order, and names a state the site lists", () => {
  const known = new Set(STATES.map(([abbr]) => abbr));
  let last = "";
  for (const [lo, hi, state] of ZIP_STATE_RANGES) {
    assert.match(lo, /^\d{3}$/, `low prefix ${lo}`);
    assert.match(hi, /^\d{3}$/, `high prefix ${hi}`);
    assert.ok(lo <= hi, `range ${lo}-${hi} is backwards`);
    assert.ok(lo > last, `range ${lo}-${hi} overlaps or is out of order after ${last}`);
    assert.ok(known.has(state), `${state} is not in STATES`);
    last = hi;
  }
  assert.equal(new Set(ZIP_STATE_RANGES.map((r) => r[2])).size, STATES.length,
    "every state in STATES has at least one range");
});

test("a zip code is read as five digits, with or without the +4", () => {
  assert.equal(zipDigits("90210"), "90210");
  assert.equal(zipDigits(" 90210-1234 "), "90210");
  assert.equal(zipDigits("9021"), "");
  assert.equal(zipDigits("Ventura"), "");
  assert.equal(zipDigits(null), "");
});

test("well-known zip codes land in their state", () => {
  const cases = [
    ["90210", "CA"], ["93003", "CA"], ["10001", "NY"], ["11730", "NY"], ["00501", "NY"],
    ["02134", "MA"], ["01810", "MA"], ["05401", "VT"], ["06103", "CT"], ["07030", "NJ"],
    ["20001", "DC"], ["20599", "DC"], ["20101", "VA"], ["22201", "VA"], ["21201", "MD"],
    ["30301", "GA"], ["39901", "GA"], ["33101", "FL"], ["35201", "AL"], ["37201", "TN"],
    ["38601", "MS"], ["48201", "MI"], ["53201", "WI"], ["55401", "MN"], ["60601", "IL"],
    ["63101", "MO"], ["68102", "NE"], ["70112", "LA"], ["72201", "AR"], ["73301", "TX"],
    ["73101", "OK"], ["74101", "OK"], ["75201", "TX"], ["88510", "TX"], ["80202", "CO"],
    ["82001", "WY"], ["83702", "ID"], ["84101", "UT"], ["85001", "AZ"], ["87101", "NM"],
    ["89101", "NV"], ["96813", "HI"], ["97201", "OR"], ["98101", "WA"], ["99501", "AK"],
    ["03301", "NH"], ["04101", "ME"], ["02903", "RI"], ["19901", "DE"], ["15201", "PA"],
  ];
  for (const [zip, state] of cases) assert.equal(zipState(zip), state, zip);
});

test("military, territory and unassigned prefixes are unknown", () => {
  for (const zip of ["09001", "34001", "96201", "00901", "00801", "9000", "ABCDE"])
    assert.equal(zipState(zip), "", zip);
});

test("the in-person area is the first three digits", () => {
  assert.equal(zipArea("90210"), "902xx");
  assert.equal(zipArea("93003-1234"), "930xx");
  assert.equal(zipArea("abc"), "");
});

test("the database's zip_state carries the same table", () => {
  const sql = readFileSync(here("../../supabase/migrations/20261005120000_therapist_search_by_zip_and_delivery.sql"), "utf8");
  const body = sql.slice(sql.indexOf("create or replace function public.zip_state"),
                         sql.indexOf("as v(lo, hi, state)"));
  const rows = [...body.matchAll(/\('(\d{3})','(\d{3})','([A-Z]{2})'\)/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(rows, ZIP_STATE_RANGES);
});

console.log(`\n${n} checks passed`);
