-- =============================================================================
-- Theraglee Match Mode: keep the answers across sign-ins, and add insurance.
-- -----------------------------------------------------------------------------
-- 1. my_access() is how every page loads the signed-in member's profile. It
--    never returned the Match Mode answers (pseudonym, age range, topics, how
--    to meet), so after each sign-in the "Therapists read" line showed
--    "Theraglee member · topics not chosen yet" and the window that edits them
--    opened blank, with a fresh pseudonym. The answers were saved all along;
--    they just weren't read back. my_access() now returns them.
--
-- 2. A member now says how they plan to pay: an insurance plan from the same
--    list therapists pick the plans they accept from (INSURANCES in
--    site/assets/lists.js), paying out of pocket ('self_pay'), or not sure yet
--    ('unsure'). Therapists read it in the Match Mode line, and the practice
--    dashboard marks members whose plan the therapist accepts.
-- =============================================================================

alter table public.profiles
  add column if not exists match_insurance text;

-- The plan names live in site/assets/lists.js and grow over time, so the check
-- keeps the value short and plain rather than repeating the whole list.
alter table public.profiles
  drop constraint if exists profiles_match_insurance_check;
alter table public.profiles
  add constraint profiles_match_insurance_check
    check (match_insurance is null
           or (length(match_insurance) between 2 and 100
               and match_insurance !~ '[<>]'));

comment on column public.profiles.match_insurance is
  'How the member plans to pay, shown to therapists in Match Mode: a plan name from INSURANCES in site/assets/lists.js, ''self_pay'' or ''unsure''.';

grant update (match_insurance) on public.profiles to authenticated;

-- 1. Load the Match Mode answers with the rest of the member's own profile.
create or replace function public.my_access()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'level', public.user_level(),
    'authenticated', auth.uid() is not null,
    'profile', (
      select to_jsonb(x) from (
        select p.id, p.email, p.full_name, p.role, p.tier, p.subscription_status,
               p.current_period_end, p.cancel_at_period_end, p.visible_to_therapists,
               p.issues, p.zip, p.daily_email, p.daily_email_kinds, p.onboarded,
               p.match_pseudonym, p.match_age_range, p.match_topics, p.match_delivery,
               p.match_insurance
        from public.profiles p where p.id = auth.uid()
      ) x
    ),
    'therapist', (
      select to_jsonb(t) from public.therapist_profiles t where t.user_id = auth.uid()
    )
  )
$function$;

-- 2. What a therapist can see: the same view, with insurance added at the end.
create or replace view public.member_discovery
with (security_invoker = off) as
select
  p.id,
  p.match_age_range as age_range,
  p.match_delivery  as delivery,
  coalesce(nullif(p.match_topics, '{}'), p.issues) as issues,
  case when p.zip ~ '^[0-9]{5}' then left(p.zip, 3) || 'xx' end as area,
  p.created_at,
  exists (
    select 1
    from public.therapist_outreach o
    join public.therapist_profiles t on t.id = o.therapist_id
    where o.member_id = p.id and t.user_id = auth.uid()
  ) as already_contacted,
  exists (
    select 1
    from public.outreach_replies r
    join public.therapist_profiles t on t.id = r.therapist_id
    where r.member_id = p.id and t.user_id = auth.uid()
  ) as has_replied,
  p.match_pseudonym as pseudonym,
  p.match_insurance as insurance
from public.profiles p
where p.visible_to_therapists
  and p.role = 'member'
  and (public.is_active_therapist() or public.is_admin())
  and not exists (
    select 1
    from public.member_blocks b
    join public.therapist_profiles t on t.id = b.therapist_id
    where b.member_id = p.id and t.user_id = auth.uid()
  );

revoke all on public.member_discovery from anon;
grant select on public.member_discovery to authenticated;
