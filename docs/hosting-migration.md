# Moving theraglee.com from HostGator to Vercel

A runbook for pointing the domain at the Vercel app. Written to be followed in
order — the ordering is what keeps the site (and later, email) from breaking.

> **This file must never be deployed.** It lives in `docs/`, outside `site/`,
> for exactly that reason. See "A note on what gets published" at the bottom.

---

## What is actually being moved

`theraglee.com` currently serves a **stock, empty WordPress install** on
HostGator — the Sydney theme, WooCommerce with no products, and no content
beyond WordPress's own default "Hello world!" post and "Sample Page". There is
nothing on it to preserve, back up, or migrate.

The real Theraglee app already runs on Vercel. This migration only changes
**which server the domain name points at**.

| | Before | After |
|---|---|---|
| `theraglee.com` | HostGator (198.57.242.178) | Vercel |
| Registrar | Network Solutions | Network Solutions — unchanged |
| DNS host | HostGator nameservers | HostGator for now; move later (step 7) |
| Email | Configured, never used | Unchanged now; set up properly in step 8 |
| App code | — | No changes needed. Everything uses `location.origin` |

**The domain registration is not at risk.** `theraglee.com` is registered with
Network Solutions until 2027-06-12. HostGator only provides DNS and hosting.

---

## The two things that will bite you

Both are handled in the steps below — flagged here so they aren't skipped.

1. **`webmail` and `cpanel` are CNAMEs pointing at the apex.** The moment the
   apex `A` record moves to Vercel, those two follow it there and stop working.
   They have to be converted to `A` records *before* the apex moves. (`mail`,
   `ftp` and `autodiscover` already have their own `A` records and are fine.)

2. **Supabase Auth has an allowlist of redirect URLs.** Until `theraglee.com`
   is on it, sign-up confirmations and password-reset links will keep sending
   people to whichever origin is on the list — not the new domain. This is step 5
   and it is not optional.

---

## Record the current DNS first

So there is something to roll back to. This is the full live state as of the
migration:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | 198.57.242.178 | 7200 |
| CNAME | `www` | theraglee.com | 7200 |
| CNAME | `webmail` | theraglee.com | 7200 |
| CNAME | `cpanel` | theraglee.com | 7200 |
| A | `mail` | 198.57.242.178 | — |
| A | `ftp` | 198.57.242.178 | — |
| A | `autodiscover` | 198.57.242.178 | — |
| MX | `@` | `0 mail.theraglee.com` | 3600 |
| TXT | `@` | `v=spf1 a mx include:websitewelcome.com ~all` | 14400 |
| TXT | `_dmarc` | `v=DMARC1; p=none` | — |
| NS | `@` | hgns1.hostgator.com, hgns2.hostgator.com | 21600 |

---

## Step 0a — Publishing (this is now automatic)

The site is deployed by Vercel straight from this repository: the project is
linked to `Suzy590/Theraglee-Repo` with **`site/` as the root directory**, so a
push to the default branch deploys it. There is no longer a manual step.

> **Prerequisite, now done:** the Vercel GitHub App must have access to
> `Suzy590/Theraglee-Repo`. It is already installed on the account (that is how
> `assignremind` deploys) but is scoped to selected repositories, so this one has
> to be added at <https://github.com/apps/vercel> → *Configure* → **Suzy590** →
> *Repository access*. Without it, linking fails with
> `To link a GitHub repository, you need to install the GitHub integration first`.

This replaced the old route, where files were copied into the `site_files` table
in Supabase and Vercel was redeployed by hand. `site_files` is no longer what
gets served, and the old `theraglee-site` project is superseded.

Already live as a result: the branded `404.html`, the legacy WordPress redirects
in `vercel.json`, and the member-library feature (`assets/library.js` plus the
seven pages that use it). `README.md` is gone from the deployed set — it now
lives at `docs/site.md`, outside the deployed directory.

The project is **`theraglee-web`** (`prj_QmVDTmkjdf9dF6KRAhn3t9gsnQvg`), serving
**https://theraglee-web.vercel.app**. Production branch is
`claude/theraglee-template-design-utlypx`, root directory `site/`.

Verify any deploy against that URL (after step 3 it is just
`https://theraglee.com`):

```bash
P=https://theraglee-web.vercel.app
curl -sI "$P/README.md"                                    # want: 404, not 200
curl -s  "$P/no-such-page" | grep -o '<title>.*</title>'   # want: the branded 404
curl -sI "$P/my-account"   | grep -i -E 'HTTP|location'    # want: 308 → /account.html
curl -sI "$P/assets/library.js" | head -1                  # want: 200
```

All four passed on the first deploy (commit `2ac35bb`), along with every legacy
WordPress redirect and the security headers. Every asset was confirmed
byte-identical to the repository — which is the point of deploying from Git
rather than re-uploading files.

One bonus of the Git flow: `vercel.json` is now consumed as configuration
instead of being served as a static file, so it returns `404` rather than the
`200` it gave on the old upload-based project.

### The old `theraglee-site` project is now stale — and still leaking

`theraglee-site.vercel.app` still exists and still serves its **last upload**,
which predates all of this. It still returns `200` for `/README.md`, so the
admin-address doc is still public there even though it is fixed on
`theraglee-web`.

Retiring it is safe once `theraglee.com` points at `theraglee-web` (step 1–4).
Either delete the project in the Vercel dashboard, or pause it
(**Settings → Pause Project**), which makes it serve `503`. This was left for
you rather than done automatically, because something may still be linking to
that URL — the Supabase Auth allowlist did, until step 5.

Note that removing it does not retract anything: the same content is in the
public GitHub repository. See "That does not make the content private" below.

## Step 0 — Lower the TTL (do this a few hours ahead)

In HostGator's cPanel → **Zone Editor** for theraglee.com, change the TTL on the
apex `A` record and the `www` CNAME from `7200` to `300`.

This means that if something goes wrong in step 3, a rollback takes 5 minutes
instead of 2 hours. Wait at least the old TTL (2 hours) after this before
starting step 3, so the short TTL has propagated.

## Step 1 — Add the domain in Vercel

In the Vercel dashboard → project **theraglee-web** (the Git-linked one from
step 0a, *not* the old `theraglee-site`) → **Settings → Domains**:

1. Add `theraglee.com`.
2. Add `www.theraglee.com`, and set it to **redirect to `theraglee.com`**.
   (Pick the apex as canonical — every internal link in the app is relative, so
   either works, but committing to one keeps search engines and cookies tidy.)

Vercel will show **"Invalid Configuration"** and display the exact DNS records
it wants. That is expected — DNS still points at HostGator. **Copy those exact
values.**

> Do not use an IP address from a blog post or from memory, including any you
> may have seen elsewhere in this repo's history. Vercel assigns different apex
> IPs to different domains — `216.230.86.1`, `216.198.79.x`, `64.29.17.x` and
> `76.76.21.x` are all currently in service. **Only the value shown in your
> dashboard for your domain is correct.**

## Step 2 — Protect webmail and cpanel (before touching the apex)

Still in HostGator's **Zone Editor**, change these two from CNAME to A:

| Name | Change from | Change to |
|---|---|---|
| `webmail` | CNAME → theraglee.com | **A → 198.57.242.178** |
| `cpanel` | CNAME → theraglee.com | **A → 198.57.242.178** |

Leave `mail`, `ftp`, `autodiscover`, the `MX` record and both `TXT` records
completely alone.

Confirm before continuing:

```bash
dig +short webmail.theraglee.com   # want: 198.57.242.178 (an A record, no CNAME)
dig +short cpanel.theraglee.com    # want: 198.57.242.178
```

## Step 3 — Point the apex and www at Vercel

In the **Zone Editor**, using the values Vercel gave you in step 1:

| Type | Name | Change to |
|---|---|---|
| A | `@` | *the IP Vercel's dashboard shows* |
| CNAME | `www` | *the CNAME target Vercel's dashboard shows* (often `cname.vercel-dns.com`, but newer accounts get a per-account hostname) |

If HostGator refuses to save a CNAME on `www` because a conflicting record
exists, delete the old `www` record first, then add the new one.

## Step 4 — Verify

Give it 5–15 minutes (you lowered the TTL in step 0), then:

```bash
dig +short theraglee.com
dig +short www.theraglee.com

curl -sI https://theraglee.com | grep -i -E 'server|x-vercel'   # want: server: Vercel
curl -sI https://www.theraglee.com | grep -i location           # want: redirect to https://theraglee.com

# the security headers from site/vercel.json should be present
curl -sI https://theraglee.com | grep -i -E 'x-content-type|x-frame|referrer-policy'

# a legacy WordPress URL should now redirect rather than 404
curl -sI https://theraglee.com/my-account | grep -i -E 'HTTP|location'   # want: 308 → /account.html

# and an unknown path should give the branded 404 page, not a bare one
curl -s https://theraglee.com/no-such-page | grep -o '<title>.*</title>'
```

In Vercel's Domains panel both entries should go green, with a certificate
issued automatically. Then load the site in a browser and check the logo, fonts
and stylesheet all load over the new domain.

## Step 5 — Point Supabase Auth at the new domain

**Do not skip this.** Supabase validates every `emailRedirectTo` and
`redirectTo` against an allowlist; the app passes `location.origin`, which is
about to become `https://theraglee.com`. If that origin is not allowed, sign-up
confirmation and password-reset emails will silently send people to the old
`vercel.app` URL.

Supabase dashboard → project `oekqzuguruyqkafsqhos` → **Authentication → URL
Configuration**:

- **Site URL** → `https://theraglee.com`
- **Redirect URLs** → add `https://theraglee.com/**`

Add `https://theraglee-web.vercel.app/**` too, and keep it in the redirect list
until you are certain the new domain is working. The stale
`https://theraglee-site.vercel.app/**` entry can be dropped once that project is
retired.

Test by running an actual password reset and confirming the emailed link points
at `theraglee.com`.

## Step 6 — Point Stripe at the new domain

Supabase → **Edge Functions → Secrets**: set `SITE_URL` to
`https://theraglee.com`.

The checkout function prefers the `return_url` the browser sends
(`location.origin`), so this is the fallback path — but it is the one used if a
call ever arrives without it, and a wrong value sends paying customers to the
old domain after checkout.

The Stripe webhook endpoint is a Supabase function URL and is **not** affected.

## Step 7 — Leave HostGator

Only once steps 4–6 are confirmed working, and you have given it a few days.

HostGator is currently providing your **DNS**, so cancelling the account while
the nameservers still point there takes the domain offline. Move DNS first:

**Option A — Vercel DNS (simplest, if Vercel keeps this domain).** Vercel will
offer nameservers when you add the domain. Set them at **Network Solutions**,
then re-create the `MX`/`TXT` records for whatever email you set up in step 8.

**Option B — Network Solutions DNS.** You are already paying for the
registration; use its DNS and set the records there.

**Option C — Cloudflare DNS (free).** Best tooling of the three, and it has
free email routing (see step 8).

Whichever you pick: change the nameservers at Network Solutions, wait for
propagation, confirm the site still loads, *then* cancel HostGator.

Once HostGator is gone you can also drop the now-dead records: `mail`, `ftp`,
`autodiscover`, `webmail`, `cpanel`, the `MX` record, and the
`include:websitewelcome.com` SPF record.

## Step 8 — Setting up @theraglee.com email

Nothing currently sends or receives on this domain — the MX record points at
HostGator's shared mail server, but no mailbox has been used. So there is no
email cutover risk in this migration, and no rush.

When you do want it, pick a host **before** cancelling HostGator so there is no
gap. Reasonable options:

| Option | Cost | Good for |
|---|---|---|
| **Cloudflare Email Routing** | Free | Forwarding `hello@theraglee.com` → your Hotmail. Receive only — sending as the domain needs something else. |
| **Zoho Mail** | Free tier (1 domain) | A real mailbox on your own domain, cheaply. |
| **Google Workspace** | ~$7/user/mo | The familiar option; best if you want Docs/Drive too. |
| **Fastmail** | ~$5/user/mo | Clean, no ads, good with custom domains. |

Whichever you choose, set its `MX`, `SPF` and `DKIM` records, and tighten
`_dmarc` from `p=none` to `p=quarantine` once you have confirmed mail flows.

---

## Rolling back

Before nameservers move (steps 1–6), rollback is just restoring the two records
from the table above:

- `A @` → `198.57.242.178`
- `CNAME www` → `theraglee.com`

With the TTL at 300 that takes effect in about 5 minutes. Leave `webmail` and
`cpanel` as `A` records — they work correctly either way.

After nameservers move (step 7), rollback means pointing the nameservers back
at `hgns1/hgns2.hostgator.com` at Network Solutions, which is slower. Don't do
step 7 until you're happy.

---

## A note on access

Two steps in here still can't be done from a Claude session and are marked as
yours: adding the domain in the Vercel dashboard, and editing DNS at HostGator.
There is no tool for either.

Everything else is reachable. One wrinkle worth recording, because it cost time:
the Vercel API resolves this account by the slug **`scanchol-7878`**. Querying by
the team ID `team_cHW24er3QiSNFbZw2mOuaoga`, or by the team slug
`scanchol-7878s-projects`, both return an empty project list — which reads
exactly like an account with nothing in it. It is not. The projects are
`theraglee-web` (git-linked, current), `theraglee-site` (the old unlinked
upload-based project) and `theraglee` (a stale first attempt).

## A note on what gets published

`site/` is uploaded verbatim to Vercel, so **every file in it is publicly
readable** — including non-HTML ones.

`site/README.md` was being served at `/README.md` with a `200`. It documents
which email address is auto-granted administrator and the SQL that lifts the
AssignRemind safety gate. It has been **moved to `docs/site.md`**, outside the
deployed directory, so it can no longer be served at all.

**The rule: no `.md` file is ever published.** Documentation belongs in `docs/`,
which is outside the deployed root and therefore unreachable — that is the real
guarantee, not a filter. `site/.vercelignore` also excludes `*.md` as a backstop
for anything dropped into `site/` later. `vercel.json` is the one non-asset file
that *must* ship, because Vercel reads the redirects and headers from it — its
contents are not sensitive.

### That does not make the content private

`github.com/Suzy590/Theraglee-Repo` is a **public repository**, so the same
README — and this file — are readable by anyone regardless of what the site
serves. Removing it from `site_files` stops the *website* publishing it; it does
not retract it.

Two things worth deciding separately from this migration:

- **Make the repository private** if the intent was that it not be public.
- **Reconsider the auto-admin rule itself.** Documentation being public is only
  a problem because knowing the address is useful to an attacker — which means
  the mechanism, not the documentation, is what is load-bearing. Granting
  administrator to whoever signs in with a particular address is worth replacing
  with an explicit role you set once on the account. Moving to a short, public,
  memorable domain is exactly the moment this gets more attention, not less.
