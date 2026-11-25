// Runs supabase/functions/founding-billing/index.ts under plain Node, with
// Stripe, Supabase and the email API replaced by fakes, and checks the one
// promise the function exists to keep: a founding therapist's first charge is
// never scheduled before the email announcing it has gone out.
//
//   node tests/founding-billing/check.mjs
//
// The function's imports of `jsr:@supabase/supabase-js` and `npm:stripe` are
// pointed at tests/founding-billing/stubs/ by a resolve hook, `Deno` is a
// small stand-in, and Node's built-in TypeScript stripping does the rest.
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { MATCH_MEANS } from "../../supabase/functions/_shared/billing.ts";

const stub = (name) => new URL(`./stubs/${name}`, import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("jsr:@supabase/supabase-js")) return { url: stub("supabase-js.mjs"), shortCircuit: true };
    if (specifier.startsWith("npm:stripe")) return { url: stub("stripe.mjs"), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

/* ------------------------------------------------------------ the fakes -- */

const KEY = "test-founding-key";
const ADMIN = "owner@theraglee.example";
const THERAPIST = "ada@practice.example";
const T = "11111111-1111-4111-8111-111111111111";
const DAY = 86400;
const FAR = Math.floor(Date.now() / 1000) + 700 * DAY;

const world = {};
function reset() {
  world.events = [];                 // what happened, in order
  world.mail = [];                   // emails the fake API accepted
  world.mailFails = () => null;      // (to) => an error body, or null to accept
  world.stripeFails = null;          // an error message, or null
  world.stripeUpdates = [];
  world.writeFails = () => null;     // (table, values) => an error message, or null
  world.authEmail = null;
  world.alerts = [];
  world.profiles = [{
    id: T, stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1",
    first_match_at: null, first_match_notice_at: null,
  }];
  world.subs = new Map([["sub_1", {
    id: "sub_1", status: "trialing", trial_end: FAR, metadata: { supabase_user_id: T, plan: "therapist" },
  }]]);
  world.due = [{ user_id: T, therapist_id: "t-1", first_name: "Ada", contact_email: THERAPIST, email: "ada@signin.example" }];
}

const tables = () => ({
  profiles: world.profiles,
  billing_alerts: world.alerts,
  app_secrets: [{ key: "founding_key", value: KEY }],
  app_config: [{ key: "display_therapist_founding", value: "20" }, { key: "admin_email", value: ADMIN }],
});

function from(name) {
  const filters = [];
  let op = "select", values = null, lim = Infinity;
  const run = async () => {
    const rows = tables()[name];
    if (!rows) throw new Error(`the fake database has no table ${name}`);
    if (op !== "select") {
      const fail = world.writeFails(name, values);
      if (fail) return { data: null, error: { message: fail } };
    }
    if (op === "insert") {
      rows.push({ id: `alert-${rows.length + 1}`, resolved_at: null, ...values });
      world.events.push(`insert:${name}`);
      return { data: null, error: null };
    }
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      hit.forEach((r) => Object.assign(r, values));
      world.events.push(`update:${name}:${Object.keys(values).join(",")}`);
      return { data: null, error: null };
    }
    return { data: hit.slice(0, lim), error: null };
  };
  const q = {
    select: () => q,
    update: (v) => { op = "update"; values = v; return q; },
    insert: (v) => { op = "insert"; values = v; return q; },
    eq: (c, v) => { filters.push((r) => r[c] === v); return q; },
    is: (c, v) => { filters.push((r) => (r[c] ?? null) === v); return q; },
    limit: (n) => { lim = n; return q; },
    maybeSingle: () => run().then((r) => ({ data: r.data?.[0] ?? null, error: r.error })),
    then: (resolve, reject) => run().then(resolve, reject),
  };
  return q;
}

globalThis.__fakeSupabase = {
  from,
  rpc: async (fn) => fn === "founding_first_matches"
    ? { data: world.due, error: null }
    : { data: null, error: { message: `the fake database has no function ${fn}` } },
  auth: {
    getUser: async () => ({ data: { user: null }, error: { message: "no session" } }),
    admin: { getUserById: async () => ({ data: { user: world.authEmail ? { email: world.authEmail } : null } }) },
  },
};

globalThis.__fakeStripe = {
  subscriptions: {
    retrieve: async (id) => {
      const s = world.subs.get(id);
      if (!s) throw new Error(`No such subscription: ${id}`);
      return structuredClone(s);
    },
    update: async (id, params) => {
      if (world.stripeFails) throw new Error(world.stripeFails);
      const s = world.subs.get(id);
      s.trial_end = params.trial_end;
      s.metadata = params.metadata;
      world.stripeUpdates.push({ id, ...params });
      world.events.push("stripe:update");
      return structuredClone(s);
    },
  },
};

globalThis.fetch = async (url, init) => {
  assert.equal(String(url), "https://api.resend.com/emails");
  const body = JSON.parse(init.body);
  const fail = world.mailFails(body.to);
  if (fail) return new Response(fail, { status: 422 });
  world.mail.push(body);
  world.events.push(`email:${body.to}`);
  return new Response("{}", { status: 200 });
};

const env = {
  SUPABASE_URL: "http://fake.local", SUPABASE_SERVICE_ROLE_KEY: "service-role",
  STRIPE_SECRET_KEY: "sk_test_fake", RESEND_API_KEY: "re_fake", SITE_URL: "https://theraglee.com",
};
let handler;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

await import("../../supabase/functions/founding-billing/index.ts");
assert.equal(typeof handler, "function", "the function registered its handler");

/** One hourly run, as pg_cron makes it. The function's own log lines are kept off the test output. */
async function run(headers = { "x-founding-key": KEY }) {
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try {
    const res = await handler(new Request("https://fake.local/functions/v1/founding-billing",
      { method: "POST", headers, body: "{}" }));
    return { status: res.status, body: await res.json() };
  } finally {
    console.log = log; console.warn = warn;
  }
}

const profile = () => world.profiles[0];
const sub = () => world.subs.get("sub_1");
const to = (address) => world.mail.filter((m) => m.to === address);
const openAlerts = () => world.alerts.filter((a) => !a.resolved_at);
const sec = (iso) => Math.floor(new Date(iso).getTime() / 1000);
const longDate = (unix) => new Date(unix * 1000)
  .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

let n = 0;
const test = async (name, fn) => { reset(); await fn(); n++; console.log("ok -", name); };

/* ------------------------------------------------------------ the checks -- */

await test("only the database's key (or an administrator) may run the check", async () => {
  assert.equal((await run({})).status, 403);
  assert.equal((await run({ "x-founding-key": "guess" })).status, 403);
  assert.equal(world.mail.length, 0);
  assert.equal(world.stripeUpdates.length, 0);
});

await test("with nobody due, nothing is sent and nothing changes", async () => {
  world.due = [];
  const r = await run();
  assert.deepEqual(r, { status: 200, body: { ok: true, checked: 0, results: [] } });
  assert.deepEqual(world.events, []);
});

await test("a first match: the email goes out first, then Stripe gets the date the email gave", async () => {
  const before = Math.floor(Date.now() / 1000);
  const r = await run();
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results, [{ user_id: T, started: true, sent: true, error: null }]);

  // The order is the promise.
  assert.deepEqual(world.events, [
    `email:${THERAPIST}`,
    "update:profiles:first_match_notice_at",
    "stripe:update",
    "update:profiles:first_match_at",
    "update:billing_alerts:resolved_at",
  ]);

  // A week's notice, and the same date in the email, in Stripe and nowhere earlier.
  const starts = sub().trial_end;
  assert.ok(starts >= before + 7 * DAY && starts <= before + 7 * DAY + 5);
  assert.equal(starts, sec(profile().first_match_notice_at) + 7 * DAY);
  const [mail] = to(THERAPIST);
  for (const part of [mail.text, mail.html]) {
    assert.ok(part.includes(longDate(starts)), "the email names the date billing begins");
    assert.ok(part.includes("Nothing is charged before that date"));
    assert.ok(part.includes("$20 a month"));
  }
  // What a match is, and that it is not a promised session.
  assert.ok(mail.text.includes(MATCH_MEANS));
  assert.ok(mail.html.includes("does not guarantee that the member will schedule a session"));

  assert.equal(world.stripeUpdates[0].proration_behavior, "none");
  assert.equal(sub().metadata.supabase_user_id, T, "the subscription keeps its member link");
  assert.ok(sub().metadata.founding_first_match);
  assert.ok(profile().first_match_at);
  assert.equal(world.alerts.length, 0);
  assert.equal(to(ADMIN).length, 0);
});

await test("the email cannot be sent: no charge is scheduled, the admin is told once, and the next run tries again", async () => {
  world.mailFails = (address) => (address === THERAPIST ? '{"message":"mailbox unavailable"}' : null);

  const first = await run();
  assert.equal(first.body.results[0].started, false);
  assert.equal(first.body.results[0].sent, false);
  assert.match(first.body.results[0].error, /mailbox unavailable/);
  assert.equal(world.stripeUpdates.length, 0, "Stripe is not touched");
  assert.equal(sub().trial_end, FAR, "the free period has no end yet");
  assert.equal(profile().first_match_at, null);
  assert.equal(profile().first_match_notice_at, null);
  assert.equal(openAlerts().length, 1);
  assert.equal(openAlerts()[0].kind, "founding_notice");
  assert.equal(openAlerts()[0].raw.stage, "notice");
  assert.equal(openAlerts()[0].stripe_id, "sub_1");
  assert.match(openAlerts()[0].summary, /billing has not been started/);
  assert.equal(to(ADMIN).length, 1, "the administrator is emailed");

  // An hour later it still fails: still no charge, and no second alert.
  await run();
  assert.equal(world.stripeUpdates.length, 0);
  assert.equal(world.alerts.length, 1);
  assert.equal(to(ADMIN).length, 1);

  // Then the email goes through: billing starts a week from that email, and the alert closes.
  world.mailFails = () => null;
  const third = await run();
  assert.deepEqual(third.body.results, [{ user_id: T, started: true, sent: true, error: null }]);
  assert.equal(to(THERAPIST).length, 1);
  assert.equal(sub().trial_end, sec(profile().first_match_notice_at) + 7 * DAY);
  assert.equal(openAlerts().length, 0);
});

await test("no address on file is the same: no email, so no charge", async () => {
  world.due = [{ user_id: T, therapist_id: "t-1", first_name: null, contact_email: null, email: null }];
  const r = await run();
  assert.equal(r.body.results[0].error, "no_email_on_file");
  assert.equal(world.stripeUpdates.length, 0);
  assert.equal(profile().first_match_at, null);
  assert.equal(openAlerts().length, 1);

  // The sign-in address is the last resort, and it is enough.
  world.authEmail = "ada@signin.example";
  await run();
  assert.equal(to("ada@signin.example").length, 1);
  assert.equal(world.stripeUpdates.length, 1);
});

await test("the email went out but Stripe failed: the next run keeps the promised date and sends no second email", async () => {
  world.stripeFails = "Stripe is unavailable";
  const first = await run();
  assert.deepEqual(first.body.results, [{ user_id: T, started: false, sent: true, error: "Stripe is unavailable" }]);
  assert.equal(to(THERAPIST).length, 1);
  assert.equal(sub().trial_end, FAR);
  assert.equal(profile().first_match_at, null);
  assert.equal(openAlerts()[0].raw.stage, "billing");
  const promised = sec(profile().first_match_notice_at) + 7 * DAY;

  world.stripeFails = null;
  const second = await run();
  assert.deepEqual(second.body.results, [{ user_id: T, started: true, sent: false, error: null }]);
  assert.equal(to(THERAPIST).length, 1, "one email, one date");
  assert.equal(sub().trial_end, promised);
  assert.ok(profile().first_match_at);
  assert.equal(openAlerts().length, 0);
});

await test("a promise too old to be fair warning is replaced by a fresh email and a fresh week", async () => {
  // The notice went out six days ago and billing never started: a day's warning is not enough.
  profile().first_match_notice_at = new Date(Date.now() - 6 * DAY * 1000).toISOString();
  const before = Math.floor(Date.now() / 1000);
  const r = await run();
  assert.deepEqual(r.body.results, [{ user_id: T, started: true, sent: true, error: null }]);
  assert.equal(to(THERAPIST).length, 1);
  assert.ok(sub().trial_end >= before + 7 * DAY);
  assert.ok(to(THERAPIST)[0].text.includes(longDate(sub().trial_end)));
});

await test("billing started but the profile could not be marked: the next run finishes without another email", async () => {
  world.writeFails = (table, values) => (table === "profiles" && "first_match_at" in values ? "database is busy" : null);
  const first = await run();
  assert.deepEqual(first.body.results, [{ user_id: T, started: true, sent: true, error: "database is busy" }]);
  assert.equal(openAlerts()[0].raw.stage, "record");
  const promised = sub().trial_end;

  world.writeFails = () => null;
  await run();
  assert.equal(to(THERAPIST).length, 1);
  assert.equal(sub().trial_end, promised, "the date does not move");
  assert.ok(profile().first_match_at);
  assert.equal(openAlerts().length, 0);
});

await test("a membership no longer in its free period is marked and left alone", async () => {
  sub().status = "active";
  const r = await run();
  assert.deepEqual(r.body.results, [{ user_id: T, started: false, sent: false, error: null }]);
  assert.equal(world.mail.length, 0);
  assert.equal(world.stripeUpdates.length, 0);
  assert.ok(profile().first_match_at);
});

await test("Stripe cannot be read: nothing is sent, nothing starts, and the admin hears of it", async () => {
  world.subs.clear();
  const r = await run();
  assert.match(r.body.results[0].error, /No such subscription/);
  assert.equal(to(THERAPIST).length, 0);
  assert.equal(profile().first_match_at, null);
  assert.equal(openAlerts()[0].raw.stage, "lookup");
  assert.equal(to(ADMIN).length, 1);
});

console.log(`\n${n} checks passed`);
