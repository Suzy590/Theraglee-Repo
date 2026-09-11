// License verification.
//
// A therapist's license is checked against the state board, the result is
// written to license_verifications, the listing's status moves with it, and
// the therapist (and, when a person has to look, the administrator) is
// emailed. The decisions live in _shared/license.ts; this file fetches,
// records and sends.
//
// Who calls it:
//   - Postgres, through pg_net, when a profile is created or its license
//     details change (event "check"), when a verification row is written
//     (event "notify"), and once a day for licenses due a re-check (event
//     "recheck"). These carry the shared key from app_secrets.
//   - The therapist dashboard's "Check my license now" button and the admin
//     screen, with a user JWT (event "check").
//
// How a license is checked, in order:
//   1. A primary-source-verification vendor, if LICENSE_VERIFY_URL and
//      LICENSE_VERIFY_API_KEY are set. Covers every state.
//   2. The board's open dataset, where the state publishes one
//      (state_boards.api_url + automatable; Washington and Colorado today).
//   3. Otherwise the check is filed as needs_review with the board's own
//      lookup link, the administrator is emailed, and they record the result
//      in the admin queue. Most boards only publish a human lookup, several
//      behind a bot check, so this is the usual route.
//
// verify_jwt is false: Postgres cannot mint a user JWT, so the function
// checks the shared key or the JWT itself.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS, json, readBody } from "../_shared/http.ts";
import {
  adapterFor, boardFor, composeEmail, decide, interpret, queryFor,
  type BoardRow, type EmailContext, type Finding, type Outcome,
} from "../_shared/license.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const SITE = (Deno.env.get("SITE_URL") || "https://theraglee.com").replace(/\/$/, "");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Therapist = {
  id: string; user_id: string; first_name: string; last_name: string;
  license_number: string | null; license_states: string[] | null; license_type: string | null;
  contact_email: string | null; verification: string;
};

const THERAPIST_COLS =
  "id, user_id, first_name, last_name, license_number, license_states, license_type, contact_email, verification";

/* ---------------------------------------------------------------- auth -- */

type Caller = { kind: "hook" } | { kind: "user"; id: string; admin: boolean } | null;

async function callerFrom(req: Request): Promise<Caller> {
  const presented = req.headers.get("x-license-key");
  if (presented) {
    const { data } = await admin.from("app_secrets").select("value").eq("key", "license_hook_key").maybeSingle();
    return data?.value && presented === data.value ? { kind: "hook" } : null;
  }
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: p } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  return { kind: "user", id: u.user.id, admin: p?.role === "admin" };
}

/* -------------------------------------------------------------- lookup -- */

async function callVendor(payload: Record<string, unknown>): Promise<{ ok: true; data: any } | { ok: false; error: string } | null> {
  const url = Deno.env.get("LICENSE_VERIFY_URL");
  const key = Deno.env.get("LICENSE_VERIFY_API_KEY");
  if (!url || !key) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `vendor ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: `vendor unreachable: ${String((e as Error)?.message ?? e)}` };
  }
}

/** A vendor's answer in the shared Finding shape. Field names follow the common PSV conventions. */
function findingFromVendor(d: any, verifyUrl: string | null): Finding {
  const name = d.licensee_name ?? d.name ?? null;
  const status = d.license_status ?? d.status ?? null;
  const expires = d.expires_on ?? d.expiration_date ?? null;
  const discipline = d.disciplinary ?? d.has_discipline ?? null;
  return {
    found: d.found !== false && Boolean(name || status),
    licensee_name: name, license_status: status,
    expires_on: typeof expires === "string" ? expires.slice(0, 10) : null,
    discipline: typeof discipline === "boolean" ? discipline : null,
    ambiguous: null,
    source_url: d.source_url ?? verifyUrl,
    raw: d,
  };
}

/** The board's open dataset, for the two states that publish one. */
async function fetchDataset(board: BoardRow, t: Therapist): Promise<{ finding: Finding } | { error: string } | null> {
  const adapter = adapterFor(board.api_url);
  if (!adapter || !board.automatable || !board.api_url) return null;
  const url = queryFor(adapter, board.api_url, t.license_number!);
  if (!url) return { error: "The license number has no digits to search on." };
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { error: `board dataset ${res.status}` };
    const rows = await res.json();
    if (!Array.isArray(rows)) return { error: "board dataset returned something other than rows" };
    return { finding: interpret(adapter, rows, t.license_number!, t.license_type, board.verify_url) };
  } catch (e) {
    return { error: `board dataset unreachable: ${String((e as Error)?.message ?? e)}` };
  }
}

/* --------------------------------------------------------------- check -- */

async function loadBoards(): Promise<BoardRow[]> {
  const { data } = await admin.from("state_boards").select("*");
  return (data ?? []) as BoardRow[];
}

/** Runs one therapist's check and records it. Returns what was recorded. */
async function check(t: Therapist) {
  const state = (t.license_states ?? [])[0];
  const boards = await loadBoards();
  const board = state ? boardFor(boards, state, t.license_type) : null;
  const lookup = board?.verify_url
    ?? `https://www.google.com/search?q=${encodeURIComponent(state + " board behavioral health license verification")}`;
  const profileName = `${t.first_name} ${t.last_name}`;

  let method: "vendor" | "board" | "manual" = "manual";
  let finding: Finding | null = null;
  let failure: string | null = null;

  const vendor = await callVendor({
    license_number: t.license_number, state, license_type: t.license_type ?? null,
    first_name: t.first_name, last_name: t.last_name,
  });
  if (vendor?.ok) { method = "vendor"; finding = findingFromVendor(vendor.data, board?.verify_url ?? null); }
  else if (vendor && !vendor.ok) failure = vendor.error;

  if (!finding && board) {
    const ds = await fetchDataset(board, t);
    if (ds && "finding" in ds) { method = "board"; finding = ds.finding; }
    else if (ds && "error" in ds) failure = failure ? `${failure}; ${ds.error}` : ds.error;
  }

  let status: Outcome;
  let notes: string | null;
  if (finding) {
    ({ status, notes } = decide(finding, profileName));
  } else {
    status = "needs_review";
    notes = failure
      ? `Automatic check failed, so a person needs to look: ${failure}`
      : board?.verify_url
      ? "This board publishes a web lookup only. Confirm against it and record the result."
      : `No lookup on file for ${state}. Confirm against the board and record the result.`;
  }

  const args = {
    p_therapist_id: t.id,
    p_status: status,
    p_method: method,
    p_licensee_name: finding?.licensee_name ?? null,
    p_license_status: finding?.license_status ?? null,
    p_expires_on: finding?.expires_on ?? null,
    p_disciplinary: finding?.discipline ?? null,
    p_board_name: board?.board_name ?? null,
    p_source_url: finding?.source_url ?? lookup,
    p_notes: notes,
    p_raw: finding?.raw ?? null,
  };
  const { data: recorded, error } = await admin.rpc("record_license_check", args);
  if (error) throw new Error(`record_license_check: ${error.message}`);

  return { status, method, board: board?.board_name ?? null, lookup_url: args.p_source_url, recorded };
}

/* -------------------------------------------------------------- notify -- */

async function sendEmail(to: string, subject: string, html: string, text: string, replyTo?: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { sent: false, error: "email_not_configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM") || "Theraglee <notifications@theraglee.com>",
      to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) return { sent: false, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
  return { sent: true, error: null };
}

/** The address a therapist reads: the profile's contact email, else the sign-in email. */
async function therapistEmail(t: Therapist): Promise<string | null> {
  if (t.contact_email) return t.contact_email;
  const { data } = await admin.auth.admin.getUserById(t.user_id);
  return data?.user?.email ?? null;
}

/** Emails for one verification row: the therapist always, the administrator when a person has to look. */
async function notify(verificationId: string) {
  const { data: v } = await admin.from("license_verifications").select("*").eq("id", verificationId).maybeSingle();
  if (!v) return { error: "not_found" };
  const { data: t } = await admin.from("therapist_profiles").select(THERAPIST_COLS).eq("id", v.therapist_id).maybeSingle();
  if (!t) return { error: "not_found" };

  const kind: Outcome = ["verified", "rejected", "expired"].includes(v.status) ? v.status : "needs_review";
  const ctx: EmailContext = {
    firstName: t.first_name, fullName: `${t.first_name} ${t.last_name}`,
    state: v.license_state, licenseNumber: v.license_number ?? t.license_number ?? "",
    licenseType: v.license_type ?? t.license_type ?? null,
    boardName: v.board_name, lookupUrl: v.source_url, site: SITE,
    notes: v.notes, licenseStatus: v.license_status, expiresOn: v.expires_on,
    automatic: v.method !== "manual",
  };

  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "admin_email").maybeSingle();
  const adminEmail = cfg?.value || null;

  const out: Record<string, unknown> = { status: kind };
  const to = await therapistEmail(t);
  if (to) {
    const m = composeEmail(kind, ctx);
    out.therapist = await sendEmail(to, m.subject, m.html, m.text, adminEmail ?? undefined);
  } else {
    out.therapist = { sent: false, error: "no_email_on_file" };
  }
  if (kind === "needs_review" && adminEmail) {
    const m = composeEmail("admin_review", ctx);
    out.admin = await sendEmail(adminEmail, m.subject, m.html, m.text, to ?? undefined);
  }
  return out;
}

/* ------------------------------------------------------------- handler -- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const caller = await callerFrom(req);
    if (!caller) return json({ error: "unauthorized" }, 401);

    const body = await readBody(req);
    const event = typeof body.event === "string" ? body.event : "check";

    if (event === "notify") {
      if (caller.kind !== "hook") return json({ error: "forbidden" }, 403);
      const id = String(body.verification_id ?? "");
      if (!UUID_RE.test(id)) return json({ error: "bad_request" }, 400);
      return json({ ok: true, ...(await notify(id)) });
    }

    if (event === "recheck") {
      if (caller.kind !== "hook") return json({ error: "forbidden" }, 403);
      // Verified licenses whose re-check date has come: run each one again.
      const { data: due } = await admin.from("therapist_profiles").select(THERAPIST_COLS)
        .eq("verification", "verified").lte("next_license_check", new Date().toISOString().slice(0, 10)).limit(50);
      const results = [];
      for (const t of (due ?? []) as Therapist[]) {
        try { results.push({ id: t.id, ...(await check(t)) }); }
        catch (e) { results.push({ id: t.id, error: String((e as Error)?.message ?? e) }); }
      }
      return json({ ok: true, checked: results.length, results });
    }

    // event "check"
    const id = String(body.therapist_id ?? "");
    if (!UUID_RE.test(id)) return json({ error: "bad_request", message: "Missing therapist." }, 400);
    const { data: t } = await admin.from("therapist_profiles").select(THERAPIST_COLS).eq("id", id).maybeSingle();
    if (!t) return json({ error: "not_found", message: "Listing not found." }, 404);
    if (caller.kind === "user" && !caller.admin && t.user_id !== caller.id) return json({ error: "forbidden" }, 403);
    if (!t.license_number || !(t.license_states ?? []).length) {
      return json({ error: "incomplete", message: "Add your license number and state of licensure first." }, 400);
    }

    const r = await check(t as Therapist);
    return json({
      ok: true, ...r, automatic: r.method !== "manual",
      message: r.status === "verified"
        ? "License verified against the board record. Your account is active."
        : r.status === "rejected"
        ? "That license is not showing as current and in good standing. We have emailed you what to do next."
        : r.status === "expired"
        ? "That license shows as expired. We have emailed you what to do next."
        : "We are checking with the state board and will email you either way, usually within two business days.",
    });
  } catch (err) {
    console.error(err);
    return json({ error: "server_error", message: String((err as Error)?.message ?? err) }, 500);
  }
});
