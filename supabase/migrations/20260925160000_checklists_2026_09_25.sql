-- The two checklists for 2026-09-25: The Week After a Loss (Grief) and
-- When the Inner Critic Gets Loud (Self-Compassion).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-25
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('the-week-after-a-loss', 'The Week After a Loss', 'For the first days after someone has died, when ordinary life keeps asking things of you. It holds the bar at eating, resting and letting people help, and asks nothing of you beyond that.', 'Grief', '["Eat something every few hours — Grief empties the tank, and forgetting to eat makes all of it harder.", "Drink water and lie down — Your body is doing heavy work even when you are sitting still.", "Decide nothing big this week — No moves, no clearing out, no promises; they will all keep.", "Give one person a real job — A meal, a ride, a call made on your behalf; people want something to do.", "Say no to what you cannot face — Turning down a gathering is allowed, and it needs no explanation.", "Let the crying come when it comes — Grief does not keep to a schedule, and holding it back costs more.", "Keep one thread of routine — A shower, a walk, feeding the cat; one fixed point steadies a shapeless day.", "Reach out if it turns very dark — If you are thinking of harming yourself, call or text 988 at any hour."]'::jsonb, 'daily', array['Grief', 'Loss']::text[], 1, '2026-09-25T16:00:00+00:00'::timestamptz),
  ('when-the-inner-critic-gets-loud', 'When the Inner Critic Gets Loud', 'For the hours after a mistake, when the voice in your head starts summing up your whole character. It gets the accusation out where you can look at it, then tests it against what actually happened.', 'Self-Compassion', '["Write the sentence down word for word — On paper it reads like the accusation it is, not like the truth.", "Name the voice as a voice — “My critic is saying I am useless” puts a little air between you and it.", "Ask if you would say it to a friend — If it would be cruel out loud, it is cruel in your head too.", "Look for the actual evidence — One bad meeting is not a career, and one snapped reply is not a character.", "Ask what it is trying to protect — The critic usually believes it is keeping you from failing in public.", "Say the fair version instead — Not “I am wonderful”, just what a decent witness would say about today.", "Do one small competent thing — Action argues with the critic better than reasoning with it does.", "Tell someone what it has been saying — Said out loud to someone kind, it loses most of its size."]'::jsonb, 'as needed', array['Self-Compassion', 'Self-Esteem']::text[], 1, '2026-09-25T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
