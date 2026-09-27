-- The Premium Goals & tracking page becomes a quest map. A member starts from
-- something they would like more of in everyday life (a value, never a
-- symptom), picks the kinds of practice they like and how long they usually
-- have, and the page draws a story-like map of chapters with micro-actions
-- and optional side paths. Chapters open with the number of days the member
-- shows up, in a row or not; nothing is ever taken away. docs/quest-map.md is
-- the guide.
--
-- The value, category, minute and scene lists in the checks below are a data
-- contract with site/assets/quest-paths.js; tests/quest-paths/check.mjs fails
-- if they stop matching. To add one, change both, in a new migration.
--
-- Privacy: every row here is readable and writable by its owner only. No
-- therapist, admin screen or other member has a policy on these tables, and
-- nothing here is sent anywhere. A member keeps read and delete access after
-- leaving Premium, so they can always export or erase what they wrote; adding
-- or changing rows needs Premium (level 3).

-- 1. SMART goals ---------------------------------------------------------------
-- Specific is the title, Measurable is target_per_week (already there). These
-- add Achievable (minutes each time), Relevant (the value it serves), a cue for
-- when and where, and Time-bound (a date to look back on it). All optional, so
-- goals made before today stay valid.
alter table public.goals
  add column if not exists value_key text check (value_key in (
    'calm_evenings', 'steady_routines', 'connection', 'energy',
    'time_outdoors', 'self_kindness', 'creativity', 'focus')),
  add column if not exists cue       text check (char_length(cue) <= 140),
  add column if not exists minutes   smallint check (minutes between 1 and 240),
  add column if not exists review_on date;

comment on column public.goals.value_key is 'Which quest value this goal serves (a VALUES key in site/assets/quest-paths.js).';
comment on column public.goals.cue is 'When and where the member plans to do it, in their words.';
comment on column public.goals.minutes is 'Roughly how long each time takes, in minutes.';
comment on column public.goals.review_on is 'The date the member chose to look back on this goal.';

-- 2. Quests --------------------------------------------------------------------
create table if not exists public.quests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  value_key  text not null check (value_key in (
    'calm_evenings', 'steady_routines', 'connection', 'energy',
    'time_outdoors', 'self_kindness', 'creativity', 'focus')),
  intention  text check (char_length(intention) <= 140),
  categories text[] not null check (
    cardinality(categories) between 1 and 8
    and categories <@ array['habits', 'self_care', 'reflection', 'gratitude',
                            'movement', 'nature', 'connection', 'creativity']::text[]),
  minutes    smallint not null default 5 check (minutes in (2, 5, 10, 20)),
  scene      text not null default 'garden' check (scene in ('garden', 'lights', 'scenery')),
  helper     boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.quests is 'A member''s quest map on the Premium Goals & tracking page. docs/quest-map.md.';
comment on column public.quests.intention is 'Optional: what the member would like more of, in their own words.';
comment on column public.quests.helper is 'Whether the optional, rule-based suggestion helper is on.';

-- One quest on the go at a time; finished or replaced ones stay for the record.
create unique index if not exists quests_one_active on public.quests (user_id) where active;

-- 3. Micro-actions done --------------------------------------------------------
create table if not exists public.quest_steps (
  id         uuid primary key default gen_random_uuid(),
  quest_id   uuid not null references public.quests(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action_key text not null check (action_key ~ '^[a-z_]{3,40}$'),
  done_on    date not null default current_date,
  created_at timestamptz not null default now(),
  unique (quest_id, action_key, done_on)
);
create index if not exists quest_steps_user_day on public.quest_steps (user_id, done_on);

comment on table public.quest_steps is 'One row per micro-action a member marked done on a day. action_key is an ACTIONS key in site/assets/quest-paths.js.';

-- 4. What felt helpful ---------------------------------------------------------
create table if not exists public.quest_reflections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  noted_on   date not null default current_date,
  helped     text not null check (char_length(helped) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (user_id, noted_on)
);

comment on table public.quest_reflections is 'Optional, member-controlled notes on what felt helpful that day. Never read by anyone else.';

-- 5. Row-level security --------------------------------------------------------
alter table public.quests            enable row level security;
alter table public.quest_steps       enable row level security;
alter table public.quest_reflections enable row level security;

-- Read and delete: always your own.
create policy "own rows: read"   on public.quests for select to authenticated using (user_id = auth.uid());
create policy "own rows: delete" on public.quests for delete to authenticated using (user_id = auth.uid());
create policy "own rows: read"   on public.quest_steps for select to authenticated using (user_id = auth.uid());
create policy "own rows: delete" on public.quest_steps for delete to authenticated using (user_id = auth.uid());
create policy "own rows: read"   on public.quest_reflections for select to authenticated using (user_id = auth.uid());
create policy "own rows: delete" on public.quest_reflections for delete to authenticated using (user_id = auth.uid());

-- Add and change: your own, while Premium.
create policy "premium: insert" on public.quests for insert to authenticated
  with check (user_id = auth.uid() and public.user_level() >= 3);
create policy "premium: update" on public.quests for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.user_level() >= 3);

create policy "premium: insert" on public.quest_steps for insert to authenticated
  with check (user_id = auth.uid() and public.user_level() >= 3
    and exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid()));

create policy "premium: insert" on public.quest_reflections for insert to authenticated
  with check (user_id = auth.uid() and public.user_level() >= 3);
create policy "premium: update" on public.quest_reflections for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.user_level() >= 3);

-- 6. Privileges ----------------------------------------------------------------
-- Signed-out visitors get nothing; members get the four row privileges above
-- (TRUNCATE and friends are already off by default, 20260908130000).
revoke all on public.quests, public.quest_steps, public.quest_reflections from anon;
grant select, insert, update, delete on public.quests, public.quest_reflections to authenticated;
grant select, insert, delete on public.quest_steps to authenticated;
