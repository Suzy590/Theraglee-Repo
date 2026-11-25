// Starts a founding therapist's billing when their first match arrives.
//
// The founding offer is free until the first match. A match is a regular
// (non-therapist) member whose pseudonymous Match Mode profile fits the
// therapist's listing and so appears on the therapist's dashboard; it is not
// a guarantee that the member will schedule a session.
//
// pg_cron calls this every hour (with the shared key from app_secrets;
// verify_jwt is off because Postgres cannot mint a user JWT).
// founding_first_matches() in SQL says which founding therapists, still in
// their free period, now have a match. For each one this function, in this
// order:
//
//   1. emails the therapist: the match is here, and the date billing begins,
//      FOUNDING_NOTICE_DAYS from now; then records that the notice went out
//      (profiles.first_match_notice_at);
//   2. only then moves the Stripe trial's end to that date, so the first
//      charge, at the locked-in founding rate, lands a week later;
//   3. records profiles.first_match_at, so it is never done twice.
//
// The order is the promise: no notice, no charge. If the email cannot be
// sent, nothing changes in Stripe and the next hourly run tries again. If the
// email went out but a later step failed, the next run finishes the job with
// the date the email gave (foundingPromisedStart) instead of sending another.
// The first failure for an account is written to billing_alerts and emailed
// to the administrator (app_config.admin_email); the row is closed when the
// job goes through.
//
// The Stripe webhook then syncs the new period end to the profile, and the
// Membership tab shows "Billing starts <date>". A therapist whose Stripe
// subscription is no longer trialing (an admin ended the trial by hand, say)
// is simply marked and skipped. An administrator can also call this with
// their session to run the check now.
import { admin, callerFrom, loadConfig } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { foundingBillingStart, foundingPromisedStart, MATCH_MEANS } from "../_shared/billing.ts";

const SITE = (Deno.env.get("SITE_URL") || "https://theraglee.com").replace(/\/$/, "");

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

type Due = {
  user_id: string; therapist_id: string; first_name: string | null;
  contact_email: string | null; email: string | null;
};

/** The address a therapist reads: the listing's contact email, else the sign-in email. */
async function therapistEmail(d: Due): Promise<string | null> {
  if (d.contact_email) return d.contact_email;
  if (d.email) return d.email;
  const { data } = await admin.auth.admin.getUserById(d.user_id);
  return data?.user?.email ?? null;
}

const longDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function compose(d: Due, rate: string, startsUnix: number) {
  const first = (d.first_name || "").trim();
  const hello = first ? `Hello, ${first}.` : "Hello.";
  const when = longDate(startsUnix);
  const dash = `${SITE}/therapist-dashboard.html#home`;
  const member = `${SITE}/therapist-dashboard.html#membership`;
  const subject = "Your first Theraglee match is here";

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#16241C">` +
    `<p style="color:#8B978E;font-size:13px;margin:0 0 14px">Theraglee · Founding member</p>` +
    `<p style="font-size:17px;margin:0">${esc(hello)}</p>` +
    `<p style="margin:14px 0 0;line-height:1.5">The first member who matches your practice has appeared on your ` +
    `dashboard. They have Theraglee Match Mode on, which means they asked for a therapist like you to reach out.</p>` +
    `<p style="margin:18px 0 0"><a href="${dash}" style="display:inline-block;background:#187C1A;color:#fff;` +
    `padding:10px 20px;border-radius:100px;text-decoration:none;font-size:14px">See your match</a></p>` +
    `<div style="margin:22px 0 0;padding:18px 20px;background:#F0F7E2;border-radius:14px;line-height:1.5">` +
    `<p style="margin:0"><strong>About your membership.</strong> As promised, your founding membership has been free ` +
    `until this moment. Billing begins on <strong>${esc(when)}</strong> at your locked-in founding rate of ` +
    `<strong>$${esc(rate)} a month</strong>, charged to the card you saved, and the rate stays the same for as long ` +
    `as your membership stays continuously active. Nothing is charged before that date.</p></div>` +
    `<p style="margin:18px 0 0;color:#5A6760;font-size:14px;line-height:1.5">${esc(MATCH_MEANS)}</p>` +
    `<p style="margin:18px 0 0;color:#5A6760;font-size:14px;line-height:1.5">You can see the date, update your card ` +
    `or cancel any time from the <a href="${member}" style="color:#187C1A">Membership tab</a>. Canceling before ` +
    `${esc(when)} means you are never charged, though the founding rate ends with the membership.</p>` +
    `<hr style="border:0;border-top:1px solid #E6E8E1;margin:26px 0">` +
    `<p style="color:#8B978E;font-size:12px;line-height:1.5;margin:0">You get this because you joined Theraglee on ` +
    `the founding offer, which is free until your first member match. This is the notice before your first charge.</p></div>`;

  const text =
    `${hello}\n\nThe first member who matches your practice has appeared on your dashboard. They have Theraglee ` +
    `Match Mode on, which means they asked for a therapist like you to reach out.\n\nSee your match: ${dash}\n\n` +
    `About your membership: as promised, your founding membership has been free until this moment. Billing begins ` +
    `on ${when} at your locked-in founding rate of $${rate} a month, charged to the card you saved, and the rate ` +
    `stays the same for as long as your membership stays continuously active. Nothing is charged before that date.\n\n` +
    `${MATCH_MEANS}\n\n` +
    `You can see the date, update your card or cancel any time from the Membership tab: ${member}\n` +
    `Canceling before ${when} means you are never charged, though the founding rate ends with the membership.\n\n` +
    `You get this because you joined Theraglee on the founding offer, which is free until your first member match. ` +
    `This is the notice before your first charge.\n`;

  return { subject, html, text };
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { sent: false, error: "email_not_configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM") || "Theraglee <notifications@theraglee.com>",
      to, subject, html, text,
    }),
  });
  if (!res.ok) return { sent: false, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
  return { sent: true, error: null };
}

/* ------------------------------------------------------------- alerts -- */

/** Where a run stopped: reading the membership, sending the notice, starting billing in Stripe, or recording it. */
type Stage = "lookup" | "notice" | "billing" | "record";

const ALERT_KIND = "founding_notice";

/** What the administrator reads. The account id only, never a name or an address. */
function alertSummary(stage: Stage, userId: string, error: string): string {
  const who = `founding therapist ${userId}`;
  const again = "The check tries again every hour.";
  if (stage === "lookup") {
    return `The first match for ${who} has arrived, but their membership could not be read (${error}). ` +
      `No email has been sent and their billing has not been started. ${again}`;
  }
  if (stage === "notice") {
    return `The email announcing the first charge to ${who} could not be sent (${error}). ` +
      `Their billing has not been started and will not be until the email goes out. ${again}`;
  }
  if (stage === "billing") {
    return `The email announcing the first charge to ${who} went out, but Stripe did not start their billing ` +
      `(${error}). ${again} It keeps the date the email gave.`;
  }
  return `The first charge for ${who} is announced and scheduled in Stripe, but their profile could not be ` +
    `updated (${error}). ${again}`;
}

/**
 * Tells the administrator once per account: a row in billing_alerts, and an
 * email if app_config.admin_email is set. While that row is open the hourly
 * retries stay quiet. Never throws; the run goes on to the next therapist.
 */
async function raiseAlert(
  userId: string, stage: Stage, error: string, subId: string | null, customerId: string | null, adminEmail: string,
) {
  try {
    const { data: open } = await admin.from("billing_alerts").select("id")
      .eq("kind", ALERT_KIND).eq("user_id", userId).is("resolved_at", null).limit(1);
    if (open?.length) return;

    const summary = alertSummary(stage, userId, error);
    const { error: insErr } = await admin.from("billing_alerts").insert({
      kind: ALERT_KIND, stripe_id: subId ?? "none", customer_id: customerId, user_id: userId,
      summary, raw: { stage, error },
    });
    // Without the row there is nothing to keep the next run quiet, so no email either.
    if (insErr) { console.warn("billing alert not saved", insErr.message); return; }
    if (!adminEmail) return;

    const subject = "Theraglee: a founding therapist's first-charge notice needs a look";
    const where = `${SITE}/admin.html`;
    const html =
      `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#16241C">` +
      `<p style="color:#8B978E;font-size:13px;margin:0 0 14px">Theraglee · Billing alert</p>` +
      `<p style="margin:0;line-height:1.5">${esc(summary)}</p>` +
      `<p style="margin:14px 0 0;color:#5A6760;font-size:14px;line-height:1.5">A founding therapist is never charged ` +
      `before the email with the date has gone out. You will not get this message again for the same account ` +
      `unless it fails anew after going through. Admin: <a href="${where}" style="color:#187C1A">${esc(where)}</a></p></div>`;
    const text = `${summary}\n\nA founding therapist is never charged before the email with the date has gone out. ` +
      `You will not get this message again for the same account unless it fails anew after going through.\n\n` +
      `Admin: ${where}\n`;
    const sent = await sendEmail(adminEmail, subject, html, text);
    if (!sent.sent) console.warn("billing alert email not sent", sent.error);
  } catch (err) {
    console.warn("billing alert failed", String((err as Error)?.message ?? err));
  }
}

/** Closes the account's open alert once its billing has been started (or there was nothing to start). */
async function closeAlerts(userId: string) {
  const { error } = await admin.from("billing_alerts").update({ resolved_at: new Date().toISOString() })
    .eq("kind", ALERT_KIND).eq("user_id", userId).is("resolved_at", null);
  if (error) console.warn("billing alert not closed", error.message);
}

/** Whether the request may run the check: the database's key, or an administrator's session. */
async function allowed(req: Request): Promise<boolean> {
  const { data: secret } = await admin.from("app_secrets").select("value").eq("key", "founding_key").maybeSingle();
  const presented = req.headers.get("x-founding-key");
  if (secret?.value && presented === secret.value) return true;
  const caller = await callerFrom(req);
  return caller?.profile.role === "admin";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!(await allowed(req))) return json({ error: "forbidden" }, 403);

  const stripe = stripeClient();
  if (!stripe) return json({ error: "billing_not_configured" }, 503);

  const cfg = await loadConfig();
  const rate = (cfg.display_therapist_founding ?? "").trim() || "20";
  const adminEmail = (cfg.admin_email ?? "").trim();

  const { data: due, error } = await admin.rpc("founding_first_matches");
  if (error) return json({ error: "query_failed", message: error.message }, 500);

  const results: Array<{ user_id: string; started: boolean; sent: boolean; error: string | null }> = [];
  for (const d of (due ?? []) as Due[]) {
    const out = { user_id: d.user_id, started: false, sent: false, error: null as string | null };
    let stage: Stage = "lookup";
    let subId: string | null = null;
    let customerId: string | null = null;
    try {
      const { data: p, error: readErr } = await admin.from("profiles")
        .select("stripe_subscription_id, stripe_customer_id, first_match_at, first_match_notice_at")
        .eq("id", d.user_id).maybeSingle();
      if (readErr) throw new Error(readErr.message);
      if (!p?.stripe_subscription_id || p.first_match_at) { results.push(out); continue; }
      subId = p.stripe_subscription_id;
      customerId = p.stripe_customer_id ?? null;

      const sub = await stripe.subscriptions.retrieve(p.stripe_subscription_id);
      const now = new Date();

      if (sub.status !== "trialing") {
        // No free period left to end (an admin ended the trial by hand, say):
        // recorded, so the check never repeats for this account.
        stage = "record";
        const { error: upErr } = await admin.from("profiles")
          .update({ first_match_at: now.toISOString() }).eq("id", d.user_id);
        if (upErr) throw new Error(upErr.message);
        await closeAlerts(d.user_id);
        console.log(JSON.stringify(out));
        results.push(out);
        continue;
      }

      // 1. The notice. An earlier run may already have sent it and then failed
      //    to start billing; that email's date stands, and no second one goes.
      stage = "notice";
      let starts = foundingPromisedStart(p.first_match_notice_at, now);
      if (starts === null) {
        const to = await therapistEmail(d);
        if (!to) throw new Error("no_email_on_file");
        starts = foundingBillingStart(now);
        const msg = compose(d, rate, starts);
        const sent = await sendEmail(to, msg.subject, msg.html, msg.text);
        if (!sent.sent) throw new Error(sent.error ?? "email_not_sent");
        out.sent = true;
        // If this cannot be saved the email is still out, so billing may
        // start; at worst a failed run sends the notice once more.
        const { error: noteErr } = await admin.from("profiles")
          .update({ first_match_notice_at: now.toISOString() }).eq("id", d.user_id);
        if (noteErr) console.warn("first_match_notice_at not saved", d.user_id, noteErr.message);
      }

      // 2. Only now does the free period get an end: the date in the email.
      stage = "billing";
      await stripe.subscriptions.update(sub.id, {
        trial_end: starts,
        proration_behavior: "none",
        metadata: { ...sub.metadata, founding_first_match: now.toISOString() },
      });
      out.started = true;

      // 3. Recorded, so the check never repeats for this account.
      stage = "record";
      const { error: upErr } = await admin.from("profiles")
        .update({ first_match_at: now.toISOString() }).eq("id", d.user_id);
      if (upErr) throw new Error(upErr.message);
      await closeAlerts(d.user_id);
    } catch (err) {
      out.error = String((err as Error)?.message ?? err);
      await raiseAlert(d.user_id, stage, out.error, subId, customerId, adminEmail);
    }
    // Identifiers and outcome only — never addresses or names — in the log.
    console.log(JSON.stringify({ ...out, ...(out.error ? { stage } : {}) }));
    results.push(out);
  }

  return json({ ok: true, checked: (due ?? []).length, results });
});
