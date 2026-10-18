// Every morning: the next follow-up email to each therapist who created an
// account and stopped before the listing went live, and the one-click
// unsubscribe link every one of those emails carries.
//
// verify_jwt is false because pg_cron calls this over HTTP and cannot mint a
// user JWT. Authenticity for the send comes from the shared key in
// app_secrets. The unauthenticated route is GET ?u=<token>, where the token is
// the only proof needed to stop the emails.
//
// The decisions live in _shared/therapist-nudges.ts; this file fetches,
// calls, sends, and records.
import { admin } from "../_shared/supabase.ts";
import { json, readBody } from "../_shared/http.ts";
import { page } from "../_shared/tool-email.ts";
import {
  composeNudge, daysSince, nextStep, prettyDate, rateLine, STEPS, type Recipient, type Step,
} from "../_shared/therapist-nudges.ts";

const SITE = (Deno.env.get("SITE_URL") || "https://theraglee.com").replace(/\/$/, "");
const UNSUB_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1/therapist-nudges`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const goneWrong = () =>
  page("That link is not valid",
    `<h1>That link is not valid</h1><p>It may have already been used. If you are still getting ` +
    `these emails, reply to one and we will stop them by hand.</p>` +
    `<a class="btn" href="${SITE}/">Back to Theraglee</a>`, 404);

async function unsubscribe(token: string) {
  if (!UUID_RE.test(token)) return goneWrong();
  const { data: ok, error } = await admin.rpc("therapist_nudge_unsubscribe", { p_token: token });
  if (error) {
    console.error("unsubscribe failed:", error.code ?? error.message);
    return page("Something went wrong",
      `<h1>Something went wrong</h1><p>Please try that link again in a moment.</p>`, 500);
  }
  return ok
    ? page("Unsubscribed",
        `<h1>No more reminders</h1><p>We will not write again about finishing your listing. ` +
        `Your account is unchanged, and your practice dashboard is open whenever you want it.</p>` +
        `<a class="btn" href="${SITE}/therapist-dashboard.html">Open my dashboard</a>`)
    : goneWrong();
}

async function send(to: string, msg: { subject: string; html: string; text: string }, unsub: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "email_not_configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM") || "Theraglee <notifications@theraglee.com>",
      to, subject: msg.subject, html: msg.html, text: msg.text,
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) return { ok: false, error: `send failed ${res.status} ${(await res.text()).slice(0, 200)}` };
  return { ok: true, error: null as string | null };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // One click out. Mail clients may send either verb.
  if (req.method === "GET" || (req.method === "POST" && url.searchParams.has("u"))) {
    return await unsubscribe(url.searchParams.get("u") || "");
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { data: secret } = await admin.from("app_secrets")
    .select("value").eq("key", "therapist_nudges_key").maybeSingle();
  if (!secret?.value || req.headers.get("x-nudges-key") !== secret.value) {
    return json({ error: "forbidden" }, 403);
  }

  const body = await readBody(req);
  const dryRun = Boolean(body.dry_run);
  // The owner can send one step to one account to see it in a real inbox.
  const only = typeof body.user_id === "string" ? body.user_id : null;
  const forced = STEPS.map((s) => s.step as string).includes(body.step) ? body.step as Step : null;

  if (!dryRun && !Deno.env.get("RESEND_API_KEY")) {
    return json({ error: "email_not_configured",
      message: "Set the RESEND_API_KEY secret on this project before the therapist follow-up emails can send." }, 503);
  }

  const { data, error } = await admin.rpc("therapist_nudge_recipients", { p_limit: 300 });
  if (error) {
    console.error("recipients failed:", error.code ?? error.message);
    return json({ error: "recipients_failed" }, 500);
  }
  let recipients = (data ?? []) as Recipient[];
  if (only) recipients = recipients.filter((r) => r.user_id === only);

  const { data: cfgRows } = await admin.from("app_config").select("key,value")
    .in("key", ["founding_enabled", "display_therapist_founding", "founding_deadline", "display_therapist_monthly"]);
  const cfg = Object.fromEntries((cfgRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const now = new Date();
  const { rate, founding } = rateLine(cfg, now);

  let sent = 0, skipped = 0, failed = 0;
  const previews: unknown[] = [];

  for (const r of recipients) {
    const step = (only && forced) ? forced : nextStep(daysSince(r.created_at, now), r.sent_steps);
    if (!step) { skipped++; continue; }

    const unsub = `${UNSUB_BASE}?u=${encodeURIComponent(r.email_token)}`;
    const msg = composeNudge(step, {
      firstName: r.first_name, stage: r.stage, site: SITE, unsub, rate, founding,
      signedUp: prettyDate(r.created_at),
    });
    if (dryRun) { previews.push({ user_id: r.user_id, step, stage: r.stage, subject: msg.subject }); continue; }

    const out = await send(r.email, msg, unsub);
    await admin.from("therapist_nudge_sends").insert({
      user_id: r.user_id, step, stage: r.stage,
      status: out.ok ? "sent" : "failed", error: out.error,
    });
    if (out.ok) sent++; else failed++;
  }

  // Counts only — never an address, never the body of a message.
  console.log(JSON.stringify({ considered: recipients.length, sent, skipped, failed, dry_run: dryRun }));
  return json({ considered: recipients.length, sent, skipped, failed, dry_run: dryRun,
    ...(dryRun ? { previews } : {}) });
});
