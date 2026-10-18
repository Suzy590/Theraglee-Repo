// Exercises supabase/functions/_shared/therapist-nudges.ts under plain Node —
// the module has no imports, so Node's built-in TypeScript stripping is enough.
//
//   node tests/therapist-nudges/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import {
  composeNudge, daysSince, MAX_DAYS, nextStep, prettyDate, rateLine, STEPS, whatIsLeft,
} from "../../supabase/functions/_shared/therapist-nudges.ts";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const NOW = new Date("2026-10-18T15:00:00Z");
const SITE = "https://theraglee.com";

/* ------------------------------------------------------------- the steps */

test("four steps, in order, each later than the last", () => {
  assert.deepEqual(STEPS.map((s) => s.step), ["day1", "day3", "day7", "day14"]);
  for (let i = 1; i < STEPS.length; i++) assert.ok(STEPS[i].after > STEPS[i - 1].after);
  assert.equal(STEPS[0].after, 1, "nobody is written to on the day they signed up");
});

test("daysSince counts whole days", () => {
  assert.equal(daysSince("2026-10-18T03:00:00Z", NOW), 0);
  assert.equal(daysSince("2026-10-17T14:00:00Z", NOW), 1);
  assert.equal(daysSince("2026-10-11T15:00:00Z", NOW), 7);
});

test("nextStep sends the step whose day has come, once", () => {
  assert.equal(nextStep(0, []), null);
  assert.equal(nextStep(1, []), "day1");
  assert.equal(nextStep(2, ["day1"]), null);
  assert.equal(nextStep(3, ["day1"]), "day3");
  assert.equal(nextStep(5, ["day1", "day3"]), null);
  assert.equal(nextStep(7, ["day1", "day3"]), "day7");
  assert.equal(nextStep(14, ["day1", "day3", "day7"]), "day14");
  assert.equal(nextStep(20, ["day1", "day3", "day7", "day14"]), null);
});

test("nextStep skips stale steps instead of catching up", () => {
  // An account ten days old when the sequence starts gets day7, not day1.
  assert.equal(nextStep(10, []), "day7");
  assert.equal(nextStep(11, ["day7"]), null);
  assert.equal(nextStep(14, ["day7"]), "day14");
  assert.equal(nextStep(3, null), "day3");
});

test("nextStep stops after the last step and after MAX_DAYS", () => {
  assert.equal(nextStep(44, []), "day14");
  assert.equal(nextStep(MAX_DAYS + 1, []), null);
  assert.equal(nextStep(100, ["day14"]), null);
});

/* ---------------------------------------------------------- what is left */

test("whatIsLeft points each stage at the right place", () => {
  assert.equal(whatIsLeft("no_membership", SITE).href, `${SITE}/therapist-dashboard.html#membership`);
  assert.match(whatIsLeft("no_membership", SITE).line, /^One thing is left: start your membership/);
  assert.equal(whatIsLeft("no_license", SITE).href, `${SITE}/therapist-dashboard.html`);
  assert.match(whatIsLeft("no_license", SITE).line, /license number and state/);
  assert.match(whatIsLeft("nothing_yet", SITE).line, /^Two things are left/);
});

/* ------------------------------------------------------------ the emails */

const ctx = (over = {}) => ({
  firstName: "Maria", stage: "nothing_yet", site: SITE,
  unsub: "https://x.supabase.co/functions/v1/therapist-nudges?u=abc",
  rate: "$20/month", founding: true, signedUp: "October 4, 2026", ...over,
});

test("every step has a subject, a button, the unsubscribe link and a plain-text twin", () => {
  for (const { step } of STEPS) {
    for (const stage of ["nothing_yet", "no_membership", "no_license"]) {
      const m = composeNudge(step, ctx({ stage }));
      assert.ok(m.subject.length > 8, `${step} subject`);
      assert.ok(m.html.includes("therapist-dashboard.html"), `${step}/${stage} button`);
      assert.ok(m.html.includes(ctx().unsub) && m.text.includes(ctx().unsub), `${step}/${stage} unsubscribe`);
      assert.ok(m.text.includes(whatIsLeft(stage, SITE).line), `${step}/${stage} says what is left`);
      assert.ok(m.html.includes("October 4, 2026"), `${step}/${stage} names the sign-up day`);
      assert.ok(!/<[a-z]/.test(m.text), `${step}/${stage} text has no tags`);
    }
  }
});

test("the day-1 subject counts what is left", () => {
  assert.equal(composeNudge("day1", ctx({ stage: "nothing_yet" })).subject, "You're two steps from a live listing");
  assert.equal(composeNudge("day1", ctx({ stage: "no_membership" })).subject, "You're one step from a live listing");
  assert.equal(composeNudge("day1", ctx({ stage: "no_license" })).subject, "You're one step from a live listing");
});

test("the day-3 email states the rate and that it is locked in while founding", () => {
  const m = composeNudge("day3", ctx());
  assert.ok(m.text.includes("$20/month, locked in"));
  assert.ok(m.text.includes("no fee per contact, per referral or per session"));
  const regular = composeNudge("day3", ctx({ rate: "$29/month", founding: false }));
  assert.ok(regular.text.includes("Theraglee is $29/month."));
  assert.ok(!regular.text.includes("locked in"));
  const none = composeNudge("day3", ctx({ rate: null, founding: false }));
  assert.ok(none.text.includes("Theraglee is one flat rate."));
});

test("the day-7 email shows a Match Mode line and admits the community is still growing", () => {
  const m = composeNudge("day7", ctx());
  assert.ok(m.text.includes("303xx area"));
  assert.ok(m.text.includes("may still be small"));
  assert.ok(m.text.includes("clinician library"));
});

test("the day-14 email says it is the last and asks one question", () => {
  const m = composeNudge("day14", ctx());
  assert.ok(m.text.startsWith("Hi Maria,\n\nThis is the last of these emails."));
  assert.ok(m.text.includes("what stopped you?"));
});

test("nothing promises referrals or mentions streaks, and the greeting copes without a name", () => {
  for (const { step } of STEPS) {
    const m = composeNudge(step, ctx({ firstName: null }));
    assert.ok(m.text.startsWith("Hi there,"));
    assert.ok(!/guarantee|clients are waiting|streak/i.test(m.text), `${step} overpromises`);
  }
});

test("a name with markup is escaped in the HTML and left alone in the text", () => {
  const m = composeNudge("day1", ctx({ firstName: "<b>Mo</b>" }));
  assert.ok(m.html.includes("Hi &lt;b&gt;Mo&lt;/b&gt;,"));
  assert.ok(m.text.startsWith("Hi <b>Mo</b>,"));
});

/* -------------------------------------------------------------- the rate */

test("rateLine prefers the founding rate while the offer is open", () => {
  assert.deepEqual(rateLine({ founding_enabled: "true", display_therapist_founding: "20", display_therapist_monthly: "29" }, NOW),
    { rate: "$20/month", founding: true });
  assert.deepEqual(rateLine({ founding_enabled: "true", display_therapist_founding: "20", founding_deadline: "2026-10-01", display_therapist_monthly: "29" }, NOW),
    { rate: "$29/month", founding: false });
  assert.deepEqual(rateLine({ founding_enabled: "false", display_therapist_founding: "20", display_therapist_monthly: "29" }, NOW),
    { rate: "$29/month", founding: false });
  assert.deepEqual(rateLine({}, NOW), { rate: null, founding: false });
});

test("prettyDate reads like a person wrote it", () => {
  assert.equal(prettyDate("2026-10-04T18:30:00Z"), "October 4, 2026");
});

console.log(`\n${n} checks passed`);
