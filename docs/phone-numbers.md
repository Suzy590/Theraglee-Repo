# Tracking numbers and call forwarding

Every verified therapist's profile shows a Theraglee number instead of their
own line. Calls to it ring through to their real number, and the therapist's
dashboard counts them. This is how that works and how to set a number up.

## How a call flows

1. A visitor taps the Theraglee number on a profile. The browser records a
   `call` row in `therapist_events`, which the Referrals tab shows as
   **Phone calls** (taps).
2. The number is a Twilio number. When it rings, Twilio asks the
   `twilio-voice` Edge Function (`supabase/functions/twilio-voice`) what to do.
   The function finds the listing whose `proxy_phone` matches the called
   number and answers with TwiML that dials the therapist's `contact_phone`,
   ringing it for 25 seconds. The therapist sees the caller's own number on
   their phone, so they can call back.
3. When the forwarded leg ends, Twilio tells the function how it went. The
   function keeps one row in `therapist_calls`: how long it lasted, whether it
   was answered, and the caller's last four digits only. The row is keyed on
   Twilio's call id, so a repeated delivery updates rather than duplicates.
   An unanswered caller hears a short apology; an answered call simply ends.
4. `therapist_stats()` reports the answered ones as `verified_calls`, which
   the dashboard shows under the **Phone calls** card as connected calls
   confirmed by the phone network.

A number nobody owns, or a listing with no contact number on file, hears an
apology and the call ends. Nothing is stored for it.

The decisions (matching numbers, the TwiML, the row, Twilio's request
signature, which numbers to ask for and how a purchase is worded) are in
`supabase/functions/_shared/twilio.ts` and tested by:

```bash
node tests/twilio-voice/check.mjs
```

## Security

The function has `verify_jwt = false` because Twilio has no Supabase session.
Instead every request must carry Twilio's signature, computed from the
account's auth token over the URL and the POSTed parameters; anything unsigned
or signed with another account's token is refused. The full caller number is
never stored, only its last four digits.

## Setting it up (once)

1. **Twilio account.** A paid (upgraded) account at twilio.com. A trial account
   can only call numbers you have verified by hand, so it will not forward to
   therapists.
2. **The secrets.** Twilio Console → **Account info** (on the home page) shows
   the *Account SID* and the *Auth Token*. In the Supabase Dashboard →
   **Edge Functions → Secrets**, add `TWILIO_ACCOUNT_SID` and
   `TWILIO_AUTH_TOKEN` with those values. Never paste the token anywhere else.
3. **Deploy the functions** with the Supabase CLI:

   ```bash
   supabase link --project-ref oekqzuguruyqkafsqhos
   supabase functions deploy twilio-voice twilio-numbers
   ```

   `supabase/config.toml` already carries their `verify_jwt = false`.
4. **Apply the migrations** `20261008170000_therapist_calls.sql`,
   `20261008180000_therapist_calls_answered.sql` and
   `20261008200000_twilio_auto_numbers.sql` (SQL Editor, or
   `supabase db push`).

## Numbers are issued on their own

The moment a listing goes live (license verified and the membership active, so
`published` turns true) and it has no number yet, a trigger on
`therapist_profiles` asks the `twilio-numbers` Edge Function
(`supabase/functions/twilio-numbers`) to buy one, with the shared key in
`app_secrets.twilio_hook_key`, the same way the license check is asked for.
The function:

1. searches Twilio for a voice number in the therapist's own area code (from
   their `contact_phone`), then anywhere in their first licensed state, then
   anywhere in the US;
2. buys the first one offered, with its **A call comes in** webhook already
   pointed at `twilio-voice` and the therapist's name as its label in the
   Twilio Console;
3. saves it on the listing: `proxy_phone` (shown as `(805) 010-0199`),
   `proxy_phone_provider = 'twilio'`, `proxy_phone_sid` (Twilio's id for it,
   needed to release it) and `proxy_phone_assigned_at`.

If the purchase fails (no secrets yet, Twilio has nothing to offer, the card
is declined) the listing simply stays without a number, the reason is in the
function's logs, and **Issue** on the admin page tries again. A listing that
goes down keeps its number, so a lapse and renewal does not change what the
profile showed.

## From the admin page

`/admin.html` → **Tracking numbers** lists every verified therapist with
their forwarding number, their Theraglee number and where it came from:

- **Issue** buys a number now, for a listing that went live before this was
  switched on or whose automatic purchase failed. Only a live listing gets one
  (verified, with the membership active: the badge beside the name says
  which), and a listing that already has one is left alone. The button is
  disabled for a listing whose membership is inactive, and the function
  refuses too.
- **Release** gives a Twilio number back (it stops billing) and clears it from
  the listing. Calls already recorded stay on the therapist's dashboard. A
  number that was pasted in by hand is simply cleared.
- **Paste by hand** keeps the old way for a number from somewhere other than
  Theraglee's Twilio account. It is shown as typed; calls to it forward only if
  its own provider forwards them. To make such a number ring through this
  function, set its voice webhook (in whatever console owns it) to

  ```
  https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/twilio-voice
  ```

  with method **HTTP POST**.

The therapist's **Forwards to** column must show a number, or callers hear the
apology. After issuing a number, call it once from your own phone: the
therapist's phone should ring, and a minute later the call appears on their
dashboard's Referrals tab.

Each number costs about $1.15 a month, and each call Twilio's inbound rate
plus its outbound rate for the forwarded leg, a few cents a minute in all.
