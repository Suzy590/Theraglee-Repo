-- =============================================================================
-- The founding offer: free until the first member match, then $20/month.
-- -----------------------------------------------------------------------------
-- A founding therapist pays nothing until the first member who matches their
-- practice appears on their dashboard. In Stripe that is a trialing
-- subscription on the founding price, with the card on file; the
-- `founding-billing` Edge Function ends the free period (a week ahead, with an
-- email) when the first match arrives. This migration adds what that needs:
--
--   profiles.founding_member    set by the Stripe webhook while a live
--                               subscription sits on the founding price; the
--                               Founding Member badge reads it
--   profiles.first_match_at     when the first matching member appeared, set
--                               once by the founding-billing function
--   my_access()                 returns both, for the practice dashboard
--   therapist_directory         shows `founding_member`, for the badge on the
--                               public profile and the directory card
--   founding_first_matches()    founding therapists still in their free period
--                               who now have a matching member
--   app_secrets.founding_key    the key pg_cron presents to the function
--   cron job founding-billing   calls the function every hour
--
-- The offer's own settings (switch, price, rate, spots, deadline) are
-- unchanged from 20260918120000_founding_member_offer.sql.
-- =============================================================================

-- ---------------------------------------------------------------- columns --
alter table public.profiles
  add column if not exists founding_member boolean not null default false,
  add column if not exists first_match_at  timestamptz;

comment on column public.profiles.founding_member is
  'True while the account''s live Stripe subscription is on the founding price. Set by the stripe-webhook function; shows the Founding Member badge.';
comment on column public.profiles.first_match_at is
  'When the first member who matched this therapist''s practice appeared on their dashboard. Set once by the founding-billing function, which starts billing from it.';

-- Neither is a member's own choice: only the service role writes them.
revoke update (founding_member, first_match_at) on public.profiles from authenticated;

-- ------------------------------------------------------------- my_access --
-- The latest copy (20261008150000_match_mode_matching.sql) plus the two new
-- columns, so the practice dashboard can say where the free period stands.
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
               p.match_insurance, p.match_gender, p.deletion_requested_at,
               p.match_session_for, p.founding_member, p.first_match_at
        from public.profiles p where p.id = auth.uid()
      ) x
    ),
    'therapist', (
      select to_jsonb(t) from public.therapist_profiles t where t.user_id = auth.uid()
    )
  )
$function$;

-- ----------------------------------------------------- the public listing --
-- The latest copy (20261008150000_match_mode_matching.sql) with
-- founding_member added at the end, the only place a replaced view may grow.
create or replace view public.therapist_directory as
  select id,
    slug,
    first_name,
    last_name,
    credentials,
    gender,
    bio,
    photo_url,
    practice_photos,
    license_states,
    insurances,
    delivery,
    locations,
    website,
    fees,
    education,
    specialties,
    top_specialties,
    age_ranges,
    participants,
    treatment_modalities,
    languages,
    verified_at,
    created_at,
    proxy_phone as tracking_phone,
    contact_email is not null as accepts_messages,
    (accepts_payments and charges_enabled and session_fee_cents is not null) as accepts_payments,
    case when accepts_payments and charges_enabled then session_fee_cents end as session_fee_cents,
    identity_status = 'verified' as identity_verified,
    payment_methods,
    education_school,
    education_degree,
    education_year,
    age_range_1,
    age_range_2,
    genders_seen,
    exists (
      select 1 from public.profiles p
       where p.id = t.user_id and p.founding_member
    ) as founding_member
  from public.therapist_profiles t
  where published and verification = 'verified';

-- ------------------------------------------------- who has a match now --
-- Founding therapists whose free period is still running (a trialing
-- subscription on the founding price, no first match recorded) and whose
-- live listing now has at least one matching member: either the dashboard
-- already recorded a sighting (match_sightings), or a member who has Match
-- Mode on fits the listing by the same rules member_discovery uses
-- (match_fits, not blocked). A listing that is not live has shown nobody
-- anything, so it is not counted.
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
       exists (select 1 from public.match_sightings s where s.therapist_id = t.id)
       or exists (
         select 1
           from public.profiles m
          where m.visible_to_therapists
            and m.role = 'member'
            and not exists (
              select 1 from public.member_blocks b
               where b.member_id = m.id and b.therapist_id = t.id)
            and public.match_fits(m.id, t.id)
       )
     )
$$;

comment on function public.founding_first_matches() is
  'Founding therapists still in their free period whose live listing now has a matching member. Read every hour by the founding-billing function, which starts their billing.';

revoke all on function public.founding_first_matches() from public, anon, authenticated;
grant  execute on function public.founding_first_matches() to service_role;

-- ----------------------------------------------------------- the shared key --
insert into public.app_secrets (key, value)
values ('founding_key', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- ------------------------------------------------------------------ schedule --
-- Every hour, at ten past, so a match is answered the same hour it appears.
-- The function presents the key from app_secrets, so the public URL cannot
-- be used to start anyone's billing.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'founding-billing') then
    perform cron.unschedule('founding-billing');
  end if;
end $$;

select cron.schedule(
  'founding-billing',
  '10 * * * *',
  $cron$
    select net.http_post(
      url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/founding-billing',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-founding-key', (select value from public.app_secrets where key = 'founding_key')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $cron$
);
