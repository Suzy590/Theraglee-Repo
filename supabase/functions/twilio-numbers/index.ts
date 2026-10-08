// Issues and releases Theraglee tracking numbers through Twilio.
//
// verify_jwt is intentionally false: the function is called two ways and
// checks both itself:
//   - by Postgres (pg_net) with the shared key in app_secrets.twilio_hook_key,
//     the moment a listing goes live (20261008200000_twilio_auto_numbers.sql);
//   - by an administrator from /admin.html with their session, to issue a
//     number by hand or to release one.
//
// Actions, as JSON { action, therapist_id }:
//   issue    Buys a voice number near the therapist (their own area code, then
//            their first licensed state, then anywhere in the US), points its
//            "A call comes in" webhook at the twilio-voice function, and saves
//            it on the listing. Only a live listing (verified, membership
//            active) gets one; a listing that already has one is left alone.
//   release  Gives a Twilio number back and clears it from the listing. A
//            number pasted in by hand is simply cleared.
//
// Needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN. docs/phone-numbers.md is
// the guide.
import { admin } from "../_shared/supabase.ts";
import { json, CORS } from "../_shared/http.ts";
import {
  formatUs, friendlyNameFor, numberSearches, purchaseForm, twilioAuthHeader,
} from "../_shared/twilio.ts";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const VOICE_URL = `${SUPABASE_URL}/functions/v1/twilio-voice`;

/* ---------------------------------------------------------- who is asking */

async function allowed(req: Request): Promise<boolean> {
  const key = req.headers.get("x-hook-key");
  if (key) {
    const { data } = await admin.from("app_secrets").select("value").eq("key", "twilio_hook_key").maybeSingle();
    return !!data?.value && key === data.value;
  }
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return false;
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return false;
  const { data: p } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  return p?.role === "admin";
}

/* ------------------------------------------------------------- Twilio */

function twilio() {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID"), token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) return null;
  const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}`;
  const headers = { Authorization: twilioAuthHeader(sid, token) };
  return {
    async search(query: string): Promise<string | null> {
      const r = await fetch(`${base}/AvailablePhoneNumbers/US/Local.json?${query}`, { headers });
      if (!r.ok) { console.warn("number search failed", r.status, await r.text()); return null; }
      const body = await r.json();
      return body?.available_phone_numbers?.[0]?.phone_number ?? null;
    },
    async buy(form: URLSearchParams): Promise<{ sid: string; phone: string } | { error: string }> {
      const r = await fetch(`${base}/IncomingPhoneNumbers.json`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body: form,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return { error: body?.message ?? `Twilio answered ${r.status}` };
      return { sid: body.sid, phone: body.phone_number };
    },
    async release(pnSid: string): Promise<string | null> {
      const r = await fetch(`${base}/IncomingPhoneNumbers/${encodeURIComponent(pnSid)}.json`, { method: "DELETE", headers });
      // 404: already gone from Twilio's side, which is the state we want.
      return r.ok || r.status === 404 ? null : `Twilio answered ${r.status}`;
    },
  };
}

/* ------------------------------------------------------------- actions */

type Listing = {
  id: string; first_name: string | null; last_name: string | null; contact_phone: string | null;
  license_states: string[] | null; verification: string; published: boolean; proxy_phone: string | null;
  proxy_phone_provider: string | null; proxy_phone_sid: string | null;
};

async function listing(id: string): Promise<Listing | null> {
  const { data } = await admin.from("therapist_profiles")
    .select("id, first_name, last_name, contact_phone, license_states, verification, published, proxy_phone, proxy_phone_provider, proxy_phone_sid")
    .eq("id", id).maybeSingle();
  return data as Listing | null;
}

async function issue(t: Listing) {
  if (t.proxy_phone) return json({ ok: true, phone: t.proxy_phone, already: true });
  if (t.verification !== "verified") {
    return json({ error: "not_verified", message: "Only a verified listing gets a number." }, 409);
  }
  // `published` is verified plus an active membership: a listing nobody can
  // see would only cost its number's monthly fee.
  if (!t.published) {
    return json({ error: "not_live", message: "The membership is not active, so the listing is not live and gets no number." }, 409);
  }
  const tw = twilio();
  if (!tw) return json({ error: "not_configured", message: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not set." }, 503);

  let candidate: string | null = null;
  for (const q of numberSearches(t)) {
    candidate = await tw.search(q);
    if (candidate) break;
  }
  if (!candidate) return json({ error: "none_available", message: "Twilio had no voice number to offer just now." }, 502);

  const bought = await tw.buy(purchaseForm(candidate, VOICE_URL, friendlyNameFor(t)));
  if ("error" in bought) {
    console.error("purchase failed", t.id, bought.error);
    return json({ error: "purchase_failed", message: bought.error }, 502);
  }

  const phone = formatUs(bought.phone);
  const { error } = await admin.from("therapist_profiles").update({
    proxy_phone: phone, proxy_phone_provider: "twilio", proxy_phone_sid: bought.sid,
    proxy_phone_assigned_at: new Date().toISOString(),
  }).eq("id", t.id);
  if (error) {
    // The number is bought but not on the listing: give it back rather than
    // leave it billing with nobody to answer it.
    console.error("could not save number; releasing", t.id, error);
    await tw.release(bought.sid);
    return json({ error: "server_error", message: "Bought a number but could not save it; it was released." }, 500);
  }
  console.log("issued", phone, "to", t.id);
  return json({ ok: true, phone });
}

async function release(t: Listing) {
  if (!t.proxy_phone) return json({ ok: true, already: true });
  if (t.proxy_phone_provider === "twilio" && t.proxy_phone_sid) {
    const tw = twilio();
    if (!tw) return json({ error: "not_configured", message: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not set." }, 503);
    const err = await tw.release(t.proxy_phone_sid);
    if (err) return json({ error: "release_failed", message: err }, 502);
  }
  const { error } = await admin.from("therapist_profiles").update({
    proxy_phone: null, proxy_phone_provider: null, proxy_phone_sid: null, proxy_phone_assigned_at: null,
  }).eq("id", t.id);
  if (error) return json({ error: "server_error", message: "Could not clear the number." }, 500);
  console.log("released number of", t.id);
  return json({ ok: true });
}

/* --------------------------------------------------------------- serve */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!await allowed(req)) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({})) ?? {};
  const id = String(body.therapist_id ?? "");
  const t = id ? await listing(id) : null;
  if (!t) return json({ error: "not_found", message: "No such listing." }, 404);

  switch (body.action) {
    case "issue": return issue(t);
    case "release": return release(t);
    default: return json({ error: "bad_action" }, 400);
  }
});
