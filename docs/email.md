# Email on theraglee.com

## What this covers

There are **two separate email jobs** on this domain, and they are easy to
confuse:

1. **Your inbox** — `hello@theraglee.com`, the address printed on the privacy
   page, the terms and the homepage. A person reads it and replies to it.
2. **The site's own email** — `notifications@theraglee.com`, which the app
   sends automatically: the daily digest, therapist messages, license
   verification and the Sunday tool email. Nobody types these.

They need different setups and they fail in different ways. Both are covered
below.

## Where things stand

**Both halves are set up and working, as of 2026-09-23.** Every record below
is live, and every check the script can make from outside reports `ok`.

| | Provider | Address | State |
|---|---|---|---|
| Your inbox | Google Workspace Business Starter | `hello@theraglee.com` | Sends and receives |
| The site's email | Resend, region `us-east-1` | `notifications@theraglee.com` | Verified |

`notifications@` is also an alias on the `hello` mailbox, so when a member
hits Reply on the daily email their message lands in the inbox instead of
bouncing.

What it costs and how it is scoped:

- Google Workspace Business Starter, one user, $8.40 per month. The alias is
  free and does not count as a second user.
- Resend's free tier, 3,000 messages a month. The daily digest and the Sunday
  email are nowhere near it.
- The Resend API key is restricted to **sending**, on `theraglee.com` only.
  `assignremind.com` shares that Resend account, and this key cannot send as
  it.

Run this at any point to confirm the records are still right:

```bash
python3 tools/check_email_dns.py
```

It reads public DNS, not this repo, so it tells you what the rest of the
world sees. Everything below is the record of how this was set up — follow it
again if the domain ever moves or a record is lost.

## A word on why there are so many records

Only one record makes email *arrive* (the `MX` record). The rest exist to
prove that mail claiming to be from `theraglee.com` really is. Spammers forge
sender addresses constantly, so Gmail and Outlook now assume a domain is
guilty until it proves otherwise. The three proofs are:

| Record | Plain English |
|---|---|
| **SPF** | "These servers are allowed to send as me." |
| **DKIM** | A tamper-proof signature on each message. |
| **DMARC** | "If a message fails the two checks above, here's what to do with it." |

Skipping them doesn't break email on day one. It breaks it slowly, as
providers lose trust, and by then it's hard to diagnose. Do all of them.

---

## How to add a record in Vercel

You will do this several times, so here it is once:

1. Go to the Vercel dashboard and open **Domains** (it's at the team level,
   not inside a project).
2. Click **theraglee.com**, then the **DNS Records** section.
3. Click **Add Record** and fill in the form.

Three things trip people up:

- **The Name field.** For a record on the domain itself, leave Name
  **empty**. Vercel already shows `.theraglee.com` after the box — typing
  `theraglee.com` there gets you `theraglee.com.theraglee.com`. Where the
  tables below say `(blank)`, leave it empty. Where they say `send`, type
  just `send`.
- **Quotes.** Paste TXT values *without* surrounding quotation marks, even
  though other guides show them with quotes.
- **TTL.** Leave it at the default. It only controls how quickly a later
  change takes effect.

An `MX` record gets an extra **Priority** field. A `TXT` record does not.

---

## Part 1 — Your inbox (Google Workspace)

### Step 1: Sign up

Go to `workspace.google.com` and start a **Business Starter** plan (~$7 per
user per month). During signup it asks for your domain — enter
`theraglee.com` — and for the first username. Use **hello**, so the address
is `hello@theraglee.com` and matches what the site already publishes.

Google will ask you to prove you own the domain and will show you a TXT
record. Add it in Vercel:

| Type | Name | Value | Priority |
|---|---|---|---|
| TXT | *(blank)* | `google-site-verification=…` *(yours, from Google)* | — |

Then click Verify in Google. This can take a few minutes.

> Adding this does **not** disturb the SPF record you add next. A domain is
> allowed to have many TXT records; it is only SPF specifically that must
> appear once. See the warning in Step 3.

### Step 2: Turn mail delivery on (MX)

This is the record that makes mail arrive.

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | *(blank)* | `smtp.google.com` | `1` |

One record is all Google needs now. Older guides list five
(`ASPMX.L.GOOGLE.COM` and four `ALT…` entries) — those still work, but don't
mix the two styles. If you already added the five, leave them and skip this.

Once this is live and your Workspace account exists, `hello@theraglee.com`
starts receiving. Send yourself a test from your Hotmail account.

### Step 3: Say who may send (SPF)

| Type | Name | Value | Priority |
|---|---|---|---|
| TXT | *(blank)* | `v=spf1 include:_spf.google.com ~all` | — |

> **The one rule to get right:** a domain may have exactly **one** SPF
> record — one TXT record starting with `v=spf1`. Two of them is not "extra
> safe", it is a broken configuration, and mail providers treat a domain with
> two SPF records as failing. If you ever need to authorize another sender,
> you add an `include:` to the existing record, you do not add a second
> record.

This record does not need to mention Resend. Resend sends using
`send.theraglee.com` as its return address, which carries its own SPF record
(Part 2), so the two never collide.

### Step 4: Sign your mail (DKIM)

This one can only be generated inside your account, which is why it isn't
already done for you.

1. In the Google **Admin console**, go to **Apps → Google Workspace → Gmail
   → Authenticate email**.
2. Select `theraglee.com` and choose **2048-bit** key length.
3. Click **Generate new record**. Google shows you a long value.
4. Add it in Vercel:

| Type | Name | Value | Priority |
|---|---|---|---|
| TXT | `google._domainkey` | `v=DKIM1; k=rsa; p=…` *(yours, from Google)* | — |

5. Go back to the Admin console and click **Start authentication**. If you
   skip this last click, the record exists but Google never signs anything
   with it.

### Step 5: Set the policy (DMARC)

| Type | Name | Value | Priority |
|---|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@theraglee.com` | — |

`p=none` means "watch, don't block". That is deliberately the gentle setting
to start with: if you turn on blocking before DKIM is working, you block your
own mail. Tightening it is the last step of this document.

The `rua=` part asks mail providers to send you reports. **These arrive as
XML attachments and are not meant to be read by a person** — expect a handful
a week from Google, Yahoo and others. They are how you find out something is
misconfigured. File them in a folder, or drop the `rua=` part if you'd rather
not receive them at all.

### Step 6: Add `notifications@` as an alias

Easy to forget, and it loses real mail. The app sends as
`notifications@theraglee.com`, so when a member simply hits Reply, their
message goes to that address. Once the `MX` record above is live, mail to
`notifications@theraglee.com` arrives at Google — and Google rejects it
unless the address exists.

In the Admin console, open the `hello` user and add **notifications** as an
alias. It costs nothing (an alias is not a second user) and those replies
land in your inbox.

---

## Part 2 — The site's own email (Resend)

The code sends through Resend — see `supabase/functions/`. The domain is
verified there now; these are the steps that got it there.

1. Sign in at `resend.com` and go to **Domains → Add Domain**.
2. Enter `theraglee.com`.
3. Resend shows you three records. Add all three in Vercel:

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` *(check your region)* | `10` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| TXT | `resend._domainkey` | `p=…` *(yours, from Resend)* | — |

> **Copy the values from your own dashboard rather than from this table.**
> The region in that MX value changes depending on where your Resend account
> lives (`us-east-1`, `eu-west-1`, `ap-northeast-1`). The wrong region looks
> plausible and silently fails.

4. Click **Verify** in Resend.

### DNS is only half of it

Verifying the domain lets Resend send. The functions also need an API key, or
they return `email_not_configured` and send nothing:

- Set **`RESEND_API_KEY`** on the Supabase project, under *Edge Functions →
  Secrets*. This is done: the key in place is scoped to sending on
  `theraglee.com`.
- `MAIL_FROM` is optional; it defaults to
  `Theraglee <notifications@theraglee.com>`.

`docs/site.md` and `docs/weekly-tool-email.md` cover what each function does
with them.

---

## Every record in one place

Once both parts are done, `theraglee.com` should carry these eight records.
The four marked *(yours)* have values that only exist inside your accounts.

| # | Type | Name | Value | Priority | Purpose |
|---|---|---|---|---|---|
| 1 | TXT | *(blank)* | `google-site-verification=…` *(yours)* | — | Proves you own the domain |
| 2 | MX | *(blank)* | `smtp.google.com` | 1 | **Receives your mail** |
| 3 | TXT | *(blank)* | `v=spf1 include:_spf.google.com ~all` | — | Authorizes Google to send |
| 4 | TXT | `google._domainkey` | `v=DKIM1; k=rsa; p=…` *(yours)* | — | Signs your mail |
| 5 | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@theraglee.com` | — | Policy for both senders |
| 6 | MX | `send` | `feedback-smtp.<region>.amazonses.com` *(yours)* | 10 | Resend's return path |
| 7 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — | Authorizes Resend to send |
| 8 | TXT | `resend._domainkey` | `p=…` *(yours)* | — | Signs the app's mail |

The website's own records (`A` on the domain and on `www`, and the `CAA`
records) are managed by Vercel. **Leave them alone** — none of the above
touches them, and deleting one takes the site down.

---

## Checking it worked

```bash
python3 tools/check_email_dns.py
```

Every line should read `ok`. A `MISS` immediately after an edit usually just
means DNS hasn't caught up; wait an hour and run it again.

DNS being correct is necessary but not sufficient, so also do the two real
tests:

- **Receiving:** send a message from your Hotmail to `hello@theraglee.com`
  and confirm it arrives.
- **Sending:** reply to it from `hello@theraglee.com`. Open the message in
  Gmail, use **Show original**, and confirm `SPF`, `DKIM` and `DMARC` all say
  **PASS**.

For the app's side, **a dry run proves nothing.** `daily-digest` only checks
for `RESEND_API_KEY` when `dry_run` is false:

```ts
if (!dryRun && !Deno.env.get("RESEND_API_KEY")) { ... }
```

so a dry run answers happily whether or not the key is set. Use a path that
really sends:

- **Easiest.** Put an address into the "Start with your inbox" box on the
  homepage. `tool-signup` is public and sends the first tool straight away,
  so one real message goes out through Resend. Unsubscribing is one click,
  and signing up twice is safe.
- **Then read the result back**, which is more reliable than watching an
  inbox:

  ```sql
  select status, error, created_at
  from tool_email_sends
  order by created_at desc
  limit 5;
  ```

  `status = 'sent'` means Resend accepted the message. `status = 'failed'`
  puts the reason in `error`.

- **For the digest specifically**, `daily-digest` takes a `user_id` in the
  POST body and then emails only that person, skipping the once-a-day rule —
  it exists so the owner can test against their own inbox. It needs an
  `x-digest-key` header matching `app_secrets.digest_key`.

---

## Two weeks later: tighten DMARC

Once you've confirmed both directions work and nothing odd has turned up,
change record 5 from `p=none` to:

```
v=DMARC1; p=quarantine; rua=mailto:hello@theraglee.com
```

That tells providers to send anything failing the checks to spam rather than
the inbox. After another month with no problems you can move to `p=reject`,
which refuses it outright.

**Do not skip straight to `p=reject`.** If anything is misconfigured, you
will silently block your own mail — including the digest going to members —
and the failures are invisible from your side.

---

## When something goes wrong

| What you see | Most likely cause |
|---|---|
| Mail to `hello@` bounces | Record 2 missing, or the Workspace user doesn't exist yet |
| Replies to the digest bounce | The `notifications` alias was never added (Part 1, Step 6) |
| Your mail lands in spam, authentication passes | A new domain with no sending history. See below — there is nothing to fix |
| Your mail lands in spam, DKIM fails | DKIM (record 4) added but **Start authentication** never clicked |
| SPF shows `PERMERROR` | Two TXT records starting with `v=spf1`. Delete one |
| Resend won't verify | Wrong region in record 6, or not enough time has passed |
| App sends nothing, no error mail | `RESEND_API_KEY` not set on Supabase — DNS is not the problem |
| Site went down | A website record was edited. See `docs/hosting-migration.md` |

### Spam at a new domain is not a misconfiguration

The first messages from this domain landed in Outlook's junk folder, and the
headers on one of them looked like this:

```
spf=pass      smtp.mailfrom=send.theraglee.com
dkim=pass     header.d=theraglee.com
dkim=pass     header.d=amazonses.com
dmarc=pass    header.from=theraglee.com
compauth=pass reason=100
```

Everything passed, `compauth=pass reason=100` being the strongest verdict
Microsoft issues. The message was junked anyway, because `theraglee.com` had
been sending for a matter of hours and Outlook distrusts senders it does not
recognize.

**Check the headers before changing anything.** If they read like the above,
the setup is right and no record will improve it. What does:

- Time, and sending consistently rather than in bursts.
- Recipients marking a message **Not junk**. This is the strongest signal
  there is, and the only fast one.
- Tightening `_dmarc` to `p=quarantine` once both senders are confirmed —
  see above. Microsoft gives some weight to an enforced policy.

Reputation builds from volume, and this domain sends very little, so expect
it to take weeks rather than days. Read the headers rather than the folder:
the folder reflects a stranger's caution, the headers reflect whether the
setup is correct.

## Once the mailbox exists

Nothing on the site needs changing — `hello@theraglee.com` is already what
every page prints, which is why it was chosen as the first username. The
addresses appear in `site/privacy.html`, `site/terms.html`, `site/index.html`
and `site/for-therapists.html`; `docs/legal-pages.md` is the guide to those
pages if the contact address ever moves.
