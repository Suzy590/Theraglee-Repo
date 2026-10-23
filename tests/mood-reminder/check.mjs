// Exercises supabase/functions/_shared/mood-reminder.ts, the words of the
// evening mood reminder, under plain Node (the module has no imports, so
// Node's built-in TypeScript stripping is enough), and checks that the pieces
// around it agree: the migration lets a member change the switch and returns
// it from my_access(), the function is registered with verify_jwt off, and
// the dashboard and account page both offer the tick box.
//
//   node tests/mood-reminder/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeMoodReminder, firstName, esc } from "../../supabase/functions/_shared/mood-reminder.ts";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const opts = { site: "https://theraglee.com", unsubBase: "https://x.supabase.co/functions/v1/mood-reminder" };
const sarai = { user_id: "u1", email: "s@example.com", full_name: "Sarai Example", email_token: "tok-1", started: false };

test("firstName takes the first word and copes with nothing", () => {
  assert.equal(firstName("Sarai Example"), "Sarai");
  assert.equal(firstName("  Sarai "), "Sarai");
  assert.equal(firstName(null), "");
  assert.equal(firstName(""), "");
});

test("the email greets by first name, links the check-in and offers one-click unsubscribe", () => {
  const m = composeMoodReminder(sarai, opts);
  assert.match(m.html, /Good evening, Sarai\./);
  assert.match(m.text, /Good evening, Sarai\./);
  assert.ok(m.html.includes('href="https://theraglee.com/dashboard.html#mood"'), "button links to the check-in");
  assert.ok(m.text.includes("https://theraglee.com/dashboard.html#mood"), "plain text carries the link too");
  assert.equal(m.unsub, "https://x.supabase.co/functions/v1/mood-reminder?u=tok-1");
  assert.ok(m.html.includes(m.unsub) && m.text.includes(m.unsub), "unsubscribe link in both parts");
  assert.ok(m.html.includes("988"), "the crisis line is in every email");
});

test("a member who tapped a face but did not submit is told the check-in is still open", () => {
  const open = composeMoodReminder({ ...sarai, started: true }, opts);
  const fresh = composeMoodReminder(sarai, opts);
  assert.equal(open.subject, "Today's mood check-in is still open");
  assert.equal(fresh.subject, "A quick nudge: today's mood check-in");
  assert.match(open.text, /tapped a face/);
  assert.doesNotMatch(fresh.text, /tapped a face/);
});

test("no name still reads well, and a name is escaped", () => {
  const m = composeMoodReminder({ ...sarai, full_name: null }, opts);
  assert.match(m.html, /Good evening\.</);
  const t = composeMoodReminder({ ...sarai, full_name: "<b>Bo</b>" }, opts);
  assert.ok(t.html.includes("&lt;b&gt;Bo&lt;/b&gt;"), "html is escaped");
  assert.equal(esc(`a&b<c>"d'`), "a&amp;b&lt;c&gt;&quot;d&#39;");
});

test("the reminder never mentions streaks, scores or a diagnosis of its own", () => {
  for (const started of [true, false]) {
    const m = composeMoodReminder({ ...sarai, started }, opts);
    assert.doesNotMatch(m.html + m.text, /streak/i);
    assert.doesNotMatch(m.html + m.text, /\bscore/i);
    assert.doesNotMatch(m.html + m.text, /diagnos(e|is)\b(?! or treatment)/i);
  }
});

test("the migration lets a member change the switch and my_access() returns it", () => {
  const sql = read("supabase/migrations/20261024120000_mood_reminder.sql");
  assert.match(sql, /add column if not exists mood_reminder boolean not null default false/);
  assert.match(sql, /grant update \(mood_reminder\) on public\.profiles to authenticated/);
  assert.match(sql, /function public\.my_access\(\)[\s\S]*p\.mood_reminder/);
  assert.match(sql, /cron\.schedule\(\s*'mood-reminder'/);
  assert.match(sql, /x-mood-reminder-key/);
  // The function reads the key under the same name the cron job sends it.
  const fn = read("supabase/functions/mood-reminder/index.ts");
  assert.match(fn, /req\.headers\.get\("x-mood-reminder-key"\)/);
  assert.match(fn, /eq\("key", "mood_reminder_key"\)/);
  assert.match(sql, /'mood_reminder_key'/);
});

test("the function is registered with verify_jwt off, like the digest", () => {
  const toml = read("supabase/config.toml");
  assert.match(toml, /\[functions\.mood-reminder\]\s*\nverify_jwt = false/);
});

test("the dashboard check-in and the account page both offer the tick box", () => {
  assert.match(read("site/assets/mood-ui.js"), /mood_reminder/);
  assert.match(read("site/account.html"), /id="mremind"/);
  assert.match(read("site/account.html"), /mood_reminder/);
});

console.log(`\n${n} checks passed.`);
