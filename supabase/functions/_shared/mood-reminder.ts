// The evening mood reminder: the words of the email a member gets on a day
// they ticked the box for and have not submitted the mood check-in by
// evening. No imports, so tests/mood-reminder/check.mjs can run it under
// plain Node. The `mood-reminder` Edge Function decides who gets one (in SQL,
// mood_reminder_recipients) and delivers; this file only composes.
//
// House rules: it nudges, it never scores or diagnoses, and it never mentions
// streaks. docs/mood.md is the guide.

export type ReminderRecipient = {
  user_id: string; email: string; full_name: string | null; email_token: string;
  /** The member tapped a face for today but did not submit the rest. */
  started: boolean;
};

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** The first word of a name, for the greeting; empty when there is none. */
export const firstName = (full: string | null | undefined) =>
  (full || "").trim().split(/\s+/)[0] || "";

/** One message: a greeting, why the check-in matters, one button, the way out. */
export function composeMoodReminder(
  r: ReminderRecipient, { site, unsubBase }: { site: string; unsubBase: string },
) {
  const first = firstName(r.full_name);
  const hello = first ? `Good evening, ${first}.` : "Good evening.";
  const href = `${site}/dashboard.html#mood`;
  const unsub = `${unsubBase}?u=${encodeURIComponent(r.email_token)}`;

  const subject = r.started
    ? "Today's mood check-in is still open"
    : "A quick nudge: today's mood check-in";

  const why = r.started
    ? "You tapped a face for today earlier, and the rest of the check-in is still open. " +
      "A minute on what may be shaping your mood is what makes your patterns add up."
    : "You asked for a reminder on the days you have not checked in. Today's is still open: " +
      "one tap for your day overall, then a minute on what may be shaping it.";

  const html =
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#16241C">` +
    `<p style="color:#8B978E;font-size:13px;margin:0 0 14px">Theraglee · your mood check-in</p>` +
    `<p style="font-size:17px;margin:0">${esc(hello)}</p>` +
    `<div style="margin:18px 0 0;padding:18px 20px;background:#F0F7E2;border-radius:14px">` +
    `<p style="margin:0;line-height:1.55">${esc(why)}</p>` +
    `<p style="margin:14px 0 0"><a href="${href}" style="display:inline-block;background:#187C1A;color:#fff;` +
    `padding:10px 20px;border-radius:100px;text-decoration:none;font-size:14px">Check in now</a></p>` +
    `</div>` +
    `<p style="margin:18px 0 0;color:#5A6760;font-size:14px;line-height:1.5">There is no wrong answer, ` +
    `and a day you skip is simply a day that is not counted. This is a nudge, nothing more.</p>` +
    `<hr style="border:0;border-top:1px solid #E6E8E1;margin:26px 0">` +
    `<p style="color:#8B978E;font-size:12px;line-height:1.5;margin:0">Theraglee is educational and supportive only — ` +
    `not medical advice, diagnosis or treatment. In crisis? Call or text 988 in the US, or call 911 if you are in danger.</p>` +
    `<p style="color:#8B978E;font-size:12px;margin:12px 0 0">You get this because you ticked “Email me a reminder” on your mood check-in. ` +
    `<a href="${unsub}" style="color:#8B978E">Unsubscribe</a> · ` +
    `<a href="${href}" style="color:#8B978E">Change this on your dashboard</a></p></div>`;

  const text =
    `${hello}\n\n${why}\n\nCheck in now: ${href}\n\n` +
    `There is no wrong answer, and a day you skip is simply a day that is not counted. This is a nudge, nothing more.\n\n` +
    `Theraglee is educational and supportive only — not medical advice, diagnosis or treatment. ` +
    `In crisis? Call or text 988 in the US, or call 911 if you are in danger.\n\n` +
    `You get this because you ticked “Email me a reminder” on your mood check-in.\n` +
    `Unsubscribe: ${unsub}\nChange this on your dashboard: ${href}\n`;

  return { subject, html, text, unsub };
}
