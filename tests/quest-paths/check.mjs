// Exercises the Premium Goals & tracking page's data and drawings under plain
// Node: site/assets/quest-paths.js (the action library), quest-goals.js (the
// goal matcher and milestones) and quest-scene.js (the trail map). Checks the
// lists match the database's checks, that a goal in a member's words finds the
// right theme and relevant stepping stones, that the map draws cleanly for any
// goal, and that nothing a member reads drifts into clinical language.
//
//   node tests/quest-paths/check.mjs
//
// Exits non-zero on the first failed assertion. docs/quest-map.md is the guide.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  VALUES, CATEGORIES, MINUTES, SCENES, ACTIONS, PROMPT_IDEAS, action, suits, helper,
} from "../../site/assets/quest-paths.js";
import {
  WORDS, THEME_TAGS, MILESTONES, MILESTONE_SETS, EXAMPLE_GOALS, GOAL_LIBRARY, STEPS_PER_MILESTONE,
  detectTheme, suggestMilestones, suggestSteps, reasonFor, recognizedWords, milestoneProblems, tagsOf, setFor,
} from "../../site/assets/quest-goals.js";
import { LIBRARY_SETS, LIBRARY_WORDS, LIBRARY_THEME_TAGS } from "../../site/assets/quest-goal-library.js";
import { trailMap, TRAIL, campAt, hikerFraction, dayFraction, along } from "../../site/assets/quest-scene.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const sql = read("supabase/migrations/20260927190000_quest_maps.sql");
const sql2 = read("supabase/migrations/20261003120000_quest_milestones.sql");
const sql3 = read("supabase/migrations/20261004090000_calm_theme.sql");
const page = read("site/goals.html");
const ui = read("site/assets/goals-ui.js");
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

/* ---------------------------------------------------------- the library */
test("values match both database checks (the newest migration that sets them)", () => {
  const keys = VALUES.map(v => v.key);
  const lists = [...sql3.matchAll(/check \(value_key in \(([^)]*)\)/g)];
  assert.equal(lists.length, 2, "goals.value_key and quests.value_key");
  for (const m of lists) same(keys, [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]));
  assert.match(sql3, /goals_value_key_check/); assert.match(sql3, /quests_value_key_check/);
});

test("categories, minutes and scenes match the database", () => {
  same(CATEGORIES.map(c => c.key), listAfter("categories <@ array["));
  same(SCENES.map(s => s.key), listAfter("scene in ("));
  const mins = sql.match(/minutes in \(([^)]*)\)/)[1].split(",").map(Number);
  same(MINUTES, mins);
});

test("the milestones migration holds the table the page reads, and lets step keys carry digits", () => {
  assert.match(sql2, /create table if not exists public\.quest_milestones/);
  for (const col of ["title", "position", "actions", "own_steps", "reached_on", "checked_on"]) assert.match(sql2, new RegExp(`\\b${col}\\b`), col);
  assert.match(sql2, /milestone_id uuid references public\.quest_milestones/);
  assert.match(sql2, /action_key ~ '\^\[a-z0-9_\]\{3,60\}\$'/);
  assert.match(sql2, /char_length\(intention\) <= 240/);
  assert.match(sql2, /enable row level security/);
  assert.match(sql2, /revoke all on public\.quest_milestones from anon/);
});

test("every action is well formed and every focus has short actions of its own in every category", () => {
  const cats = new Set(CATEGORIES.map(c => c.key)), vals = new Set(VALUES.map(v => v.key)), keys = new Set();
  for (const a of ACTIONS) {
    assert.match(a.key, /^[a-z0-9_]{3,60}$/, `${a.key} fits quest_steps.action_key`);
    assert.ok(!keys.has(a.key), `${a.key} is unique`); keys.add(a.key);
    assert.ok(cats.has(a.cat) && MINUTES.includes(a.min), `${a.key} has a known category and length`);
    for (const v of a.values || []) assert.ok(vals.has(v), `${a.key} names known value ${v}`);
    assert.ok(a.text.length > 10 && a.text.endsWith("."), `${a.key} reads as a sentence`);
    if (a.write) assert.match(a.text, /^(Write|Note|Describe|List|Fill|Name)\b/, `${a.key} is done by writing`);
    if (/^(Write|Describe|List|Fill)\b/.test(a.text)) assert.ok(a.write, `${a.key} should be flagged write`);
  }
  for (const v of VALUES) {
    assert.ok(v.example && v.does, `${v.key} has an example goal and a line on its actions`);
    for (const c of CATEGORIES) assert.ok(ACTIONS.some(a => a.cat === c.key && suits(a, v.key) && a.min <= 5), `${v.key} has a short ${c.key} action`);
  }
});

/* ------------------------------------------------------------ the matcher */
test("every milestone names real actions, four each, five per theme, in plain words", () => {
  assert.deepEqual(milestoneProblems(), []);
  for (const v of VALUES) {
    const list = MILESTONES[v.key];
    assert.equal(list.length, 5, `${v.key} has five milestones`);
    for (const m of list) {
      assert.equal(m.steps.length, 4, `${m.title} has four stepping stones`);
      assert.ok(m.title.length <= 60 && !/\d/.test(m.title), `${m.title} is short and not a number to hit`);
      assert.ok(m.steps.some(k => suits(action(k), v.key)), `${m.title} has a stone written for ${v.key}`);
    }
    assert.equal(suggestMilestones(v.key).length, 5);
    assert.notEqual(suggestMilestones(v.key)[0].steps, list[0].steps, "suggestions are copies");
  }
  for (const [k, set] of Object.entries(MILESTONE_SETS)) {
    assert.equal(set.milestones.length, 5, `${k} set has five milestones`);
    for (const m of set.milestones) assert.equal(m.steps.length, 4, `${m.title} has four stones`);
  }
  assert.equal(EXAMPLE_GOALS.length, VALUES.length);
  assert.ok(ui.includes("Browse ${GOAL_LIBRARY.length + EXAMPLE_GOALS.length} common goals"), "setup offers the library");
  assert.equal(STEPS_PER_MILESTONE, 7);
  for (const tag of Object.values(THEME_TAGS).flatMap(t => Object.keys(t))) assert.ok(WORDS[tag], `theme tag ${tag} has words`);
});

test("a goal in a member's words finds its theme, and says which words did it", () => {
  const cases = [
    ["Evenings that feel like mine again", "calm_evenings"],
    ["I want to stop scrolling my phone at night and sleep better", "calm_evenings"],
    ["Feel less lonely and talk to my friends more", "connection"],
    ["Have more energy in the mornings, I am exhausted all the time", "energy"],
    ["Get outside every day", "time_outdoors"],
    ["Stop being so hard on myself", "self_kindness"],
    ["Talking to myself like a friend", "self_kindness"],
    ["Start drawing again", "creativity"],
    ["Focus at work without getting distracted", "focus"],
    ["A morning routine that actually sticks", "steady_routines"],
    ["More real conversations", "connection"],
    ["Fresh air every day, not just weekends", "time_outdoors"],
    ["A more loving marriage", "connection"],
    ["Date nights again", "connection"],
    ["Fight less with my partner and really listen", "connection"],
    ["Learn to love myself", "self_kindness"],
  ];
  for (const [text, theme] of cases) {
    const d = detectTheme(text);
    assert.equal(d.theme, theme, `"${text}" → ${d.theme}`);
    assert.ok(d.because.length, `"${text}" says why`);
    assert.ok(recognizedWords(text).length);
  }
  for (const g of EXAMPLE_GOALS) assert.equal(detectTheme(g.text).theme, g.theme, `example "${g.text}" matches its own theme`);
  assert.equal(detectTheme("Be a better person").theme, null, "words we do not know ask the member to pick");
  assert.equal(detectTheme("").theme, null);
});

test("suggested stepping stones are relevant: they fit the theme, the milestone and the member's words", () => {
  const text = "I want to stop scrolling my phone at night and sleep better";
  const ms = suggestMilestones("calm_evenings")[0];
  const s = suggestSteps({ text, theme: "calm_evenings", milestone: ms, minutes: 5, limit: 8 });
  assert.equal(s.length, 8);
  assert.ok(s.slice(0, 4).every(x => ms.steps.includes(x.action.key)), "the milestone's own stones lead");
  assert.ok(s.every(x => x.action.min <= 5), "nothing longer than the member has");
  assert.ok(s.every(x => x.because.length), "every suggestion names a word from the goal");
  assert.match(reasonFor(s[0]), /because you mentioned/);
  assert.ok(s.slice(0, 6).every(x => tagsOf(x.action.key).some(t => ["evening", "sleep", "screen"].includes(t))), "the top stones are about evenings, sleep or screens");
  for (const v of VALUES) {
    const r = suggestSteps({ text: v.example, theme: v.key, milestone: suggestMilestones(v.key)[0], minutes: 20, limit: 6 });
    assert.ok(r.length >= 4 && r.every(x => suits(x.action, v.key) || !x.action.values), `${v.key}: stones suit the theme`);
  }
  // A goal about a partner gets milestones and stones written for one.
  const marriage = suggestMilestones("connection", "A more loving marriage");
  assert.equal(marriage[0].title, "One meal a day together with no screens");
  assert.equal(suggestMilestones("connection", "Feel less lonely")[0].title, "I reach out to one person most days");
  const ms2 = suggestSteps({ text: "A more loving marriage", theme: "connection", milestone: marriage[1], minutes: 10, limit: 6 });
  assert.ok(ms2.every(x => tagsOf(x.action.key).includes("partner")), ms2.map(x => x.action.key).join());
  assert.match(reasonFor(ms2[0]), /marriage|loving/);
  // A milestone the member wrote still gets stones from its words.
  const own = suggestSteps({ text: "", theme: "focus", milestone: { title: "No phone at the dinner table", steps: [] }, minutes: 10, limit: 4 });
  assert.ok(own.some(x => tagsOf(x.action.key).includes("screen") || tagsOf(x.action.key).includes("food")), own.map(x => x.action.key).join());
  // Nothing in the matcher reaches outside the browser.
  const src = read("site/assets/quest-goals.js");
  assert.ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon|import\(/.test(src), "the matcher makes no network calls");
});

test("the What helped nudges all ask what helped, and the helper stays rule-based", () => {
  for (const c of CATEGORIES) assert.ok((PROMPT_IDEAS[c.key] || []).length, `${c.key} has nudges`);
  for (const line of Object.values(PROMPT_IDEAS).flat()) assert.match(line, /\?$/);
  for (let i = 0; i < 20; i++) assert.ok(PROMPT_IDEAS.gratitude.includes(helper.prompt(["gratitude"], i)));
});

test("the goal library: a hundred common goals to start, twenty more a week, every one matched", () => {
  assert.ok(GOAL_LIBRARY.length >= 100, `${GOAL_LIBRARY.length} goals`);
  const texts = new Set();
  const byWeek = {};
  for (const g of GOAL_LIBRARY) {
    assert.ok(g.text.length >= 8 && g.text.length <= 70 && !/[.!]$/.test(g.text), `"${g.text}" reads like a goal, no closing period`);
    assert.ok(!texts.has(g.text.toLowerCase()), `"${g.text}" is not a repeat`); texts.add(g.text.toLowerCase());
    assert.ok(VALUES.some(v => v.key === g.theme), `"${g.text}" names a theme`);
    assert.match(g.week, /^\d{4}-\d{2}-\d{2}$/, `"${g.text}" has the week it was added`);
    assert.equal(new Date(g.week + "T12:00:00Z").getUTCDay(), 1, `"${g.text}": week is a Monday`);
    (byWeek[g.week] ||= []).push(g);
    const d = detectTheme(g.text);
    assert.equal(d.theme, g.theme, `"${g.text}" → ${d.theme} (${d.because.join(", ")}), wanted ${g.theme}`);
    assert.equal(setFor(g.theme, g.text), g.set || null, `"${g.text}" picks the ${g.set || "general"} set`);
    if (g.set) assert.equal(MILESTONE_SETS[g.set].theme, g.theme, `"${g.text}": the ${g.set} set is for its theme`);
    const stones = suggestSteps({ text: g.text, theme: g.theme, milestone: suggestMilestones(g.theme, g.text)[0], minutes: 10, limit: 4 });
    assert.ok(stones.length === 4 && stones.filter(x => x.action.min <= 10).length >= 2, `"${g.text}" gets four stones, most of them short`);
  }
  const weeks = Object.keys(byWeek).sort();
  assert.ok(byWeek[weeks[0]].length >= 100, "the first batch is a hundred");
  for (const w of weeks.slice(1)) assert.ok(byWeek[w].length >= 20, `week ${w} added ${byWeek[w].length}, twenty is the floor`);
  for (const v of VALUES) assert.ok(GOAL_LIBRARY.some(g => g.theme === v.key), `${v.key} has library goals`);
  for (const [key, set] of Object.entries(LIBRARY_SETS)) {
    assert.ok(WORDS[key], `${key} set has words`);
    assert.ok(GOAL_LIBRARY.some(g => g.set === key), `${key} set is used by a goal`);
    assert.equal(set.milestones.length, 5); for (const m of set.milestones) assert.equal(m.steps.length, 4, m.title);
  }
  for (const tag of Object.keys(LIBRARY_WORDS)) assert.ok(WORDS[tag].length, `${tag} merged`);
  for (const theme of Object.keys(LIBRARY_THEME_TAGS)) assert.ok(THEME_TAGS[theme], `${theme} is a theme`);
});

/* ------------------------------------------------------------- the map */
const ms = (theme, reached, count = 5) => suggestMilestones(theme).slice(0, count).map((m, i) => ({ title: m.title, reached: i < reached }));

test("camps sit along the trail in order, the hiker only moves forward, and planted days never move", () => {
  for (const count of [1, 3, 4, 5, 6]) {
    let last = 0;
    for (let i = 0; i < count; i++) { const f = campAt(i, count); assert.ok(f > last && f < 1); last = f; }
  }
  let lastF = 0;
  const m = ms("focus", 0);
  for (let c = 0; c < 5; c++) {
    for (let k = 0; k <= 7; k++) {
      const f = hikerFraction({ milestones: m.map((x, i) => ({ ...x, reached: i < c })), current: c, stepFrac: k / 7 });
      assert.ok(f >= lastF && f <= 1, `camp ${c} step ${k} does not step back`); lastF = f;
    }
  }
  assert.ok(hikerFraction({ milestones: m, current: 5, stepFrac: 0 }) >= 0.98, "all reached: at the goal");
  for (let k = 1; k < 200; k++) { const f = dayFraction(k); assert.ok(f > 0 && f < 1); assert.equal(dayFraction(k), f); }
  const p = along(0.5); assert.ok(p.x > 0 && p.x < TRAIL.W && p.y > 0 && p.y < TRAIL.H && Math.abs(Math.hypot(p.nx, p.ny) - 1) < 1e-6);
});

test("the trail map draws for every theme, any number of milestones, any scene and any day count", () => {
  for (const v of VALUES) for (const scene of [...SCENES.map(s => s.key), "nope"]) for (const count of [1, 3, 5]) {
    for (const reached of [0, 1, count]) for (const days of [0, 1, 12, 160]) {
      const list = ms(v.key, reached, count);
      const svg = trailMap({ goal: { text: v.example, theme: v.key }, milestones: list, current: reached, stepFrac: 0.4, days, scene });
      assert.ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>"));
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${v.key}/${scene}/${count}/${reached}/${days} draws cleanly`);
      assert.equal((svg.match(/data-ms=/g) || []).length, count, "every camp can be tapped");
      assert.match(svg, /data-goal/);
      assert.match(svg, /You are here/);
      assert.match(svg, reached >= count ? /GOAL REACHED/ : /WORKING ON NOW/);
      assert.equal((svg.match(/WORKING ON NOW/g) || []).length <= 1, true, "only the current camp is labeled");
    }
  }
  assert.match(trailMap({ goal: { text: "<b>", theme: "focus" }, milestones: [{ title: "a & b", reached: false }] }), /&lt;b&gt;/, "escapes the member's words");
});

test("the trail only ever gains flowers, lanterns and reached camps", () => {
  const count = (svg, re) => (svg.match(re) || []).length;
  let flowers = 0, lanterns = 0;
  const list = ms("energy", 1);
  for (let d = 0; d < 170; d++) {
    const f = count(trailMap({ goal: { theme: "energy" }, milestones: list, current: 1, days: d, scene: "garden" }), /class="trail-bloom"/g);
    const l = count(trailMap({ goal: { theme: "energy" }, milestones: list, current: 1, days: d, scene: "lights" }), /#FFF4D0/g);
    assert.ok(f >= flowers && l >= lanterns, `day ${d}: nothing disappears`); flowers = f; lanterns = l;
  }
  assert.ok(flowers > 140 && lanterns > 140);
  let flags = 0;
  for (let r = 0; r <= 5; r++) {
    const c = count(trailMap({ goal: { theme: "energy" }, milestones: ms("energy", r), current: r, scene: "scenery" }), /fill="#187C1A"\/>\s*<text[^>]*>✓/g);
    assert.ok(c >= flags); flags = c;
  }
  assert.equal(flags, 5, "a green check flag per reached camp");
});

/* --------------------------------------------------------------- words */
const words = [
  ...VALUES.flatMap(v => [v.label, v.phrase, v.example, v.does]), ...CATEGORIES.map(c => c.label),
  ...SCENES.flatMap(s => [s.label, s.blurb]), ...ACTIONS.map(a => a.text),
  ...Object.values(MILESTONES).flat().map(m => m.title), ...Object.values(PROMPT_IDEAS).flat(),
  ...Object.values(MILESTONE_SETS).flatMap(s => s.milestones.map(m => m.title)), ...GOAL_LIBRARY.map(g => g.text),
].join("\n");

test("no clinical, screening or streak language in anything a member reads", () => {
  const banned = /symptom|diagnos|disorder|patient|treat|therap|clinical|screen(ing)? (for|test)|depress|anxiety|panic|trauma|cure|heal|recover|relapse|severity|score|streak|fail|missed|behind/i;
  const hit = words.split("\n").find(l => banned.test(l));
  assert.equal(hit, undefined, `found: ${hit}`);
  assert.ok(!/streak/i.test(ui) && !/streak/i.test(page), "no streaks on the page");
});

test("US spelling", () => {
  const uk = /colour|behaviour|favourite|centre|practis|personalis|organis|licence|grey|programme|judgement|labelled|travell|\blift\b/i;
  const hit = words.split("\n").find(l => uk.test(l));
  assert.equal(hit, undefined, `found: ${hit}`);
});

/* ---------------------------------------------------------------- pages */
test("the tab carries the wellness note and crisis line, and the three levels in order", () => {
  const goalsTab = dash.slice(dash.indexOf('data-panel="goals"'), dash.indexOf('data-panel="playlists"'));
  assert.match(goalsTab, /class="wellness"/);
  assert.match(goalsTab, /General wellness and self-help only/);
  assert.match(goalsTab, /not psychotherapy or clinical\s+care/);
  assert.match(goalsTab, /not a substitute for help from a licensed professional/);
  assert.match(goalsTab, /tel:988/);
  assert.match(goalsTab, /therapists\.html/);
  assert.match(goalsTab, /href="#nearby"/);
  assert.match(goalsTab, /id="goals-host"/);
  const order = ["Your goal", "Working on now", "Today's stepping stones", "Tonight"].map(s => ui.indexOf(s));
  assert.ok(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), `goal, milestone, stones, tonight: ${order}`);
  assert.match(ui, /Is it happening for you now\?/, "the member decides when a milestone is reached");
  assert.match(ui, /Your words never leave your device and no AI reads them/);
  assert.match(ui, /Today is done\./); assert.match(ui, /Today still needs one step\./);
});

test("Mental Health Goals is its own tab on the member dashboard's menu bar, and goals.html leads there", () => {
  assert.match(dash, /<button data-tab="goals" role="tab">Mental Health Goals<\/button>/);
  assert.match(dash, /'goals'/, "goals is in PANELS");
  assert.match(dash, /mountGoals\(host, \{ sb, uid: a\.profile\.id/);
  assert.match(dash, /lockNotice\(host, 3, 'Mental Health Goals'\)/, "Premium only");
  assert.match(dash, /<link rel="stylesheet" href="assets\/goals\.css">/);
  assert.match(app, /\['Mental Health Goals',\s*'goals'\]/);
  assert.doesNotMatch(app, /'goals\.html':/, "the forwarding page shows no tab row");
  assert.match(page, /location\.replace\('dashboard\.html#' \+ tab\)/);
  assert.match(page, /'#music' \? 'playlists'/); assert.match(page, /'#map' \? 'nearby'/);
  assert.match(page, /'goals'/);
});

test("Nearby help stays on the member dashboard's menu bar", () => {
  assert.match(dash, /<button data-tab="nearby" role="tab">Nearby help<\/button>/);
  assert.match(dash, /data-panel="nearby"/);
  assert.match(app, /\['Nearby help',\s*'nearby'\]/);
});

console.log(`\n${n} checks passed`);
