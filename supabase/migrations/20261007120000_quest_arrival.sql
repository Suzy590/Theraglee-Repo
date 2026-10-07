-- Reaching the destination on Mental Health Goals: once every milestone is
-- reached, the page asks the member to look back at the day they set out and
-- say whether they feel closer to the goal than they were then. The answer
-- is theirs, in three words and an optional note, and only shapes what the
-- page offers next (the same trail again, changed camps, a new goal). Nothing
-- scores it. The answer keys are the data contract with `data-arrive` in
-- site/assets/goals-ui.js; tests/quest-paths/check.mjs reads this file.
-- docs/quest-map.md is the guide.

alter table public.quests
  add column if not exists arrived_on     date,
  add column if not exists arrived_closer text check (arrived_closer in ('yes', 'some', 'no')),
  add column if not exists arrived_note   text check (char_length(arrived_note) <= 1000);

comment on column public.quests.arrived_on     is 'The day the member looked back, with every milestone reached.';
comment on column public.quests.arrived_closer is 'Whether they feel closer to the goal than when they set out: yes, some (of the way), or no. Their word, not a score.';
comment on column public.quests.arrived_note   is 'Optional: a few words from the member on what is different now.';
