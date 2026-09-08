-- =============================================================================
-- Trivia scores: one row per member per trivia set.
-- -----------------------------------------------------------------------------
-- The 150 mental health trivia sets ship with the site
-- (site/assets/trivia-sets.js) the same way the free discovery tools do, so
-- there is no content table. What the database keeps is each Premium member's
-- best score, last score and play count per set, so scores follow the member
-- across devices instead of living in one browser's localStorage.
--
-- set_id is the set's stable v5 UUID from trivia-sets.js (the same id used in
-- favorites and item_progress with item_type = 'trivia'). It is not a foreign
-- key because the sets are not rows.
--
-- Trivia is a Premium feature, so writes require user_level() >= 3. Reads are
-- allowed to any signed-in member on their own rows, so a member whose
-- membership lapses can still see their history on the account page.
-- =============================================================================

create table if not exists public.trivia_scores (
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  set_id     uuid        not null,
  best       integer     not null check (best >= 0),
  last       integer     not null check (last >= 0),
  total      integer     not null check (total > 0),
  plays      integer     not null default 1 check (plays >= 1),
  played_at  timestamptz not null default now(),
  primary key (user_id, set_id),
  check (best <= total and last <= total)
);

comment on table public.trivia_scores is
  'Best and latest score per member per mental health trivia set (Premium). set_id is the set''s id in site/assets/trivia-sets.js.';

alter table public.trivia_scores enable row level security;

drop policy if exists "own trivia scores read"   on public.trivia_scores;
drop policy if exists "own trivia scores insert" on public.trivia_scores;
drop policy if exists "own trivia scores update" on public.trivia_scores;
drop policy if exists "own trivia scores delete" on public.trivia_scores;

create policy "own trivia scores read" on public.trivia_scores
  for select to authenticated
  using (user_id = auth.uid());

create policy "own trivia scores insert" on public.trivia_scores
  for insert to authenticated
  with check (user_id = auth.uid() and public.user_level() >= 3);

create policy "own trivia scores update" on public.trivia_scores
  for update to authenticated
  using (user_id = auth.uid() and public.user_level() >= 3)
  with check (user_id = auth.uid() and public.user_level() >= 3);

create policy "own trivia scores delete" on public.trivia_scores
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.trivia_scores from anon;
grant select, insert, update, delete on public.trivia_scores to authenticated;

-- Record one finished play. Keeps the best score, replaces the last score, and
-- counts the play, all in one statement so the page never has to read first.
create or replace function public.record_trivia_score(p_set_id uuid, p_score integer, p_total integer)
returns public.trivia_scores
language sql
security invoker
set search_path = public
as $$
  insert into public.trivia_scores as t (user_id, set_id, best, last, total, plays, played_at)
  values (auth.uid(), p_set_id, p_score, p_score, p_total, 1, now())
  on conflict (user_id, set_id) do update
    set best      = greatest(t.best, excluded.best),
        last      = excluded.last,
        total     = excluded.total,
        plays     = t.plays + 1,
        played_at = now()
  returning t.*;
$$;

revoke all on function public.record_trivia_score(uuid, integer, integer) from public, anon;
grant execute on function public.record_trivia_score(uuid, integer, integer) to authenticated;
