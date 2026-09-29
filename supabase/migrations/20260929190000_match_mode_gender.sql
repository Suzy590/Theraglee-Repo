-- =============================================================================
-- Theraglee Match Mode: gender is asked for again, and therapists read it.
-- -----------------------------------------------------------------------------
-- profiles.match_gender has existed since 20260913200000_match_mode_anonymous.sql,
-- with its check ('female', 'male', 'non_binary', 'prefer_not') and the member's
-- update grant, but it was no longer asked for or shown. The Match Mode window
-- now asks for it (Male, Female, Non-binary, Prefer not to answer), so:
--
-- 1. my_access() returns it, so the answer is read back after each sign-in.
-- 2. member_discovery exposes it as `gender`, added at the end of the view.
-- =============================================================================

comment on column public.profiles.match_gender is
  'Gender shown to therapists in Match Mode: female, male, non_binary or prefer_not.';

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
               p.match_insurance, p.match_gender
        from public.profiles p where p.id = auth.uid()
      ) x
    ),
    'therapist', (
      select to_jsonb(t) from public.therapist_profiles t where t.user_id = auth.uid()
    )
  )
$function$;

-- 2. What a therapist can see: the same view, with gender added at the end.
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
  p.match_insurance as insurance,
  p.match_gender    as gender
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
