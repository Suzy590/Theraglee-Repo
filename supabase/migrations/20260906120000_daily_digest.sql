-- =============================================================================
-- Daily email digest
-- -----------------------------------------------------------------------------
-- Registered members are promised "automatic mental health articles sent to
-- your inbox". Until now `profiles.daily_email` was only a saved preference:
-- nothing read it and nothing sent anything. This migration adds the pieces
-- the `daily-digest` Edge Function needs:
--
--   level_for(uuid)        a member's access level for any user id, so the
--                          digest can respect min_level the way the site does
--   daily_pick_for(...)    the dashboard's personalized daily pick, for any user
--   profiles.email_token   one-click unsubscribe without signing in
--   digest_sends           what was sent, so nobody gets the same article twice
--                          in a month and nobody gets two emails on one day
--   digest_recipients()    who is due an email today
--   digest_article(uuid)   the article to include for a member
--   digest_unsubscribe()   flips daily_email off by token
--   app_secrets            the shared key pg_cron presents to the function
--   cron job daily-digest  calls the function every morning
--
-- The digest is on by default for new members, with an unsubscribe link in
-- every email and a switch on the dashboard and the account page.
-- =============================================================================

-- ---------------------------------------------------------------- level_for --
create or replace function public.level_for(p_user uuid)
returns smallint
language sql stable security definer
set search_path = public
as $$
  select case
    when p_user is null then 0::smallint
    else coalesce((
      select case
        when p.role = 'admin' then 3::smallint
        when p.role = 'therapist' then 1::smallint
        when p.tier = 'premium' and public.sub_active(p.subscription_status) then 3::smallint
        when p.tier = 'basic'   and public.sub_active(p.subscription_status) then 2::smallint
        else 1::smallint
      end
      from public.profiles p where p.id = p_user
    ), 1::smallint)
  end
$$;
revoke execute on function public.level_for(uuid) from public, anon, authenticated;
grant  execute on function public.level_for(uuid) to service_role;

-- user_level() keeps its signature (RLS policies depend on it) and now shares
-- one definition with level_for, so the two can never drift apart.
create or replace function public.user_level()
returns smallint
language sql stable security definer
set search_path = public
as $$
  select public.level_for(auth.uid())
$$;

-- ------------------------------------------------------------ daily_pick_for --
create or replace function public.daily_pick_for(p_user uuid, p_kind text, p_seed integer default 0)
returns setof public.daily_content
language plpgsql stable security definer
set search_path = public
as $function$
declare
  lvl       smallint := public.level_for(p_user);
  day_seed  int := ((current_date - date '2000-01-01') + p_seed);
  fav       text[];
  n         int;
  cycle     int;
  idx       int;
begin
  if p_user is not null then
    select array_agg(tag) into fav from (
      select unnest(tags) tag, count(*) c
      from public.activity_log
      where user_id = p_user and created_at > now() - interval '60 days'
      group by 1 order by c desc limit 5
    ) t;

    -- No history yet: the topics the member picked on their profile stand in.
    if fav is null then
      select nullif(array_agg(lower(i)), '{}') into fav
      from public.profiles p, unnest(p.issues) i
      where p.id = p_user;
    end if;
  end if;

  -- personalized deck, when there is something to personalize on
  if fav is not null and array_length(fav, 1) > 0 then
    select count(*) into n from public.daily_content d
    where d.kind = p_kind::public.daily_kind and d.active
      and d.min_level <= lvl and d.tags && fav;

    if n > 0 then
      cycle := day_seed / n;
      idx   := day_seed % n;
      return query
        select * from public.daily_content d
        where d.kind = p_kind::public.daily_kind and d.active
          and d.min_level <= lvl and d.tags && fav
        order by md5(d.id::text || cycle::text)
        offset idx limit 1;
      return;
    end if;
  end if;

  -- the full deck for this kind and access level
  select count(*) into n from public.daily_content d
  where d.kind = p_kind::public.daily_kind and d.active and d.min_level <= lvl;

  if n = 0 then return; end if;

  cycle := day_seed / n;
  idx   := day_seed % n;

  return query
    select * from public.daily_content d
    where d.kind = p_kind::public.daily_kind and d.active and d.min_level <= lvl
    order by md5(d.id::text || cycle::text)
    offset idx limit 1;
end $function$;
revoke execute on function public.daily_pick_for(uuid, text, integer) from public, anon, authenticated;
grant  execute on function public.daily_pick_for(uuid, text, integer) to service_role;

-- The site keeps calling daily_pick(); it is now a thin wrapper.
create or replace function public.daily_pick(p_kind text, p_seed integer default 0)
returns setof public.daily_content
language sql stable security definer
set search_path = public
as $$
  select * from public.daily_pick_for(auth.uid(), p_kind, p_seed)
$$;

-- ------------------------------------------------------------------ profiles --
alter table public.profiles
  add column if not exists email_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_email_token_idx on public.profiles (email_token);

-- On for new members. Existing rows keep whatever they chose.
alter table public.profiles alter column daily_email set default true;
alter table public.profiles alter column daily_email_kinds
  set default '{article,affirmation,tip,journal_prompt}'::text[];

-- -------------------------------------------------------------- digest_sends --
create table if not exists public.digest_sends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  sent_on     date not null default current_date,
  article_id  uuid references public.articles(id) on delete set null,
  kinds       text[] not null default '{}',
  status      text not null default 'sent' check (status in ('sent', 'failed')),
  error       text,
  created_at  timestamptz not null default now()
);
create unique index if not exists digest_sends_one_per_day
  on public.digest_sends (user_id, sent_on) where status = 'sent';
create index if not exists digest_sends_article_idx
  on public.digest_sends (user_id, article_id, sent_on);

alter table public.digest_sends enable row level security;
drop policy if exists "member reads own sends" on public.digest_sends;
create policy "member reads own sends" on public.digest_sends
  for select using (user_id = auth.uid());
revoke all on public.digest_sends from anon;
grant select on public.digest_sends to authenticated;
grant all on public.digest_sends to service_role;

-- --------------------------------------------------------- digest_recipients --
-- Members due an email today: opted in, have an address, not already sent
-- today, and not already failed twice today.
create or replace function public.digest_recipients(p_limit integer default 300)
returns table (
  user_id uuid, email text, full_name text, level smallint,
  kinds text[], email_token uuid
)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, public.level_for(p.id),
         p.daily_email_kinds, p.email_token
  from public.profiles p
  where p.daily_email
    and p.email is not null
    and p.role in ('member', 'admin')
    and cardinality(p.daily_email_kinds) > 0
    and not exists (
      select 1 from public.digest_sends s
      where s.user_id = p.id and s.sent_on = current_date and s.status = 'sent')
    and (select count(*) from public.digest_sends s
         where s.user_id = p.id and s.sent_on = current_date and s.status = 'failed') < 2
  order by p.created_at
  limit p_limit
$$;
revoke execute on function public.digest_recipients(integer) from public, anon, authenticated;
grant  execute on function public.digest_recipients(integer) to service_role;

-- ------------------------------------------------------------ digest_article --
-- The article for a member today: one they can read at their level, never
-- sent to them before if possible, otherwise the one they saw longest ago —
-- and never anything from the last 30 days. Returns nothing when every
-- article is too recent, so a small library does not repeat itself daily.
create or replace function public.digest_article(p_user uuid)
returns setof public.articles
language sql stable security definer
set search_path = public
as $$
  select a.*
  from public.articles a
  left join lateral (
    select max(s.sent_on) as last_on
    from public.digest_sends s
    where s.user_id = p_user and s.article_id = a.id and s.status = 'sent'
  ) s on true
  where a.min_level <= public.level_for(p_user)
    and (a.published_at is null or a.published_at <= now())
    and (s.last_on is null or s.last_on <= current_date - 30)
  order by s.last_on asc nulls first, a.published_at desc nulls last
  limit 1
$$;
revoke execute on function public.digest_article(uuid) from public, anon, authenticated;
grant  execute on function public.digest_article(uuid) to service_role;

-- -------------------------------------------------------- digest_unsubscribe --
create or replace function public.digest_unsubscribe(p_token uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles set daily_email = false where email_token = p_token;
  return found;
end $$;
revoke execute on function public.digest_unsubscribe(uuid) from public, anon, authenticated;
grant  execute on function public.digest_unsubscribe(uuid) to service_role;

-- --------------------------------------------------------------- app_secrets --
-- Keys that only the database and the service role may read. RLS with no
-- policies means anon and authenticated see nothing even if granted.
create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
grant all on public.app_secrets to service_role;

insert into public.app_secrets (key, value)
values ('digest_key', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- ------------------------------------------------------------------ schedule --
-- 13:00 UTC is 9 am Eastern / 6 am Pacific. The function presents the key
-- from app_secrets, so the public URL cannot be used to trigger sends.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-digest') then
    perform cron.unschedule('daily-digest');
  end if;
end $$;

select cron.schedule(
  'daily-digest',
  '0 13 * * *',
  $cron$
    select net.http_post(
      url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/daily-digest',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-digest-key', (select value from public.app_secrets where key = 'digest_key')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $cron$
);
