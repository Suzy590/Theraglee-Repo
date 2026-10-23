// Sends the evening mood reminder: one short email to each member who ticked
// the box on the mood check-in and has not submitted today's check-in by
// evening. Off for everyone until they tick it.
//
// verify_jwt is false because pg_cron calls this over HTTP and cannot mint a
// user JWT. Authenticity comes from the shared key in app_secrets. The one
// unauthenticated route is GET ?u=<token>, the unsubscribe link in every email.
//
// Who gets it and "once a day" are decided in SQL (mood_reminder_recipients,
// mood_reminder_sends, 20261024120000_mood_reminder.sql) so the rules live
// next to the data. The words are in _shared/mood-reminder.ts. This file only
// delivers. docs/mood.md is the guide.
import { admin } from "../_shared/supabase.ts";
import { page, sendToolEmail } from "../_shared/tool-email.ts";
import { composeMoodReminder, type ReminderRecipient } from "../_shared/mood-reminder.ts";

const SITE = (Deno.env.get("SITE_URL") || "https://theraglee.com").replace(/\/$/, "");
const SELF = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mood-reminder`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const notValid = () => page("Not found", `<h1>That link is not valid</h1>` +
  `<p>You can untick the reminder on your dashboard's mood check-in instead.</p>` +
  `<a class="btn" href="${SITE}/dashboard.html#mood">Open my dashboard</a>`, 404);

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // The unsubscribe link. No sign-in: the token is the proof.
  if (req.method === "GET") {
    const token = url.searchParams.get("u") || "";
    if (!UUID_RE.test(token)) return notValid();
    const { data: ok, error } = await admin.rpc("mood_reminder_unsubscribe", { p_token: token });
    if (error) return page("Something went wrong", `<h1>Something went wrong</h1><p>Please try again in a moment.</p>`, 500);
    return ok
      ? page("Reminders off", `<h1>Mood reminders are off</h1>` +
          `<p>No more evening nudges. Your check-in works exactly as before, and you can tick the box ` +
          `again on your dashboard any time.</p>` +
          `<a class="btn" href="${SITE}/dashboard.html#mood">Back to Theraglee</a>`)
      : notValid();
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Scheduler auth: the shared key from app_secrets.
  const { data: secret } = await admin.from("app_secrets").select("value").eq("key", "mood_reminder_key").maybeSingle();
  const presented = req.headers.get("x-mood-reminder-key");
  if (!secret?.value || presented !== secret.value) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const dryRun = Boolean(body?.dry_run);
  const onlyUser = typeof body?.user_id === "string" && UUID_RE.test(body.user_id) ? body.user_id : null;

  if (!dryRun && !Deno.env.get("RESEND_API_KEY")) {
    return json({ error: "email_not_configured",
      message: "Set the RESEND_API_KEY secret on this project before the reminder can send." }, 503);
  }

  // Who is due. A single user_id skips the once-a-day and not-yet-submitted
  // rules so the owner can test against their own inbox; the scheduled run
  // never passes one.
  let recipients: ReminderRecipient[] = [];
  if (onlyUser) {
    const { data: p } = await admin.from("profiles")
      .select("id, email, full_name, email_token").eq("id", onlyUser).maybeSingle();
    if (p?.email) {
      recipients = [{ user_id: p.id, email: p.email, full_name: p.full_name, email_token: p.email_token,
        started: Boolean(body?.started) }];
    }
  } else {
    const { data, error } = await admin.rpc("mood_reminder_recipients", { p_limit: 300 });
    if (error) {
      console.error("recipients failed:", error.code ?? error.message);
      return json({ error: "recipients_failed" }, 500);
    }
    recipients = (data as ReminderRecipient[]) ?? [];
  }

  let sent = 0, failed = 0;
  const previews: unknown[] = [];

  for (const r of recipients) {
    const msg = composeMoodReminder(r, { site: SITE, unsubBase: SELF });
    if (dryRun) {
      previews.push({ to: r.email, subject: msg.subject, started: r.started, html: msg.html });
      continue;
    }
    const out = await sendToolEmail(r.email, msg);
    await admin.from("mood_reminder_sends").insert({
      user_id: r.user_id, status: out.ok ? "sent" : "failed", error: out.error,
    });
    out.ok ? sent++ : failed++;
  }

  // Counts only — never addresses or content — in the log.
  console.log(JSON.stringify({ considered: recipients.length, sent, failed, dry_run: dryRun }));
  return json({ considered: recipients.length, sent, failed, dry_run: dryRun,
    ...(dryRun ? { previews } : {}) });
});
