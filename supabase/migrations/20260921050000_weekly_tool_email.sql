-- =============================================================================
-- The Sunday tool email, for visitors who have no account.
-- -----------------------------------------------------------------------------
-- Someone can hand over an address on the homepage and get one free discovery
-- tool every Sunday morning without signing up for anything. There is no
-- account, no password and no card. The only thing stored is the address, a
-- token that proves an unsubscribe link is theirs, and which tools have gone
-- out so the next one is new.
--
-- Delivery is Resend, the same provider the morning digest already uses. The
-- schedule is pg_cron calling the weekly-tools Edge Function, the same shape
-- as the daily digest.
-- =============================================================================

-- 1. The free tools the email draws from -------------------------------------
-- Seeded from site/assets/discover-tools.js by tools/discover_tools_sql.mjs,
-- in the companion migration. Every one of them is free and needs no account.

create table if not exists public.discover_tools (
  slug        text primary key,
  title       text not null,
  description text not null,
  topic       text not null,
  kind        text not null,
  minutes     smallint not null default 5,
  position    integer not null
);

comment on table public.discover_tools is
  'The free discovery tools, mirrored from site/assets/discover-tools.js so the weekly email can name one. Generated — do not edit by hand.';

create index if not exists discover_tools_position_idx on public.discover_tools (position);

alter table public.discover_tools enable row level security;
revoke all on public.discover_tools from anon, authenticated;
grant select on public.discover_tools to authenticated;

drop policy if exists "anyone signed in reads tools" on public.discover_tools;
create policy "anyone signed in reads tools" on public.discover_tools
  for select to authenticated using (true);

-- 2. Who asked for it ---------------------------------------------------------

create table if not exists public.tool_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  token           uuid not null default gen_random_uuid(),
  source          text,
  created_at      timestamptz not null default now(),
  last_sent_at    timestamptz,
  sent_count      integer not null default 0,
  unsubscribed_at timestamptz,
  constraint tool_subscribers_email_check check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

comment on table public.tool_subscribers is
  'Addresses for the Sunday tool email. These people have no Theraglee account; the address and the unsubscribe token are the whole record.';
comment on column public.tool_subscribers.token is
  'Proves an unsubscribe link belongs to this address. It is the only credential involved.';

create unique index if not exists tool_subscribers_email_key on public.tool_subscribers (lower(email));
create index if not exists tool_subscribers_due_idx on public.tool_subscribers (last_sent_at) where unsubscribed_at is null;

-- Nobody reaches this table from the browser. The Edge Functions use the
-- service role, which bypasses row level security.
alter table public.tool_subscribers enable row level security;
revoke all on public.tool_subscribers from anon, authenticated;

drop policy if exists "admin reads tool subscribers" on public.tool_subscribers;
create policy "admin reads tool subscribers" on public.tool_subscribers
  for select using (public.is_admin());

-- 3. What has already gone out ------------------------------------------------

create table if not exists public.tool_email_sends (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.tool_subscribers(id) on delete cascade,
  tool_slug     text references public.discover_tools(slug) on delete set null,
  status        text not null,
  error         text,
  created_at    timestamptz not null default now()
);

comment on table public.tool_email_sends is
  'One row per Sunday email. Keeps the next tool new for that reader and keeps "once a week" a fact rather than a hope.';

create index if not exists tool_email_sends_sub_idx on public.tool_email_sends (subscriber_id, created_at desc);

alter table public.tool_email_sends enable row level security;
revoke all on public.tool_email_sends from anon, authenticated;

drop policy if exists "admin reads tool sends" on public.tool_email_sends;
create policy "admin reads tool sends" on public.tool_email_sends
  for select using (public.is_admin());

-- 4. The next tool for one reader ---------------------------------------------
-- Walks the list in order and returns the first tool this reader has not been
-- sent. Once they have had all 360, it starts the cycle again.

create or replace function public.weekly_tool_for(p_subscriber uuid)
returns table (slug text, title text, description text, topic text, minutes smallint)
language sql stable security definer set search_path = public
as $$
  with sent as (
    select s.tool_slug from public.tool_email_sends s
    where s.subscriber_id = p_subscriber and s.status = 'sent' and s.tool_slug is not null
  )
  select t.slug, t.title, t.description, t.topic, t.minutes
  from public.discover_tools t
  where t.slug not in (select tool_slug from sent)
  order by t.position
  limit 1
$$;

revoke all on function public.weekly_tool_for(uuid) from public, anon, authenticated;
grant execute on function public.weekly_tool_for(uuid) to service_role;

-- A reader who has seen everything starts over rather than getting nothing.
create or replace function public.weekly_tool_next(p_subscriber uuid)
returns table (slug text, title text, description text, topic text, minutes smallint)
language plpgsql stable security definer set search_path = public
as $$
begin
  return query select * from public.weekly_tool_for(p_subscriber);
  if not found then
    return query
      select t.slug, t.title, t.description, t.topic, t.minutes
      from public.discover_tools t order by t.position limit 1;
  end if;
end $$;

revoke all on function public.weekly_tool_next(uuid) from public, anon, authenticated;
grant execute on function public.weekly_tool_next(uuid) to service_role;

-- 5. Who is due ---------------------------------------------------------------
-- Six days rather than seven, so a send that starts a little early or runs
-- long never skips somebody for a whole week.

create or replace function public.tool_email_recipients(p_limit integer default 500)
returns table (id uuid, email text, token uuid, sent_count integer)
language sql stable security definer set search_path = public
as $$
  select s.id, s.email, s.token, s.sent_count
  from public.tool_subscribers s
  where s.unsubscribed_at is null
    and (s.last_sent_at is null or s.last_sent_at < now() - interval '6 days')
  order by s.created_at
  limit greatest(p_limit, 0)
$$;

revoke all on function public.tool_email_recipients(integer) from public, anon, authenticated;
grant execute on function public.tool_email_recipients(integer) to service_role;

-- 6. One click to stop --------------------------------------------------------

create or replace function public.tool_email_unsubscribe(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare hit boolean;
begin
  update public.tool_subscribers
     set unsubscribed_at = coalesce(unsubscribed_at, now())
   where token = p_token
  returning true into hit;
  return coalesce(hit, false);
end $$;

revoke all on function public.tool_email_unsubscribe(uuid) from public, anon, authenticated;
grant execute on function public.tool_email_unsubscribe(uuid) to service_role;

-- 7. The key the scheduler presents -------------------------------------------

insert into public.app_secrets (key, value)
values ('weekly_tools_key', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- 8. Sunday morning -----------------------------------------------------------
-- 13:00 UTC on Sunday is 9 am Eastern and 6 am Pacific, the same hour the
-- daily digest goes out.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-tools') then
    perform cron.unschedule('weekly-tools');
  end if;
end $$;

select cron.schedule(
  'weekly-tools',
  '0 13 * * 0',
  $cron$
    select net.http_post(
      url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/weekly-tools',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-tools-key', (select value from public.app_secrets where key = 'weekly_tools_key')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $cron$
);
