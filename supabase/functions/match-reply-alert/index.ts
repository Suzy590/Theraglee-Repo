// Emails a therapist when a member answers their Theraglee Match Mode message.
//
// The database calls this (trigger on outreach_replies, via pg_net) right
// after a reply is saved, with the shared key from app_secrets — the same
// arrangement as verify-license and the daily digest. verify_jwt is off
// because Postgres cannot mint a user JWT.
//
// The email goes to the therapist's contact address (or their sign-in email
// when the listing has none) and carries the member's name and message, the
// same things the therapist sees on the Member requests tab. The outcome is
// written back to the reply row (notified_at / notify_error) so the owner can
// see whether the alert went out.
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const SITE = (Deno.env.get("SITE_URL") || "https://theraglee.com").replace(/\/$/, "");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

type Reply = {
  id: string; therapist_id: string; member_id: string; member_name: string; message: string;
  created_at: string; notified_at: string | null;
};
type Therapist = { id: string; user_id: string; first_name: string; contact_email: string | null };

/** The address a therapist reads: the profile's contact email, else the sign-in email. */
async function therapistEmail(t: Therapist): Promise<string | null> {
  if (t.contact_email) return t.contact_email;
  const { data } = await admin.auth.admin.getUserById(t.user_id);
  return data?.user?.email ?? null;
}

function compose(t: Therapist, r: Reply) {
  const first = (t.first_name || "").trim();
  const hello = first ? `Hello, ${first}.` : "Hello.";
  const link = `${SITE}/therapist-dashboard.html#members`;
  const subject = `${r.member_name} replied to your Theraglee Match Mode message`;

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#16241C">` +
    `<p style="color:#8B978E;font-size:13px;margin:0 0 14px">Theraglee · Match Mode</p>` +
    `<p style="font-size:17px;margin:0">${esc(hello)}</p>` +
    `<p style="margin:14px 0 0;line-height:1.5">A member you reached out to has written back, and they have given you their name: ` +
    `<strong>${esc(r.member_name)}</strong>.</p>` +
    `<div style="margin:18px 0 0;padding:18px 20px;background:#F0F7E2;border-radius:14px">` +
    `<p style="margin:0;white-space:pre-wrap;line-height:1.5">${esc(r.message)}</p></div>` +
    `<p style="margin:18px 0 0"><a href="${link}" style="display:inline-block;background:#187C1A;color:#fff;` +
    `padding:10px 20px;border-radius:100px;text-decoration:none;font-size:14px">Write back on your dashboard</a></p>` +
    `<p style="margin:18px 0 0;color:#5A6760;font-size:14px;line-height:1.5">Replies go through Theraglee, so neither ` +
    `of you shares an email address. The member does not see this address.</p>` +
    `<hr style="border:0;border-top:1px solid #E6E8E1;margin:26px 0">` +
    `<p style="color:#8B978E;font-size:12px;line-height:1.5;margin:0">You get this because a member answered a ` +
    `Theraglee Match Mode message you sent. Replies from members always show on your practice dashboard as well.</p></div>`;

  const text =
    `${hello}\n\nA member you reached out to has written back, and they have given you their name: ${r.member_name}.\n\n` +
    `${r.message}\n\nWrite back on your dashboard: ${link}\n\n` +
    `Replies go through Theraglee, so neither of you shares an email address. The member does not see this address.\n`;

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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Only the database may call this: the shared key from app_secrets.
  const { data: secret } = await admin.from("app_secrets").select("value").eq("key", "match_hook_key").maybeSingle();
  const presented = req.headers.get("x-match-key");
  if (!secret?.value || presented !== secret.value) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const replyId = typeof body?.reply_id === "string" && UUID_RE.test(body.reply_id) ? body.reply_id : null;
  if (!replyId) return json({ error: "reply_id_required" }, 400);

  const { data: r } = await admin.from("outreach_replies")
    .select("id, therapist_id, member_id, member_name, message, created_at, notified_at")
    .eq("id", replyId).maybeSingle();
  if (!r) return json({ error: "reply_not_found" }, 404);
  if ((r as Reply).notified_at) return json({ ok: true, already: true });

  const { data: t } = await admin.from("therapist_profiles")
    .select("id, user_id, first_name, contact_email").eq("id", (r as Reply).therapist_id).maybeSingle();
  if (!t) return json({ error: "therapist_not_found" }, 404);

  const to = await therapistEmail(t as Therapist);
  const record = async (error: string | null) => {
    await admin.from("outreach_replies")
      .update({ notified_at: error ? null : new Date().toISOString(), notify_error: error })
      .eq("id", replyId);
  };
  if (!to) { await record("no_email_on_file"); return json({ ok: false, error: "no_email_on_file" }); }

  const msg = compose(t as Therapist, r as Reply);
  const out = await sendEmail(to, msg.subject, msg.html, msg.text);
  await record(out.error);

  // Identifiers and outcome only — never addresses, names or content — in the log.
  console.log(JSON.stringify({ reply_id: replyId, sent: out.sent, error: out.error }));
  return json({ ok: out.sent, error: out.error });
});
