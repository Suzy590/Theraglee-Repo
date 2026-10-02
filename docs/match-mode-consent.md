# Theraglee Match Mode — consent wording

This is the wording a member reads when they switch **Theraglee Match Mode**
on, and the facts it rests on. It is kept in step with what the site actually
does: `site/assets/match.js` (the window that asks for the details and the one
line therapists read), the `member_discovery` view (what a therapist can
select), `outreach_replies.member_name` (where the real name travels) and
`member_blocks` (blocking). Change the code and this file in the same pull
request.

## What the member agrees to

> **Let therapists reach out to you.** Verified therapists can see a private,
> pseudonymous profile and message you in your Theraglee inbox.
>
> - What therapists see: Your pseudonym, age range, gender, broad topics you’d
>   like to work on with a therapist, whether you’d prefer
>   in-person/telehealth (video)/either, your insurance, and the first 3 digits
>   of your ZIP.
> - If you indicate that you are open to telehealth (video) sessions, therapists
>   anywhere in your state can reach out to you.
> - Your real name is shared only if you reply.
> - You can block any therapist with one tap.
> - Turning Theraglee Match Mode off makes you invisible to therapists again.

This is `MATCH_BLURB` in `site/assets/match.js`, shown under the Match Mode
switch on the dashboard and on the account page (its lead ends with a link to
`site/match-mode.html`, the plain-language explainer; see
[`therapist-pages.md`](therapist-pages.md)): the bold lead and one
sentence, then a circled "i" labeled "How Theraglee works". The list is folded under
it and opens when the member hovers over it or clicks (or taps) it; the
button reports whether it is open (`aria-expanded`) to screen readers. When the switch is turned on, a window asks for every
detail below, all required. It suggests a pseudonym ("Quiet Harbor 27") that
the member can keep, replace with another suggestion, or type over, and says it
will be shared with therapists and must not be their real name.

## What therapists can see before a member replies

| Detail | Where it comes from | What a therapist reads |
| --- | --- | --- |
| Pseudonym | `profiles.match_pseudonym`, 2 to 30 letters, digits, spaces and `. ' _ -`, chosen by the member | "Quiet Harbor 27" |
| Gender | `profiles.match_gender`: `male`, `female`, `non_binary` or `prefer_not` (Male, Female, Non-binary, Prefer not to answer). "Prefer not to answer" leaves it out of the line | "female"; the practice dashboard card reads "Prefers not to answer" |
| Age range | `profiles.match_age_range`, one of `18-24`, `25-34`, `35-44`, `45-54`, `55-64`, `65+` | "35–44" |
| Broad topics | `profiles.match_topics`, from Anxiety, Panic, Depression, Stress, Life transition, Grief/loss, Relationship issues, Family issues, Trauma, Personal growth, Other. Separate from `profiles.issues`, which shapes daily content; the view falls back to `issues` for members who switched Match Mode on before `match_topics` existed | "seeks help with anxiety and stress" |
| Session preference | `profiles.match_delivery`: `in_person`, `telehealth` (video) or `both` | "seeking video sessions" |
| How they plan to pay | `profiles.match_insurance`: a plan name from `INSURANCES` in `site/assets/lists.js` (the same list therapists pick the plans they accept from), `self_pay` or `unsure`. The practice dashboard marks members whose plan is in the therapist's `insurances` and can show only those | "has Aetna insurance", "paying out of pocket", "not sure about insurance yet" |
| First three digits of the zip code | `left(profiles.zip, 3)`, exposed by the view as `area`; the zip code is required to switch on | "in the 902xx area" |

Nothing else. The view has no real name, exact age, zip, email or content column.

## How the answers are loaded

Every page reads the signed-in member's profile from `my_access()`
(`20260928190000_match_mode_insurance_and_reload.sql`). It must return every
`match_*` column above; if one is left out, the "Therapists read" line forgets
it at each sign-in and the window opens blank for it, even though the answer is
saved. Add any new Match Mode column there too.

## What therapists never see

The member's name, exact location, email address, journal, quiz results,
worksheet results, mood or goal logs, or anything else in their private
dashboard. Exact age is no longer collected for Match Mode; older rows may
still hold it, but no view exposes it.

## When the real name is shared

Only when the member replies to a therapist's message. The reply button opens a
form that reminds them which pseudonym the therapist has known them by and asks
for their real name at that moment, the database refuses a reply without one
(`outreach_replies_name_check`), and the name goes to that one therapist. The
therapist is emailed the reply (`match-reply-alert`). Nothing else about the
member changes: the therapist still cannot see their email or anything they
have written.

## Control

- **Off by default.** `profiles.visible_to_therapists` starts false.
- **One tap to hide.** Switching Match Mode off removes the member from
  `member_discovery` at once. A therapist the member has already replied to can
  still answer that conversation (`member_replied_to()`), because the member
  chose to talk to them.
- **One tap to block.** A row in `member_blocks` removes the member from that
  therapist's view and stops that therapist writing to them, even after a
  reply (`member_blocked()` in the outreach insert policy). The member can
  unblock from the same place, the Messages tab on the dashboard or the Inbox
  on the account page.

## Where the wording appears

- Landing page, Match Mode section (`site/index.html`)
- The Match Mode switch on the dashboard and the account page, and the window
  that opens when it is switched on (`site/dashboard.html`,
  `site/account.html`, `site/assets/match.js`)
- The member's Messages tab on the dashboard and Inbox on the account page
  (`site/assets/inbox.js`)
- The "What is Theraglee Match Mode?" answer on the pricing, account and
  For Therapists pages
- The practice dashboard's Member requests tab (`site/therapist-dashboard.html`)
- Privacy Policy sections on therapists and on consumer health data
  (`site/privacy.html`)
