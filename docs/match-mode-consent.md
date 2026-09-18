# Theraglee Match Mode — consent wording

This is the wording a member reads when they switch **Theraglee Match Mode**
on, and the facts it rests on. It is kept in step with what the site actually
does: `site/assets/match.js` (the window that asks for the details and the one
line therapists read), the `member_discovery` view (what a therapist can
select), `outreach_replies.member_name` (where the real name travels) and
`member_blocks` (blocking). Change the code and this file in the same pull
request.

## What the member agrees to

> **Theraglee Match Mode** lets verified therapists in your area reach out to
> you. They see a **pseudonymous profile**, never your name: your age range,
> the broad topics you want to work on (like anxiety or burnout), whether you
> prefer in-person, video, or either, and your general location so they know
> you're nearby.
>
> Your name stays private until you decide otherwise. If you choose to reply to
> a therapist, your reply includes your real name — only then, and only to
> them.
>
> Match Mode is off by default. One tap hides your profile from therapists
> again whenever you like, and you can block any therapist with one tap.

## What therapists can see before a member replies

| Detail | Where it comes from | What a therapist reads |
| --- | --- | --- |
| Age range | `profiles.match_age_range`, one of `18-24`, `25-34`, `35-44`, `45-54`, `55-64`, `65+` | "35–44" |
| Broad topics | `profiles.issues`, the same topics that shape daily content | "seeks help with anxiety and burnout" |
| Session preference | `profiles.match_delivery`: `in_person`, `telehealth` (video) or `both` | "seeking video sessions" |
| General location | the first three digits of `profiles.zip`, exposed by the view as `area` | "in the 902xx area" |

Nothing else. The view has no name, gender, age, zip, email or content column.

## What therapists never see

The member's name, exact location, email address, journal, quiz results,
worksheet results, mood or goal logs, or anything else in their private
dashboard. Gender and exact age are no longer collected for Match Mode; older
rows may still hold them, but no view exposes them.

## When the real name is shared

Only when the member replies to a therapist's message. The reply form asks for
the real name at that moment, the database refuses a reply without one
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
  unblock from the same place, their Inbox on the account page.

## Where the wording appears

- Landing page, Match Mode section (`site/index.html`)
- The Match Mode switch on the dashboard and the account page, and the window
  that opens when it is switched on (`site/dashboard.html`,
  `site/account.html`, `site/assets/match.js`)
- The member's Inbox on the account page
- The "What is Theraglee Match Mode?" answer on the pricing, account and
  For Therapists pages
- The practice dashboard's Member requests tab (`site/therapist-dashboard.html`)
- Privacy Policy sections on therapists and on consumer health data
  (`site/privacy.html`)
