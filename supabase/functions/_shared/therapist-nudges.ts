// The follow-up emails a therapist gets when they create an account and stop
// before the listing is live. The decisions (who is at which stage, which
// email is due, and what it says) live here so `tests/therapist-nudges/check.mjs`
// can exercise them under plain Node; the function in
// `../therapist-nudges/index.ts` fetches, calls, and sends.
//
// House rules: one email per step, four steps at most, never one the day they
// signed up, and every message says plainly that the member community is
// still growing. Nobody is promised referrals.

/** What is still missing before the listing can go live. */
export type Stage = "nothing_yet" | "no_membership" | "no_license";

/** The four emails, in order, and the day (since sign-up) each one is due. */
export const STEPS = [
  { step: "day1", after: 1 },
  { step: "day3", after: 3 },
  { step: "day7", after: 7 },
  { step: "day14", after: 14 },
] as const;
export type Step = (typeof STEPS)[number]["step"];

/** Nobody older than this is written to: the sequence is for new accounts. */
export const MAX_DAYS = 45;

export type Recipient = {
  user_id: string; email: string; first_name: string | null;
  created_at: string; stage: Stage; sent_steps: string[] | null; email_token: string;
};

export type NudgeContext = {
  firstName: string | null;
  stage: Stage;
  site: string;
  unsub: string;
  /** "$20/month" while the founding offer is open, else the regular monthly rate, else null. */
  rate: string | null;
  founding: boolean;
  /** The day the account was created, as a reader would say it. */
  signedUp: string;
};

export type Email = { subject: string; html: string; text: string };

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Whole days between the account's creation and now. */
export function daysSince(createdAt: string, now: Date): number {
  const ms = now.getTime() - new Date(createdAt).getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * The one email due today, or null. The due step is the latest whose day has
 * passed; if that one went out already there is nothing to send. Earlier
 * steps that were never sent are skipped rather than caught up, so an account
 * that is ten days old gets the day-7 email, not three in a row.
 */
export function nextStep(days: number, sent: readonly string[] | null | undefined): Step | null {
  if (days > MAX_DAYS) return null;
  let due: Step | null = null;
  for (const s of STEPS) if (days >= s.after) due = s.step;
  if (!due) return null;
  return (sent ?? []).includes(due) ? null : due;
}

/** The sentence that says what is left, and where the button should go. */
export function whatIsLeft(stage: Stage, site: string): { line: string; href: string; label: string } {
  const dash = `${site}/therapist-dashboard.html`;
  switch (stage) {
    case "no_membership":
      return {
        line: "One thing is left: start your membership. Your listing goes live on its own the moment it is active and your license clears, and there is nothing to publish.",
        href: `${dash}#membership`, label: "Start my membership",
      };
    case "no_license":
      return {
        line: "One thing is left: your license number and state, plus the specialties, insurance plans and locations members are matched on. We check the license with your board, and the listing goes live on its own.",
        href: dash, label: "Finish my profile",
      };
    default:
      return {
        line: "Two things are left: start your membership, and add your license and the profile members are matched on. Both are on your practice dashboard, and the listing goes live on its own once the license clears.",
        href: dash, label: "Open my dashboard",
      };
  }
}

const wrap = (inner: string, c: NudgeContext) =>
  `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#16241C;line-height:1.55">` +
  `<p style="color:#8B978E;font-size:13px;margin:0 0 18px">Theraglee · for therapists</p>` +
  inner +
  `<hr style="border:0;border-top:1px solid #E6E8E1;margin:26px 0">` +
  `<p style="color:#8B978E;font-size:12px;line-height:1.5;margin:0">You get this because you created a Theraglee therapist account on ${esc(c.signedUp)} ` +
  `and the listing is not live yet. Reply if something got in the way; a person reads it. ` +
  `<a href="${esc(c.unsub)}" style="color:#8B978E">Unsubscribe</a> — one click, no questions.</p></div>`;

const btn = (href: string, label: string) =>
  `<p style="margin:18px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#187C1A;color:#fff;` +
  `text-decoration:none;padding:11px 22px;border-radius:100px">${esc(label)}</a></p>`;

const p = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;

const footText = (c: NudgeContext) =>
  `\n\nYou get this because you created a Theraglee therapist account on ${c.signedUp} and the listing is not live yet. ` +
  `Reply if something got in the way; a person reads it.\nUnsubscribe: ${c.unsub}\n`;

/** The email for a step, in the therapist's situation. */
export function composeNudge(step: Step, c: NudgeContext): Email {
  const hi = `Hi ${c.firstName || "there"},`;
  const left = whatIsLeft(c.stage, c.site);
  const rate = c.rate
    ? (c.founding ? `${c.rate}, locked in for as long as your membership stays active` : c.rate)
    : "one flat rate";

  if (step === "day1") {
    const subject = c.stage === "nothing_yet"
      ? "You're two steps from a live listing"
      : "You're one step from a live listing";
    const html = wrap(
      p(esc(hi)) +
      p("Thanks for creating a Theraglee therapist account. " + esc(left.line)) +
      p("Nothing is public until your license is confirmed with the state board. Your own phone number and email stay private throughout: callers reach a Theraglee number that forwards to you, and messages arrive through Theraglee.") +
      btn(left.href, left.label), c);
    const text = `${hi}\n\nThanks for creating a Theraglee therapist account. ${left.line}\n\n` +
      `Nothing is public until your license is confirmed with the state board. Your own phone number and email stay private throughout.\n\n` +
      `${left.label}: ${left.href}` + footText(c);
    return { subject, html, text };
  }

  if (step === "day3") {
    const subject = "The math on a directory listing";
    const html = wrap(
      p(esc(hi)) +
      p("Most therapists we talk to have the same complaint about the big directories: a monthly fee, one or two inquiries a year, and a profile that has to be re-done every month to stay visible.") +
      p(`Theraglee is ${esc(rate)}. There is no fee per contact, per referral or per session, and there never will be. You fill in your profile once, and members are matched to you by fit, not by how recently you edited your page.`) +
      p(esc(left.line)) +
      btn(left.href, left.label), c);
    const text = `${hi}\n\nMost therapists we talk to have the same complaint about the big directories: a monthly fee, one or two inquiries a year, and a profile that has to be re-done every month to stay visible.\n\n` +
      `Theraglee is ${rate}. There is no fee per contact, per referral or per session, and there never will be. You fill in your profile once, and members are matched to you by fit, not by how recently you edited your page.\n\n` +
      `${left.line}\n\n${left.label}: ${left.href}` + footText(c);
    return { subject, html, text };
  }

  if (step === "day7") {
    const subject = "What a warm lead looks like on Theraglee";
    const sample = "35–44 · seeks help with anxiety and sleep problems · seeking video sessions · has Aetna insurance · in the 303xx area";
    const html = wrap(
      p(esc(hi)) +
      p("When a member switches on Theraglee Match Mode, this is what the therapists who match them see on their dashboard:") +
      `<p style="margin:0 0 14px;padding:12px 16px;background:#F3F6EF;border-radius:12px;color:#5A6760;font-size:14px">${esc(sample)}</p>` +
      p("That member asked a therapist to reach out. You send one short message from your dashboard; if they reply, you have their real name and a first session to book. No one is contacting three therapists off a search page.") +
      p("We will be straight with you: the member community in your area may still be small, and we would rather say so than promise a flood. What is yours from day one is the clinician library, worksheets and exercises written for working therapists with new ones added every day, and a listing that is live and searchable the moment your license clears.") +
      p(esc(left.line)) +
      btn(left.href, left.label), c);
    const text = `${hi}\n\nWhen a member switches on Theraglee Match Mode, this is what the therapists who match them see on their dashboard:\n\n    ${sample}\n\n` +
      `That member asked a therapist to reach out. You send one short message from your dashboard; if they reply, you have their real name and a first session to book. No one is contacting three therapists off a search page.\n\n` +
      `We will be straight with you: the member community in your area may still be small, and we would rather say so than promise a flood. What is yours from day one is the clinician library, worksheets and exercises written for working therapists with new ones added every day, and a listing that is live and searchable the moment your license clears.\n\n` +
      `${left.line}\n\n${left.label}: ${left.href}` + footText(c);
    return { subject, html, text };
  }

  // day14: the last one.
  const subject = "Last one from us: what got in the way?";
  const html = wrap(
    p(esc(hi)) +
    p("This is the last of these emails. Your account stays exactly as it is, and you can finish it whenever you like.") +
    p("One question, if you have a minute: what stopped you? The price, the profile form, a doubt about whether anyone in your area is on Theraglee yet, or something else. Reply to this email and tell us. A person reads every one, and it changes what we build.") +
    p(esc(left.line)) +
    btn(left.href, left.label), c);
  const text = `${hi}\n\nThis is the last of these emails. Your account stays exactly as it is, and you can finish it whenever you like.\n\n` +
    `One question, if you have a minute: what stopped you? The price, the profile form, a doubt about whether anyone in your area is on Theraglee yet, or something else. Reply to this email and tell us. A person reads every one, and it changes what we build.\n\n` +
    `${left.line}\n\n${left.label}: ${left.href}` + footText(c);
  return { subject, html, text };
}

/** The founding rate while the offer is open, else the regular monthly rate. */
export function rateLine(cfg: Record<string, string | undefined>, now: Date): { rate: string | null; founding: boolean } {
  const open = cfg.founding_enabled === "true" && !!cfg.display_therapist_founding &&
    (!cfg.founding_deadline || new Date(cfg.founding_deadline).getTime() > now.getTime());
  if (open) return { rate: `$${cfg.display_therapist_founding}/month`, founding: true };
  if (cfg.display_therapist_monthly) return { rate: `$${cfg.display_therapist_monthly}/month`, founding: false };
  return { rate: null, founding: false };
}

/** "October 4, 2026", in US English. */
export function prettyDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
