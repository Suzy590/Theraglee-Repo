-- The two checklists for 2026-09-29: Parenting on Almost No Sleep (Parenting)
-- and When the House Has Got Away From You (Home).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-29
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('parenting-on-almost-no-sleep', 'Parenting on Almost No Sleep', 'For the stretch when the nights are broken and the days run on fumes. It drops the standard to feeding and safety, finds you an hour off, and takes the short temper off your conscience.', 'Parenting', '["Lower today to feeding and safety — Everything else on the list genuinely keeps until you have slept.", "Take the nap that is offered — Twenty minutes now beats a tidy kitchen you will not remember.", "Eat something without waiting to sit down — Standing over the sink still counts on a day like this.", "Get outside for ten minutes — Daylight and air do more for a foggy head than another coffee.", "Hand over an hour and actually leave — Hovering in the next room is not a break for anyone.", "Forgive the short temper — Snapping on two hours of sleep is a tired body, not the parent you are.", "Pick one thing to undo the chaos — The dishes or the floor, not both; one visible win is enough today.", "Ask for help before you are desperate — Help arranged on an ordinary day arrives faster than help begged for on a bad one."]'::jsonb, 'as needed', array['Parenting', 'Burnout']::text[], 1, '2026-09-29T16:00:00+00:00'::timestamptz),
  ('when-the-house-has-got-away-from-you', 'When the House Has Got Away From You', 'For the rooms that piled up during a hard stretch, when the whole job looks too big to start. It gives you fifteen minutes, one surface and no decisions, which is how a house actually gets climbed back out of.', 'Home', '["Start with a trash bag, not a plan — Throwing out needs no decisions and clears the most space fastest.", "Set a timer for fifteen minutes — The goal is to stop on time, not to finish the house.", "Do one surface, not one room — A cleared table you can see changes the feel of everything around it.", "Run the dishwasher or the laundry first — Machines do their part while you do yours.", "Put like with like before deciding anything — Sorting is easier than choosing, and it shows you the real size of it.", "Leave the sentimental box for another day — It is the slowest pile and it will stall you every time.", "Keep a donation bag by the door — Anything undecided goes in; if it is not missed in a month, it goes for good.", "Skip the guilt about how it got here — A house gets away from people during hard stretches, and this is the climb out."]'::jsonb, 'as needed', array['Habits', 'Self-Care']::text[], 1, '2026-09-29T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
