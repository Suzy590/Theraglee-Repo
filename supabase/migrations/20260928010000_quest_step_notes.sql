-- Some micro-actions on the quest map are done by writing something down
-- ("Write three things you are glad of today"). Tapping one now opens a note
-- box, and the note is kept with the step so the member can read it back or
-- change it. Optional: a step marked without writing simply has no note.
-- docs/quest-map.md is the guide.

alter table public.quest_steps
  add column if not exists note text check (char_length(note) <= 1000);

comment on column public.quest_steps.note is
  'What the member wrote for a writing-type action, if anything. Private to them.';

-- Changing a note needs the update privilege, which quest_steps did not grant.
-- Same rule as the other quest tables: own rows, while Premium.
create policy "premium: update" on public.quest_steps for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.user_level() >= 3);
grant update on public.quest_steps to authenticated;
