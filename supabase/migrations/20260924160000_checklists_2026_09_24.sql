-- The two checklists for 2026-09-24: A Weekend With No One in It (Loneliness)
-- and When Money Worry Won't Switch Off (Money).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-24
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('a-weekend-with-no-one-in-it', 'A Weekend With No One in It', 'For the long, quiet weekend when nobody has called and the hours stretch out. It works on the two halves separately: making the time bearable now, and putting one thread out so next weekend has something in it.', 'Loneliness', '["Say it is loneliness, not a verdict — An empty weekend is a gap in the calendar, not proof about you.", "Get out among people once — A coffee shop, a library, a store; being near others counts even without talking.", "Send one message you would normally not send — “Thinking of you, how are things?” is enough to start.", "Put a shape on the day — One thing in the morning and one in the afternoon; empty hours get heavier.", "Move for twenty minutes — A walk changes the day more than another hour of scrolling will.", "Notice who you scroll past — Watching other people’s weekends is not the same as having one.", "Do one thing you would do for a guest — Cook properly, open the window, put music on; you count as company.", "Put one thing on the calendar for next week — A class, a call, a coffee; loneliness eases through plans, not willpower."]'::jsonb, 'as needed', array['Loneliness', 'Relationships']::text[], 1, '2026-09-24T16:00:00+00:00'::timestamptz),
  ('when-money-worry-wont-switch-off', 'When Money Worry Won’t Switch Off', 'For the nights the numbers keep circling and nothing gets decided. It turns the vague dread into facts, one next step and a time to stop, so the worry has somewhere to go besides 3 am.', 'Money', '["Write the actual number down — A known figure is easier to face than the one your head keeps rounding up.", "Separate this week from this year — Most money dread is a far-off problem borrowing tonight’s attention.", "Name the very next step — One call, one form, one email; not the whole way out.", "Give it a slot tomorrow — Worry lets go a little once it has an appointment.", "Find out what help exists — Payment plans, hardship terms and free advice lines are more common than people think.", "Tell one person the real picture — Money worry gets heavier in private than it ever is out loud.", "Stop checking the balance tonight — Looking again after hours changes nothing and costs you the sleep.", "Do one kind ordinary thing — Tea, a shower, a walk; being broke is not a reason to go without comfort."]'::jsonb, 'as needed', array['Money', 'Worry']::text[], 1, '2026-09-24T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
