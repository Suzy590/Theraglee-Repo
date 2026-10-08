-- =============================================================================
-- Theraglee Match Mode: the gender answer is read back after each sign-in again.
-- -----------------------------------------------------------------------------
-- 20260929190000_match_mode_gender.sql added profiles.match_gender to my_access()
-- so the Match Mode window reopened with the member's answer. The next rewrite
-- of my_access(), in 20261006120000_account_deletion.sql, added
-- deletion_requested_at but was written from the earlier copy and left
-- match_gender out. The answer stayed saved in profiles, but a member who turned
-- Match Mode off, signed out and signed back in found the gender choice blank
-- when switching it on again, and the "What therapists see" line forgot it.
--
-- This returns every match_* column plus deletion_requested_at. Per
-- docs/match-mode-consent.md, any new Match Mode column must be added here too.
-- =============================================================================

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
               p.match_insurance, p.match_gender, p.deletion_requested_at
        from public.profiles p where p.id = auth.uid()
      ) x
    ),
    'therapist', (
      select to_jsonb(t) from public.therapist_profiles t where t.user_id = auth.uid()
    )
  )
$function$;
