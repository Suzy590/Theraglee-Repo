-- The Premium Goals & tracking page becomes goal-first: a goal in the
-- member's own words, three to five milestones they can notice in real life,
-- and a few small stepping stones a day toward the milestone they are
-- working on now. docs/quest-map.md is the guide.
--
-- Nothing here reads or scores anything: the milestones are the member's
-- words, reached when they say so. Privacy as before: every row is readable
-- and deletable by its owner only, and adding or changing needs Premium.

-- 1. The goal sentence is longer than the old one-line intention -------------
alter table public.quests drop constraint if exists quests_intention_check;
alter table public.quests add constraint quests_intention_check check (char_length(intention) <= 240);
comment on column public.quests.intention is 'The member''s goal, in their own words (up to 240 characters).';

-- 2. Milestones ---------------------------------------------------------------
create table if not exists public.quest_milestones (
  id         uuid primary key default gen_random_uuid(),
  quest_id   uuid not null references public.quests(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 140),
  position   smallint not null check (position between 0 and 11),
  -- Stepping stones from the action library (ACTIONS keys in site/assets/quest-paths.js)…
  actions    text[] not null default '{}' check (cardinality(actions) <= 8),
  -- …and ones the member wrote themselves.
  own_steps  text[] not null default '{}' check (cardinality(own_steps) <= 8),
  reached_on date,
  checked_on date,
  created_at timestamptz not null default now(),
  unique (quest_id, position)
);
create index if not exists quest_milestones_user on public.quest_milestones (user_id);

comment on table public.quest_milestones is 'The milestones of a member''s goal on Goals & tracking, in order. Reached when the member says so.';
comment on column public.quest_milestones.actions is 'Stepping stones from the action library, by key.';
comment on column public.quest_milestones.own_steps is 'Stepping stones the member wrote, in their words.';
comment on column public.quest_milestones.reached_on is 'The day the member said this milestone is happening for them.';
comment on column public.quest_milestones.checked_on is 'The last day the member answered the weekly "is this happening?" question.';

-- 3. A step belongs to a milestone --------------------------------------------
alter table public.quest_steps
  add column if not exists milestone_id uuid references public.quest_milestones(id) on delete set null;
create index if not exists quest_steps_milestone on public.quest_steps (milestone_id, done_on);

-- A stepping stone the member wrote has a key like own_1a2b3c4d_0, so keys may
-- carry digits now. Old keys still fit.
alter table public.quest_steps drop constraint if exists quest_steps_action_key_check;
alter table public.quest_steps add constraint quest_steps_action_key_check check (action_key ~ '^[a-z0-9_]{3,60}$');

-- 4. Row-level security -------------------------------------------------------
alter table public.quest_milestones enable row level security;

create policy "own rows: read"   on public.quest_milestones for select to authenticated using (user_id = auth.uid());
create policy "own rows: delete" on public.quest_milestones for delete to authenticated using (user_id = auth.uid());
create policy "premium: insert" on public.quest_milestones for insert to authenticated
  with check (user_id = auth.uid() and public.user_level() >= 3
    and exists (select 1 from public.quests q where q.id = quest_id and q.user_id = auth.uid()));
create policy "premium: update" on public.quest_milestones for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.user_level() >= 3);

-- 5. Privileges ---------------------------------------------------------------
revoke all on public.quest_milestones from anon;
grant select, insert, update, delete on public.quest_milestones to authenticated;
