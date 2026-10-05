// Takes a member's message to a therapist ("Send a message" on a profile)
// and puts it in the therapist's Theraglee inbox: a therapist_messages row,
// shown on the Messages tab of the practice dashboard. The therapist answers
// from there and the answer lands in the member's Theraglee inbox
// (therapist_message_replies), so no email address travels in either
// direction.
//
// The sender must be signed in: a reply needs an inbox to land in. The
// member's account email is kept on the row for the record and for the rate
// limits, but the therapist is never shown it.
//
// verify_jwt is off because the browser's own token is checked here, so a
// visitor without an account gets a friendly "sign in" answer rather than a
// bare 401 from the gateway. This function is the only writer to
// therapist_messages: the table has no insert policy for anon or
// authenticated, so the public API cannot be used to post directly.
//
// The therapist gets a short email saying a message is waiting, with a link
// to the dashboard. The message itself, and the member's details, stay on
// Theraglee.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const SITE = (Deno.env.get("SITE_URL") || "https://theraglee.com").replace(/\/$/, "");

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type Therapist = {
  id: string; user_id: string; first_name: string; last_name: string; credentials: string | null;
  contact_email: string | null; slug: string; published: boolean; verification: string;
};

/** The address a therapist reads: the profile's contact email, else the sign-in email. */
async function therapistEmail(t: Therapist): Promise<string | null> {
  if (t.contact_email) return t.contact_email;
  const { data } = await admin.auth.admin.getUserById(t.user_id);
  return data?.user?.email ?? null;
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") || "Theraglee <notifications@theraglee.com>";
  if (!key) return { sent: false, error: "email_not_configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) return { sent: false, error: `${res.status} ${await res.text()}` };
  return { sent: true, error: null };
}

/** The heads-up the therapist gets: a message is waiting on the dashboard. */
function compose(t: Therapist, name: string) {
  const first = (t.first_name || "").trim();
  const hello = first ? `Hello, ${first}.` : "Hello.";
  const link = `${SITE}/therapist-dashboard.html#messages`;
  const subject = `${name} sent you a message on Theraglee`;

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#16241C">` +
    `<p style="color:#8B978E;font-size:13px;margin:0 0 14px">Theraglee · Messages</p>` +
    `<p style="font-size:17px;margin:0">${esc(hello)}</p>` +
    `<p style="margin:14px 0 0;line-height:1.5"><strong>${esc(name)}</strong> wrote to you from your Theraglee profile. ` +
    `The message is waiting in your Theraglee inbox.</p>` +
    `<p style="margin:18px 0 0"><a href="${link}" style="display:inline-block;background:#187C1A;color:#fff;` +
    `padding:10px 20px;border-radius:100px;text-decoration:none;font-size:14px">Read and reply on your dashboard</a></p>` +
    `<p style="margin:18px 0 0;color:#5A6760;font-size:14px;line-height:1.5">Reply there and your answer goes to their ` +
    `Theraglee inbox. Neither of you sees the other's email address.</p>` +
    `<hr style="border:0;border-top:1px solid #E6E8E1;margin:26px 0">` +
    `<p style="color:#8B978E;font-size:12px;line-height:1.5;margin:0">You get this because someone wrote to you ` +
    `through your Theraglee listing. Messages always show on your practice dashboard as well.</p></div>`;

  const text =
    `${hello}\n\n${name} wrote to you from your Theraglee profile. The message is waiting in your Theraglee inbox.\n\n` +
    `Read and reply on your dashboard: ${link}\n\n` +
    `Reply there and your answer goes to their Theraglee inbox. Neither of you sees the other's email address.\n`;

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const {
      therapist_slug, sender_name, sender_phone,
      message, preferred_times, company, // `company` is a honeypot
    } = body;

    // Bots fill hidden fields; people do not.
    if (company) return json({ ok: true });

    // The sender has to be signed in: the reply goes to their Theraglee inbox.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: null };
    const user = auth?.user ?? null;
    if (!user) {
      return json({ error: "sign_in",
        message: "Sign in to send a message. The reply comes to your Theraglee inbox." }, 401);
    }
    const email = String(user.email ?? "").trim().toLowerCase();
    if (!email) return json({ error: "sign_in", message: "Your account needs an email address first." }, 401);

    const name = String(sender_name ?? "").trim();
    const text = String(message ?? "").trim();

    if (!therapist_slug) return json({ error: "bad_request", message: "Missing therapist." }, 400);
    if (name.length < 2)  return json({ error: "bad_name",  message: "Please enter your name." }, 400);
    if (text.length < 10)
      return json({ error: "bad_message", message: "Please write a little more so they can help." }, 400);
    if (text.length > 4000)
      return json({ error: "bad_message", message: "That message is too long — please keep it under 4000 characters." }, 400);

    // Resolve the listing. Only published, verified listings accept mail.
    const { data: t } = await admin
      .from("therapist_profiles")
      .select("id, user_id, first_name, last_name, credentials, contact_email, slug, published, verification")
      .eq("slug", therapist_slug)
      .maybeSingle<Therapist>();

    if (!t || !t.published || t.verification !== "verified") {
      return json({ error: "not_available", message: "That profile is not accepting messages." }, 404);
    }

    // ---- rate limits ----
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();

    const { count: toThisTherapist } = await admin
      .from("therapist_messages").select("id", { count: "exact", head: true })
      .eq("therapist_id", t.id).eq("sender_user_id", user.id).gte("created_at", dayAgo);
    if ((toThisTherapist ?? 0) >= 3) {
      return json({ error: "rate_limited",
        message: "You have already messaged this therapist today. Watch your Theraglee inbox for their reply." }, 429);
    }

    const { count: fromSender } = await admin
      .from("therapist_messages").select("id", { count: "exact", head: true })
      .eq("sender_user_id", user.id).gte("created_at", hourAgo);
    if ((fromSender ?? 0) >= 10) {
      return json({ error: "rate_limited", message: "Too many messages just now. Please try again later." }, 429);
    }

    const { data: row, error: insErr } = await admin
      .from("therapist_messages")
      .insert({
        therapist_id: t.id,
        sender_user_id: user.id,
        sender_name: name,
        sender_email: email,
        sender_phone: String(sender_phone ?? "").trim() || null,
        message: text,
        preferred_times: String(preferred_times ?? "").trim() || null,
      })
      .select("id").single();

    if (insErr) {
      console.error("insert failed", insErr);
      return json({ error: "server_error", message: "Could not send that just now." }, 500);
    }

    // Counts toward the therapist's referral reporting.
    await admin.from("therapist_events").insert({
      therapist_id: t.id, event_type: "email", actor_id: user.id,
    });

    // ---- the heads-up ----
    // The message is in the therapist's inbox either way; this only tells
    // them to look. Nothing the member wrote, and no address, is in it.
    const who = `${t.first_name} ${t.last_name}${t.credentials ? ", " + t.credentials : ""}`;
    let delivery = "pending", deliveryError: string | null = null, deliveredAt: string | null = null;
    const to = await therapistEmail(t);
    if (to) {
      const { subject, html, text: plain } = compose(t, name);
      const r = await sendEmail(to, subject, html, plain);
      if (r.sent) { delivery = "sent"; deliveredAt = new Date().toISOString(); }
      else { deliveryError = r.error; }
    } else {
      deliveryError = "no_email_on_file";
    }

    await admin.from("therapist_messages")
      .update({ delivery, delivered_at: deliveredAt, delivery_error: deliveryError })
      .eq("id", row.id);

    return json({
      ok: true,
      therapist: who,
      delivered: delivery === "sent",
      message: `${t.first_name} has it in their Theraglee inbox. Their reply comes to yours: ` +
        `the Messages tab on your dashboard.`,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "server_error", message: "Something went wrong sending that." }, 500);
  }
});
