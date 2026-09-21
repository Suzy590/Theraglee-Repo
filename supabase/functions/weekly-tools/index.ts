// Sunday morning: one free tool to everyone on the list, and the one-click
// unsubscribe link that every email carries.
//
// verify_jwt is false because pg_cron calls this over HTTP and cannot mint a
// user JWT. Authenticity for the send comes from the shared key in
// app_secrets. The unauthenticated route is GET ?u=<token>, where the token is
// the only proof needed to leave.
import { admin } from "../_shared/supabase.ts";
import { json, readBody } from "../_shared/http.ts";
import { composeToolEmail, page, sendToolEmail, SITE, type Tool } from "../_shared/tool-email.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const goneWrong = () =>
  page("That link is not valid",
    `<h1>That link is not valid</h1><p>It may have already been used. If you are still getting ` +
    `these emails, reply to one and we will take you off by hand.</p>` +
    `<a class="btn" href="${SITE}/">Back to Theraglee</a>`, 404);

async function unsubscribe(token: string) {
  if (!UUID_RE.test(token)) return goneWrong();
  const { data: ok, error } = await admin.rpc("tool_email_unsubscribe", { p_token: token });
  if (error) {
    console.error("unsubscribe failed:", error.code ?? error.message);
    return page("Something went wrong",
      `<h1>Something went wrong</h1><p>Please try that link again in a moment.</p>`, 500);
  }
  return ok
    ? page("Unsubscribed",
        `<h1>You're unsubscribed</h1><p>No more Sunday emails, and we have kept nothing else. ` +
        `Everything on the site is still open to you, with no account needed.</p>` +
        `<a class="btn" href="${SITE}/discover.html">Browse the free tools</a>`)
    : goneWrong();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // One click out of the list. Mail clients may send either verb.
  if (req.method === "GET" || (req.method === "POST" && url.searchParams.has("u"))) {
    return await unsubscribe(url.searchParams.get("u") || "");
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { data: secret } = await admin.from("app_secrets")
    .select("value").eq("key", "weekly_tools_key").maybeSingle();
  if (!secret?.value || req.headers.get("x-tools-key") !== secret.value) {
    return json({ error: "forbidden" }, 403);
  }

  const body = await readBody(req);
  const dryRun = Boolean(body.dry_run);

  if (!dryRun && !Deno.env.get("RESEND_API_KEY")) {
    return json({ error: "email_not_configured",
      message: "Set the RESEND_API_KEY secret on this project before the weekly tool email can send." }, 503);
  }

  const { data, error } = await admin.rpc("tool_email_recipients", { p_limit: 500 });
  if (error) {
    console.error("recipients failed:", error.code ?? error.message);
    return json({ error: "recipients_failed" }, 500);
  }
  const recipients = (data ?? []) as { id: string; email: string; token: string; sent_count: number }[];

  let sent = 0, skipped = 0, failed = 0;
  const previews: unknown[] = [];

  for (const r of recipients) {
    const { data: picks } = await admin.rpc("weekly_tool_next", { p_subscriber: r.id });
    const tool = (picks as Tool[] | null)?.[0];
    if (!tool) { skipped++; continue; }

    const msg = await composeToolEmail(tool, r.token);
    if (dryRun) { previews.push({ subject: msg.subject, tool: tool.slug }); continue; }

    const out = await sendToolEmail(r.email, msg);
    await admin.from("tool_email_sends").insert({
      subscriber_id: r.id, tool_slug: tool.slug,
      status: out.ok ? "sent" : "failed", error: out.error,
    });
    if (out.ok) {
      await admin.from("tool_subscribers")
        .update({ last_sent_at: new Date().toISOString(), sent_count: r.sent_count + 1 })
        .eq("id", r.id);
      sent++;
    } else {
      failed++;
    }
  }

  // Counts only — never an address, never the body of a message.
  console.log(JSON.stringify({ considered: recipients.length, sent, skipped, failed, dry_run: dryRun }));
  return json({ considered: recipients.length, sent, skipped, failed, dry_run: dryRun,
    ...(dryRun ? { previews } : {}) });
});
