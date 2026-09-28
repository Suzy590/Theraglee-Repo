// Exercises site/assets/quest-paths.js and site/assets/quest-scene.js, the
// quest map on the Premium Goals & tracking page, under plain Node. Checks the
// lists match the database's checks, that every map fits the member's own
// choices, that progress only counts up, and that nothing a member reads
// drifts into clinical language.
//
//   node tests/quest-paths/check.mjs
//
// Exits non-zero on the first failed assertion. docs/quest-map.md is the guide.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  VALUES, CATEGORIES, MINUTES, SCENES, ACTIONS, CHAPTERS, PROMPT_IDEAS, MILESTONES,
  buildQuest, progress, helper, pool, MAIN_PER_CHAPTER,
} from "../../site/assets/quest-paths.js";
import { questMap, garden, lights, scenery, scene } from "../../site/assets/quest-scene.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const sql = read("supabase/migrations/20260927190000_quest_maps.sql");
const page = read("site/goals.html");

/** The quoted words inside the first `<anchor> ... )` list in the migration. */
const listAfter = (anchor) => {
  const i = sql.indexOf(anchor);
  assert.ok(i >= 0, `migration has ${anchor}`);
  const body = sql.slice(i + anchor.length, sql.indexOf(")", i + anchor.length));
  return [...body.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
};
const same = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test("values match both database checks", () => {
  const keys = VALUES.map(v => v.key);
  const lists = [...sql.matchAll(/value_key\s+text[^(]*check \(value_key in \(([^)]*)\)/g)];
  assert.equal(lists.length, 2, "goals.value_key and quests.value_key");
  for (const m of lists) same(keys, [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]));
});

test("categories, minutes and scenes match the database", () => {
  same(CATEGORIES.map(c => c.key), listAfter("categories <@ array["));
  same(SCENES.map(s => s.key), listAfter("scene in ("));
  const mins = sql.match(/minutes in \(([^)]*)\)/)[1].split(",").map(Number);
  same(MINUTES, mins);
});

test("every action is well formed", () => {
  const cats = new Set(CATEGORIES.map(c => c.key));
  const vals = new Set(VALUES.map(v => v.key));
  const keys = new Set();
  for (const a of ACTIONS) {
    assert.match(a.key, /^[a-z_]{3,40}$/, `${a.key} fits quest_steps.action_key`);
    assert.ok(!keys.has(a.key), `${a.key} is unique`); keys.add(a.key);
    assert.ok(cats.has(a.cat), `${a.key} has a known category`);
    assert.ok(MINUTES.includes(a.min), `${a.key} takes one of the minute choices`);
    for (const v of a.values || []) assert.ok(vals.has(v), `${a.key} names known value ${v}`);
    assert.ok(a.text.length > 10 && a.text.endsWith("."), `${a.key} reads as a sentence`);
  }
});

test("writing actions are flagged, so the page opens a note box for them", () => {
  const writers = ACTIONS.filter(a => a.write);
  assert.ok(writers.length >= 10, "a good spread of writing actions");
  for (const a of writers) assert.match(a.text, /^(Write|Note|Describe|List|Fill|Name)\b/, `${a.key} is done by writing`);
  for (const a of ACTIONS.filter(a => /^(Write|Describe|List|Fill)\b/.test(a.text))) assert.ok(a.write, `${a.key} should be flagged write`);
});

test("every category has a two-minute action, so the shortest setting is never empty", () => {
  for (const c of CATEGORIES) {
    assert.ok(ACTIONS.some(a => a.cat === c.key && a.min === 2), `${c.key} has a 2 minute action`);
    assert.ok((PROMPT_IDEAS[c.key] || []).length, `${c.key} has prompt ideas`);
  }
});

test("every choice draws a full map from the member's own picks", () => {
  for (const v of VALUES) for (const c of CATEGORIES) for (const m of MINUTES) {
    const q = buildQuest({ id: "t", value: v.key, categories: [c.key], minutes: m });
    assert.equal(q.chapters.length, CHAPTERS.length);
    for (const ch of q.chapters) {
      assert.ok(ch.main.length >= 1, `${v.key}/${c.key}/${m} has an action in ${ch.place}`);
      for (const a of ch.main) {
        assert.equal(a.cat, c.key, "main actions come from chosen categories");
        assert.ok(a.min <= m, "main actions fit the time");
      }
      assert.ok(ch.side, "every chapter has a side path");
      assert.notEqual(ch.side.cat, c.key, "side paths come from other categories");
      assert.ok(ch.side.min <= m, "side paths fit the time too");
    }
  }
});

test("with several categories, chapters get the full set of actions and prefer the value", () => {
  const q = buildQuest({ id: "x", value: "calm_evenings", categories: ["self_care", "habits", "nature"], minutes: 10 });
  for (const ch of q.chapters) assert.equal(ch.main.length, MAIN_PER_CHAPTER);
  const p = pool({ value: "calm_evenings", categories: ["self_care", "habits", "nature"], minutes: 10 });
  assert.ok(p.every(a => !a.values || a.values.includes("calm_evenings")));
});

test("chapters never repeat an earlier chapter's exact set when there are enough actions", () => {
  const cats = CATEGORIES.map(c => c.key);
  for (const v of VALUES) for (const m of MINUTES) for (let i = 0; i < cats.length; i++) {
    const categories = [cats[i], cats[(i + 3) % cats.length]];
    if (pool({ value: v.key, categories, minutes: m }).length < 2 * MAIN_PER_CHAPTER) continue;
    const q = buildQuest({ id: `${v.key}${m}${i}`, value: v.key, categories, minutes: m });
    const sets = q.chapters.filter(c => c.main.length === MAIN_PER_CHAPTER)
      .map(c => c.main.map(a => a.key).sort().join());
    assert.equal(new Set(sets).size, sets.length, `${v.key}/${categories}/${m}: ${sets.join(" | ")}`);
  }
});

test("the same quest always draws the same map", () => {
  const args = { id: "abc", value: "connection", categories: ["gratitude", "connection"], minutes: 5 };
  assert.deepEqual(JSON.stringify(buildQuest(args)), JSON.stringify(buildQuest({ ...args, categories: ["connection", "gratitude"] })));
  assert.match(buildQuest(args).chapters[0].story, /closer connection/);
});

test("progress counts distinct days, in a row or not, and only ever goes up", () => {
  assert.equal(progress([]).days, 0);
  assert.equal(progress([]).open, 0);
  assert.equal(progress(["2026-09-01", "2026-09-01", "2026-09-20"]).days, 2);
  const three = progress(["2026-01-01", "2026-03-01", "2026-09-01"]);
  assert.equal(three.open, 1, "three scattered days open chapter two");
  assert.equal(progress(["a", "b"]).next.left, 1);
  let last = -1;
  for (let d = 0; d <= 60; d++) {
    const p = progress(Array.from({ length: d }, (_, i) => `d${i}`));
    assert.ok(p.open >= last); last = p.open;
  }
  assert.equal(progress(Array.from({ length: 99 }, (_, i) => `d${i}`)).next, null);
  assert.deepEqual(CHAPTERS.map(c => c.at), [...CHAPTERS.map(c => c.at)].sort((a, b) => a - b));
  assert.equal(CHAPTERS[0].at, 0, "the first chapter is open from the start");
  for (const c of CHAPTERS.slice(1)) assert.ok(MILESTONES.includes(c.at), `${c.place} opens on a milestone`);
});

test("the helper only offers shorter things and prompts from chosen categories", () => {
  for (const a of ACTIONS) {
    const s = helper.shorter(a.key, { categories: [a.cat] });
    if (s) assert.ok(s.min < a.min, `${a.key} -> ${s.key} is shorter`);
    if (a.min === 2) assert.equal(helper.shorter(a.key, { categories: CATEGORIES.map(c => c.key) }), null);
  }
  for (let i = 0; i < 50; i++) assert.ok(PROMPT_IDEAS.gratitude.includes(helper.prompt(["gratitude"], i)));
  assert.ok(PROMPT_IDEAS.reflection.includes(helper.prompt([], 1)));
});

test("drawings render for any number of days without broken numbers", () => {
  const q = buildQuest({ id: "s", value: "focus", categories: ["habits"], minutes: 20 });
  for (const d of [0, 1, 2, 5, 9, 19, 47, 48, 60, 61, 300]) {
    for (const svg of [garden(d), lights(d), scenery(progress(Array.from({ length: d }, (_, i) => i)).open)]) {
      assert.ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>"));
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `day ${d} draws cleanly`);
    }
  }
  for (let o = 0; o < CHAPTERS.length; o++) {
    const svg = questMap(q.chapters, o, o);
    assert.equal((svg.match(/data-ch=/g) || []).length, CHAPTERS.length);
    assert.ok(!/NaN|undefined/.test(svg));
  }
  assert.equal(scene("nope", { days: 3, open: 1 }), garden(3), "unknown scenes fall back to the garden");
});

test("the lights and garden only gain things as days are added", () => {
  const lit = (d) => (lights(d).match(/#D9A12B/g) || []).length;
  const plants = (d) => (garden(d).match(/stroke="#6AB21E"/g) || []).length;
  for (let d = 0; d < 80; d++) {
    assert.ok(lit(d + 1) >= lit(d));
    assert.ok(plants(d + 1) >= plants(d));
  }
});

// Everything a member reads from these files.
const words = [
  ...VALUES.flatMap(v => [v.label, v.phrase]), ...CATEGORIES.map(c => c.label),
  ...SCENES.flatMap(s => [s.label, s.blurb]), ...ACTIONS.map(a => a.text),
  ...CHAPTERS.flatMap(c => [c.place, c.story("calmer evenings")]),
  ...Object.values(PROMPT_IDEAS).flat(),
].join("\n");

test("no clinical, screening or streak language in anything a member reads", () => {
  const banned = /symptom|diagnos|disorder|patient|treat|therap|clinical|screen(ing)? (for|test)|depress|anxiety|panic|trauma|cure|heal|recover|relapse|severity|score|streak|fail|missed|behind/i;
  const hit = words.split("\n").find(l => banned.test(l));
  assert.equal(hit, undefined, `found: ${hit}`);
});

test("US spelling", () => {
  const uk = /colour|behaviour|favourite|centre|practis|personalis|organis|licence|grey|programme|judgement|labelled|travell|\blift\b/i;
  const hit = words.split("\n").find(l => uk.test(l));
  assert.equal(hit, undefined, `found: ${hit}`);
});

test("the page carries the wellness note, crisis line and professional help on every tab", () => {
  assert.match(page, /General wellness and self-help only/);
  assert.match(page, /not psychotherapy or clinical\s+care/);
  assert.match(page, /not a substitute for help from a licensed professional/);
  assert.match(page, /tel:988/);
  assert.match(page, /therapists\.html/);
  assert.match(page, /\$\{WELLNESS\}/, "the note is in the shell every tab draws");
  assert.ok(!/streak/i.test(page), "no streaks on the page");
});

console.log(`\n${n} checks passed`);
