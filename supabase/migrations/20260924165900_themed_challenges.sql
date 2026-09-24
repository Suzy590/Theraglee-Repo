-- Challenges become themed. A challenge is now a theme ("Fostering Gratitude")
-- with a bank of daily to-dos; the member picks how many days it runs (7, 21,
-- 30, 90, 120, 150, 180, 365 or a custom 8 to 364) and the to-dos cycle
-- through the bank. challenge_templates.total_days is the size of that bank,
-- user_challenges.total_days is still the length the member chose.
--
-- The three fixed-length challenges imported from the original Word documents
-- are retired; no member run was started from any of them. published_at says
-- when a theme joined the library, the same way it does for checklists.
-- docs/challenges.md is the guide.

alter table public.challenge_templates
  add column if not exists published_at timestamptz;

delete from public.challenge_templates
  where slug in (
    '7-day-mental-health-reset',
    '30-day-overall-mental-health-improvement-challenge',
    '30-day-mental-health-challenge-for-veterans'
  );

comment on column public.challenge_templates.total_days is
  'How many daily to-dos the theme carries (its challenge_days rows). A run longer than this cycles through them again.';
comment on column public.challenge_templates.published_at is
  'When the theme joined the library. Two new themes are added every day.';
