// Google Analytics reports for the admin screen (/admin.html, Google Analytics tab).
//
// Admin only: the caller's JWT is checked in-body and their profile must have
// role = 'admin'. One POST with an `action` field:
//
//   summary   the numbers for the tab: { days } (7, 30, 90 or 365)
//   test      checks that the key and the property id work, without reports
//
// The reports come from the Google Analytics Data API, read with a service
// account whose key file sits in the GA_SERVICE_ACCOUNT_JSON secret; the
// property id comes from app_config (ga_property_id, set on the tab). The
// service account signs a short JWT, trades it for an access token (kept
// here until it expires), and posts the requests built in _shared/analytics.ts.
import { CORS, json, readBody } from "../_shared/http.ts";
import { callerFrom, loadConfig } from "../_shared/supabase.ts";
import {
  apiErrorMessage, CONFIG_KEYS, DATA_API, parseServiceAccount, propertyIdFrom, realtimeRequest, reportRequests,
  summarize, tokenClaims, windowFrom,
} from "../_shared/analytics.ts";

const fail = (message: string, status = 400, error = "bad_request") => json({ error, message }, status);

/* ------------------------------------------------------------- the token */

const b64url = (bytes: Uint8Array | string) => {
  const s = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const utf8 = (s: string) => new TextEncoder().encode(s);

/** The PEM private key from the key file as a WebCrypto signing key. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const der = atob(pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, ""));
  const bytes = Uint8Array.from(der, (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

let cached: { token: string; expires: number } | null = null;

/** An access token for the Data API, signed with the service account. */
async function accessToken(account: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expires > now + 60) return cached.token;
  const header = b64url(utf8(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(utf8(JSON.stringify(tokenClaims(account.client_email, account.token_uri, now))));
  const key = await importPrivateKey(account.private_key);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, utf8(`${header}.${claims}`)));
  const assertion = `${header}.${claims}.${b64url(sig)}`;
  const res = await fetch(account.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw Object.assign(new Error(apiErrorMessage(401, body)), { status: 401 });
  }
  cached = { token: body.access_token, expires: now + Number(body.expires_in ?? 3600) };
  return body.access_token;
}

/* ---------------------------------------------------------- the reports */

/** POSTs one Data API method on the property; throws with a message an
 *  administrator can act on when Google says no. */
async function dataApi(token: string, propertyId: string, method: string, body: unknown) {
  const res = await fetch(`${DATA_API}/properties/${propertyId}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(res.status, out)), { status: res.status });
  return out;
}

async function connection() {
  const parsed = parseServiceAccount(Deno.env.get("GA_SERVICE_ACCOUNT_JSON"));
  if ("error" in parsed) return { error: fail(parsed.error, 503, "analytics_not_configured") };
  const cfg = await loadConfig();
  const propertyId = propertyIdFrom(cfg[CONFIG_KEYS.propertyId]);
  if (!propertyId) {
    return { error: fail("Enter the GA4 property id on this tab first (the number under Admin → Property details in Google Analytics).", 503, "analytics_not_configured") };
  }
  return { account: parsed.account, propertyId };
}

async function summary(body: Record<string, unknown>) {
  const c = await connection();
  if ("error" in c) return c.error;
  const days = windowFrom(body.days);
  const token = await accessToken(c.account);
  const batch = await dataApi(token, c.propertyId, "batchRunReport", { requests: reportRequests(days) });
  // The realtime report is extra: a property too new to have it, or a
  // momentary error, should not take the rest of the tab down with it.
  const realtime = await dataApi(token, c.propertyId, "runRealtimeReport", realtimeRequest).catch(() => null);
  return json({ ok: true, ...summarize(batch.reports ?? [], realtime, days), property_id: c.propertyId, service_account: c.account.client_email });
}

async function test() {
  const c = await connection();
  if ("error" in c) return c.error;
  const token = await accessToken(c.account);
  await dataApi(token, c.propertyId, "runReport", {
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }], metrics: [{ name: "activeUsers" }], limit: 1,
  });
  return json({ ok: true, property_id: c.propertyId, service_account: c.account.client_email });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const caller = await callerFrom(req);
    if (!caller) return fail("Please sign in first.", 401, "unauthorized");
    if (caller.profile.role !== "admin") return fail("This is for site administrators.", 403, "forbidden");

    const body = await readBody(req);
    switch (body.action) {
      case "summary": return await summary(body);
      case "test":    return await test();
      default:        return fail(`Unknown action "${body.action}".`);
    }
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status) return fail(String((err as Error).message), 502, "analytics_error");
    console.error("google-analytics error", err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
