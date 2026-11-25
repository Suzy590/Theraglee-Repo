-- =============================================================================
-- The founding offer: what a match is, and no first charge without notice.
-- -----------------------------------------------------------------------------
-- Two changes on top of 20261023180000_founding_free_until_first_match.sql.
--
-- 1. What a match is.
--
--      A match is a regular (non-therapist) member whose pseudonymous Match
--      Mode profile fits a therapist's listing and so appears on that
--      therapist's dashboard. It is not a guarantee that the member will
--      schedule a session.
--
--    founding_first_matches() already followed the dashboard (Match Mode on,
--    not blocked, match_fits). It now also says the two things the sentence
--    above adds:
--
--      - a regular member: the account's role is `member`, on both paths,
--        the recorded sighting included. Never a therapist's or an
--        administrator's own account.
--      - a pseudonymous profile that matched: the member has a pseudonym and
--        has answered what the Match Mode window asks
--        (match_profile_complete(), the list matchComplete() keeps in
--        site/assets/match.js). match_fits() treats an unanswered question
--        as "not ruled out", which is right for who a dashboard shows, but a
--        row with Match Mode on and nothing filled in has not matched
--        anybody, so it never starts a therapist's billing.
--
-- 2. Notice before the first charge.
--
--    The founding-billing function used to move the Stripe trial's end and
--    then send the email; if the email failed, the charge still came a week
--    later, unannounced. It now sends the email first and only then touches
--    Stripe. profiles.first_match_notice_at records that the email went out,
--    so a run that failed after it starts billing on the date the therapist
--    was given instead of emailing a second date.
--
-- Nothing here changes who a therapist sees on the dashboard: member_discovery
-- and match_fits() are untouched.
-- =============================================================================

-- ----------------------------------------------------------------- column --
alter table public.profiles
  add column if not exists first_match_notice_at timestamptz;

comment on column public.profiles.first_match_notice_at is
  'When the email announcing a founding therapist''s first charge went out. Set by the founding-billing function before it starts billing in Stripe; billing begins a week after it.';
comment on column public.profiles.first_match_at is
  'When a founding therapist''s first match (a regular member whose pseudonymous Match Mode profile fits the listing and appears on the dashboard) started their billing. Set once by the founding-billing function, after the notice has gone out.';

-- Not a member's own choice: only the service role writes it.
revoke update (first_match_notice_at) on public.profiles from authenticated;

-- ------------------------------------------- a profile that can match --
-- True when the member has the pseudonymous profile Match Mode asks for: a
-- pseudonym and every answer in the window. Topics fall back to `issues`,
-- as member_discovery does for members who switched Match Mode on before
-- match_topics existed.
create or replace function public.match_profile_complete(p_member uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = p_member
       and p.match_pseudonym is not null
       and p.match_age_range is not null
       and p.match_gender is not null
       and coalesce(nullif(p.match_topics, '{}'), p.issues, '{}') <> '{}'
       and p.match_session_for is not null
       and p.match_insurance is not null
       and p.match_delivery is not null
       and p.zip ~ '^[0-9]{5}'
  )
$$;

comment on function public.match_profile_complete(uuid) is
  'Whether a member has the pseudonymous profile Match Mode asks for (a pseudonym and every answer). Used by founding_first_matches(): only such a member counts as a match that starts a founding therapist''s billing.';

revoke all on function public.match_profile_complete(uuid) from public, anon, authenticated;
grant  execute on function public.match_profile_complete(uuid) to service_role;

-- ------------------------------------------------- who has a match now --
-- Founding therapists whose free period is still running (a trialing
-- subscription on the founding price, no first match recorded) and whose
-- live listing now has a match: a regular member (role `member`) with a
-- pseudonymous profile (match_profile_complete) who either was recorded on
-- this therapist's dashboard (match_sightings) or is on it now by the rules
-- member_discovery uses (Match Mode on, not blocked, match_fits). A listing
-- that is not live has shown nobody anything, so it is not counted.
create or replace function public.founding_first_matches()
returns table (
  user_id       uuid,
  therapist_id  uuid,
  first_name    text,
  contact_email text,
  email         text
)
language sql
stable security definer
set search_path to 'public'
as $$
  select p.id, t.id, t.first_name, t.contact_email, p.email
    from public.profiles p
    join public.therapist_profiles t on t.user_id = p.id
   where p.role = 'therapist'
     and p.founding_member
     and p.first_match_at is null
     and p.subscription_status = 'trialing'
     and t.published
     and t.verification = 'verified'
     and (
       exists (
         select 1
           from public.match_sightings s
           join public.profiles m on m.id = s.member_id
          where s.therapist_id = t.id
            and m.role = 'member'
            and public.match_profile_complete(m.id)
       )
       or exists (
         select 1
           from public.profiles m
          where m.visible_to_therapists
            and m.role = 'member'
            and public.match_profile_complete(m.id)
            and not exists (
              select 1 from public.member_blocks b
               where b.member_id = m.id and b.therapist_id = t.id)
            and public.match_fits(m.id, t.id)
       )
     )
$$;

comment on function public.founding_first_matches() is
  'Founding therapists still in their free period whose live listing now has a match: a regular (non-therapist) member whose pseudonymous Match Mode profile fits the listing and appears on the dashboard. A match is not a guarantee of a scheduled session. Read every hour by the founding-billing function, which emails the therapist and then starts their billing.';

revoke all on function public.founding_first_matches() from public, anon, authenticated;
grant  execute on function public.founding_first_matches() to service_role;
