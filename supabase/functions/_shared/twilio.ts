// Call forwarding through Twilio: the decisions, kept free of imports so
// tests/twilio-voice/check.mjs can run them under plain Node.
//
// A verified therapist's profile shows a Theraglee number
// (therapist_profiles.proxy_phone) in place of their own. When it rings,
// Twilio asks the twilio-voice function what to do, and the function answers
// with TwiML (Twilio's small XML) that dials the therapist's real number.
// When that forwarded leg ends, Twilio tells the function how it went, and the
// call is kept in therapist_calls. Everything below is the pure part of that.

export const digitsOf = (s: unknown): string => String(s ?? "").replace(/\D/g, "");

/** A US number the way Twilio dials it (+1 and ten digits), or null. */
export function toE164(s: unknown): string | null {
  let d = digitsOf(s);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? `+1${d}` : null;
}

/** The last ten digits, so "(805) 746-6567", "8057466567" and "+18057466567" agree. */
export const last10 = (s: unknown): string => digitsOf(s).slice(-10);

export function sameNumber(a: unknown, b: unknown): boolean {
  const x = last10(a), y = last10(b);
  return x.length === 10 && x === y;
}

/** What is kept about the caller: the last four digits, nothing more. */
export function maskCaller(s: unknown): string | null {
  const d = digitsOf(s);
  return d.length >= 4 ? `***-***-${d.slice(-4)}` : null;
}

export interface ProxyRow {
  id: string;
  proxy_phone: string | null;
  contact_phone: string | null;
}

/** The listing whose Theraglee number was called, or null. */
export function therapistForNumber<T extends ProxyRow>(rows: T[], called: unknown): T | null {
  return rows.find((r) => sameNumber(r.proxy_phone, called)) ?? null;
}

/* ------------------------------------------------------------------ TwiML */

const escapeXml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

const twiml = (inner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;

/** Rings `to` for up to `ringSeconds`; Twilio then POSTs how it went to `action`. */
export function forwardTwiml(to: string, action: string, ringSeconds = 25): string {
  return twiml(
    `<Dial action="${escapeXml(action)}" method="POST" timeout="${ringSeconds}">${escapeXml(to)}</Dial>`,
  );
}

/** Says `text` to the caller, then hangs up. */
export function sayTwiml(text: string): string {
  return twiml(`<Say>${escapeXml(text)}</Say><Hangup/>`);
}

/** Nothing more to do: the call ends. */
export const emptyTwiml = (): string => twiml("");

export const NO_LINE =
  "Sorry, this therapist's line is not available right now. Please try again later, or send them a message from their Theraglee profile.";
export const NO_ANSWER =
  "Sorry, no one could pick up just now. Please try again later, or send a message from their Theraglee profile.";

/* ------------------------------------------------- the row for a call */

export interface CallRow {
  therapist_id: string;
  provider: "twilio";
  provider_sid: string;
  caller_masked: string | null;
  duration_secs: number | null;
  answered: boolean;
}

/** Twilio's DialCallStatus values that mean the therapist picked up. */
const ANSWERED = new Set(["completed", "answered"]);

/**
 * The therapist_calls row for a forwarded leg that just ended, from the
 * parameters Twilio POSTs to the <Dial> action. Null when there is no call id
 * to key it on.
 */
export function callRow(therapistId: string, p: Record<string, string>): CallRow | null {
  const sid = (p.CallSid ?? "").trim();
  if (!sid) return null;
  const answered = ANSWERED.has((p.DialCallStatus ?? "").trim().toLowerCase());
  const secs = Number.parseInt(p.DialCallDuration ?? "", 10);
  return {
    therapist_id: therapistId,
    provider: "twilio",
    provider_sid: sid,
    caller_masked: maskCaller(p.From),
    duration_secs: Number.isFinite(secs) ? secs : null,
    answered,
  };
}

export const isUuid = (s: unknown): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s ?? ""));

/* --------------------------------------------------- request signature */

/**
 * Twilio signs every webhook request: the full URL it called, then every
 * POST parameter sorted by name and appended as name+value, HMAC-SHA1'd with
 * the account's auth token and base64'd. This recomputes that.
 */
export async function twilioSignature(
  token: string, url: string, params: Record<string, string>,
): Promise<string> {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin);
}

const sameString = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/**
 * True when `given` (the X-Twilio-Signature header) signs these params for
 * any of `urls`: the URL as the function saw it and the public one Twilio
 * was configured with, since the two can differ behind the gateway.
 */
export async function signatureMatches(
  token: string, urls: string[], params: Record<string, string>, given: string | null,
): Promise<boolean> {
  if (!given) return false;
  for (const url of new Set(urls.filter(Boolean))) {
    if (sameString(await twilioSignature(token, url, params), given)) return true;
  }
  return false;
}

/* ------------------------------------------------- buying a number */
// The twilio-numbers function issues a Theraglee number the moment a listing
// goes live (and on an administrator's click), and releases it on request.
// These are the pure parts: which numbers to ask Twilio for, how to word the
// purchase, and how the number is shown.

/** The three-digit area code of a US number, or null. */
export function areaCodeOf(s: unknown): string | null {
  const d = last10(s);
  return d.length === 10 ? d.slice(0, 3) : null;
}

/** "+18050100199" shown as "(805) 010-0199"; a number that is not a US one is left alone. */
export function formatUs(s: unknown): string {
  if (!toE164(s)) return String(s ?? "");
  const d = last10(s);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const US_STATE = /^[A-Z]{2}$/;

/**
 * The searches to try, in order, for a listing: the therapist's own area code,
 * then anywhere in their first licensed state, then any US local number.
 * Each is the query string for Twilio's AvailablePhoneNumbers/US/Local.
 */
export function numberSearches(t: { contact_phone?: string | null; license_states?: string[] | null }): string[] {
  const out: string[] = [];
  const base = "VoiceEnabled=true&PageSize=5";
  const area = areaCodeOf(t.contact_phone);
  if (area) out.push(`AreaCode=${area}&${base}`);
  const state = (t.license_states ?? []).map((s) => String(s).trim().toUpperCase()).find((s) => US_STATE.test(s));
  if (state) out.push(`InRegion=${state}&${base}`);
  out.push(base);
  return out;
}

/** The form Twilio's IncomingPhoneNumbers takes to buy `number` and point it at `voiceUrl`. */
export function purchaseForm(number: string, voiceUrl: string, friendlyName: string): URLSearchParams {
  return new URLSearchParams({
    PhoneNumber: number,
    VoiceUrl: voiceUrl,
    VoiceMethod: "POST",
    FriendlyName: friendlyName.slice(0, 64),
  });
}

/** What the number is called in the Twilio Console. */
export const friendlyNameFor = (t: { first_name?: string | null; last_name?: string | null }): string =>
  `Theraglee: ${[t.first_name, t.last_name].filter(Boolean).join(" ").trim() || "therapist"}`;

/** Basic auth for Twilio's REST API. */
export const twilioAuthHeader = (accountSid: string, token: string): string =>
  "Basic " + btoa(`${accountSid}:${token}`);
