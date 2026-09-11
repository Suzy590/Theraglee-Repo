// The pure decisions behind license verification: which board row applies,
// how a board's record is read, whether it passes, and what the emails say.
// No imports, so tests/license-logic/check.mjs can run it under plain Node.
//
// The Edge Function (verify-license/index.ts) does the fetching, recording
// and sending; everything that can be reasoned about without a network lives
// here so it can be tested.

/* ------------------------------------------------------------- boards -- */

export interface BoardRow {
  state: string;
  profession: string;
  board_name: string;
  verify_url: string | null;
  api_url: string | null;
  automatable: boolean;
  notes: string | null;
}

/** License types that a state's separate board of psychology covers. */
export const PSYCH_TYPES = ["PsyD", "PhD", "EdD"];

/**
 * The board row for a therapist: the state's `psychology` row for a
 * psychologist where one exists, otherwise `behavioral_health`. Mirrors the
 * choice the admin queue makes.
 */
export function boardFor(rows: BoardRow[], state: string, licenseType: string | null | undefined) {
  const row = (p: string) => rows.find((b) => b.state === state && b.profession === p) ?? null;
  return (PSYCH_TYPES.includes(licenseType ?? "") && row("psychology")) || row("behavioral_health");
}

/* -------------------------------------------------------------- names -- */

/** Loose name comparison: boards format names inconsistently. */
export function namesAgree(profileName: string, boardName: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const a = new Set(norm(profileName));
  const b = norm(boardName);
  if (!b.length) return false;
  const hits = b.filter((w) => a.has(w)).length;
  return hits >= Math.min(2, b.length);
}

/* ----------------------------------------------------------- findings -- */

/** What a board's record says, in one shape whichever board it came from. */
export interface Finding {
  /** false when the board has no record of that number. */
  found: boolean;
  licensee_name: string | null;
  license_status: string | null;
  /** ISO date (YYYY-MM-DD) or null when the board does not publish one. */
  expires_on: string | null;
  /** true: an action is on record. null: the board does not say. */
  discipline: boolean | null;
  /** Set when the record cannot be read with confidence (several matches, an action still pending). */
  ambiguous: string | null;
  source_url: string | null;
  raw: unknown;
}

export type Outcome = "verified" | "rejected" | "expired" | "needs_review";

/** Exactly current, nothing attached. Anything qualified goes to a person. */
const CLEAN_STATUS = /^(active|clear|current|valid|in good standing|licensed|registered|license renewed & current)$/i;
const EXPIRED_STATUS = /expired|lapsed|delinquent/i;
const CONDITIONAL_STATUS = /probation|condition|restrict|provisional|summary/i;

/**
 * The verdict for one board record. Only a clean, current record under a
 * matching name is verified automatically; a mismatch or anything qualified
 * is filed for a person to look at, never silently approved or refused.
 */
export function decide(f: Finding, profileName: string, today = new Date()): { status: Outcome; notes: string | null } {
  if (!f.found) {
    return { status: "rejected", notes: "The board has no record of a license with that number." };
  }
  if (f.ambiguous) return { status: "needs_review", notes: f.ambiguous };

  const status = (f.license_status ?? "").trim();
  const expired = f.expires_on ? new Date(f.expires_on + "T23:59:59Z") < today : false;

  if (f.discipline === true) {
    return { status: "rejected", notes: `The board shows an action on this license (status: ${status || "unknown"}).` };
  }
  if (expired || EXPIRED_STATUS.test(status)) {
    return { status: "expired", notes: `The board shows this license as expired${f.expires_on ? ` on ${f.expires_on}` : ""}.` };
  }
  if (CONDITIONAL_STATUS.test(status)) {
    return { status: "needs_review", notes: `The board shows a qualified status: "${status}". A person needs to read the record.` };
  }
  if (!CLEAN_STATUS.test(status)) {
    return { status: "rejected", notes: `The board shows this license as "${status || "unknown"}", not current.` };
  }
  if (f.licensee_name && !namesAgree(profileName, f.licensee_name)) {
    return {
      status: "needs_review",
      notes: `The board shows "${f.licensee_name}" but the profile says "${profileName}". Confirm before publishing.`,
    };
  }
  return { status: "verified", notes: null };
}

/* ----------------------------------------------------------- adapters -- */

/**
 * States whose board publishes its license roster as an open dataset. The
 * dataset URL lives in state_boards.api_url; the host says how to read it.
 */
export type Adapter = "wa" | "co";

export function adapterFor(apiUrl: string | null | undefined): Adapter | null {
  if (!apiUrl) return null;
  if (/^https:\/\/data\.wa\.gov\//.test(apiUrl)) return "wa";
  if (/^https:\/\/data\.colorado\.gov\//.test(apiUrl)) return "co";
  return null;
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

/** The dataset query for one license number. Null when the number has no digits to search on. */
export function queryFor(adapter: Adapter, apiUrl: string, licenseNumber: string): string | null {
  const n = digitsOf(licenseNumber);
  if (!n) return null;
  const base = apiUrl.replace(/\?.*$/, "");
  if (adapter === "wa") {
    // Credential numbers look like MHC.LH.61321872; the number is the last part.
    const where = `credentialnumber like '%.${n}' OR credentialnumber = '${n}'`;
    return `${base}?$where=${encodeURIComponent(where)}&$limit=50`;
  }
  // Colorado numbers are plain digits, but the same number recurs across professions.
  return `${base}?licensenumber=${encodeURIComponent(n)}&$limit=50`;
}

const WA_TYPES: Record<string, RegExp> = {
  LMHC: /^Mental Health Counselor (License|Probationary License)$/,
  LMFT: /^Marriage and Family Therapist (License|Probationary License)$/,
  LICSW: /^Social Worker Independent Clinical (License|Probationary License)$/,
  LASW: /^Social Worker Advanced (License|Probationary License)$/,
  PSY: /^Psychologist (License|Probationary License)$/,
};
const WA_ANY = /^(Mental Health Counselor|Marriage and Family Therapist|Social Worker Independent Clinical|Social Worker Advanced|Psychologist) (License|Probationary License)$/;

const CO_TYPES: Record<string, string[]> = {
  LPC: ["LPC"], LPCC: ["LPCC"], LCSW: ["CSW"], LSW: ["LSW"], LMFT: ["MFT"], MFTC: ["MFTC"],
  PSY: ["PSY"], PSYC: ["PSYC"],
};
const CO_ANY = new Set(["LPC", "LPCC", "CSW", "LSW", "MFT", "MFTC", "PSY", "PSYC"]);

/** Theraglee's credential labels mapped onto each board's own type codes. */
function wantedTypes(adapter: Adapter, licenseType: string | null | undefined): RegExp | Set<string> | null {
  const t = (licenseType ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (adapter === "wa") {
    if (["PSYD", "PHD", "EDD"].includes(t)) return WA_TYPES.PSY;
    if (t === "LMHC" || t === "LPC" || t === "LPCC" || t === "LCPC") return WA_TYPES.LMHC;
    if (t === "LMFT") return WA_TYPES.LMFT;
    if (t === "LCSW" || t === "LICSW") return WA_TYPES.LICSW;
    return null;
  }
  if (["PSYD", "PHD", "EDD"].includes(t)) return new Set(["PSY"]);
  if (t === "LPC" || t === "LMHC" || t === "LCPC") return new Set(CO_TYPES.LPC);
  if (t === "LPCC") return new Set(CO_TYPES.LPCC);
  if (t === "LCSW" || t === "LICSW") return new Set(CO_TYPES.LCSW);
  if (t === "LMFT") return new Set(CO_TYPES.LMFT);
  return null;
}

const isoDate = (s: unknown): string | null => {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
};

const fullName = (r: Record<string, unknown>) =>
  [r.firstname, r.middlename, r.lastname].map((s) => String(s ?? "").trim()).filter(Boolean).join(" ") || null;

/**
 * Reads the dataset rows for one license into a Finding. Rows for other
 * professions that share the number are dropped; if more than one row is left
 * the record is ambiguous and goes to a person.
 */
export function interpret(
  adapter: Adapter,
  rows: Record<string, unknown>[],
  licenseNumber: string,
  licenseType: string | null | undefined,
  verifyUrl: string | null,
): Finding {
  const n = digitsOf(licenseNumber);
  const none: Finding = {
    found: false, licensee_name: null, license_status: null, expires_on: null,
    discipline: null, ambiguous: null, source_url: verifyUrl, raw: rows,
  };

  if (adapter === "wa") {
    const wanted = wantedTypes("wa", licenseType) as RegExp | null;
    let hits = rows.filter((r) => digitsOf(String(r.credentialnumber ?? "")).endsWith(n) &&
      WA_ANY.test(String(r.credentialtype ?? "")));
    if (wanted) {
      const typed = hits.filter((r) => wanted.test(String(r.credentialtype ?? "")));
      if (typed.length) hits = typed;
    }
    // A renewed credential leaves a Superseded twin behind; the live row wins.
    if (hits.length > 1) {
      const live = hits.filter((r) => !/^(superseded|closed)$/i.test(String(r.status ?? "")));
      if (live.length) hits = live;
    }
    if (!hits.length) return none;
    if (hits.length > 1) {
      return { ...none, found: true, ambiguous: `${hits.length} Washington credentials share that number; a person needs to pick the right one.` };
    }
    const r = hits[0];
    const action = String(r.actiontaken ?? "").trim().toLowerCase();
    return {
      found: true,
      licensee_name: fullName(r),
      license_status: String(r.status ?? "").trim() || null,
      expires_on: isoDate(r.expirationdate),
      discipline: action === "yes" ? true : action === "no" ? false : null,
      ambiguous: action === "pending" ? "Washington shows a disciplinary action pending on this credential." : null,
      source_url: verifyUrl,
      raw: r,
    };
  }

  // Colorado
  const wanted = wantedTypes("co", licenseType) as Set<string> | null;
  let hits = rows.filter((r) => digitsOf(String(r.licensenumber ?? "")) === n &&
    CO_ANY.has(String(r.licensetype ?? "").toUpperCase()));
  if (wanted) {
    const typed = hits.filter((r) => wanted.has(String(r.licensetype ?? "").toUpperCase()));
    if (typed.length) hits = typed;
  }
  if (!hits.length) return none;
  if (hits.length > 1) {
    return { ...none, found: true, ambiguous: `${hits.length} Colorado licenses share that number; a person needs to pick the right one.` };
  }
  const r = hits[0];
  const hasCase = Boolean(String(r.casenumber ?? "").trim() || String(r.programaction ?? "").trim());
  const link = (r.linktoverifylicense as { url?: string } | undefined)?.url;
  return {
    found: true,
    licensee_name: fullName(r),
    license_status: String(r.licensestatusdescription ?? "").trim() || null,
    expires_on: isoDate(r.licenseexpirationdate),
    discipline: hasCase,
    ambiguous: null,
    source_url: link || verifyUrl,
    raw: r,
  };
}

/* ------------------------------------------------------------- emails -- */

export interface EmailContext {
  firstName: string;
  fullName: string;
  state: string;
  licenseNumber: string;
  licenseType: string | null;
  boardName: string | null;
  lookupUrl: string | null;
  site: string;
  notes: string | null;
  licenseStatus: string | null;
  expiresOn: string | null;
  automatic: boolean;
}

export interface Email { subject: string; html: string; text: string }

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const wrap = (inner: string) =>
  `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#16241C;line-height:1.5">` +
  inner +
  `<hr style="border:0;border-top:1px solid #E6E8E1;margin:26px 0">` +
  `<p style="color:#8B978E;font-size:12px;line-height:1.5;margin:0">Theraglee verifies every therapist's license with the ` +
  `state board before a listing goes live, and re-checks it before it expires. Reply to this email if anything here looks wrong.</p></div>`;

const btn = (href: string, label: string) =>
  `<p style="margin:18px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#187C1A;color:#fff;` +
  `text-decoration:none;padding:11px 22px;border-radius:100px">${esc(label)}</a></p>`;

const li = (items: string[]) => `<ol style="padding-left:20px;margin:12px 0">${items.map((i) => `<li style="margin:6px 0">${i}</li>`).join("")}</ol>`;

/** Which board and license the email is about, in one line. */
function licenseLine(c: EmailContext) {
  return `${c.licenseType ? c.licenseType + " " : ""}license ${c.licenseNumber} in ${c.state}` +
    (c.boardName ? ` (${c.boardName})` : "");
}

/** The email a therapist gets for each outcome, plus the one the administrator gets for a manual check. */
export function composeEmail(kind: Outcome | "admin_review", c: EmailContext): Email {
  const hi = `Hi ${c.firstName || "there"},`;
  const dash = `${c.site}/therapist-dashboard.html`;
  const lookup = c.lookupUrl ?? "";

  if (kind === "verified") {
    const subject = "Your license is verified on Theraglee";
    const html = wrap(
      `<p>${esc(hi)}</p>` +
      `<p>Good news: your ${esc(licenseLine(c))} checks out as current and in good standing` +
      (c.expiresOn ? `, through ${esc(c.expiresOn)}` : "") + `. Your Theraglee therapist account is active.</p>` +
      `<p>Your listing appears in the directory as soon as your membership is active and you press <strong>Publish</strong> on your dashboard. Nothing is public until you do.</p>` +
      btn(dash, "Open my dashboard") +
      `<p style="color:#5A6760;font-size:14px;margin-top:22px">We re-check your license with the board before it expires, so there is nothing to send us.</p>`,
    );
    const text = `${hi}\n\nGood news: your ${licenseLine(c)} checks out as current and in good standing` +
      (c.expiresOn ? `, through ${c.expiresOn}` : "") + `. Your Theraglee therapist account is active.\n\n` +
      `Your listing appears in the directory as soon as your membership is active and you press Publish on your dashboard: ${dash}\n\n` +
      `We re-check your license with the board before it expires, so there is nothing to send us.`;
    return { subject, html, text };
  }

  if (kind === "needs_review") {
    const subject = "We're checking your license with the state board";
    const html = wrap(
      `<p>${esc(hi)}</p>` +
      `<p>Thanks for creating a Theraglee therapist profile. We are confirming your ${esc(licenseLine(c))} against the board's own record. This usually takes one to two business days, and we email you either way.</p>` +
      `<p>Meanwhile you can finish your profile, and nothing is public until your license is confirmed and you choose to publish.</p>` +
      btn(dash, "Finish my profile"),
    );
    const text = `${hi}\n\nThanks for creating a Theraglee therapist profile. We are confirming your ${licenseLine(c)} against the board's own record. ` +
      `This usually takes one to two business days, and we email you either way.\n\nMeanwhile you can finish your profile: ${dash}\n` +
      `Nothing is public until your license is confirmed and you choose to publish.`;
    return { subject, html, text };
  }

  if (kind === "admin_review") {
    const subject = `License to verify: ${c.fullName} (${c.state})`;
    const adminUrl = `${c.site}/admin.html`;
    const html = wrap(
      `<p>A therapist profile needs a license check that could not be completed automatically.</p>` +
      `<p><strong>${esc(c.fullName)}</strong><br>${esc(licenseLine(c))}` +
      (c.notes ? `<br><span style="color:#5A6760">${esc(c.notes)}</span>` : "") + `</p>` +
      (lookup ? btn(lookup, "Open the board lookup") : "") +
      `<p style="margin-top:14px">Then record the result in the <a href="${esc(adminUrl)}" style="color:#187C1A">admin license queue</a>. ` +
      `The therapist is emailed automatically when you do.</p>`,
    );
    const text = `A therapist profile needs a license check that could not be completed automatically.\n\n` +
      `${c.fullName}\n${licenseLine(c)}\n` + (c.notes ? `${c.notes}\n` : "") +
      (lookup ? `\nBoard lookup: ${lookup}\n` : "") +
      `\nRecord the result in the admin license queue: ${adminUrl}\nThe therapist is emailed automatically when you do.`;
    return { subject, html, text };
  }

  // rejected or expired: say what the board showed and what to do next.
  const expired = kind === "expired";
  const subject = expired
    ? "Your license shows as expired, so your Theraglee listing is on hold"
    : "We could not verify your license, so your Theraglee listing is on hold";
  const shown = c.licenseStatus ? `The board shows the status as "${c.licenseStatus}".` : "";
  const reason = c.notes ? esc(c.notes) : (expired ? "The board shows the license as expired." : "The board record does not show a current license in good standing under these details.");
  const steps = [
    `Open the board's own lookup${lookup ? ` (<a href="${esc(lookup)}" style="color:#187C1A">${esc(c.boardName || "state board")}</a>)` : ""} and check what it shows for license ${esc(c.licenseNumber)}.`,
    expired
      ? `If the license has lapsed, renew it with the board. Once the board shows it as current, open your dashboard and press <strong>Check my license now</strong>.`
      : `If the number, license type or name on your profile does not match the board record exactly, correct your profile to match and press <strong>Check my license now</strong> on your dashboard.`,
    `If the board shows a disciplinary action or restriction, Theraglee cannot list the profile while it is on record. If you believe the record is wrong, contact the board first, then reply to this email once it is corrected.`,
    `If everything on the board already looks right, reply to this email and a person will look again.`,
  ];
  const stepsText = [
    `1. Open the board's own lookup${lookup ? ` (${lookup})` : ""} and check what it shows for license ${c.licenseNumber}.`,
    expired
      ? `2. If the license has lapsed, renew it with the board. Once the board shows it as current, open your dashboard and press "Check my license now".`
      : `2. If the number, license type or name on your profile does not match the board record exactly, correct your profile to match and press "Check my license now" on your dashboard.`,
    `3. If the board shows a disciplinary action or restriction, Theraglee cannot list the profile while it is on record. If you believe the record is wrong, contact the board first, then reply to this email once it is corrected.`,
    `4. If everything on the board already looks right, reply to this email and a person will look again.`,
  ];
  const html = wrap(
    `<p>${esc(hi)}</p>` +
    `<p>We checked your ${esc(licenseLine(c))} and could not confirm it as current and in good standing, so your listing cannot go live yet. ${esc(shown)}</p>` +
    `<p style="padding:14px 16px;background:#FFF4E5;border-radius:12px;margin:14px 0">${reason}</p>` +
    `<p><strong>What to do next</strong></p>` + li(steps) +
    btn(dash, "Open my dashboard") +
    `<p style="color:#5A6760;font-size:14px;margin-top:22px">Your account and dashboard stay open; only the public listing is on hold.</p>`,
  );
  const text = `${hi}\n\nWe checked your ${licenseLine(c)} and could not confirm it as current and in good standing, so your listing cannot go live yet. ${shown}\n\n` +
    `${c.notes ?? (expired ? "The board shows the license as expired." : "The board record does not show a current license in good standing under these details.")}\n\n` +
    `What to do next\n${stepsText.join("\n")}\n\nYour dashboard: ${dash}\n\nYour account and dashboard stay open; only the public listing is on hold.`;
  return { subject, html, text };
}
