-- The two checklists for 2026-09-28: Before a Conversation You Have Been
-- Dreading (Communication) and Getting Back to Moving Your Body (Body).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-28
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('before-a-conversation-you-have-been-dreading', 'Before a Conversation You Have Been Dreading', 'For the talk you have rehearsed in your head for weeks and still have not had. It sorts out what you actually want from it, gives you an opening line, and sets the bar somewhere you can reach.', 'Communication', '["Write down what you want to come out of it — An apology, a change, an answer; pick one, not all three.", "Cut it to one sentence — If you cannot say the point in a sentence, the conversation will wander.", "Decide your opening line and keep it — The first ten seconds are the hardest, so do not improvise them.", "Lead with what you noticed, not what they are — “The last three Fridays” goes somewhere; “you always” does not.", "Plan for them not taking it well — You are not responsible for managing their reaction as well as your own.", "Pick a time when neither of you is running — Not bedtime, not out the door, not over a meal you cooked.", "Decide what you will not get into — Name the old argument you are not reopening today.", "Set the bar at saying it, not at winning — Having said the thing out loud is the whole success here."]'::jsonb, 'as needed', array['Communication', 'Assertiveness']::text[], 1, '2026-09-28T16:00:00+00:00'::timestamptz),
  ('getting-back-to-moving-your-body', 'Getting Back to Moving Your Body', 'For the restart after weeks or years away, when the old routine feels out of reach and starting feels faintly humiliating. It sets the first week absurdly low on purpose, so there is a second week.', 'Body', '["Pick something you do not dread — The best exercise is whichever one you will still be doing in March.", "Make the first session laughably short — Ten minutes is plenty; the point this week is going, not the workout.", "Put it in the calendar twice — Two named slots beat a vague plan to go more often.", "Get the clothes out the night before — Removing one small obstacle decides more mornings than motivation does.", "Go at a pace you could talk at — Starting too hard is the most common way a restart ends in week one.", "Expect to feel unfit and go anyway — That feeling is the starting line, not a sign you should not be here.", "Skip the comparison to your old self — You are not behind; you are at the beginning, which is a different thing.", "Notice one thing that felt better — Sleep, mood, looser shoulders; that is the reason worth keeping."]'::jsonb, 'weekly', array['Movement', 'Motivation']::text[], 1, '2026-09-28T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
