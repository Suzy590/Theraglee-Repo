# Theraglee Match Mode — consent wording

This is the wording a member reads when they switch **Theraglee Match Mode**
on, and the facts it rests on. It is kept in step with what the site actually
does: `site/assets/match.js` (the window that asks for the details and the one
line therapists read), the `member_discovery` view (what a therapist can
select), `outreach_replies.member_name` (where the real name travels) and
`member_blocks` (blocking). Change the code and this file in the same pull
request.

## What the member agrees to

> Let therapists reach out to you. Verified therapists see a pseudonymous
> profile that includes: your pseudonym, your age range, the broad topic(s) you
> would like to work on with a therapist, whether you prefer in-person, video,
> or either, and the first three digits of your zip code so they know you're
> nearby. If you indicate you are open to video sessions, you may have
> therapists anywhere in your state reach out to you. Therapists will reach out
> to you by messaging your Theraglee inbox. Your real name goes to a therapist
> only if you choose to reply to them, and you can block any therapist with one
> tap. Toggling OFF Theraglee Match Mode makes you invisible to therapists.

This is `MATCH_BLURB` in `site/assets/match.js`, and the paragraph under the
switch on the dashboard. When the switch is turned on, a window asks for every
detail below, all required. It suggests a pseudonym ("Quiet Harbor 27") that
the member can keep, replace with another suggestion, or type over, and says it
will be shared with therapists and must not be their real name.

## What therapists can see before a member replies

| Detail | Where it comes from | What a therapist reads |
| --- | --- | --- |
| Pseudonym | `profiles.match_pseudonym`, 2 to 30 letters, digits, spaces and `. ' _ -`, chosen by the member | "Quiet Harbor 27" |
| Age range | `profiles.match_age_range`, one of `18-24`, `25-34`, `35-44`, `45-54`, `55-64`, `65+` | "35–44" |
| Broad topics | `profiles.match_topics`, from Anxiety, Panic, Depression, Stress, Life transition, Grief/loss, Relationship issues, Family issues, Trauma, Personal growth, Other. Separate from `profiles.issues`, which shapes daily content; the view falls back to `issues` for members who switched Match Mode on before `match_topics` existed | "seeks help with anxiety and stress" |
| Session preference | `profiles.match_delivery`: `in_person`, `telehealth` (video) or `both` | "seeking video sessions" |
| First three digits of the zip code | `left(profiles.zip, 3)`, exposed by the view as `area`; the zip code is required to switch on | "in the 902xx area" |

Nothing else. The view has no real name, gender, age, zip, email or content column.

## What therapists never see

The member's name, exact location, email address, journal, quiz results,
worksheet results, mood or goal logs, or anything else in their private
dashboard. Gender and exact age are no longer collected for Match Mode; older
rows may still hold them, but no view exposes them.

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
