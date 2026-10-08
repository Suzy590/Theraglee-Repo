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
>   like to work on with a therapist, whether the sessions are for you, a couple
>   or your family, whether you’d prefer in-person/telehealth (video)/either,
>   your insurance, and the first 3 digits of your ZIP.
> - If you indicate that you are open to telehealth (video) sessions, therapists
>   anywhere in your state can reach out to you.
> - Your real name is shared only if you reply.
> - You can block any therapist with one tap.
> - Turning Theraglee Match Mode off makes you invisible to therapists again.

This is `MATCH_BLURB` in `site/assets/match.js`, shown under the Match Mode
switch on the dashboard and on the account page: a circled "i" labeled "How
Theraglee Match Mode works". The whole of the wording is folded under it as
one list, the bold lead and its sentence first (ending with a link to
`site/match-mode.html`, the plain-language explainer; see
[`therapist-pages.md`](therapist-pages.md)), then the details. The list opens
when the member hovers over it or clicks (or taps) it; the button reports
whether it is open (`aria-expanded`) to screen readers, and the dashboard's
switch names the list as its description. When the switch is turned on, a
window asks for every detail below, all required. It suggests a pseudonym ("Quiet Harbor 27") that
the member can keep, replace with another suggestion, or type over, and says it
will be shared with therapists and must not be their real name.

## What therapists can see before a member replies

| Detail | Where it comes from | What a therapist reads |
| --- | --- | --- |
| Pseudonym | `profiles.match_pseudonym`, 2 to 30 letters, digits, spaces and `. ' _ -`, chosen by the member | "Quiet Harbor 27" |
| Gender | `profiles.match_gender`: `male`, `female`, `non_binary` or `prefer_not` (Male, Female, Non-binary, Prefer not to answer). "Prefer not to answer" leaves it out of the line | "female"; the practice dashboard card reads "Prefers not to answer" |
| Age range | `profiles.match_age_range`, one of `18-24`, `25-34`, `35-44`, `45-54`, `55-64`, `65+` | "35–44" |
| Broad topics | `profiles.match_topics`, up to three from `SPECIALTIES` in `site/assets/lists.js` (the same list therapists pick their specialties from), chosen in three drop-downs. Separate from `profiles.issues`, which shapes daily content; the view falls back to `issues` for members who switched Match Mode on before `match_topics` existed. The short list the window offered before 2026-10-08 was folded into specialty names by `20261008150000_match_mode_matching.sql` | "seeks help with anxiety and stress" |
| Who the sessions are for | `profiles.match_session_for`: `individual`, `couple` or `family` (Just me, My partner and me, My family) | "couples therapy"; the practice dashboard card reads "A couple" |
| Session preference | `profiles.match_delivery`: `in_person`, `telehealth` (video) or `both` | "seeking video sessions" |
| How they plan to pay | `profiles.match_insurance`: a plan name from `INSURANCES` in `site/assets/lists.js` (the same list therapists pick the plans they accept from), `self_pay` or `unsure`. The practice dashboard marks members whose plan is in the therapist's `insurances` and can show only those | "has Aetna insurance", "paying out of pocket", "not sure about insurance yet" |
| First three digits of the zip code | `left(profiles.zip, 3)`, exposed by the view as `area`; the zip code is required to switch on | "in the 902xx area" |

Nothing else. The view has no real name, exact age, zip, email or content column.

The practice dashboard also remembers *when* a member first appeared on a
therapist's dashboard, so the Referrals tab can count each match once:
`match_sightings` holds the therapist's id, the member's id and that moment,
nothing more, and only the database's own functions read or write it
(`20261005120000_match_sightings.sql`). Switching Match Mode off or blocking a
therapist does not remove the row, since it is a count of the past, not a
view of the member; deleting the account does.

## How the answers are loaded

Every page reads the signed-in member's profile from `my_access()`
(latest copy: `20261008150000_match_mode_matching.sql`). It must return every
`match_*` column above; if one is left out, the "What therapists see" line (on
the dashboard, the link beside ON that opens it on hover or tap) forgets it at
each sign-in and the window opens blank for it, even though the answer is
saved. Add any new Match Mode column there too, and when another migration
rewrites `my_access()` for some other column, start from the latest copy so no
`match_*` column is dropped (that is how `match_gender` went missing between
2026-10-06 and 2026-10-08).

## Which therapists see a member

Since `20261008150000_match_mode_matching.sql` the `member_discovery` view
shows a therapist only the members who fit their listing, decided by
`match_fits(member, therapist)` on six things:

| Member | Therapist's listing | Fit |
| --- | --- | --- |
| `match_age_range` | `age_ranges` (Ages seen) | 18-24 is Young adults; 25-34 through 55-64 are Adults; 65+ is Senior adults |
| `match_gender` | `genders_seen` (Genders you see: `male`, `female`, `non_binary`, the same keys) | the member's gender is one of them; "Prefer not to answer" fits everyone |
| `match_topics` (or `issues` for older rows) | `specialties` | at least one topic is a specialty, compared without regard to case |
| `match_session_for` | `participants` (Who you see) | individual needs Individuals, couple needs Couples, family needs Families |
| `match_insurance` | `insurances` | the plan is one the therapist accepts; `self_pay` and `unsure` fit everyone, since every therapist is assumed to take cash |
| `match_delivery` and `zip` | `delivery`, `locations`, `license_states` | in person: an office whose zip code starts with the same three digits. Video: licensed in the zip code's state (`zip_state()`). Either: one or the other |

A listing with no Ages seen, Genders you see, specialties or Who you see has
said nothing to match against and is not ruled out on that point; insurance is
the exception, a named plan has to be on the listing. A member the therapist
has already written to stays in the view whether or not they still fit, so the
conversation on the practice dashboard keeps its line. An administrator with no
listing sees everyone. `tests/match-mode/check.mjs` keeps the keys and the
mappings in the migration in step with `site/assets/match.js` and
`site/assets/lists.js`.

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
  reply (`member_blocked()` in the outreach insert policy, and in the
  therapist's reply policy on `therapist_message_replies`, so a conversation
  the member started from a profile is covered too). The button is on every
  thread in the inbox, and the member can unblock from the same place, the
  Messages tab on the dashboard or the Inbox on the account page.

## Where the wording appears

- Landing page, Match Mode section (`site/index.html`)
- The Match Mode switch on the dashboard and the account page, and the window
  that opens when it is switched on (`site/dashboard.html`,
  `site/account.html`, `site/assets/match.js`)
- The member's Messages tab on the dashboard and Inbox on the account page
  (`site/assets/inbox.js`)
- The "What is Theraglee Match Mode?" answer on the pricing, account and
  For Therapists pages
- The member requests on the practice dashboard's Home tab (`site/therapist-dashboard.html`)
- Privacy Policy sections on therapists and on consumer health data
  (`site/privacy.html`)
