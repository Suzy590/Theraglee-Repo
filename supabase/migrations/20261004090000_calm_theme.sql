-- A ninth theme for Goals & tracking: `calm`, "Feeling calmer day to day".
-- "Feel less stressed" is the goal people type most, and the eight themes
-- had no home for it (calm evenings is about the end of the day). The
-- value lists below are the data contract with VALUES in
-- site/assets/quest-paths.js; tests/quest-paths/check.mjs reads this file.
-- docs/quest-map.md is the guide.

alter table public.goals drop constraint if exists goals_value_key_check;
alter table public.goals add constraint goals_value_key_check check (value_key in (
  'calm_evenings', 'steady_routines', 'connection', 'energy',
  'time_outdoors', 'self_kindness', 'creativity', 'focus', 'calm'));

alter table public.quests drop constraint if exists quests_value_key_check;
alter table public.quests add constraint quests_value_key_check check (value_key in (
  'calm_evenings', 'steady_routines', 'connection', 'energy',
  'time_outdoors', 'self_kindness', 'creativity', 'focus', 'calm'));
