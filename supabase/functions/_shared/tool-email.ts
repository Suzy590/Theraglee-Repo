// The Sunday tool email, shared by the function that welcomes a new reader and
// the one that sends the weekly round.
//
// House rule, and the reason this lives in one file: every email features one
// free tool and ends with exactly one soft nudge toward a paid membership.
// Never a second pitch anywhere in the message.
import { admin } from "./supabase.ts";

export const SITE = (Deno.env.get("SITE_URL") || "https://theraglee.com").replace(/\/$/, "");
export const UNSUB_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1/weekly-tools`;

export type Tool = {
  slug: string; title: string; description: string; topic: string; minutes: number;
};

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** The one nudge, with a count that is read from the library rather than guessed. */
async function upgradeLine(): Promise<{ html: string; text: string }> {
  const [{ count: quizzes }, { count: worksheets }] = await Promise.all([
    admin.from("quizzes").select("*", { count: "exact", head: true }),
    admin.from("worksheets").select("*", { count: "exact", head: true }),
  ]);
  const total = (quizzes ?? 0) + (worksheets ?? 0);
  const many = total > 50 ? `${Math.floor(total / 10) * 10}+ scored quizzes and interactive worksheets` : "the full tool library";
  return {
    html: `<p style="margin:0;color:#5A6760;font-size:14px;line-height:1.55">Basic members get ${esc(many)}, ` +
      `saved and tracked. <a href="${SITE}/pricing.html" style="color:#187C1A">See what's included</a>.</p>`,
    text: `Basic members get ${many}, saved and tracked. See what's included: ${SITE}/pricing.html\n`,
  };
}

/** One message: a greeting, one tool, one nudge, and the way out. */
export async function composeToolEmail(tool: Tool, token: string, opts: { welcome?: boolean } = {}) {
  const unsub = `${UNSUB_BASE}?u=${encodeURIComponent(token)}`;
  const href = `${SITE}/discover.html?slug=${encodeURIComponent(tool.slug)}`;
  const nudge = await upgradeLine();

  const subject = opts.welcome
    ? `Your first Theraglee tool: ${tool.title}`
    : `This week's tool: ${tool.title}`;

  const opener = opts.welcome
    ? "Thanks for asking. Here is your first one, and another will land on Sunday morning."
    : "Good morning. Here is this week's tool.";

  const html =
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#FAFAF6;` +
    `color:#16241C;max-width:560px;margin:0 auto;padding:30px 24px">` +
    `<p style="color:#8B978E;font-size:13px;margin:0 0 18px">Theraglee · one free tool a week</p>` +
    `<p style="margin:0 0 22px;line-height:1.55">${esc(opener)}</p>` +
    `<div style="background:#fff;border:1px solid #E6E8E1;border-radius:18px;padding:24px">` +
    `<p style="margin:0 0 6px;color:#8B978E;font-size:12px;text-transform:uppercase;letter-spacing:.06em">` +
    `${esc(tool.topic)} · ${Number(tool.minutes) || 5} min</p>` +
    `<h1 style="margin:0 0 10px;font-size:1.32rem;font-weight:500;line-height:1.3">${esc(tool.title)}</h1>` +
    `<p style="margin:0 0 18px;color:#5A6760;line-height:1.55">${esc(tool.description)}</p>` +
    `<a href="${href}" style="display:inline-block;background:#187C1A;color:#fff;text-decoration:none;` +
    `padding:11px 22px;border-radius:100px;font-size:15px">Try it now</a>` +
    `<p style="margin:14px 0 0;color:#8B978E;font-size:13px">No account needed. Nothing you enter is stored on our side.</p>` +
    `</div>` +
    `<div style="margin:26px 0 0">${nudge.html}</div>` +
    `<hr style="border:0;border-top:1px solid #E6E8E1;margin:26px 0">` +
    `<p style="color:#8B978E;font-size:12px;line-height:1.5;margin:0">Theraglee is educational and supportive only — ` +
    `not medical advice, diagnosis or treatment. In crisis? Call or text 988 in the US, or call 911 if you are in danger.</p>` +
    `<p style="color:#8B978E;font-size:12px;margin:12px 0 0">You get this because you asked for a free tool each week at theraglee.com. ` +
    `<a href="${unsub}" style="color:#8B978E">Unsubscribe</a> — one click, no questions.</p></div>`;

  const text =
    `${opener}\n\n${tool.title}\n${tool.topic} · ${Number(tool.minutes) || 5} min\n\n` +
    `${tool.description}\n\nTry it now: ${href}\nNo account needed.\n\n${nudge.text}\n` +
    `Theraglee is educational and supportive only — not medical advice, diagnosis or treatment. ` +
    `In crisis? Call or text 988 in the US, or call 911 if you are in danger.\n\n` +
    `Unsubscribe: ${unsub}\n`;

  return { subject, html, text, unsub };
}

/** Hands the message to Resend, the provider the rest of the site already uses. */
export async function sendToolEmail(
  to: string, msg: { subject: string; html: string; text: string; unsub: string },
) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "email_not_configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM") || "Theraglee <notifications@theraglee.com>",
      to, subject: msg.subject, html: msg.html, text: msg.text,
      headers: {
        "List-Unsubscribe": `<${msg.unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) return { ok: false, error: `send failed ${res.status} ${(await res.text()).slice(0, 200)}` };
  return { ok: true, error: null as string | null };
}

/** The small page the unsubscribe link lands on. */
export const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — Theraglee</title>` +
    `<style>body{font-family:system-ui,sans-serif;background:#FAFAF6;color:#16241C;margin:0;padding:60px 20px}` +
    `.card{max-width:480px;margin:0 auto;background:#fff;border:1px solid #E6E8E1;border-radius:18px;padding:34px}` +
    `h1{font-weight:500;font-size:1.5rem;margin:0 0 10px}p{color:#5A6760;line-height:1.5}` +
    `a.btn{display:inline-block;margin-top:14px;background:#187C1A;color:#fff;text-decoration:none;` +
    `padding:11px 22px;border-radius:100px}</style></head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
