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
signature) are in `supabase/functions/_shared/twilio.ts` and tested by:

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
2. **The secret.** Twilio Console → **Account info** (on the home page) →
   *Auth Token*. In the Supabase Dashboard → **Edge Functions → Secrets**, add
   `TWILIO_AUTH_TOKEN` with that value. Never paste the token anywhere else.
3. **Deploy the function** with the Supabase CLI:

   ```bash
   supabase link --project-ref oekqzuguruyqkafsqhos
   supabase functions deploy twilio-voice
   ```

   `supabase/config.toml` already carries its `verify_jwt = false`.
4. **Apply the migrations** `20261008170000_therapist_calls.sql` and
   `20261008180000_therapist_calls_answered.sql` (SQL Editor, or
   `supabase db push`).

## Giving a therapist a number

1. Twilio Console → **Phone Numbers → Manage → Buy a number**. Country United
   States, capability **Voice**, ideally an area code near the therapist. Buy
   it (about $1.15 a month).
2. Open the number → **Configure** → *Voice Configuration* → **A call comes
   in**: choose *Webhook*, paste

   ```
   https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/twilio-voice
   ```

   and set the method to **HTTP POST**. Save. Leave the other voice fields
   empty; the function sets its own status callback.
3. `/admin.html` → **Tracking numbers** → **Assign** beside the therapist, and
   paste the number. Any spelling works (`(805) 010-0199`, `8050100199`,
   `+18050100199`); the function matches on the last ten digits. The
   therapist's **Forwards to** column must show a number, or callers hear the
   apology.
4. Call it once from your own phone. The therapist's phone should ring, and a
   minute later the call appears on their dashboard's Referrals tab.

Each call costs Twilio's inbound rate plus its outbound rate for the forwarded
leg, a few cents a minute in all.

## Taking a number back

Clear it in `/admin.html` (Assign → empty → Save) and release the number in
the Twilio Console so it stops billing. Calls already recorded stay on the
therapist's dashboard.
