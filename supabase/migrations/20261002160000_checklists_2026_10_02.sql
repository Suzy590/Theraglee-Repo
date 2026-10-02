-- The two checklists for 2026-10-02: After a Fight With Someone You Love
-- (Relationships) and Studying When the Exam Is Close (Study).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-10-02
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('after-a-fight-with-someone-you-love', 'After a Fight With Someone You Love', 'For the hour or two after it, when the house is quiet and you are still rehearsing your side. It settles you first, then sorts out what is worth coming back to and how to open the door again.', 'Relationships', '["Give it twenty minutes before anything else — Nothing useful gets said while both of you are still flooded.", "Drink water and go to a different room — Your body comes down faster when the scene changes.", "Write your side out, for you only — On paper it loses the heat it has in your head.", "Find the one sentence underneath it — Usually it is “I felt dismissed” or “I felt alone”, not the dishes.", "Name one thing they got right — Not a concession; just the part of their case that holds.", "Decide what you are apologizing for — Your own share, specifically, with no “but” attached to it.", "Open with repair, not with the argument — “I hate it when we are like this” goes further than a better point.", "Agree when you will come back to it — Some things need a calmer hour, not the same night."]'::jsonb, 'as needed', array['Relationships', 'Communication']::text[], 1, '2026-10-02T16:00:00+00:00'::timestamptz),
  ('studying-when-the-exam-is-close', 'Studying When the Exam Is Close', 'For the last stretch before a test, when panic makes you reread the same pages for hours. It swaps rereading for recall, protects sleep as part of the work, and keeps the days before from eating you.', 'Study', '["Write what is actually on the exam — Vague dread covers more ground than the syllabus does.", "Close the notes and test yourself — Trying to recall it teaches more than reading it again.", "Work in blocks with real breaks — Forty minutes on, ten minutes properly off, beats four blurred hours.", "Start with what you avoid — The topic you keep skipping is usually the one costing you points.", "Make the hard bit smaller — One formula, one case, one date; progress needs a size you can hold.", "Protect sleep as part of studying — A tired brain cannot retrieve what a rested one knows.", "Eat and move once during the day — Studying through hunger makes the next hour slower, not longer.", "Stop at a set time tonight — An open-ended evening of panic studying does less than a planned one."]'::jsonb, 'daily', array['Stress', 'Motivation']::text[], 1, '2026-10-02T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
