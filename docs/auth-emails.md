# The sign-in emails: confirmation and password reset

## What this covers

Two kinds of email reach a member or therapist about their account, and
neither is sent by the site's own code:

| Email | When | Where its words live |
|---|---|---|
| **Confirm your email** | Right after signing up | Supabase dashboard → Authentication → Emails → Templates → *Confirm sign up* |
| **Reset your password** | After "Forgot your password?" on a sign-in page, or "Send me a reset link" on the account page | Supabase dashboard → Authentication → Emails → Templates → *Reset Password*. The repo's copy is `supabase/templates/recovery.html` |

Both are sent by **Supabase Auth**, the sign-in service, from its own
template. The site only asks for them (`sb.auth.signUp` and
`sb.auth.resetPasswordForEmail` in `site/assets/auth.js` and
`site/account.html`) and says where the link should land. That is why a
problem with the email itself — a missing link, odd wording, the wrong sender
— is fixed in the Supabase dashboard, not in `site/`.

The morning digest, the mood reminder, therapist messages and the Sunday
tool email are a different thing entirely: the site's own Edge Functions send
those through Resend. `docs/email.md` covers them.

## How a password reset works

1. The member types their email on `login.html` (or `therapist-login.html`)
   and clicks **Forgot your password?**, or clicks **Send me a reset link**
   on `account.html`.
2. Supabase emails them the *Reset Password* template. Its link is
   `{{ .ConfirmationURL }}`: a one-time address on Supabase that signs them in
   and then sends them on to **`reset-password.html`** on the site.
3. `reset-password.html` sees they are signed in and asks for the new
   password twice. Saving calls `sb.auth.updateUser({ password })` and then
   opens their own dashboard (members and therapists both land here; the page
   sends each to the right one).
4. A link that has expired (they last an hour) or was used already arrives
   with an error instead. The page says so and offers to send a fresh one.

Emails sent before `reset-password.html` existed pointed at `account.html`
or the practice dashboard. Those links still work: `chrome()` in
`site/assets/app.js` notices a reset arriving on any other page and takes it
to `reset-password.html`.

## "The email had no link in it"

That is what a member sees when the *Reset Password* template in the
dashboard no longer contains `{{ .ConfirmationURL }}`, or contains it only as
a button that their mail app does not show (some phone mail apps, and any
app set to plain text, drop a button and keep only the words around it).

The fix is the template in `supabase/templates/recovery.html`. It carries the
link twice: a green button, and the full address written out underneath, so
there is always something to tap or copy. To put it live:

1. Supabase dashboard → project `oekqzuguruyqkafsqhos` → **Authentication →
   Emails → Templates** (older dashboards say *Email Templates*).
2. Open **Reset Password**.
3. Set the subject to `Reset your Theraglee password`.
4. Replace the body with everything in `supabase/templates/recovery.html`
   below its opening comment (the comment is for this repo; Supabase would
   send it as-is, invisibly, which is harmless but untidy).
5. Save, then test: on `login.html`, type your own address and click
   **Forgot your password?**. The email should show the button and the
   written-out link, and the link should open `reset-password.html` on
   `theraglee.com`.

`supabase/config.toml` names the same file under
`[auth.email.template.recovery]`, which is how the Supabase CLI applies it to
a *local* copy of the project. **Do not run `supabase config push` to apply
it to the live project.** That command pushes every `[auth]` setting at once,
and the ones this repo does not set (the Site URL, the redirect allowlist,
the rate limits) would be pushed at their defaults over the live values.
Paste by hand, as above.

## The link must be allowed to land on the site

Supabase only sends someone to an address on its allowlist. If the site is
missing from it, the link in the email still appears, but it lands on the
wrong host or on an error. Check under **Authentication → URL Configuration**:

- **Site URL**: `https://theraglee.com`
- **Redirect URLs**: `https://theraglee.com/**` (and
  `https://theraglee-web.vercel.app/**` while that preview is in use)

`docs/hosting-migration.md`, step 5, has the history.

## When something goes wrong

| What the member sees | Most likely cause |
|---|---|
| No email at all | Supabase's built-in sender is limited to a few emails an hour per project; or the address has no account (Supabase says nothing either way, on purpose); or it is in spam |
| Email with no link | The dashboard template lost `{{ .ConfirmationURL }}`, or the mail app hides buttons. Paste the template above |
| Link opens Supabase and stops, or an error page | The site is missing from the redirect allowlist (above) |
| Link opens the site but no password form appears | The person is not signed in when `reset-password.html` loads. Usually the link was used already, or more than an hour had passed; the page offers a new one |
| "New password should be different from the old password" | Supabase refuses the same password again. Choose another |
