-- =============================================================================
-- The evening mood reminder
-- -----------------------------------------------------------------------------
-- A member can tick a box on the dashboard's mood check-in (and on the
-- account page's Profile tab) to be emailed on the days they have not
-- submitted the check-in by evening. It is off until they tick it. This adds:
--
--   profiles.mood_reminder         the opt-in, the one column a member may
--                                  change here
--   mood_reminder_today()          the US calendar day the reminder is about
--   mood_reminder_sends            what was sent, so nobody gets two in a day
--   mood_reminder_recipients()     who is due a reminder tonight
--   mood_reminder_unsubscribe()    one click in the email turns it off
--   app_secrets.mood_reminder_key  the key pg_cron presents to the function
--   cron job mood-reminder         every day at 01:00 UTC: 9 pm Eastern in
--                                  summer and 8 pm in winter, 6 pm / 5 pm
--                                  Pacific
--
-- my_access() is rewritten to return the new column, so the tick box opens
-- in the state the member left it. The `mood-reminder` Edge Function
-- composes and sends; docs/mood.md is the guide.
-- =============================================================================

-- ------------------------------------------------------------------ profiles --
alter table public.profiles
  add column if not exists mood_reminder boolean not null default false;

comment on column public.profiles.mood_reminder is
  'Email the member in the evening on days they have not submitted the mood check-in. Opt-in: off until the member ticks the box.';

-- Members may change only the columns the site edits (20260907090000); this
-- is one more of them.
grant update (mood_reminder) on public.profiles to authenticated;

-- --------------------------------------------------------- mood_reminder_today --
-- The day a reminder is about. The job runs at 01:00 UTC, when every US time
-- zone is still on the previous calendar day; Los Angeles is the last to turn
-- over, so its date is "today" for every member. mood_logs.logged_on is the
-- browser's own local date, so the two compare directly.
create or replace function public.mood_reminder_today()
returns date
language sql stable
set search_path = public
as $$
  select (now() at time zone 'America/Los_Angeles')::date
$$;
revoke execute on function public.mood_reminder_today() from public, anon, authenticated;
grant  execute on function public.mood_reminder_today() to service_role;

-- --------------------------------------------------------- mood_reminder_sends --
create table if not exists public.mood_reminder_sends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  sent_on     date not null default public.mood_reminder_today(),
  status      text not null default 'sent' check (status in ('sent', 'failed')),
  error       text,
  created_at  timestamptz not null default now()
);
create unique index if not exists mood_reminder_sends_one_per_day
  on public.mood_reminder_sends (user_id, sent_on) where status = 'sent';

alter table public.mood_reminder_sends enable row level security;
drop policy if exists "member reads own sends" on public.mood_reminder_sends;
create policy "member reads own sends" on public.mood_reminder_sends
  for select using (user_id = auth.uid());
revoke all on public.mood_reminder_sends from anon;
grant select on public.mood_reminder_sends to authenticated;
grant all on public.mood_reminder_sends to service_role;

-- ---------------------------------------------------- mood_reminder_recipients --
-- Members due a reminder tonight: opted in, with an address, not closing
-- their account, with no submitted check-in for today, not already sent
-- today, and not already failed twice today. `started` says whether they
-- tapped a face for today without submitting the rest, so the email can say
-- the check-in is still open rather than not begun.
create or replace function public.mood_reminder_recipients(p_limit integer default 300)
returns table (
  user_id uuid, email text, full_name text, email_token uuid, started boolean
)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, p.email_token,
         exists (
           select 1 from public.mood_logs m
           where m.user_id = p.id and m.logged_on = public.mood_reminder_today()) as started
  from public.profiles p
  where p.mood_reminder
    and p.email is not null
    and p.role in ('member', 'admin')
    and p.deletion_requested_at is null
    and not exists (
      select 1 from public.mood_logs m
      where m.user_id = p.id and m.logged_on = public.mood_reminder_today()
        and m.submitted_at is not null)
    and not exists (
      select 1 from public.mood_reminder_sends s
      where s.user_id = p.id and s.sent_on = public.mood_reminder_today() and s.status = 'sent')
    and (select count(*) from public.mood_reminder_sends s
         where s.user_id = p.id and s.sent_on = public.mood_reminder_today() and s.status = 'failed') < 2
  order by p.created_at
  limit p_limit
$$;
revoke execute on function public.mood_reminder_recipients(integer) from public, anon, authenticated;
grant  execute on function public.mood_reminder_recipients(integer) to service_role;

-- --------------------------------------------------- mood_reminder_unsubscribe --
-- The one-click link in every reminder. The token is the same one the morning
-- email uses (profiles.email_token); only this switch is flipped.
create or replace function public.mood_reminder_unsubscribe(p_token uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles set mood_reminder = false where email_token = p_token;
  return found;
end $$;
revoke execute on function public.mood_reminder_unsubscribe(uuid) from public, anon, authenticated;
grant  execute on function public.mood_reminder_unsubscribe(uuid) to service_role;

-- ----------------------------------------------------------------- my_access --
-- The same function as 20261008120000_my_access_match_gender.sql, plus
-- mood_reminder, so the tick box on the dashboard and the account page opens
-- in the state the member left it.
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
               p.mood_reminder
        from public.profiles p where p.id = auth.uid()
      ) x
    ),
    'therapist', (
      select to_jsonb(t) from public.therapist_profiles t where t.user_id = auth.uid()
    )
  )
$function$;

-- --------------------------------------------------------------- app_secrets --
insert into public.app_secrets (key, value)
values ('mood_reminder_key', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- ------------------------------------------------------------------ schedule --
-- 01:00 UTC: the evening across the US, late enough that most of the day's
-- check-ins are in and early enough to still do today's. The function
-- presents the key from app_secrets, so the public URL cannot trigger sends.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'mood-reminder') then
    perform cron.unschedule('mood-reminder');
  end if;
end $$;

select cron.schedule(
  'mood-reminder',
  '0 1 * * *',
  $cron$
    select net.http_post(
      url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/mood-reminder',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-mood-reminder-key', (select value from public.app_secrets where key = 'mood_reminder_key')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $cron$
);
