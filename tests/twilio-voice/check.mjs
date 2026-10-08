// Exercises supabase/functions/_shared/twilio.ts under plain Node — the
// module has no imports, so Node's built-in TypeScript stripping is enough.
//
//   node tests/twilio-voice/check.mjs
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import {
  areaCodeOf, callRow, emptyTwiml, formatUs, forwardTwiml, friendlyNameFor, isUuid, last10,
  maskCaller, NO_ANSWER, numberSearches, purchaseForm, sameNumber, sayTwiml, signatureMatches,
  therapistForNumber, toE164, twilioAuthHeader, twilioSignature,
} from "../../supabase/functions/_shared/twilio.ts";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

await test("numbers agree however they were typed", () => {
  assert.equal(last10("(805) 746-6567"), "8057466567");
  assert.equal(last10("+18057466567"), "8057466567");
  assert.equal(sameNumber("805-746-6567", "+18057466567"), true);
  assert.equal(sameNumber("8057466567", "8057466568"), false);
  assert.equal(sameNumber("", ""), false, "two empty numbers are not the same number");
  assert.equal(sameNumber("6567", "6567"), false, "a fragment never matches");
});

await test("a US number is dialed as +1 and ten digits", () => {
  assert.equal(toE164("8057466567"), "+18057466567");
  assert.equal(toE164("(805) 746-6567"), "+18057466567");
  assert.equal(toE164("1 805 746 6567"), "+18057466567");
  assert.equal(toE164("+18057466567"), "+18057466567");
  assert.equal(toE164("746-6567"), null, "too short to dial");
  assert.equal(toE164(null), null);
});

await test("only the last four digits of a caller are kept", () => {
  assert.equal(maskCaller("+12349013030"), "***-***-3030");
  assert.equal(maskCaller("Anonymous"), null);
  assert.equal(maskCaller(undefined), null);
});

await test("the called number finds the listing it belongs to", () => {
  const rows = [
    { id: "a", proxy_phone: "(555) 010-0199", contact_phone: "8057466567" },
    { id: "b", proxy_phone: "5550100200", contact_phone: null },
  ];
  assert.equal(therapistForNumber(rows, "+15550100199")?.id, "a");
  assert.equal(therapistForNumber(rows, "+15550100200")?.id, "b");
  assert.equal(therapistForNumber(rows, "+15550100300"), null);
  assert.equal(therapistForNumber([], "+15550100199"), null);
});

await test("the forwarding TwiML dials the real number and reports back", () => {
  const x = forwardTwiml("+18057466567", "https://x.supabase.co/functions/v1/twilio-voice?step=dial&t=abc");
  assert.match(x, /^<\?xml version="1.0" encoding="UTF-8"\?><Response>/);
  assert.match(x, /<Dial action="https:\/\/x\.supabase\.co\/functions\/v1\/twilio-voice\?step=dial&amp;t=abc" method="POST" timeout="25">\+18057466567<\/Dial>/);
  assert.equal(emptyTwiml(), '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  const s = sayTwiml(NO_ANSWER);
  assert.match(s, /<Say>Sorry, no one could pick up just now\./);
  assert.match(s, /<Hangup\/><\/Response>$/);
  assert.doesNotMatch(s, /therapist's/, "the apostrophe is escaped for XML");
  assert.match(sayTwiml("a < b & c"), /<Say>a &lt; b &amp; c<\/Say>/);
});

await test("a finished forwarded leg becomes one therapist_calls row", () => {
  const tid = "6f9619ff-8b86-d011-b42d-00c04fc964ff";
  const answered = callRow(tid, {
    CallSid: "CA123", DialCallStatus: "completed", DialCallDuration: "184", From: "+12349013030",
  });
  assert.deepEqual(answered, {
    therapist_id: tid, provider: "twilio", provider_sid: "CA123",
    caller_masked: "***-***-3030", duration_secs: 184, answered: true,
  });
  const missed = callRow(tid, { CallSid: "CA124", DialCallStatus: "no-answer", From: "+12349013030" });
  assert.equal(missed.answered, false);
  assert.equal(missed.duration_secs, null);
  assert.equal(callRow(tid, { CallSid: "CA125", DialCallStatus: "busy" }).answered, false);
  assert.equal(callRow(tid, { CallSid: "CA126", DialCallStatus: "canceled" }).answered, false);
  assert.equal(callRow(tid, { DialCallStatus: "completed" }), null, "no call id, no row");
  assert.equal(isUuid(tid), true);
  assert.equal(isUuid("abc"), false);
});

await test("Twilio's signature is recomputed the way Twilio documents it", async () => {
  // The URL, token and parameters are the worked example from Twilio's
  // "Validating requests" guide; the signature was produced by twilio-node 5's
  // getExpectedTwilioSignature for them.
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = {
    CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234",
    From: "+12349013030", To: "+18005551212",
  };
  assert.equal(await twilioSignature("12345", url, params), "0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
  assert.equal(await signatureMatches("12345", [url], params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ="), true);
  assert.equal(await signatureMatches("12345", ["https://other.example/x", url], params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ="),
    true, "any of the candidate URLs may be the one Twilio signed");
  assert.equal(await signatureMatches("12345", [url], params, "0/KCTR6DLpKmkAf8muzZqo1nDgR="), false);
  assert.equal(await signatureMatches("12345", [url], { ...params, Digits: "9999" }, "0/KCTR6DLpKmkAf8muzZqo1nDgQ="), false);
  assert.equal(await signatureMatches("wrong", [url], params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ="), false);
  assert.equal(await signatureMatches("12345", [url], params, null), false, "no header, no entry");
  assert.equal(await signatureMatches("12345", [url], params, ""), false);
});

await test("a number is bought near the therapist, then in their state, then anywhere", () => {
  assert.deepEqual(numberSearches({ contact_phone: "(805) 746-6567", license_states: ["CA", "NV"] }), [
    "AreaCode=805&VoiceEnabled=true&PageSize=5",
    "InRegion=CA&VoiceEnabled=true&PageSize=5",
    "VoiceEnabled=true&PageSize=5",
  ]);
  assert.deepEqual(numberSearches({ contact_phone: null, license_states: ["ca"] }),
    ["InRegion=CA&VoiceEnabled=true&PageSize=5", "VoiceEnabled=true&PageSize=5"]);
  assert.deepEqual(numberSearches({ contact_phone: "555", license_states: [] }), ["VoiceEnabled=true&PageSize=5"]);
  assert.deepEqual(numberSearches({ license_states: ["California"] }), ["VoiceEnabled=true&PageSize=5"],
    "only a two-letter state code is sent to Twilio");
  assert.equal(areaCodeOf("+18057466567"), "805");
  assert.equal(areaCodeOf("7466567"), null);
});

await test("the purchase points the number at the voice function and labels it", () => {
  const form = purchaseForm("+18050100199", "https://x.supabase.co/functions/v1/twilio-voice", "Theraglee: Susan Canchola");
  assert.equal(form.get("PhoneNumber"), "+18050100199");
  assert.equal(form.get("VoiceUrl"), "https://x.supabase.co/functions/v1/twilio-voice");
  assert.equal(form.get("VoiceMethod"), "POST");
  assert.equal(form.get("FriendlyName"), "Theraglee: Susan Canchola");
  assert.equal(purchaseForm("+1", "u", "x".repeat(80)).get("FriendlyName").length, 64, "Twilio caps the label");
  assert.equal(friendlyNameFor({ first_name: "Susan", last_name: "Canchola" }), "Theraglee: Susan Canchola");
  assert.equal(friendlyNameFor({ first_name: null, last_name: null }), "Theraglee: therapist");
});

await test("a bought number is shown the way the admin page expects", () => {
  assert.equal(formatUs("+18050100199"), "(805) 010-0199");
  assert.equal(formatUs("8050100199"), "(805) 010-0199");
  assert.equal(formatUs("+442071234567"), "+442071234567", "a non-US number is left alone");
});

await test("Twilio's REST API is called with basic auth", () => {
  assert.equal(twilioAuthHeader("ACxyz", "tok"), "Basic " + Buffer.from("ACxyz:tok").toString("base64"));
});

console.log(`\n${n} checks passed`);
