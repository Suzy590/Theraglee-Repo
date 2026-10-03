// Exercises site/assets/quest-paths.js and site/assets/quest-scene.js, the
// quest map on the Premium Goals & tracking page, under plain Node. Checks the
// lists match the database's checks, that every map fits the member's own
// choices and speaks to their focus, that progress only counts up, that the
// trail map draws cleanly, and that nothing a member reads drifts into
// clinical language.
//
//   node tests/quest-paths/check.mjs
//
// Exits non-zero on the first failed assertion. docs/quest-map.md is the guide.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  VALUES, CATEGORIES, MINUTES, SCENES, ACTIONS, CHAPTERS, PROMPT_IDEAS, MILESTONES,
  buildQuest, progress, helper, pool, suits, samplesFor, MAIN_PER_CHAPTER,
} from "../../site/assets/quest-paths.js";
import { trailMap, hikerAt, dayAt, towardNext, TRAIL } from "../../site/assets/quest-scene.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const sql = read("supabase/migrations/20260927190000_quest_maps.sql");
const page = read("site/goals.html");
const dash = read("site/dashboard.html");
const app = read("site/assets/app.js");

/** The quoted words inside the first `<anchor> ... )` list in the migration. */
const listAfter = (anchor) => {
  const i = sql.indexOf(anchor);
  assert.ok(i >= 0, `migration has ${anchor}`);
  const body = sql.slice(i + anchor.length, sql.indexOf(")", i + anchor.length));
  return [...body.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
};
const same = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());
const days = (d) => Array.from({ length: d }, (_, i) => `d${i}`);

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

test("every focus carries an example in a member's words and a line on its actions", () => {
  for (const v of VALUES) {
    assert.ok(v.example && v.example.length > 8 && !v.example.endsWith("."), `${v.key} has an example intention`);
    assert.ok(v.does && v.does.endsWith("."), `${v.key} says what its actions look like`);
    assert.match(v.phrase, /^[a-z]/, `${v.key} phrase finishes "a quest toward …"`);
  }
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
    assert.ok((PROMPT_IDEAS[c.key] || []).length, `${c.key} has nudges`);
  }
});

test("every focus has actions of its own in every kind of practice, within five minutes", () => {
  for (const v of VALUES) {
    for (const c of CATEGORIES) {
      assert.ok(ACTIONS.some(a => a.cat === c.key && suits(a, v.key) && a.min <= 5),
        `${v.key} has a short ${c.key} action written for it`);
    }
    const own = ACTIONS.filter(a => suits(a, v.key));
    assert.ok(own.length >= 18, `${v.key} has a good spread of its own actions (${own.length})`);
    const samples = samplesFor(v.key);
    assert.equal(samples.length, 3);
    assert.ok(samples.every(a => suits(a, v.key)), "samples are written for the focus");
    assert.equal(new Set(samples.map(a => a.cat)).size, 3, "samples span three kinds of practice");
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

test("the map speaks to the focus: most of what a chapter shows was written for it", () => {
  for (const v of VALUES) for (const m of MINUTES) {
    const categories = CATEGORIES.map(c => c.key);
    const q = buildQuest({ id: "focus", value: v.key, categories, minutes: m });
    for (const ch of q.chapters) {
      assert.equal(ch.main.length, MAIN_PER_CHAPTER);
      assert.ok(ch.main.filter(a => suits(a, v.key)).length >= 2, `${v.key}/${m} ${ch.place}: ${ch.main.map(a => a.key)}`);
    }
  }
  // The case from the first screenshots: steady routines, habits and self-care, two minutes.
  const q = buildQuest({ id: "x", value: "steady_routines", categories: ["habits", "self_care"], minutes: 2 });
  for (const ch of q.chapters) assert.ok(ch.main.filter(a => suits(a, "steady_routines")).length >= 2, ch.place);
  const p = pool({ value: "calm_evenings", categories: ["self_care", "habits", "nature"], minutes: 10 });
  assert.ok(p.every(a => !a.values || a.values.includes("calm_evenings")));
  assert.ok(suits(p[0], "calm_evenings"), "the pool lists the focus's own actions first");
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
    const p = progress(days(d));
    assert.ok(p.open >= last); last = p.open;
  }
  assert.equal(progress(days(99)).next, null);
  assert.deepEqual(CHAPTERS.map(c => c.at), [...CHAPTERS.map(c => c.at)].sort((a, b) => a - b));
  assert.equal(CHAPTERS[0].at, 0, "the first chapter is open from the start");
  for (const c of CHAPTERS.slice(1)) assert.ok(MILESTONES.includes(c.at), `${c.place} opens on a milestone`);
});

test("the helper only offers shorter things and nudges from chosen categories", () => {
  for (const a of ACTIONS) {
    const s = helper.shorter(a.key, { categories: [a.cat] });
    if (s) assert.ok(s.min < a.min, `${a.key} -> ${s.key} is shorter`);
    if (a.min === 2) assert.equal(helper.shorter(a.key, { categories: CATEGORIES.map(c => c.key) }), null);
  }
  for (let i = 0; i < 50; i++) assert.ok(PROMPT_IDEAS.gratitude.includes(helper.prompt(["gratitude"], i)));
  assert.ok(PROMPT_IDEAS.reflection.includes(helper.prompt([], 1)));
  for (const line of Object.values(PROMPT_IDEAS).flat()) assert.match(line, /\?$/, "a nudge asks a question");
});

test("the hiker walks the trail one chapter at a time and never steps back", () => {
  assert.equal(TRAIL.points.length, CHAPTERS.length, "one place on the map per chapter");
  let lastSeg = 0, lastU = 0;
  for (let d = 0; d <= CHAPTERS.at(-1).at; d++) {
    const h = hikerAt(d, CHAPTERS);
    assert.equal(h.open, progress(days(d)).open, `day ${d} stands at the open chapter`);
    assert.ok(h.seg > lastSeg || (h.seg === lastSeg && h.u >= lastU), `day ${d} does not step back`);
    lastSeg = h.seg; lastU = h.u;
    assert.ok(h.u >= 0 && h.u <= 1);
  }
  assert.deepEqual(hikerAt(3, CHAPTERS), { seg: 1, u: 0, open: 1 }, "day three stands on The First Clearing");
  assert.equal(hikerAt(500, CHAPTERS).u, 1, "past the last place the hiker stays there");
  for (let k = 1; k <= 400; k++) {
    const d = dayAt(k, CHAPTERS);
    assert.ok(d.seg >= 0 && d.seg < CHAPTERS.length - 1 && d.u >= 0 && d.u <= 1, `day ${k} is planted on the trail`);
  }
  assert.equal(towardNext(progress(days(5)), CHAPTERS), 0.5, "five days is halfway from three to seven");
  assert.equal(towardNext(progress(days(40)), CHAPTERS), 1);
});

test("the trail map draws for any number of days, any scene, without broken numbers", () => {
  const q = buildQuest({ id: "s", value: "focus", categories: ["habits"], minutes: 20 });
  for (const d of [0, 1, 2, 3, 5, 7, 9, 12, 19, 25, 35, 36, 47, 48, 60, 61, 120, 121, 300]) {
    const p = progress(days(d));
    for (const scene of [...SCENES.map(s => s.key), "nope"]) {
      const svg = trailMap(q.chapters, p, { scene });
      assert.ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>"));
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `day ${d} ${scene} draws cleanly`);
      assert.equal((svg.match(/data-ch=/g) || []).length, CHAPTERS.length, "every place can be tapped");
      assert.match(svg, /You are here/);
      assert.equal((svg.match(/>opens after \d+ days</g) || []).length, CHAPTERS.length - 1 - p.open, "places ahead say when they open");
    }
  }
  for (let o = 0; o < CHAPTERS.length; o++) assert.match(trailMap(q.chapters, progress(days(CHAPTERS[o].at)), { current: o }), /showing now/);
});

test("the trail only ever gains things as days are added", () => {
  const q = buildQuest({ id: "g", value: "energy", categories: ["movement"], minutes: 5 });
  const count = (svg, re) => (svg.match(re) || []).length;
  let flowers = 0, lanterns = 0, open = 0;
  for (let d = 0; d < 130; d++) {
    const p = progress(days(d));
    const f = count(trailMap(q.chapters, p, { scene: "garden" }), /#F6C453"\/><\/g>/g);
    const l = count(trailMap(q.chapters, p, { scene: "lights" }), /#FFF4D0/g);
    const o = count(trailMap(q.chapters, p, { scene: "scenery" }), /stroke="#fff" stroke-width="3"/g);
    assert.ok(f >= flowers, `day ${d}: flowers never disappear`);
    assert.ok(l >= lanterns, `day ${d}: lanterns never go out`);
    assert.ok(o >= open, `day ${d}: an open place stays open`);
    flowers = f; lanterns = l; open = o;
  }
  assert.ok(flowers > 100 && lanterns > 100, "a flower or lantern for every day shown up");
});

// Everything a member reads from these files.
const words = [
  ...VALUES.flatMap(v => [v.label, v.phrase, v.example, v.does]), ...CATEGORIES.map(c => c.label),
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

test("the page says plainly how a day counts, and keeps goals under the trail", () => {
  assert.match(page, /Today is counted/);
  assert.match(page, /Today is not counted yet/);
  assert.match(page, /Do one small action/);
  assert.match(page, /id="goals-zone"/, "goals of your own sit in a zone under the trail");
  assert.match(page, /Logging one counts as a day shown up on your trail/);
  assert.ok(!/\['map',\s*'Nearby help'\]/.test(page), "Nearby help is no longer a tab here");
  assert.match(page, /location\.hash === '#map'\) location\.replace\('dashboard\.html#nearby'\)/, "old links to it forward");
});

test("Nearby help is a tab on the member dashboard, and the repeated tab row has it", () => {
  assert.match(dash, /<button data-tab="nearby" role="tab">Nearby help<\/button>/);
  assert.match(dash, /data-panel="nearby"/);
  assert.match(dash, /'nearby'\]/, "PANELS lists it");
  assert.match(dash, /mountNearby\(document\.getElementById\('nearby-host'\)/);
  assert.match(app, /\['Nearby help',\s*'nearby'\]/, "DASH_TABS lists it");
});

console.log(`\n${n} checks passed`);
