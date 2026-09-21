# The Sunday tool email

## What it is

A box on the homepage, just above the footer, for people who are not ready to
create an account:

> **Not ready for an account? Start with your inbox.**
> One free mental-health tool every Sunday morning. Try them at your own pace —
> no account, no card.

They hand over an address and nothing else. There is no password, no account
and no card, and the only things stored are the address, a token that proves an
unsubscribe link is theirs, and which tools have already gone out.

## What is in each email

One tool. Not a roundup, not a list.

The tool is drawn from the 360 free discovery tools, every one of which is open
to everybody and needs no account, so the promise on the homepage holds. The
email carries the title, the topic, how many minutes it takes, the description,
and a button to `/discover.html?slug=<slug>`.

After the tool there is **exactly one** soft nudge toward a paid membership,
and nowhere else in the message is there a second pitch. That rule is the
reason the composer lives in one file, `supabase/functions/_shared/tool-email.ts`:
change the message there and the rule stays in one place. The count in the
nudge is read from the library at send time rather than typed into the copy, so
it cannot go stale.

Every message ends with the safety line the rest of the site uses and a
one-click unsubscribe, sent as a real link and as the `List-Unsubscribe` and
`List-Unsubscribe-Post` headers so a mail client can offer its own button.

## The pieces

| Piece | Where |
|---|---|
| The form | `site/index.html`, section `#inbox` |
| Signing up | `supabase/functions/tool-signup` — public, no JWT. One address in, the first tool straight out |
| The Sunday send | `supabase/functions/weekly-tools` — `POST` behind the scheduler's key |
| Unsubscribing | `weekly-tools` again: `GET ?u=<token>`, no sign-in, the token is the proof |
| The message | `supabase/functions/_shared/tool-email.ts`, shared by both |
| Who is on the list | `tool_subscribers` |
| What has gone out | `tool_email_sends` |
| The tools it draws from | `discover_tools` |
| Delivery | Resend, the same provider the morning digest uses |

Nobody reaches `tool_subscribers` from the browser. Row level security is on
with no policy for `anon` or `authenticated`, so only the Edge Functions, which
hold the service role, and an administrator can read it.

## Choosing the week's tool

`weekly_tool_next(subscriber)` walks `discover_tools` in order and returns the
first one that reader has not been sent. Once they have had all 360 it starts
again. `tool_email_recipients()` returns anyone not unsubscribed whose last
send was more than six days ago — six rather than seven so a run that starts a
little early never skips somebody for a whole week.

## The schedule

`pg_cron` calls `weekly-tools` at **13:00 UTC on Sunday**, which is 9 am
Eastern and 6 am Pacific, the same hour as the daily digest. The job presents
the `weekly_tools_key` from `app_secrets`, so the public URL cannot be used to
trigger a send.

To send a round by hand, or to check one without sending anything:

```sql
select net.http_post(
  url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/weekly-tools',
  headers := jsonb_build_object(
               'Content-Type', 'application/json',
               'x-tools-key', (select value from public.app_secrets where key = 'weekly_tools_key')),
  body    := '{"dry_run": true}'::jsonb);
```

`dry_run` composes every message and sends none.

## Keeping the tool list in step

`discover_tools` mirrors `site/assets/discover-tools.js`, which is where the
tools really live. After adding or changing one there:

```bash
node tools/discover_tools_sql.mjs
```

That rewrites `supabase/migrations/20260921050100_discover_tools_seed.sql` as an
upsert on slug, so applying it twice is harmless. Never edit it by hand.

`.github/workflows/apply-content-migrations.yml` now watches
`*_discover_tools_*.sql` alongside the articles and the clinician library, so a
push to a `claude/**` branch will apply it **once the `SUPABASE_DB_URL` secret
is set**. It is not set today: the workflow exits early with a notice and
applies nothing, which is why it has been finishing green without doing any
work. Until the secret is added under *Settings → Secrets and variables →
Actions*, a new tool has to be applied with the Supabase CLI or by running the
generated file against the database by hand.

## What it needs to work

`RESEND_API_KEY` on the Supabase project, which the morning digest already
uses. Without it the functions answer honestly rather than pretending: a signup
still joins the list, and the send returns `email_not_configured` instead of
reporting success.

`MAIL_FROM` is optional and defaults to `Theraglee <notifications@theraglee.com>`.

## Things that were decided on purpose

- **No confirmation email.** The button says "Send me the tools", so the first
  tool arrives at once rather than after a second click. The trade is that an
  address is never verified, which is why unsubscribing is one click with no
  questions and why every message carries the headers a mail client needs.
- **Signing up twice is safe.** A known address gets a truthful "you're already
  on the list" and no second welcome. Someone who left and came back is simply
  switched on again.
- **A failed send does not lose the reader.** They are on the list either way,
  the failure is recorded in `tool_email_sends`, and the next Sunday picks them
  up.
- **Logs carry counts, never addresses** and never the body of a message.
