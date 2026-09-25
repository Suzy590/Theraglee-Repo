// Exercises site/assets/mood-patterns.js, the analysis behind the Mood tab,
// under plain Node, and checks that its weather keys match the database's.
//
//   node tests/mood-patterns/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  analyze, pearson, strength, FACTORS, WEATHER, MIN_DAYS,
} from "../../site/assets/mood-patterns.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const day = (i) => `2026-09-${String(i + 1).padStart(2, "0")}`;

test("pearson is 1, -1, or null when a side never changes", () => {
  assert.equal(pearson([1, 2, 3], [2, 4, 6]).toFixed(6), "1.000000");
  assert.equal(pearson([1, 2, 3], [6, 4, 2]).toFixed(6), "-1.000000");
  assert.equal(pearson([5, 5, 5], [1, 2, 3]), null);
});

test("strength labels", () => {
  assert.equal(strength(0.8), "strong");
  assert.equal(strength(-0.55), "moderate");
  assert.equal(strength(0.35), "modest");
  assert.equal(strength(0.1), "little");
});

test("fewer than seven days is not ready and says nothing", () => {
  const rows = Array.from({ length: MIN_DAYS - 1 }, (_, i) => ({ logged_on: day(i), mood: 3, sleep: i + 1 }));
  const res = analyze(rows);
  assert.equal(res.ready, false);
  assert.equal(res.days, MIN_DAYS - 1);
  assert.deepEqual(res.statements, []);
});

test("days need not be in a row, and rows without a mood do not count", () => {
  const rows = [0, 3, 5, 9, 14, 20, 27].map(i => ({ logged_on: day(i), mood: 3 }));
  rows.push({ logged_on: day(28), mood: null });
  const res = analyze(rows);
  assert.equal(res.days, 7);
  assert.equal(res.ready, true);
});

test("a factor that moves with mood is found, named, and suggested as a focus", () => {
  // Sleep tracks mood exactly; nutrition is flat; social moves against it.
  const moods = [1, 2, 3, 4, 5, 2, 4, 3];
  const rows = moods.map((m, i) => ({
    logged_on: day(i), mood: m, sleep: m * 2, nutrition: 6, social: 11 - m * 2,
  }));
  const res = analyze(rows);
  assert.equal(res.ready, true);
  const names = res.findings.map(f => f.key);
  assert.ok(names.includes("sleep"));
  assert.ok(names.includes("social"));
  assert.ok(!names.includes("nutrition"), "a factor rated the same every day says nothing");
  assert.equal(res.factors.find(f => f.key === "nutrition").r, null);
  assert.equal(res.focus.key, "sleep");
  assert.ok(res.statements.some(s => s.startsWith("On days your sleep felt better, your mood tended to be better too")));
  assert.ok(res.statements.some(s => s.includes("mood tended to be lower")));
  assert.ok(res.statements.some(s => s.includes("sleep may be a good place to focus")));
});

test("the focus is the linked factor rated lowest on average", () => {
  const moods = [1, 2, 3, 4, 5, 1, 5, 3];
  const rows = moods.map((m, i) => ({ logged_on: day(i), mood: m, sleep: m + 5, activity: m }));
  assert.equal(analyze(rows).focus.key, "activity");
});

test("a factor needs seven rated days of its own", () => {
  const rows = [1, 2, 3, 4, 5, 2, 4, 3].map((m, i) => ({ logged_on: day(i), mood: m, hunger: i < 6 ? m : null }));
  const f = analyze(rows).factors.find(x => x.key === "hunger");
  assert.equal(f.n, 6);
  assert.equal(f.r, null);
});

test("weather is mentioned only when it stands apart from the usual mood", () => {
  const rows = [
    { mood: 2, weather: "rainy" }, { mood: 2, weather: "rainy" }, { mood: 1, weather: "rainy" },
    { mood: 4, weather: "sunny" }, { mood: 4, weather: "sunny" }, { mood: 4, weather: "sunny" },
    { mood: 5, weather: "cloudy" }, // one day is not enough
  ].map((r, i) => ({ ...r, logged_on: day(i) }));
  const res = analyze(rows);
  const keys = res.weather.map(w => w.key);
  assert.ok(keys.includes("rainy"));
  assert.ok(!keys.includes("cloudy"));
  assert.ok(res.statements.some(s => s.startsWith("On rainy days (3 of them), your mood averaged 1.7 out of 5")));
});

test("nothing standing out still says so", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ logged_on: day(i), mood: 3 }));
  const res = analyze(rows);
  assert.equal(res.statements.length, 1);
  assert.match(res.statements[0], /No single factor stands out yet/);
});

test("nine factors and seven to ten weather choices, matching the migration", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260925120000_mood_factors.sql", import.meta.url), "utf8");
  assert.equal(FACTORS.length, 9);
  assert.ok(WEATHER.length >= 7 && WEATHER.length <= 10);
  for (const [key] of FACTORS) assert.match(sql, new RegExp(`add column if not exists ${key}\\s+smallint check \\(${key}\\s+between 1 and 10\\)`));
  const list = sql.match(/weather in \(([^)]*)\)/)[1].match(/'([a-z_]+)'/g).map(s => s.slice(1, -1));
  assert.deepEqual(list, WEATHER.map(w => w[0]));
});

console.log(`\n${n} checks passed`);
