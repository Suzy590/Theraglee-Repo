// Exercises supabase/functions/_shared/license.ts under plain Node — the
// module has no imports, so Node's built-in TypeScript stripping is enough.
//
//   node tests/license-logic/check.mjs
//
// The dataset rows below are real records from data.wa.gov and
// data.colorado.gov (public license rosters), trimmed to the fields the code
// reads. Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import {
  adapterFor, boardFor, composeEmail, decide, interpret, namesAgree, queryFor,
} from "../../supabase/functions/_shared/license.ts";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const TODAY = new Date("2026-09-11T12:00:00Z");

/* ---------------------------------------------------------------- boards */

const boards = [
  { state: "CA", profession: "behavioral_health", board_name: "California Board of Behavioral Sciences", verify_url: "https://search.dca.ca.gov/", api_url: null, automatable: false, notes: null },
  { state: "MD", profession: "behavioral_health", board_name: "Maryland Board of Professional Counselors and Therapists", verify_url: "https://mdbnc.health.maryland.gov/PCTPortal/verify", api_url: null, automatable: false, notes: null },
  { state: "MD", profession: "psychology", board_name: "Maryland Board of Examiners of Psychologists", verify_url: "https://mdbnc.health.maryland.gov/psychverification/", api_url: null, automatable: false, notes: null },
  { state: "WA", profession: "behavioral_health", board_name: "Washington State Department of Health", verify_url: "https://fortress.wa.gov/doh/providercredentialsearch/", api_url: "https://data.wa.gov/resource/qxh8-f4bd.json", automatable: true, notes: null },
];

test("boardFor picks the psychology board only for psychologists in split states", () => {
  assert.equal(boardFor(boards, "MD", "PsyD").profession, "psychology");
  assert.equal(boardFor(boards, "MD", "LCPC").profession, "behavioral_health");
  assert.equal(boardFor(boards, "CA", "PhD").profession, "behavioral_health");
  assert.equal(boardFor(boards, "ZZ", "LPC"), null);
});

test("namesAgree tolerates middle names, suffixes and case", () => {
  assert.equal(namesAgree("Susan Canchola", "CANCHOLA, SUSAN M"), true);
  assert.equal(namesAgree("Mary Galligan", "Mary L Galligan"), true);
  assert.equal(namesAgree("Susan Canchola", "Robert Smith"), false);
  assert.equal(namesAgree("Susan Canchola", ""), false);
});

/* ------------------------------------------------------------ adapters */

test("adapterFor recognizes the two open-data hosts and nothing else", () => {
  assert.equal(adapterFor("https://data.wa.gov/resource/qxh8-f4bd.json"), "wa");
  assert.equal(adapterFor("https://data.colorado.gov/resource/7s5z-vewr.json"), "co");
  assert.equal(adapterFor("https://search.dca.ca.gov/"), null);
  assert.equal(adapterFor(null), null);
});

test("queryFor searches on the digits of the number", () => {
  const wa = queryFor("wa", "https://data.wa.gov/resource/qxh8-f4bd.json", "MHC.LH.61321872");
  assert.ok(wa.startsWith("https://data.wa.gov/resource/qxh8-f4bd.json?$where="));
  assert.ok(decodeURIComponent(wa).includes("credentialnumber like '%.61321872'"));
  const co = queryFor("co", "https://data.colorado.gov/resource/7s5z-vewr.json", "LPC 22753");
  assert.equal(co, "https://data.colorado.gov/resource/7s5z-vewr.json?licensenumber=22753&$limit=50");
  assert.equal(queryFor("co", "https://data.colorado.gov/resource/7s5z-vewr.json", "pending"), null);
});

// Real rows from data.wa.gov (Health Care Provider Credential Data).
const WA_ROWS = [
  { credentialnumber: "MHC.LH.61321872", lastname: "Chatigny", firstname: "Mychalbrianne", middlename: "Alexa",
    credentialtype: "Mental Health Counselor License", status: "Closed", actiontaken: "No" },
  { credentialnumber: "RN.RN.00094584", lastname: "Galligan", firstname: "Mary", middlename: "L",
    credentialtype: "Registered Nurse License", status: "Active", expirationdate: "07/08/2026", actiontaken: "No" },
];

test("Washington: a closed credential is found but not current", () => {
  const f = interpret("wa", WA_ROWS, "61321872", "LMHC", "https://fortress.wa.gov/doh/providercredentialsearch/");
  assert.equal(f.found, true);
  assert.equal(f.licensee_name, "Mychalbrianne Alexa Chatigny");
  assert.equal(f.license_status, "Closed");
  assert.equal(f.discipline, false);
  const d = decide(f, "Mychalbrianne Chatigny", TODAY);
  assert.equal(d.status, "rejected");
  assert.match(d.notes, /"Closed"/);
});

test("Washington: rows for other professions never match a therapist's number", () => {
  const f = interpret("wa", WA_ROWS, "00094584", "LMHC", null);
  assert.equal(f.found, false);
  assert.equal(decide(f, "Mary Galligan", TODAY).status, "rejected");
});

test("Washington: an active, clean credential under the same name is verified", () => {
  const rows = [{ credentialnumber: "MHC.LH.60001234", lastname: "Rivera", firstname: "Ana", middlename: "",
    credentialtype: "Mental Health Counselor License", status: "Active", expirationdate: "03/15/2027", actiontaken: "No" }];
  const f = interpret("wa", rows, "MHC60001234", "LMHC", null);
  assert.equal(f.expires_on, "2027-03-15");
  assert.deepEqual(decide(f, "Ana Rivera", TODAY), { status: "verified", notes: null });
});

test("Washington: the live row wins over its superseded twin", () => {
  const rows = [
    { credentialnumber: "MHC.LH.60001234", lastname: "Rivera", firstname: "Ana", credentialtype: "Mental Health Counselor License", status: "Superseded", actiontaken: "No" },
    { credentialnumber: "MHC.LH.60001234", lastname: "Rivera", firstname: "Ana", credentialtype: "Mental Health Counselor License", status: "Active", expirationdate: "03/15/2027", actiontaken: "No" },
  ];
  const f = interpret("wa", rows, "60001234", "LMHC", null);
  assert.equal(f.ambiguous, null);
  assert.equal(f.license_status, "Active");
});

test("Washington: an action on record is a rejection; a pending one goes to a person", () => {
  const base = { credentialnumber: "MHC.LH.60001234", lastname: "Rivera", firstname: "Ana",
    credentialtype: "Mental Health Counselor License", status: "Active", expirationdate: "03/15/2027" };
  const yes = decide(interpret("wa", [{ ...base, actiontaken: "Yes" }], "60001234", "LMHC", null), "Ana Rivera", TODAY);
  assert.equal(yes.status, "rejected");
  assert.match(yes.notes, /action/);
  const pending = decide(interpret("wa", [{ ...base, actiontaken: "Pending" }], "60001234", "LMHC", null), "Ana Rivera", TODAY);
  assert.equal(pending.status, "needs_review");
});

test("Washington: a psychologist's number is read against the psychologist credential", () => {
  const rows = [{ credentialnumber: "PY.PY.60009999", lastname: "Okafor", firstname: "Ben",
    credentialtype: "Psychologist License", status: "Active", expirationdate: "01/01/2028", actiontaken: "No" }];
  const f = interpret("wa", rows, "60009999", "PsyD", null);
  assert.equal(f.found, true);
  assert.equal(decide(f, "Ben Okafor", TODAY).status, "verified");
});

// Real rows from data.colorado.gov (Professional and Occupational Licenses).
const CO_ROWS = [
  { lastname: "Babrudi", firstname: "Sharlete", middlename: "K", licensetype: "LPC", licensenumber: "22753",
    licenseexpirationdate: "2027-08-31T00:00:00.000", licensestatusdescription: "Active",
    linktoverifylicense: { url: "https://www.colorado.gov/dora/licensing/Lookup/PrintLicenseDetails.aspx?cred=1659931&contact=1597932" } },
  { lastname: "Lucido", firstname: "Hilliary", middlename: "Elizabeth", licensetype: "COS", licensenumber: "711991",
    licenseexpirationdate: "2028-04-30T00:00:00.000", licensestatusdescription: "Active" },
];

test("Colorado: an active LPC under the same name is verified, with the board's own record link", () => {
  const f = interpret("co", CO_ROWS, "22753", "LPC", "https://apps2.colorado.gov/dora/licensing/lookup/licenselookup.aspx");
  assert.equal(f.found, true);
  assert.equal(f.licensee_name, "Sharlete K Babrudi");
  assert.equal(f.expires_on, "2027-08-31");
  assert.equal(f.discipline, false);
  assert.match(f.source_url, /PrintLicenseDetails/);
  assert.deepEqual(decide(f, "Sharlete Babrudi", TODAY), { status: "verified", notes: null });
});

test("Colorado: a cosmetology license with the same number is not a therapist license", () => {
  const f = interpret("co", CO_ROWS, "711991", "LPC", null);
  assert.equal(f.found, false);
});

test("Colorado: a case on record is a rejection", () => {
  const rows = [{ ...CO_ROWS[0], casenumber: "2024-000123", programaction: "Probation" }];
  const d = decide(interpret("co", rows, "22753", "LPC", null), "Sharlete Babrudi", TODAY);
  assert.equal(d.status, "rejected");
});

/* ------------------------------------------------------------- decide */

const clean = (over = {}) => ({
  found: true, licensee_name: "Ana Rivera", license_status: "Active", expires_on: "2027-03-15",
  discipline: false, ambiguous: null, source_url: null, raw: null, ...over,
});

test("decide: expired by date or by status", () => {
  assert.equal(decide(clean({ expires_on: "2026-09-10" }), "Ana Rivera", TODAY).status, "expired");
  assert.equal(decide(clean({ expires_on: "2026-09-11" }), "Ana Rivera", TODAY).status, "verified");
  assert.equal(decide(clean({ license_status: "Expired", expires_on: null }), "Ana Rivera", TODAY).status, "expired");
});

test("decide: anything qualified or mismatched goes to a person, never auto-approved", () => {
  assert.equal(decide(clean({ license_status: "Active With Conditions" }), "Ana Rivera", TODAY).status, "needs_review");
  assert.equal(decide(clean({ license_status: "Active - Restricted" }), "Ana Rivera", TODAY).status, "needs_review");
  assert.equal(decide(clean({ license_status: "Active On Probation" }), "Ana Rivera", TODAY).status, "needs_review");
  assert.equal(decide(clean(), "Robert Smith", TODAY).status, "needs_review");
  assert.equal(decide(clean({ ambiguous: "two matches" }), "Ana Rivera", TODAY).status, "needs_review");
});

test("decide: revoked, suspended, inactive or missing are rejections", () => {
  for (const s of ["Revoked", "Suspended", "Inactive", "Retired", "Surrendered", "Pending"]) {
    assert.equal(decide(clean({ license_status: s }), "Ana Rivera", TODAY).status, "rejected", s);
  }
  assert.equal(decide(clean({ found: false }), "Ana Rivera", TODAY).status, "rejected");
});

test("decide: a vendor that does not report discipline can still verify", () => {
  assert.equal(decide(clean({ discipline: null }), "Ana Rivera", TODAY).status, "verified");
});

/* ------------------------------------------------------------- emails */

const ctx = {
  firstName: "Ana", fullName: "Ana Rivera", state: "WA", licenseNumber: "MHC.LH.60001234", licenseType: "LMHC",
  boardName: "Washington State Department of Health", lookupUrl: "https://fortress.wa.gov/doh/providercredentialsearch/",
  site: "https://theraglee.com", notes: null, licenseStatus: "Active", expiresOn: "2027-03-15", automatic: true,
};

test("emails: each outcome has a subject, HTML and plain text, with the dashboard link", () => {
  for (const kind of ["verified", "needs_review", "rejected", "expired", "admin_review"]) {
    const m = composeEmail(kind, ctx);
    assert.ok(m.subject.length > 10, kind);
    assert.ok(m.html.includes("theraglee.com/"), kind);
    assert.ok(m.text.includes("theraglee.com/"), kind);
  }
});

test("emails: the verified email says the account is active", () => {
  const m = composeEmail("verified", ctx);
  assert.match(m.text, /account is active/);
  assert.match(m.text, /through 2027-03-15/);
});

test("emails: a rejection names the board, the status and the next steps", () => {
  const m = composeEmail("rejected", { ...ctx, licenseStatus: "Revoked", notes: "The board shows an action on this license (status: Revoked)." });
  assert.match(m.text, /could not confirm/);
  assert.match(m.text, /"Revoked"/);
  assert.match(m.text, /1\. Open the board's own lookup \(https:\/\/fortress\.wa\.gov/);
  assert.match(m.text, /Check my license now/);
  assert.match(m.text, /reply to this email/i);
  assert.ok(m.html.includes("&quot;Revoked&quot;") || m.html.includes("Revoked"));
});

test("emails: an expired license is told to renew", () => {
  const m = composeEmail("expired", { ...ctx, licenseStatus: "Expired", expiresOn: "2026-06-30" });
  assert.match(m.subject, /expired/);
  assert.match(m.text, /renew it with the board/);
});

test("emails: the administrator's email carries the lookup link and the queue", () => {
  const m = composeEmail("admin_review", { ...ctx, notes: "This board publishes a web lookup only." });
  assert.match(m.subject, /^License to verify: Ana Rivera \(WA\)/);
  assert.match(m.text, /fortress\.wa\.gov/);
  assert.match(m.text, /admin\.html/);
});

test("emails: text is HTML-escaped", () => {
  const m = composeEmail("rejected", { ...ctx, notes: `Board shows "<b>x</b>"` });
  assert.ok(!m.html.includes("<b>x</b>"));
  assert.ok(m.html.includes("&lt;b&gt;x&lt;/b&gt;"));
});

console.log(`\n${n} checks passed`);
