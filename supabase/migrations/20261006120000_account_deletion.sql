-- Members delete their own account from the account page.
--
-- A member who pays through Stripe keeps what they paid for: Delete my account
-- turns off renewal (cancel_at_period_end) and records the request here; the
-- stripe-webhook function deletes the account when the subscription ends. A
-- member with no live subscription is deleted on the spot by delete-account.
-- Clearing the column (Keep my account) withdraws the request.
alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;

comment on column public.profiles.deletion_requested_at is
  'When the member asked for the account to be deleted. Set while a paid period runs out; the stripe-webhook function deletes the account when the subscription ends. Null means no request.';

-- my_access() returns it so the account page can show the scheduled deletion
-- and offer Keep my account.
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
               p.match_insurance, p.deletion_requested_at
        from public.profiles p where p.id = auth.uid()
      ) x
    ),
    'therapist', (
      select to_jsonb(t) from public.therapist_profiles t where t.user_id = auth.uid()
    )
  )
$function$;
