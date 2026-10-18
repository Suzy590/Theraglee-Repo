-- =============================================================================
-- Follow-up emails for therapists who start a listing and stop.
-- -----------------------------------------------------------------------------
-- A therapist creates an account, and then one of three things is still
-- missing before the listing can go live: the membership, the license (and
-- the profile members are matched on), or both. Each morning the
-- `therapist-nudges` Edge Function writes to each of them once per step, on
-- days 1, 3, 7 and 14 after the account was created, and never again after
-- that. The listing going live, a rejected license (verify-license has already
-- said what to do), a deletion request, or one click on the unsubscribe link
-- ends the sequence.
--
--   profiles.therapist_nudges       the switch; off after one click
--   therapist_nudge_sends           one row per email, so no step goes twice
--   therapist_nudge_recipients()    who is still unfinished, and at which stage
--   therapist_nudge_unsubscribe()   flips the switch by the profile's email token
--
-- The function presents the key in app_secrets; the schedule at the end runs
-- it at 15:00 UTC (11 am Eastern), two hours after the member digest.
-- =============================================================================

alter table public.profiles
  add column if not exists therapist_nudges boolean not null default true;

-- ------------------------------------------------------ therapist_nudge_sends --
create table if not exists public.therapist_nudge_sends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  step        text not null check (step in ('day1', 'day3', 'day7', 'day14')),
  stage       text not null check (stage in ('nothing_yet', 'no_membership', 'no_license')),
  status      text not null default 'sent' check (status in ('sent', 'failed')),
  error       text,
  created_at  timestamptz not null default now()
);
create unique index if not exists therapist_nudge_sends_one_per_step
  on public.therapist_nudge_sends (user_id, step) where status = 'sent';
create index if not exists therapist_nudge_sends_user_idx
  on public.therapist_nudge_sends (user_id, created_at);

alter table public.therapist_nudge_sends enable row level security;
drop policy if exists "therapist reads own nudges" on public.therapist_nudge_sends;
create policy "therapist reads own nudges" on public.therapist_nudge_sends
  for select using (user_id = auth.uid());
revoke all on public.therapist_nudge_sends from anon;
grant select on public.therapist_nudge_sends to authenticated;
grant all on public.therapist_nudge_sends to service_role;

-- --------------------------------------------------- therapist_nudge_recipients --
-- Therapist accounts between one and forty-five days old whose listing is not
-- live, with what is still missing. The function decides which step, if any,
-- is due today from created_at and sent_steps; this only says who is
-- unfinished. Two failures in a day stop further tries that day.
create or replace function public.therapist_nudge_recipients(p_limit integer default 300)
returns table (
  user_id uuid, email text, first_name text, created_at timestamptz,
  stage text, sent_steps text[], email_token uuid
)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.email,
         coalesce(nullif(t.first_name, ''), nullif(split_part(coalesce(p.full_name, ''), ' ', 1), '')),
         p.created_at,
         case
           when t.license_number is not null and public.sub_active(p.subscription_status) then null
           when t.license_number is not null then 'no_membership'
           when public.sub_active(p.subscription_status) then 'no_license'
           else 'nothing_yet'
         end as stage,
         coalesce((select array_agg(s.step order by s.created_at)
                     from public.therapist_nudge_sends s
                    where s.user_id = p.id and s.status = 'sent'), '{}'::text[]),
         p.email_token
  from public.profiles p
  left join public.therapist_profiles t on t.user_id = p.id
  where p.role = 'therapist'
    and p.therapist_nudges
    and p.email is not null
    and p.deletion_requested_at is null
    and p.created_at <= now() - interval '1 day'
    and p.created_at >  now() - interval '45 days'
    and coalesce(t.published, false) = false
    and coalesce(t.verification::text, '') <> 'rejected'
    and not (t.license_number is not null and public.sub_active(p.subscription_status))
    and (select count(*) from public.therapist_nudge_sends s
          where s.user_id = p.id and s.status = 'failed' and s.created_at > now() - interval '1 day') < 2
  order by p.created_at
  limit p_limit
$$;
revoke all on function public.therapist_nudge_recipients(integer) from public, anon, authenticated;
grant execute on function public.therapist_nudge_recipients(integer) to service_role;

-- ------------------------------------------------- therapist_nudge_unsubscribe --
create or replace function public.therapist_nudge_unsubscribe(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare hit boolean;
begin
  update public.profiles
     set therapist_nudges = false
   where email_token = p_token
     and role = 'therapist'
  returning true into hit;
  return coalesce(hit, false);
end $$;
revoke all on function public.therapist_nudge_unsubscribe(uuid) from public, anon, authenticated;
grant execute on function public.therapist_nudge_unsubscribe(uuid) to service_role;

-- --------------------------------------------------- the key the scheduler presents --
insert into public.app_secrets (key, value)
values ('therapist_nudges_key', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- ------------------------------------------------------------------ schedule --
do $$
begin
  if exists (select 1 from cron.job where jobname = 'therapist-nudges') then
    perform cron.unschedule('therapist-nudges');
  end if;
end $$;

select cron.schedule(
  'therapist-nudges',
  '0 15 * * *',
  $cron$
    select net.http_post(
      url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/therapist-nudges',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-nudges-key', (select value from public.app_secrets where key = 'therapist_nudges_key')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $cron$
);
