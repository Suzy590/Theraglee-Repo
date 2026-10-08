-- =============================================================================
-- verified_calls counts the calls that were answered
-- -----------------------------------------------------------------------------
-- The twilio-voice Edge Function keeps every forwarded call in
-- therapist_calls, answered or not, with `answered` saying which. The
-- dashboard shows `verified_calls` as "connected calls confirmed by the phone
-- network", so this redefines therapist_stats() (last defined in
-- 20261005120000_match_sightings.sql) to count only the answered ones. Nothing
-- else in the function changes.
-- =============================================================================

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
    where therapist_id = tid and occurred_at > prev and answered
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
