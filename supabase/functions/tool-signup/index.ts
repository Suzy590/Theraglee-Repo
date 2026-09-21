// "Not ready for an account? Start with your inbox." — the homepage form posts
// here. One address in, one welcome email with the first free tool out, and a
// place on the Sunday list.
//
// verify_jwt is false: the whole point is that the person has no account.
// Nothing here can trigger a bulk send; that lives in weekly-tools behind the
// scheduler's key.
import { admin } from "../_shared/supabase.ts";
import { CORS, json, readBody } from "../_shared/http.ts";
import { composeToolEmail, sendToolEmail, type Tool } from "../_shared/tool-email.ts";

// Deliberately loose: the address has to survive a real send, and the database
// holds the same shape as a check constraint.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await readBody(req);
  const email = String(body.email ?? "").trim().toLowerCase();
  const source = String(body.source ?? "homepage").slice(0, 60);

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: "bad_email", message: "That email address does not look right." }, 400);
  }

  // Already on the list: say yes without sending a second welcome. Someone who
  // unsubscribed and came back is switched on again.
  const { data: existing } = await admin
    .from("tool_subscribers")
    .select("id, token, unsubscribed_at, sent_count")
    .eq("email", email)
    .maybeSingle();

  let row = existing;
  if (existing) {
    if (existing.unsubscribed_at) {
      await admin.from("tool_subscribers")
        .update({ unsubscribed_at: null }).eq("id", existing.id);
    } else if (existing.sent_count > 0) {
      return json({ ok: true, already: true,
        message: "You're already on the list. The next tool lands on Sunday." });
    }
  } else {
    const { data, error } = await admin
      .from("tool_subscribers")
      .insert({ email, source })
      .select("id, token, sent_count")
      .single();
    if (error) {
      console.error("subscribe failed:", error.code ?? error.message);
      return json({ error: "signup_failed" }, 500);
    }
    row = data;
  }

  // The welcome carries the first tool, so the promise on the button is kept
  // straight away rather than on Sunday.
  const { data: picks } = await admin.rpc("weekly_tool_next", { p_subscriber: row!.id });
  const tool = (picks as Tool[] | null)?.[0];
  if (!tool) {
    return json({ ok: true, message: "You're on the list. The first tool lands on Sunday." });
  }

  const msg = await composeToolEmail(tool, row!.token, { welcome: true });
  const out = await sendToolEmail(email, msg);

  await admin.from("tool_email_sends").insert({
    subscriber_id: row!.id,
    tool_slug: tool.slug,
    status: out.ok ? "sent" : "failed",
    error: out.error,
  });
  if (out.ok) {
    await admin.from("tool_subscribers")
      .update({ last_sent_at: new Date().toISOString(), sent_count: (row!.sent_count ?? 0) + 1 })
      .eq("id", row!.id);
  } else {
    // Counts and reasons only, never the address.
    console.error("welcome send failed:", out.error);
  }

  // The reader is on the list either way; a provider hiccup is ours to chase,
  // not theirs to read about.
  return json({ ok: true, sent: out.ok,
    message: out.ok
      ? "Check your inbox — your first tool is on its way."
      : "You're on the list. Your first tool will arrive shortly." });
});
