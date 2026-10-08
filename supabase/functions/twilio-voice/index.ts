// Twilio -> Supabase: call forwarding for Theraglee tracking numbers.
//
// verify_jwt is intentionally false: Twilio cannot present a Supabase JWT.
// Authenticity is established by checking Twilio's request signature with the
// account's auth token (TWILIO_AUTH_TOKEN); anything unsigned is rejected.
//
// Two moments in a call reach this one function, both as POSTs from Twilio:
//
//   1. The Theraglee number rings. The number's "A call comes in" webhook in
//      the Twilio Console points here. The function finds whose number was
//      called and answers with TwiML that dials their real number.
//   2. The forwarded leg ends. The <Dial> we returned names this function
//      again (?step=dial&t=<therapist id>) as its action; Twilio POSTs how it
//      went (DialCallStatus, DialCallDuration) and the call is kept in
//      therapist_calls, keyed on Twilio's CallSid so a repeated delivery
//      updates rather than duplicates. An unanswered call hears a short
//      apology; an answered one simply ends.
//
// docs/phone-numbers.md is the guide.
import { admin } from "../_shared/supabase.ts";
import {
  callRow, emptyTwiml, forwardTwiml, isUuid, NO_ANSWER, NO_LINE, sayTwiml,
  signatureMatches, therapistForNumber, toE164,
} from "../_shared/twilio.ts";

/** This function's public URL: what Twilio is configured with and signs. */
const SELF = `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "")}/functions/v1/twilio-voice`;

const xml = (body: string) =>
  new Response(body, { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } });

const plain = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

/* --------------------------------------------------- 1. the number rings */

async function incoming(params: Record<string, string>) {
  const { data: rows, error } = await admin
    .from("therapist_profiles").select("id, proxy_phone, contact_phone")
    .not("proxy_phone", "is", null);
  if (error) {
    console.error("could not read listings", error);
    return xml(sayTwiml(NO_LINE));
  }
  const t = therapistForNumber(rows ?? [], params.To);
  const to = t ? toE164(t.contact_phone) : null;
  if (!t || !to) {
    console.warn("no forwarding number for", params.To);
    return xml(sayTwiml(NO_LINE));
  }
  const action = `${SELF}?step=dial&t=${encodeURIComponent(t.id)}`;
  return xml(forwardTwiml(to, action));
}

/* ------------------------------------------ 2. the forwarded leg ends */

async function dialEnded(url: URL, params: Record<string, string>) {
  const tid = url.searchParams.get("t") ?? "";
  const row = isUuid(tid) ? callRow(tid, params) : null;
  if (!row) {
    console.warn("dial action without a therapist or call id");
    return xml(emptyTwiml());
  }
  const { error } = await admin.from("therapist_calls").upsert(row, { onConflict: "provider_sid" });
  if (error) console.error("could not record call", row.provider_sid, error);
  return xml(row.answered ? emptyTwiml() : sayTwiml(NO_ANSWER));
}

/* ------------------------------------------------------------- serve */

Deno.serve(async (req) => {
  if (req.method !== "POST") return plain("POST only", 405);

  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!token) {
    console.error("TWILIO_AUTH_TOKEN is not set; refusing every call");
    return plain("not configured", 503);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return plain("bad request", 400);
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  // Twilio signed the URL it was configured with. Behind the gateway the
  // function may see a different host, so both spellings are tried.
  const url = new URL(req.url);
  const candidates = [req.url, `${SELF}${url.search}`];
  if (!await signatureMatches(token, candidates, params, req.headers.get("X-Twilio-Signature"))) {
    console.warn("rejected a request with a bad or missing signature", url.pathname + url.search);
    return plain("forbidden", 403);
  }

  return url.searchParams.get("step") === "dial" ? dialEnded(url, params) : incoming(params);
});
