// Starts a founding therapist's billing when their first match arrives.
//
// The founding offer is free until the first member who matches the practice
// appears on the dashboard. pg_cron calls this every hour (with the shared
// key from app_secrets; verify_jwt is off because Postgres cannot mint a user
// JWT). founding_first_matches() in SQL says which founding therapists, still
// in their free period, now have a match. For each one this function:
//
//   1. moves the Stripe trial's end to FOUNDING_NOTICE_DAYS from now, so the
//      first charge, at the locked-in founding rate, lands a week later;
//   2. records profiles.first_match_at, so it is never done twice;
//   3. emails the therapist: the match is here, and the date billing begins.
//
// The Stripe webhook then syncs the new period end to the profile, and the
// Membership tab shows "Billing starts <date>". A therapist whose Stripe
// subscription is no longer trialing (an admin ended the trial by hand, say)
// is simply marked and skipped. An administrator can also call this with
// their session to run the check now.
import { admin, callerFrom, loadConfig } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { foundingBillingStart } from "../_shared/billing.ts";

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

  const { data: due, error } = await admin.rpc("founding_first_matches");
  if (error) return json({ error: "query_failed", message: error.message }, 500);

  const results: Array<{ user_id: string; started: boolean; sent: boolean; error: string | null }> = [];
  for (const d of (due ?? []) as Due[]) {
    const out = { user_id: d.user_id, started: false, sent: false, error: null as string | null };
    try {
      const { data: p } = await admin.from("profiles")
        .select("stripe_subscription_id, first_match_at").eq("id", d.user_id).maybeSingle();
      if (!p?.stripe_subscription_id || p.first_match_at) { results.push(out); continue; }

      const sub = await stripe.subscriptions.retrieve(p.stripe_subscription_id);
      const now = new Date();
      const starts = foundingBillingStart(now);
      if (sub.status === "trialing") {
        await stripe.subscriptions.update(sub.id, {
          trial_end: starts,
          proration_behavior: "none",
          metadata: { ...sub.metadata, founding_first_match: now.toISOString() },
        });
        out.started = true;
      }
      // Recorded whatever Stripe's state, so the check never repeats for this account.
      const { error: upErr } = await admin.from("profiles")
        .update({ first_match_at: now.toISOString() }).eq("id", d.user_id);
      if (upErr) throw new Error(upErr.message);

      if (out.started) {
        const to = await therapistEmail(d);
        if (to) {
          const msg = compose(d, rate, starts);
          const sent = await sendEmail(to, msg.subject, msg.html, msg.text);
          out.sent = sent.sent; out.error = sent.error;
        } else out.error = "no_email_on_file";
      }
    } catch (err) {
      out.error = String((err as Error)?.message ?? err);
    }
    // Identifiers and outcome only — never addresses or names — in the log.
    console.log(JSON.stringify(out));
    results.push(out);
  }

  return json({ ok: true, checked: (due ?? []).length, results });
});
