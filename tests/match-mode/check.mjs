// Checks that the Match Mode matching rules in
// supabase/migrations/20261008150000_match_mode_matching.sql use the same keys
// and labels as site/assets/match.js and site/assets/lists.js, so a member's
// answers and a therapist's listing are compared on words that exist.
//
//   node tests/match-mode/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SPECIALTIES, AGE_RANGES as AGES_SEEN, PARTICIPANTS } from "../../site/assets/lists.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const sql = readFileSync(here("../../supabase/migrations/20261008150000_match_mode_matching.sql"), "utf8");
// match.js imports app.js, which loads the Supabase client from the network,
// so its lists are read from the source instead.
const matchSrc = readFileSync(here("../../site/assets/match.js"), "utf8");
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

const keysIn = (src, name) => {
  const block = src.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`))[1];
  return [...block.matchAll(/\['([a-z_]+)',/g)].map((m) => m[1]);
};
const MEMBER_AGES = [...matchSrc.match(/export const AGE_RANGES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const GENDERS = keysIn(matchSrc, "GENDERS");
const SESSION_FOR = keysIn(matchSrc, "SESSION_FOR");

test("Life Coaching is gone from the specialties, and the Match Mode topics are the specialties", () => {
  assert.ok(!SPECIALTIES.includes("Life Coaching"));
  assert.match(matchSrc, /export const MATCH_TOPICS = SPECIALTIES;/);
  assert.match(matchSrc, /export const MATCH_TOPICS_MAX = 3;/);
  assert.match(sql, /cardinality\(p_topics\) <= 3/);
  assert.match(sql, /check \(public\.match_topics_ok\(match_topics\)\)/);
  assert.match(sql, /array_remove\(specialties, 'Life Coaching'\)/);
});

test("every member age range maps to one of the Ages seen chips", () => {
  const fallback = sql.match(/when '65\+'\s+then 'Senior adults'\s+else '([^']+)' end/)[1];
  assert.ok(AGES_SEEN.includes(fallback), `${fallback} is not an Ages seen chip`);
  for (const range of MEMBER_AGES) {
    const m = sql.match(new RegExp(`when '${range.replace("+", "\\+")}'\\s+then '([^']+)'`));
    const target = m ? m[1] : fallback;
    assert.ok(AGES_SEEN.includes(target), `${range} maps to ${target}, not an Ages seen chip`);
  }
});

test("the genders a therapist can pick are the member's choices, minus prefer_not", () => {
  const allowed = sql.match(/genders_seen <@ array\[([^\]]*)\]/)[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(allowed, GENDERS.filter((g) => g !== "prefer_not"));
  assert.match(sql, /p\.match_gender = 'prefer_not'/, "prefer_not fits everyone");
});

test("who the sessions are for uses the keys the window offers, each mapped to a Who you see chip", () => {
  const allowed = sql.match(/match_session_for in \(([^)]*)\)/)[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(allowed, SESSION_FOR);
  const fallback = sql.match(/when 'family' then 'Families'\s+else '([^']+)' end/)[1];
  for (const k of SESSION_FOR) {
    const m = sql.match(new RegExp(`when '${k}' then '([^']+)'`));
    const target = m ? m[1] : fallback;
    assert.ok(PARTICIPANTS.includes(target), `${k} maps to ${target}, not a Who you see chip`);
  }
});

test("the old short topic list is folded into specialty names that exist", () => {
  const map = [...sql.matchAll(/when '([^']+)'\s+then '([^']+)'/g)]
    .filter(([, from]) => ["Panic", "Life transition", "Grief/loss", "Relationship issues", "Family issues", "Trauma"].includes(from));
  assert.equal(map.length, 6);
  for (const [, from, to] of map) assert.ok(SPECIALTIES.includes(to), `${from} maps to ${to}, not a specialty`);
});

test("cash fits everyone, and video means anywhere in the state", () => {
  assert.match(sql, /p\.match_insurance in \('self_pay', 'unsure'\)/);
  assert.match(sql, /match_in_state\(t\.license_states, p\.zip\)/);
  assert.match(sql, /match_nearby\(t\.locations, p\.zip\)/);
  assert.match(sql, /p\.match_session_for as session_for/, "the view exposes session_for");
  assert.match(sql, /p\.match_session_for\s*\n\s+from public\.profiles p where p\.id = auth\.uid\(\)/, "my_access() returns match_session_for");
});

console.log(`\n${n} checks passed`);
