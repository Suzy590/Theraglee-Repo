-- The two checklists for 2026-09-27: When You Are the One Holding It Together
-- (Caregiving) and The First Day Back After Time Away (Transitions).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-27
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('when-you-are-the-one-holding-it-together', 'When You Are the One Holding It Together', 'For anyone looking after someone who needs a great deal, on the weeks it is all invisible. It puts your own name on the list, asks for help in a way people can actually answer, and makes room for the resentment.', 'Caregiving', '["Name what only you are doing — The appointments, the worry, the decisions made alone all count as work.", "Ask for one specific thing this week — “Can you sit with her Thursday?” lands where “let me know if you need anything” never does.", "Put your own appointment on the calendar — The dentist, the checkup, the haircut; caregivers postpone these for years.", "Eat one real meal sitting down — Standing at the counter between tasks does not count as eating.", "Take twenty minutes outside — Not an errand and not productive; twenty minutes that belong to you.", "Let something slip on purpose — Choose what drops rather than finding out when it breaks.", "Say the resentment out loud somewhere safe — Loving someone and being worn out by them sit together fine.", "Find one person in the same boat — A support group or a friend who gets it beats explaining from scratch."]'::jsonb, 'weekly', array['Caregiving', 'Burnout']::text[], 1, '2026-09-27T16:00:00+00:00'::timestamptz),
  ('the-first-day-back-after-time-away', 'The First Day Back After Time Away', 'For the morning you return to a full inbox and the break already feels undone. It gets you through the first day without losing what the time off gave you, and keeps the pile from setting the terms.', 'Transitions', '["Start an hour later if you can — Beginning the day before the inbox opens is easier than beginning inside it.", "Read everything before replying to anything — Half of what looked urgent sorted itself out while you were gone.", "Write down the three things that matter — A pile is not a list until you have turned it into one.", "Turn down the first new request — Whatever arrives on day one can wait until you have your footing.", "Keep one thing from the time away — The walk, the early night, the book; one habit is worth carrying back.", "Expect to feel behind and slow — The first day always feels like this; it is not a verdict on the break.", "Finish one small thing before lunch — One completed item does more for the day than three half-started ones.", "Leave on time today — Working late on day one sets the terms for the whole week."]'::jsonb, 'as needed', array['Life Transitions', 'Work']::text[], 1, '2026-09-27T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
