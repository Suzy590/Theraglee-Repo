-- =============================================================================
-- Match Mode matches on the Referrals tab, each member counted once.
-- -----------------------------------------------------------------------------
-- The practice dashboard's Referrals tab reports what Theraglee brought in:
-- profile views, calls, messages, website clicks and shares. It now also
-- reports how many Theraglee Match Mode members have appeared on the
-- therapist's dashboard, as a figure the therapist can put beside the others.
--
-- A member is counted once, on the first day they appear on that therapist's
-- dashboard. A member who waits several days for an answer, or who switches
-- Match Mode off and on again, is still one match. So the count cannot be
-- taken from `member_discovery` as it stands today: that view says who is
-- visible now, not when each one first was. Instead:
--
--   match_sightings       one row per therapist and member, with the moment
--                         the member first appeared on that dashboard. The
--                         row carries nothing about the member but their id.
--   note_match_sightings  called by the dashboard when it opens and whenever
--                         the Member requests tab is drawn: adds a row for
--                         every member in `member_discovery` who has none yet,
--                         and leaves the rest alone. It records only what
--                         the therapist can see right then, since the view
--                         already hides members who blocked them and shows
--                         nothing to a therapist whose listing is not live.
--   therapist_stats       now returns `matches` in `current` and `previous`
--                         (first sightings in the chosen range and the one
--                         before it), `matches_total` (every member ever
--                         counted) and `matches` in each day of `series`.
--
-- Nobody reads or writes the table directly: the function that records
-- sightings and the one that counts them both run as the owner.
-- =============================================================================

create table if not exists public.match_sightings (
  therapist_id  uuid not null references public.therapist_profiles(id) on delete cascade,
  member_id     uuid not null references public.profiles(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (therapist_id, member_id)
);

comment on table public.match_sightings is
  'The first time each Match Mode member appeared on a therapist''s dashboard. One row per pair, never updated, so a match is counted once.';

create index if not exists match_sightings_therapist_seen_idx
  on public.match_sightings (therapist_id, first_seen_at);

alter table public.match_sightings enable row level security;
revoke all on public.match_sightings from anon, authenticated;

-- ---------------------------------------------- record what is on screen --
create or replace function public.note_match_sightings()
returns integer
language plpgsql
volatile security definer
set search_path to 'public'
as $$
declare
  tid   uuid;
  added integer := 0;
begin
  select t.id into tid
  from public.therapist_profiles t where t.user_id = auth.uid();
  if tid is null then
    return 0;
  end if;

  -- member_discovery already applies every rule about who this therapist may
  -- see (Match Mode on, listing live, not blocked), under the caller's uid.
  insert into public.match_sightings (therapist_id, member_id)
  select tid, m.id
  from public.member_discovery m
  on conflict (therapist_id, member_id) do nothing;
  get diagnostics added = row_count;

  return added;
end $$;

revoke all on function public.note_match_sightings() from public, anon;
grant execute on function public.note_match_sightings() to authenticated, service_role;

-- --------------------------------------------------- count them in stats --
create or replace function public.therapist_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  tid   uuid;
  days  int := greatest(least(coalesce(p_days, 30), 365), 1);
  since timestamptz := now() - make_interval(days => days);
  prev  timestamptz := now() - make_interval(days => days * 2);
  out   jsonb;
begin
  select t.id into tid
  from public.therapist_profiles t where t.user_id = auth.uid();
  if tid is null then
    return jsonb_build_object('error', 'no_listing');
  end if;

  with ev as (
    select event_type::text as k, occurred_at
    from public.therapist_events
    where therapist_id = tid and occurred_at > prev
  ),
  msg as (
    select created_at from public.therapist_messages
    where therapist_id = tid and created_at > prev
  ),
  calls as (
    select occurred_at from public.therapist_calls
    where therapist_id = tid and occurred_at > prev
  ),
  seen as (
    select first_seen_at from public.match_sightings
    where therapist_id = tid and first_seen_at > prev
  ),
  current_window as (
    select
      count(*) filter (where k = 'profile_view'  and occurred_at > since) as profile_views,
      count(*) filter (where k = 'call'          and occurred_at > since) as call_taps,
      count(*) filter (where k = 'website_click' and occurred_at > since) as website_clicks,
      count(*) filter (where k = 'share'         and occurred_at > since) as shares
    from ev
  ),
  prior_window as (
    select
      count(*) filter (where k = 'profile_view'  and occurred_at <= since) as profile_views,
      count(*) filter (where k = 'call'          and occurred_at <= since) as call_taps,
      count(*) filter (where k = 'website_click' and occurred_at <= since) as website_clicks,
      count(*) filter (where k = 'share'         and occurred_at <= since) as shares
    from ev
  ),
  series as (
    select d::date as day,
      (select count(*) from ev   where k = 'profile_view'  and occurred_at::date = d::date) as views,
      (select count(*) from ev   where k = 'call'          and occurred_at::date = d::date) as calls,
      (select count(*) from msg  where created_at::date    = d::date)                       as messages,
      (select count(*) from ev   where k = 'website_click' and occurred_at::date = d::date) as website,
      (select count(*) from ev   where k = 'share'         and occurred_at::date = d::date) as shares,
      (select count(*) from seen where first_seen_at::date = d::date)                       as matches
    from generate_series(since::date, current_date, interval '1 day') d
  )
  select jsonb_build_object(
    'range_days', days,
    'current', jsonb_build_object(
        'profile_views',  (select profile_views  from current_window),
        'call_taps',      (select call_taps      from current_window),
        'verified_calls', (select count(*) from calls where occurred_at > since),
        'messages',       (select count(*) from msg   where created_at  > since),
        'website_clicks', (select website_clicks from current_window),
        'shares',         (select shares         from current_window),
        'matches',        (select count(*) from seen  where first_seen_at > since)),
    'previous', jsonb_build_object(
        'profile_views',  (select profile_views  from prior_window),
        'call_taps',      (select call_taps      from prior_window),
        'verified_calls', (select count(*) from calls where occurred_at <= since),
        'messages',       (select count(*) from msg   where created_at  <= since),
        'website_clicks', (select website_clicks from prior_window),
        'shares',         (select shares         from prior_window),
        'matches',        (select count(*) from seen  where first_seen_at <= since)),
    'matches_total', (select count(*) from public.match_sightings where therapist_id = tid),
    'series', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', day, 'views', views, 'calls', calls, 'messages', messages,
        'website', website, 'shares', shares, 'matches', matches) order by day), '[]'::jsonb) from series),
    'unread_messages', (select count(*) from public.therapist_messages
                        where therapist_id = tid and read_at is null)
  ) into out;

  return out;
end $$;
