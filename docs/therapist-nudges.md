# Follow-up emails for therapists who start a listing and stop

A therapist creates an account on `therapist-signup.html` and is then meant to
start the membership and fill in the profile, after which the license check
runs and the listing goes live on its own (`docs/therapist-pages.md`,
`docs/stripe.md`). Many stop somewhere in between. This is the short sequence
of emails that follows them, and how it is built.

## What a therapist gets

Four emails at most, on days 1, 3, 7 and 14 after the account was created,
and never again after that. Each one says what is still missing, in the
therapist's own situation, with one button that goes there:

| Stage | What is missing | The button |
| --- | --- | --- |
| `nothing_yet` | The membership and the license | The practice dashboard |
| `no_membership` | The membership (a license is on file) | The Membership tab |
| `no_license` | The license and the profile (the membership is active) | The practice dashboard |

| Day | Subject | What it says |
| --- | --- | --- |
| 1 | You're one (or two) step(s) from a live listing | Thanks, what is left, nothing is public until the license is confirmed, your own number and email stay private |
| 3 | The math on a directory listing | The complaint about the big directories, the flat rate (the founding rate while the offer is open), no per-contact or per-session fee ever, matched by fit rather than by editing your page |
| 7 | What a warm lead looks like on Theraglee | A sample Match Mode line, one message and a real name back, and the honest line that the community in their area may still be small; the clinician library is theirs from day one |
| 14 | Last one from us: what got in the way? | The last email, the account stays as it is, one question to reply to |

Rules the check enforces: nobody is written to on the day they signed up,
every email carries the one-click unsubscribe link and a plain-text twin,
nothing promises referrals, and the day-7 email admits the community is still
growing. A therapist whose license is on file **and** whose membership is
active is done with their part and gets nothing from this sequence; the
license emails from `verify-license` take over.

The sequence ends on its own when the listing goes live, when a license check
comes back rejected (that email already says what to do), when the account
asks to be deleted, 45 days after sign-up, or on one click of the unsubscribe
link, which sets `profiles.therapist_nudges` to false and nothing else.

## Where the pieces are

| Piece | File |
| --- | --- |
| The decisions: stages, which step is due, the wording | `supabase/functions/_shared/therapist-nudges.ts` |
| The function pg_cron calls, and the unsubscribe page | `supabase/functions/therapist-nudges/index.ts` |
| The switch, the sends table, the recipients and unsubscribe functions, the key, the schedule | `supabase/migrations/20261018120000_therapist_nudges.sql` |
| `verify_jwt = false` (pg_cron and mail clients carry no JWT) | `supabase/config.toml` |
| The check | `tests/therapist-nudges/check.mjs` |

```bash
node tests/therapist-nudges/check.mjs
```

The step that is due is the latest one whose day has passed; if it already
went out, nothing is sent. Earlier steps that were never sent are skipped, not
caught up, so an account that is ten days old when the sequence starts gets
the day-7 email and then the day-14 one, not four in a row. The recipients
function only lists accounts between one and forty-five days old, so applying
the migration does not email every unfinished account from the past.

## Deploying it

```bash
supabase link --project-ref oekqzuguruyqkafsqhos
supabase db push                                   # or apply the migration with the Supabase MCP tool
supabase functions deploy therapist-nudges
```

The function sends through Resend with the same `RESEND_API_KEY` and
`MAIL_FROM` the other emails use (`docs/email.md`), so nothing new is needed
there. Before the first scheduled run, do a dry run to see who would get what:

```bash
curl -sS -X POST https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/therapist-nudges \
  -H "Content-Type: application/json" \
  -H "x-nudges-key: $(psql "$SUPABASE_DB_URL" -Atc "select value from app_secrets where key='therapist_nudges_key'")" \
  -d '{"dry_run": true}'
```

`previews` lists each account's id, stage, step and subject; no address, no
body. To see one email in a real inbox, send a single step to your own
therapist test account:

```json
{"user_id": "<your test account's profile id>", "step": "day7"}
```

That ignores the day rule but still records the send, so the same step will
not go to that account again on its own. Read the result back with:

```sql
select step, stage, status, error, created_at
from therapist_nudge_sends
order by created_at desc
limit 10;
```

## Writing rules

The wording lives in `composeNudge` and the check reads it, so change both
together. Keep it in US English, keep the honest line about the size of the
community, and never add a second pitch: each email has one button. A step is
never renamed once it has been sent, because `therapist_nudge_sends.step` is
what stops it going twice.
