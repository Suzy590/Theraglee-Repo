// Checks for the admin screen's Google Analytics tab. Run from the repo root:
//   node tests/google-analytics/check.mjs
// Exercises the report logic in supabase/functions/_shared/analytics.ts (no
// imports, so Node's TypeScript stripping is enough) and the tag decision in
// site/assets/analytics-tag.js, and holds the pieces together: the tab is on
// the admin screen, the config keys the tab writes are the ones the function
// and the migration know, the windows match, the privacy wording is there,
// and the copy uses US spelling. Exits 1 on the first failed assertion.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  apiErrorMessage, CONFIG_KEYS, isMeasurementId, parseServiceAccount, propertyIdFrom, realtimeRequest, reportRequests,
  rowsOf, summarize, tokenClaims, WINDOW_DAYS, windowFrom,
} from '../../supabase/functions/_shared/analytics.ts';
import { MEASUREMENT_ID, shouldLoadTag } from '../../site/assets/analytics-tag.js';
import { changeLine, CONFIG_KEYS as TAB_KEYS, gaHome, HEADLINES, WINDOWS } from '../../site/assets/admin-analytics.js';

let count = 0;
const test = (name, fn) => { fn(); count++; console.log('ok -', name); };
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

/* ------------------------------------------------------------ the ids */
test('a measurement id is G- and letters or digits', () => {
  assert.equal(isMeasurementId('G-ABC123XYZ9'), true);
  assert.equal(isMeasurementId('g-abc123'), false);
  assert.equal(isMeasurementId('UA-12345-1'), false);
  assert.equal(isMeasurementId(''), false);
  assert.equal(isMeasurementId(null), false);
  // The browser's copy of the rule says the same.
  assert.equal(MEASUREMENT_ID.test('G-ABC123XYZ9'), true);
  assert.equal(MEASUREMENT_ID.test('UA-12345-1'), false);
});

test('a property id is the digits, with or without properties/', () => {
  assert.equal(propertyIdFrom('123456789'), '123456789');
  assert.equal(propertyIdFrom(' properties/123456789 '), '123456789');
  assert.equal(propertyIdFrom('G-ABC123XYZ9'), null);
  assert.equal(propertyIdFrom('12'), null);
  assert.equal(propertyIdFrom(undefined), null);
});

test('the window snaps to one the tab offers', () => {
  assert.equal(windowFrom(7), 7);
  assert.equal(windowFrom('90'), 90);
  assert.equal(windowFrom(31), 30);
  assert.equal(windowFrom(undefined), 30);
  assert.deepEqual(WINDOWS.map(([d]) => d), WINDOW_DAYS);
});

/* ------------------------------------------------------- the key file */
test('the service account key is read, and its faults named', () => {
  assert.match(parseServiceAccount('').error, /GA_SERVICE_ACCOUNT_JSON/);
  assert.match(parseServiceAccount('{not json').error, /not valid JSON/);
  assert.match(parseServiceAccount('{"client_email":"x"}').error, /missing client_email or private_key/);
  const ok = parseServiceAccount(JSON.stringify({
    client_email: 'ga@proj.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
  }));
  assert.equal(ok.account.client_email, 'ga@proj.iam.gserviceaccount.com');
  assert.equal(ok.account.token_uri, 'https://oauth2.googleapis.com/token');
  const claims = tokenClaims(ok.account.client_email, ok.account.token_uri, 1000);
  assert.equal(claims.aud, ok.account.token_uri);
  assert.equal(claims.exp - claims.iat, 3600);
  assert.match(claims.scope, /analytics\.readonly$/);
});

/* --------------------------------------------------------- the reports */
test('five report requests, in the order summarize() reads them', () => {
  const r = reportRequests(30);
  assert.equal(r.length, 5);
  assert.deepEqual(r[0].dateRanges, [{ startDate: '29daysAgo', endDate: 'today' }, { startDate: '59daysAgo', endDate: '30daysAgo' }]);
  assert.equal(r[0].dimensions, undefined);
  assert.equal(r[1].dimensions[0].name, 'date');
  assert.equal(r[1].keepEmptyRows, true);
  assert.equal(r[2].dimensions[0].name, 'pagePath');
  assert.equal(r[3].dimensions[0].name, 'sessionDefaultChannelGroup');
  assert.equal(r[4].dimensions[0].name, 'deviceCategory');
  for (const req of r.slice(1)) assert.deepEqual(req.dateRanges, [{ startDate: '29daysAgo', endDate: 'today' }]);
  assert.equal(realtimeRequest.metrics[0].name, 'activeUsers');
  // The headline cards ask only for metrics the totals report returns.
  for (const [k] of HEADLINES) assert.ok(r[0].metrics.some((m) => m.name === k), `${k} is not in the totals report`);
});

const report = (dims, mets, rows) => ({
  dimensionHeaders: dims.map((name) => ({ name })),
  metricHeaders: mets.map((name) => ({ name })),
  rows: rows.map(([d, m]) => ({ dimensionValues: d.map((value) => ({ value })), metricValues: m.map((value) => ({ value })) })),
});

test('rows come back as objects, metrics as numbers', () => {
  const rows = rowsOf(report(['pagePath'], ['screenPageViews', 'activeUsers'], [[['/'], ['120', '40']], [['/pricing.html'], ['30', 'x']]]));
  assert.deepEqual(rows, [{ pagePath: '/', screenPageViews: 120, activeUsers: 40 }, { pagePath: '/pricing.html', screenPageViews: 30, activeUsers: 0 }]);
  assert.deepEqual(rowsOf(undefined), []);
  assert.deepEqual(rowsOf({}), []);
});

test('the summary is shaped for the tab', () => {
  const totals = report(['dateRange'], ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'averageSessionDuration', 'engagementRate'], [
    [['date_range_0'], ['200', '150', '260', '900', '95.5', '0.62']],
    [['date_range_1'], ['100', '80', '130', '400', '80', '0.5']],
  ]);
  const days = report(['date'], ['activeUsers', 'sessions', 'screenPageViews'], [[['20261001'], ['5', '6', '20']], [['20261002'], ['0', '0', '0']]]);
  const pages = report(['pagePath'], ['screenPageViews', 'activeUsers'], [[['/'], ['500', '180']]]);
  const channels = report(['sessionDefaultChannelGroup'], ['sessions', 'activeUsers'], [[['Organic Search'], ['200', '150']]]);
  const devices = report(['deviceCategory'], ['activeUsers'], [[['mobile'], ['120']], [['desktop'], ['80']]]);
  const realtime = report([], ['activeUsers'], [[[], ['3']]]);
  const s = summarize([totals, days, pages, channels, devices], realtime, 30);
  assert.equal(s.days, 30);
  assert.equal(s.now, 3);
  assert.equal(s.current.activeUsers, 200);
  assert.equal(s.current.engagementRate, 0.62);
  assert.equal(s.previous.sessions, 130);
  assert.deepEqual(s.byDate, [
    { date: '2026-10-01', activeUsers: 5, sessions: 6, pageViews: 20 },
    { date: '2026-10-02', activeUsers: 0, sessions: 0, pageViews: 0 },
  ]);
  assert.deepEqual(s.pages, [{ path: '/', pageViews: 500, activeUsers: 180 }]);
  assert.deepEqual(s.channels, [{ channel: 'Organic Search', sessions: 200, activeUsers: 150 }]);
  assert.deepEqual(s.devices, [{ device: 'mobile', activeUsers: 120 }, { device: 'desktop', activeUsers: 80 }]);
});

test('a property with no traffic yet reads as zeros, not a crash', () => {
  const s = summarize([{}, {}, {}, {}, {}], null, 7);
  assert.equal(s.now, null);
  assert.equal(s.current.activeUsers, 0);
  assert.equal(s.previous.sessions, 0);
  assert.deepEqual(s.byDate, []);
  assert.deepEqual(s.pages, []);
  // Only this window has rows: GA still names the range.
  const one = summarize([report(['dateRange'], ['activeUsers'], [[['date_range_0'], ['9']]]), {}, {}, {}, {}], null, 7);
  assert.equal(one.current.activeUsers, 9);
  assert.equal(one.previous.activeUsers, 0);
});

test('Google\'s errors are explained in words an administrator can act on', () => {
  assert.match(apiErrorMessage(403, { error: { message: 'User does not have sufficient permissions' } }), /Property access management/);
  assert.match(apiErrorMessage(403, { error: { message: 'Google Analytics Data API has not been used in project 1 before or it is disabled' } }), /not enabled/);
  assert.match(apiErrorMessage(404, {}), /no property with that id/);
  assert.match(apiErrorMessage(401, {}), /service account key/);
  assert.match(apiErrorMessage(429, {}), /rate-limiting/);
  assert.match(apiErrorMessage(500, { error: { message: 'Backend error' } }), /Backend error/);
  assert.match(apiErrorMessage(502, {}), /status 502/);
});

/* ------------------------------------------------------------- the tag */
test('the tag loads only when switched on, with a real id, for a browser that has not opted out', () => {
  const on = { ga_tag_enabled: 'true', ga_measurement_id: 'G-ABC123XYZ9' };
  const nav = {};
  assert.equal(shouldLoadTag(on, { nav }), true);
  assert.equal(shouldLoadTag({ ...on, ga_tag_enabled: 'false' }, { nav }), false);
  assert.equal(shouldLoadTag({ ...on, ga_measurement_id: '' }, { nav }), false);
  assert.equal(shouldLoadTag({ ...on, ga_measurement_id: 'UA-1-1' }, { nav }), false);
  assert.equal(shouldLoadTag({}, { nav }), false);
  assert.equal(shouldLoadTag(undefined, { nav }), false);
  // Opt-out signals, administrators, and a tag already on the page.
  assert.equal(shouldLoadTag(on, { nav: { globalPrivacyControl: true } }), false);
  assert.equal(shouldLoadTag(on, { nav: { doNotTrack: '1' } }), false);
  assert.equal(shouldLoadTag(on, { nav: { doNotTrack: 'unspecified' } }), true);
  assert.equal(shouldLoadTag(on, { nav, admin: true }), false);
  assert.equal(shouldLoadTag(on, { nav, alreadyLoaded: true }), false);
});

/* ------------------------------------------------------------- the tab */
test('the change line reads as words', () => {
  assert.equal(changeLine(120, 100), 'up 20% on the window before');
  assert.equal(changeLine(80, 100), 'down 20% on the window before');
  assert.equal(changeLine(100, 100), 'the same as the window before');
  assert.equal(changeLine(5, 0), 'nothing in the window before');
  assert.equal(changeLine(0, 0), null);
});

test('the Google Analytics link opens the property', () => {
  assert.equal(gaHome('123456789'), 'https://analytics.google.com/analytics/web/#/p123456789/reports/intelligenthome');
  assert.equal(gaHome('properties/123456789'), gaHome('123456789'));
  assert.equal(gaHome(''), 'https://analytics.google.com/');
});

test('the pieces agree on the config keys, the tab and the function', () => {
  assert.deepEqual([...TAB_KEYS].sort(), Object.values(CONFIG_KEYS).sort());
  const migration = read('supabase/migrations/20261022120000_google_analytics.sql');
  for (const k of TAB_KEYS) assert.ok(migration.includes(`'${k}'`), `${k} is not seeded by the migration`);
  const admin = read('site/admin.html');
  assert.ok(admin.includes("['analytics','Google Analytics']"), 'the admin screen has no Google Analytics tab');
  assert.ok(admin.includes('admin-analytics.js'), 'admin.html does not load the tab');
  assert.ok(/billing, content, analytics/.test(admin), 'the router does not know the tab');
  const tab = read('site/assets/admin-analytics.js');
  for (const k of TAB_KEYS) assert.ok(tab.includes(`id="${k}"`), `the tab has no field for ${k}`);
  assert.ok(tab.includes('admin_set_config'), 'the tab does not save through admin_set_config');
  assert.ok(/callFn\('google-analytics'/.test(tab), 'the tab does not call the google-analytics function');
  assert.ok(read('supabase/config.toml').includes('[functions.google-analytics]'), 'config.toml does not list the function');
  const fn = read('supabase/functions/google-analytics/index.ts');
  assert.ok(fn.includes('GA_SERVICE_ACCOUNT_JSON'), 'the function does not read the secret');
  assert.ok(fn.includes("role !== \"admin\""), 'the function does not check for an admin');
  assert.ok(read('site/assets/app.js').includes('loadAnalyticsTag(sb, { admin })'), 'chrome() does not place the tag');
});

test('the privacy wording is on the tab and in the guide', () => {
  const tab = read('site/assets/admin-analytics.js');
  assert.ok(/Privacy Policy/.test(tab) && /sections 2, 5 and 6/.test(tab), 'the tab does not say the policy has to change first');
  const guide = read('docs/google-analytics.md');
  assert.ok(/privacy\.html/.test(guide) && /legal-pages\.md/.test(guide), 'the guide does not point at the policy');
  assert.ok(/Global Privacy Control/.test(guide), 'the guide does not mention the opt-out signal');
  assert.ok(/GA_SERVICE_ACCOUNT_JSON/.test(guide), 'the guide does not name the secret');
});

test('US spelling throughout', () => {
  const UK = [/\bcolour/i, /\bbehaviour/i, /\bfavourite/i, /\bcounselling/i, /\bpersonalis/i, /\bjudgement/i,
    /\bcentre\b/i, /\bcancelled\b/i, /\bgrey\b/i, /\blabelled\b/i, /\bprogramme\b/i, /\bpractis/i, /\blicence\b/i,
    /\banalyse/i, /\boptimis/i, /\bhonour/i];
  for (const file of ['site/assets/admin-analytics.js', 'site/assets/analytics-tag.js', 'supabase/functions/_shared/analytics.ts',
    'supabase/functions/google-analytics/index.ts', 'docs/google-analytics.md', 'supabase/migrations/20261022120000_google_analytics.sql']) {
    const text = read(file);
    for (const re of UK) assert.ok(!re.test(text), `${file}: UK spelling ${re}`);
  }
});

console.log(`ok: ${count} checks on the Google Analytics tab`);
