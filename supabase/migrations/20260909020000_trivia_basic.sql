-- =============================================================================
-- Mental health trivia moves from Premium to Basic.
-- -----------------------------------------------------------------------------
-- The 150 trivia quizzes (site/assets/trivia-sets.js) are now part of Basic,
-- so a member at level 2 or above may write a score. 20260908120000 created
-- the trivia_scores policies at user_level() >= 3; this recreates the write
-- policies at >= 2. Reads and deletes are unchanged: any signed-in member on
-- their own rows.
-- =============================================================================

drop policy if exists "own trivia scores insert" on public.trivia_scores;
drop policy if exists "own trivia scores update" on public.trivia_scores;

create policy "own trivia scores insert" on public.trivia_scores
  for insert to authenticated
  with check (user_id = auth.uid() and public.user_level() >= 2);

create policy "own trivia scores update" on public.trivia_scores
  for update to authenticated
  using (user_id = auth.uid() and public.user_level() >= 2)
  with check (user_id = auth.uid() and public.user_level() >= 2);

comment on table public.trivia_scores is
  'Best and latest score per member per mental health trivia quiz (Basic). set_id is the quiz''s id in site/assets/trivia-sets.js.';
