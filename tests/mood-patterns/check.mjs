// Exercises site/assets/mood-patterns.js, the analysis behind the Mood tab,
// under plain Node, and checks that its weather keys match the database's.
//
//   node tests/mood-patterns/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  analyze, pearson, eta, strength, FACTORS, WEATHER, MIN_DAYS, WEATHER_DAYS,
} from "../../site/assets/mood-patterns.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const day = (i) => `2026-09-${String(i + 1).padStart(2, "0")}`;

test("pearson is 1, -1, or null when a side never changes", () => {
  assert.equal(pearson([1, 2, 3], [2, 4, 6]).toFixed(6), "1.000000");
  assert.equal(pearson([1, 2, 3], [6, 4, 2]).toFixed(6), "-1.000000");
  assert.equal(pearson([5, 5, 5], [1, 2, 3]), null);
});

test("eta is 1 when the groups explain every change, 0 when they explain none, null otherwise", () => {
  assert.equal(eta([[2, 2, 2], [4, 4, 4]]).toFixed(6), "1.000000");
  assert.equal(eta([[1, 5], [1, 5], [3, 3]]).toFixed(6), "0.000000");
  assert.equal(eta([[1, 2, 3]]), null, "one group says nothing");
  assert.equal(eta([[3, 3], [3, 3]]), null, "a mood that never changes says nothing");
  // Two of four points' worth of spread sits between the groups: eta = sqrt(1/2).
  assert.equal(eta([[1, 3], [3, 5]]).toFixed(4), Math.SQRT1_2.toFixed(4));
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

test("the weather joins the chart once seven days span two or more kinds seen twice", () => {
  // Sunny days run high, rainy days low, so the weather moves with the mood.
  const rows = [
    { mood: 5, weather: "sunny" }, { mood: 4, weather: "sunny" }, { mood: 5, weather: "sunny" },
    { mood: 2, weather: "rainy" }, { mood: 1, weather: "rainy" }, { mood: 2, weather: "rainy" },
    { mood: 3, weather: "cloudy" }, { mood: 3, weather: "cloudy" },
    { mood: 5, weather: "snowy" }, // one day: left out of the weather analysis
    { mood: 3 },                   // no weather picked: left out too
  ].map((r, i) => ({ ...r, logged_on: day(i) }));
  const res = analyze(rows);
  const w = res.weatherLink;
  assert.equal(w.label, "Weather");
  assert.equal(w.n, 8, "days whose weather was seen on two or more days");
  assert.equal(w.kinds, 3);
  assert.ok(w.r !== null && w.r >= 0.7, `a strong link, got ${w.r}`);
  assert.deepEqual(w.types.map(t => t.key), ["sunny", "cloudy", "rainy"], "best average mood first");
  assert.ok(w.types.every(t => t.moods === undefined), "the raw moods stay out of the result");
  assert.ok(res.statements.some(s => s.startsWith("Your mood moves with the weather (a strong link). "
    + "It has averaged 4.7 out of 5 on sunny days (3 of them) and 1.7 on rainy days (3).")));
  assert.ok(!res.statements.some(s => s.startsWith("On sunny days") || s.startsWith("On rainy days")),
    "the kinds named in the weather sentence are not repeated");
  assert.ok(!res.statements.some(s => s.includes("weather may be a good place to focus")),
    "the weather is never the focus");
});

test("the weather waits for seven days seen on two or more kinds", () => {
  const six = [
    { mood: 5, weather: "sunny" }, { mood: 5, weather: "sunny" }, { mood: 5, weather: "sunny" },
    { mood: 1, weather: "rainy" }, { mood: 1, weather: "rainy" }, { mood: 1, weather: "rainy" },
    { mood: 3, weather: "cloudy" }, { mood: 3, weather: "foggy" },
  ].map((r, i) => ({ ...r, logged_on: day(i) }));
  assert.equal(analyze(six).weatherLink.n, 6);
  assert.equal(analyze(six).weatherLink.r, null, "six days are not enough");
  const oneKind = Array.from({ length: 8 }, (_, i) => ({ logged_on: day(i), mood: (i % 5) + 1, weather: "sunny" }));
  assert.equal(analyze(oneKind).weatherLink.kinds, 1);
  assert.equal(analyze(oneKind).weatherLink.r, null, "one kind of weather says nothing");
  // Seen on only one day each: no kind reaches WEATHER_DAYS.
  const singles = WEATHER.slice(0, 8).map(([k], i) => ({ logged_on: day(i), mood: (i % 5) + 1, weather: k }));
  assert.equal(analyze(singles).weatherLink.n, 0);
  assert.equal(analyze(singles).weatherLink.r, null);
  assert.equal(WEATHER_DAYS, 2);
});

test("weather that does not move with the mood gets a little-or-no-link bar and no sentence", () => {
  const rows = [
    { mood: 2, weather: "sunny" }, { mood: 4, weather: "sunny" }, { mood: 3, weather: "sunny" },
    { mood: 2, weather: "rainy" }, { mood: 4, weather: "rainy" }, { mood: 3, weather: "rainy" },
    { mood: 3, weather: "cloudy" }, { mood: 3, weather: "cloudy" },
  ].map((r, i) => ({ ...r, logged_on: day(i) }));
  const res = analyze(rows);
  assert.ok(res.weatherLink.r !== null && res.weatherLink.r < 0.3, `got ${res.weatherLink.r}`);
  assert.equal(strength(res.weatherLink.r), "little");
  assert.deepEqual(res.weather, []);
  assert.ok(!res.statements.some(s => s.includes("moves with the weather")));
});

test("nothing standing out still says so", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ logged_on: day(i), mood: 3 }));
  const res = analyze(rows);
  assert.equal(res.statements.length, 1);
  assert.match(res.statements[0], /No single factor, and not the weather, stands out yet/);
  assert.equal(res.weatherLink.r, null, "no weather picked, so nothing to chart");
});

test("nine factors and seven to ten weather choices, matching the migration", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260925120000_mood_factors.sql", import.meta.url), "utf8");
  assert.equal(FACTORS.length, 9);
  assert.ok(WEATHER.length >= 7 && WEATHER.length <= 10);
  for (const [key] of FACTORS) assert.match(sql, new RegExp(`add column if not exists ${key}\\s+smallint check \\(${key}\\s+between 1 and 10\\)`));
  const list = sql.match(/weather in \(([^)]*)\)/)[1].match(/'([a-z_]+)'/g).map(s => s.slice(1, -1));
  assert.deepEqual(list, WEATHER.map(w => w[0]));
});

test("a submitted day is locked in the database, the note aside", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260925130000_mood_submit_once_a_day.sql", import.meta.url), "utf8");
  const locked = [...sql.matchAll(/new\.(\w+)\s+is distinct from old\.\1/g)].map(m => m[1]);
  for (const k of ["mood", "weather", "submitted_at", "logged_on", ...FACTORS.map(f => f[0])]) {
    assert.ok(locked.includes(k), `the lock must cover ${k}`);
  }
  assert.ok(!locked.includes("notes"), "the note stays editable");
});

console.log(`\n${n} checks passed`);
