// Sends the morning email: an article the member has not seen lately, plus
// the same personalized daily picks the dashboard shows (affirmation, quote,
// tip, fun fact, journal prompt) — whichever the member chose on their account.
//
// verify_jwt is false because pg_cron calls this over HTTP and cannot mint a
// user JWT. Authenticity comes from the shared key in app_secrets. The one
// unauthenticated route is GET ?u=<token>, the unsubscribe link in every email.
//
// Who gets it, which article, and "once a day" are all decided in SQL
// (digest_recipients, digest_article, digest_sends) so the rules live next to
// the data. This file only composes and delivers.
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const SITE = (Deno.env.get("SITE_URL") || "https://theraglee.com").replace(/\/$/, "");
const SELF = `${Deno.env.get("SUPABASE_URL")}/functions/v1/daily-digest`;
const KINDS = ["article", "affirmation", "quote", "tip", "fun_fact", "journal_prompt"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const page = (title: string, body: string, s = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — Theraglee</title>` +
    `<style>body{font-family:system-ui,sans-serif;background:#FAFAF6;color:#16241C;margin:0;padding:60px 20px}` +
    `.card{max-width:480px;margin:0 auto;background:#fff;border:1px solid #E6E8E1;border-radius:18px;padding:34px}` +
    `h1{font-weight:500;font-size:1.5rem;margin:0 0 10px}p{color:#5A6760;line-height:1.5}` +
    `a.btn{display:inline-block;margin-top:14px;background:#187C1A;color:#fff;text-decoration:none;` +
    `padding:11px 22px;border-radius:100px}</style></head><body><div class="card">${body}</div></body></html>`,
    { status: s, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

type Recipient = {
  user_id: string; email: string; full_name: string | null; level: number;
  kinds: string[]; email_token: string;
};
type Pick = { id: string; body: string; author: string | null } | null;
type Article = {
  id: string; slug: string; title: string; excerpt: string | null; tags: string[] | null;
} | null;

/* ----------------------------------------------------------- composition -- */

async function gather(r: Recipient) {
  const kinds = (r.kinds || []).filter((k) => KINDS.includes(k));
  const picks: Record<string, Pick> = {};
  for (const k of kinds) {
    if (k === "article") continue;
    const { data } = await admin.rpc("daily_pick_for", { p_user: r.user_id, p_kind: k });
    picks[k] = (data as Pick[] | null)?.[0] ?? null;
  }
  let article: Article = null;
  if (kinds.includes("article")) {
    const { data } = await admin.rpc("digest_article", { p_user: r.user_id });
    article = (data as Article[] | null)?.[0] ?? null;
  }
  return { kinds, picks, article };
}

function compose(r: Recipient, picks: Record<string, Pick>, article: Article) {
  const first = (r.full_name || "").trim().split(/\s+/)[0];
  const hello = first ? `Good morning, ${first}.` : "Good morning.";
  const unsub = `${SELF}?u=${encodeURIComponent(r.email_token)}`;
  const trim = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  // Stored excerpts can stop mid-word; end on a whole word instead.
  const tidy = (s: string) => {
    const t = s.trim();
    if (!t || /[.!?…"”')]$/.test(t)) return t;
    const cut = t.lastIndexOf(" ");
    return (cut > 40 ? t.slice(0, cut) : t).replace(/[,;:\-]$/, "") + "…";
  };
  const excerpt = article?.excerpt ? tidy(article.excerpt) : "";

  const subject = article
    ? `Worth a read: ${article.title}`
    : picks.affirmation
    ? `This morning: ${trim(picks.affirmation.body, 60)}`
    : "Your Theraglee morning";

  const H = (label: string, inner: string) =>
    `<p style="margin:26px 0 6px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#8B978E;font-weight:600">${label}</p>${inner}`;
  const button = (href: string, label: string) =>
    `<p style="margin:14px 0 0"><a href="${href}" style="display:inline-block;background:#187C1A;color:#fff;` +
    `padding:10px 20px;border-radius:100px;text-decoration:none;font-size:14px">${label}</a></p>`;

  let html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#16241C">` +
    `<p style="color:#8B978E;font-size:13px;margin:0 0 14px">Theraglee · your morning</p>` +
    `<p style="font-size:17px;margin:0">${esc(hello)}</p>`;
  let text = `${hello}\n`;

  if (picks.affirmation) {
    html += `<p style="font-size:22px;line-height:1.35;font-style:italic;margin:18px 0 0">${esc(picks.affirmation.body)}</p>`;
    text += `\n${picks.affirmation.body}\n`;
  }
  if (article) {
    html += H("Today's article",
      `<div style="padding:18px 20px;background:#F0F7E2;border-radius:14px">` +
      `<p style="margin:0;font-size:18px;font-weight:500">${esc(article.title)}</p>` +
      (excerpt ? `<p style="margin:8px 0 0;color:#5A6760;line-height:1.5">${esc(excerpt)}</p>` : "") +
      button(`${SITE}/article.html?slug=${encodeURIComponent(article.slug)}`, "Read the article") +
      `</div>`);
    text += `\nToday's article: ${article.title}\n` +
      (excerpt ? `${excerpt}\n` : "") +
      `${SITE}/article.html?slug=${encodeURIComponent(article.slug)}\n`;
  }
  if (picks.quote) {
    html += H("Quote", `<p style="margin:0;font-style:italic;font-size:16px">“${esc(picks.quote.body)}”</p>` +
      `<p style="margin:4px 0 0;color:#8B978E;font-size:13px">— ${esc(picks.quote.author || "Unknown")}</p>`);
    text += `\n“${picks.quote.body}” — ${picks.quote.author || "Unknown"}\n`;
  }
  if (picks.tip) {
    html += H("Tip", `<p style="margin:0;line-height:1.5">${esc(picks.tip.body)}</p>`);
    text += `\nTip: ${picks.tip.body}\n`;
  }
  if (picks.fun_fact) {
    html += H("Did you know", `<p style="margin:0;line-height:1.5">${esc(picks.fun_fact.body)}</p>`);
    text += `\nDid you know: ${picks.fun_fact.body}\n`;
  }
  if (picks.journal_prompt) {
    const href = `${SITE}/journal.html?prompt=${encodeURIComponent(picks.journal_prompt.id)}`;
    html += H("Journal prompt", `<p style="margin:0;line-height:1.5">${esc(picks.journal_prompt.body)}</p>` +
      button(href, "Write about this"));
    text += `\nJournal prompt: ${picks.journal_prompt.body}\n${href}\n`;
  }

  html += `<p style="margin:30px 0 0;color:#5A6760;font-size:14px">Your <a href="${SITE}/dashboard.html" style="color:#187C1A">dashboard</a> ` +
    `keeps your favorites, checklists and challenges in one place.</p>` +
    `<hr style="border:0;border-top:1px solid #E6E8E1;margin:26px 0">` +
    `<p style="color:#8B978E;font-size:12px;line-height:1.5;margin:0">Theraglee is educational and supportive only — ` +
    `not medical advice, diagnosis or treatment. In crisis? Call or text 988 in the US, or call 911 if you are in danger.</p>` +
    `<p style="color:#8B978E;font-size:12px;margin:12px 0 0">You get this because the morning email is switched on for your account. ` +
    `<a href="${unsub}" style="color:#8B978E">Unsubscribe</a> · ` +
    `<a href="${SITE}/account.html#profile" style="color:#8B978E">Choose what's included</a></p></div>`;
  text += `\nYour dashboard: ${SITE}/dashboard.html\n\n` +
    `Theraglee is educational and supportive only — not medical advice, diagnosis or treatment. ` +
    `In crisis? Call or text 988 in the US, or call 911 if you are in danger.\n\n` +
    `Unsubscribe: ${unsub}\nChoose what's included: ${SITE}/account.html#profile\n`;

  return { subject, html, text, unsub };
}

/* -------------------------------------------------------------- delivery -- */

async function sendEmail(to: string, subject: string, html: string, text: string, unsub: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "email_not_configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM") || "Theraglee <notifications@theraglee.com>",
      to, subject, html, text,
      headers: { "List-Unsubscribe": `<${unsub}>` },
    }),
  });
  if (!res.ok) return { ok: false, error: `send failed ${res.status} ${(await res.text()).slice(0, 200)}` };
  return { ok: true, error: null };
}

/* ---------------------------------------------------------------- handler -- */

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // The unsubscribe link. No sign-in: the token is the proof.
  if (req.method === "GET") {
    const token = url.searchParams.get("u") || "";
    if (!UUID_RE.test(token)) {
      return page("Not found", `<h1>That link is not valid</h1>` +
        `<p>You can switch the morning email off from your account page instead.</p>` +
        `<a class="btn" href="${SITE}/account.html#profile">Open my account</a>`, 404);
    }
    const { data: ok, error } = await admin.rpc("digest_unsubscribe", { p_token: token });
    if (error) return page("Something went wrong", `<h1>Something went wrong</h1><p>Please try again in a moment.</p>`, 500);
    return ok
      ? page("Unsubscribed", `<h1>You're unsubscribed</h1>` +
          `<p>No more morning emails. Everything on the site works exactly as before, and you can switch them back on from your account page any time.</p>` +
          `<a class="btn" href="${SITE}/dashboard.html">Back to Theraglee</a>`)
      : page("Not found", `<h1>That link is not valid</h1>` +
          `<p>You can switch the morning email off from your account page instead.</p>` +
          `<a class="btn" href="${SITE}/account.html#profile">Open my account</a>`, 404);
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Scheduler auth: the shared key from app_secrets.
  const { data: secret } = await admin.from("app_secrets").select("value").eq("key", "digest_key").maybeSingle();
  const presented = req.headers.get("x-digest-key");
  if (!secret?.value || presented !== secret.value) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const dryRun = Boolean(body?.dry_run);
  const onlyUser = typeof body?.user_id === "string" && UUID_RE.test(body.user_id) ? body.user_id : null;

  if (!dryRun && !Deno.env.get("RESEND_API_KEY")) {
    return json({ error: "email_not_configured",
      message: "Set the RESEND_API_KEY secret on this project before the digest can send." }, 503);
  }

  // Who is due. A single user_id skips the once-a-day rule so the owner can
  // test against their own inbox; the scheduled run never passes one.
  let recipients: Recipient[] = [];
  if (onlyUser) {
    const { data: p } = await admin.from("profiles")
      .select("id, email, full_name, daily_email_kinds, email_token").eq("id", onlyUser).maybeSingle();
    const { data: level } = await admin.rpc("level_for", { p_user: onlyUser });
    if (p?.email) {
      recipients = [{ user_id: p.id, email: p.email, full_name: p.full_name, level: Number(level ?? 1),
        kinds: p.daily_email_kinds?.length ? p.daily_email_kinds : KINDS, email_token: p.email_token }];
    }
  } else {
    const { data, error } = await admin.rpc("digest_recipients", { p_limit: 300 });
    if (error) {
      console.error("recipients failed:", error.code ?? error.message);
      return json({ error: "recipients_failed" }, 500);
    }
    recipients = (data as Recipient[]) ?? [];
  }

  let sent = 0, skipped = 0, failed = 0;
  const previews: unknown[] = [];

  for (const r of recipients) {
    const { kinds, picks, article } = await gather(r);
    if (!article && !Object.values(picks).some(Boolean)) { skipped++; continue; }

    const msg = compose(r, picks, article);
    if (dryRun) {
      previews.push({ to: r.email, subject: msg.subject, article: article?.title ?? null,
        kinds: kinds.filter((k) => k === "article" ? Boolean(article) : Boolean(picks[k])), html: msg.html });
      continue;
    }

    const out = await sendEmail(r.email, msg.subject, msg.html, msg.text, msg.unsub);
    await admin.from("digest_sends").insert({
      user_id: r.user_id,
      article_id: article?.id ?? null,
      kinds: kinds.filter((k) => k === "article" ? Boolean(article) : Boolean(picks[k])),
      status: out.ok ? "sent" : "failed",
      error: out.error,
    });
    out.ok ? sent++ : failed++;
  }

  // Counts and identifiers only — never addresses or content — in the log.
  console.log(JSON.stringify({ considered: recipients.length, sent, skipped, failed, dry_run: dryRun }));
  return json({ considered: recipients.length, sent, skipped, failed, dry_run: dryRun,
    ...(dryRun ? { previews } : {}) });
});
