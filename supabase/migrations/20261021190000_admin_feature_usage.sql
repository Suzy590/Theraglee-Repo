-- =============================================================================
-- Feature usage for the admin Content tab.
-- -----------------------------------------------------------------------------
-- /admin.html#content now shows which features of the site members actually
-- use. Every activity table is locked to its owner's rows by row-level
-- security, so the admin's browser cannot count them itself; this function
-- counts for it, as the table owner, and hands back nothing but numbers.
--
-- admin_feature_usage(p_days) returns one JSON object:
--
--   days            the window it counted (7 to 365)
--   members_total   accounts with role = 'member'
--   members_new     of those, joined inside the window
--   members_active  distinct members with any counted use inside the window
--   features        one entry per feature, keyed as site/assets/admin-usage.js
--                   names them:
--       total, members          uses and distinct members, all time
--       recent, recent_members  the same inside the window
--       last_at                 the most recent use
--       also_total, also_recent a second thing counted for that feature
--                               (opens of its page, challenges started, ...);
--                               also_recent is null when the number is a
--                               count of now rather than of events
--
-- What counts as a use is listed next to each feature below, and said in
-- words on the admin page. Features with no table of their own (the desktop
-- pet, playlists, the resource map, the dashboard tabs) write a row to
-- activity_log from the browser (logActivity in site/assets/app.js); those
-- counts start from the day that logging shipped.
-- =============================================================================

create or replace function public.admin_feature_usage(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  days  int := greatest(least(coalesce(p_days, 30), 365), 7);
  since timestamptz := now() - make_interval(days => days);
  out   jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  with ev as (
    -- Journal: an entry written.
    select 'journal' as f, user_id as u, created_at as at, 'use' as k from public.journal_entries
    -- Mood tracker: a check-in.
    union all select 'mood', user_id, coalesce(submitted_at, logged_on::timestamptz), 'use' from public.mood_logs
    -- Self-discovery tools: a tool finished; also one opened.
    union all select 'discover', user_id, created_at, case when action = 'complete' then 'use' else 'also' end
      from public.activity_log where item_type = 'discover'
    -- Quizzes: a quiz finished; also one opened.
    union all select 'quizzes', user_id, created_at, 'use' from public.quiz_attempts
    union all select 'quizzes', user_id, created_at, 'also' from public.activity_log where item_type = 'quiz' and action = 'view'
    -- Worksheets: a worksheet saved; also one opened.
    union all select 'worksheets', user_id, created_at, 'use' from public.worksheet_responses
    union all select 'worksheets', user_id, created_at, 'also' from public.activity_log where item_type = 'worksheet' and action = 'view'
    -- Checklists: a day's boxes checked; also a checklist opened.
    union all select 'checklists', user_id, coalesce(updated_at, on_date::timestamptz), 'use' from public.checklist_progress
    union all select 'checklists', user_id, created_at, 'also' from public.activity_log where item_type = 'checklist' and action = 'view'
    -- Challenges: a day checked off; also a challenge started.
    union all select 'challenges', c.user_id, p.completed_on::timestamptz, 'use'
      from public.user_challenge_progress p join public.user_challenges c on c.id = p.user_challenge_id
    union all select 'challenges', user_id, created_at, 'also' from public.user_challenges
    -- Articles: an article read; also one favorited.
    union all select 'articles', user_id, created_at, 'use' from public.activity_log where item_type = 'article' and action = 'view'
    union all select 'articles', user_id, created_at, 'also' from public.favorites where item_type = 'article'
    -- Mandalas: a coloring saved; also a mandala opened.
    union all select 'mandalas', user_id, updated_at, 'use' from public.mandala_colorings
    union all select 'mandalas', user_id, created_at, 'also' from public.activity_log where item_type = 'mandala' and action = 'view'
    -- Trivia: a set played (one row per member per set, so repeat plays of the
    -- same set count once); also a set opened.
    union all select 'trivia', user_id, played_at, 'use' from public.trivia_scores
    union all select 'trivia', user_id, created_at, 'also' from public.activity_log where item_type = 'trivia' and action = 'view'
    -- Desktop pet: a download clicked; also the pet page opened.
    union all select 'pet', user_id, created_at, case when action = 'download' then 'use' else 'also' end
      from public.activity_log where item_type = 'pet'
    -- Mental Health Goals: a stepping stone checked off (or a day logged on an
    -- older goal); also a goal set.
    union all select 'goals', user_id, created_at, 'use' from public.quest_steps
    union all select 'goals', g.user_id, l.logged_on::timestamptz, 'use'
      from public.goal_logs l join public.goals g on g.id = l.goal_id
    union all select 'goals', user_id, created_at, 'also' from public.quests
    -- Playlists: a playlist opened (mood and genre both picked); also the tab opened.
    union all select 'playlists', user_id, created_at, 'use' from public.activity_log where item_type = 'playlist'
    union all select 'playlists', user_id, created_at, 'also' from public.activity_log where item_type = 'dashboard' and 'playlists' = any(tags)
    -- Local resource map: a place searched; also the tab opened.
    union all select 'nearby', user_id, created_at, 'use' from public.activity_log where item_type = 'nearby'
    union all select 'nearby', user_id, created_at, 'also' from public.activity_log where item_type = 'dashboard' and 'nearby' = any(tags)
    -- Today tab (daily quote, tip, fact, affirmation and journal prompt): the
    -- tab opened; also a daily email sent.
    union all select 'today', user_id, created_at, 'use' from public.activity_log where item_type = 'dashboard' and 'today' = any(tags)
    union all select 'today', user_id, created_at, 'also' from public.digest_sends where status = 'sent'
    -- Favorites and save for later: an item marked.
    union all select 'favorites', user_id, created_at, 'use' from public.favorites
    -- Therapist directory: a profile viewed (visitors count too, without a
    -- member); also a message sent to a therapist from their profile.
    union all select 'therapists', actor_id, occurred_at, 'use' from public.therapist_events where event_type = 'profile_view'
    union all select 'therapists', sender_user_id, created_at, 'also' from public.therapist_messages
    -- Theraglee Match Mode: a message exchanged between a therapist and a
    -- member who has it on. (The number of members with it on now is counted
    -- separately below.)
    union all select 'match', member_id, created_at, 'use' from public.therapist_outreach
    union all select 'match', member_id, created_at, 'use' from public.outreach_replies
    -- Tracking numbers: an answered call to a therapist's Theraglee number.
    union all select 'calls', null::uuid, occurred_at, 'use' from public.therapist_calls where answered
    -- Session payments: a session paid for through the site.
    union all select 'payments', payer_user_id, paid_at, 'use' from public.session_payments where paid_at is not null
    -- Sunday tool email: a sign-up; also an email sent.
    union all select 'toolmail', null::uuid, created_at, 'use' from public.tool_subscribers
    union all select 'toolmail', null::uuid, created_at, 'also' from public.tool_email_sends where status = 'sent'
    -- AssignRemind: an assignment made; also a workspace opened.
    union all select 'assignremind', null::uuid, created_at, 'use' from public.ar_assignments
    union all select 'assignremind', owner_id, created_at, 'also' from public.ar_workspaces
  ),
  per as (
    select f,
      count(*)                 filter (where k = 'use')                         as total,
      count(distinct u)        filter (where k = 'use')                         as members,
      count(*)                 filter (where k = 'use'  and at > since)         as recent,
      count(distinct u)        filter (where k = 'use'  and at > since)         as recent_members,
      max(at)                  filter (where k = 'use')                         as last_at,
      count(*)                 filter (where k = 'also')                        as also_total,
      count(*)                 filter (where k = 'also' and at > since)         as also_recent
    from ev group by f
  )
  select jsonb_build_object(
    'days', days,
    'members_total',  (select count(*) from public.profiles where role = 'member'),
    'members_new',    (select count(*) from public.profiles where role = 'member' and created_at > since),
    'members_active', (select count(distinct u) from ev where k = 'use' and u is not null and at > since),
    'features', (select coalesce(jsonb_object_agg(f, jsonb_build_object(
        'total', total, 'members', members, 'recent', recent, 'recent_members', recent_members,
        'last_at', last_at, 'also_total', also_total, 'also_recent', also_recent)), '{}'::jsonb) from per),
    -- Match Mode's second number is a count of now, not of events.
    'match_on', (select count(*) from public.profiles where role = 'member' and visible_to_therapists)
  ) into out;

  return out;
end $$;

revoke all on function public.admin_feature_usage(integer) from public, anon;
grant execute on function public.admin_feature_usage(integer) to authenticated;
