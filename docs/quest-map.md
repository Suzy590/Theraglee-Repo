# Mental Health Goals: the goal, the milestones, the stepping stones

**Mental Health Goals** is a Premium (level 3) tab on the member dashboard's
menu bar (`dashboard.html#goals`); `site/goals.html` forwards there. It is built
from three levels, top to bottom, and one picture beside them:

| Level | What it is | On the map |
|---|---|---|
| **Your goal** | One sentence in the member's own words ("Evenings that feel like mine again"). The destination. It does not change day to day. | The far hills, with a drawing for the goal's theme: a lit cabin, a lighthouse, a campfire, a sunrise, a peak with a flag, a bench under a tree, an easel, a lookout tower |
| **Working on now** | One of three to five milestones the member chose: things they could notice in real life ("The phone charges outside the bedroom most nights"), never numbers. Reached when the member says so. | Camps along the path, a tent and a numbered flag each; a green check flag once reached, a glow on the current one, the ones ahead a little faded |
| **Today's stepping stones** | A few small actions from the library (`ACTIONS` in `quest-paths.js`), or ones the member wrote, that serve the current milestone. Any one of them done today is today's step. Small on purpose, and the page says so. | The hiker, who moves a little toward the next camp for every day a stone is done (seven steps is the suggested distance) |

Beside the three levels, in the **left third of the tab**, the same trail is
written out in words (**Where you are**, `.trail-guide` in `site/dashboard.html`,
filled by `drawGuide()` in `goals-ui.js`): why Theraglee Goals are built as a
process (a destination, camps along the trail, small stepping stones each day),
the current goal, then every milestone in order with its stepping stones, "to
be repeated until your next milestone", and a reminder to jot down what helped
under **What helped today?**. The milestone being worked on carries a
**You are here** arrow; reached ones are folded to a line. It is the picture
for people who read lists rather than maps, and it redraws whenever the trail
does. The wellness note runs across the top of both columns; on a phone the
trail comes first and the guide follows it. Before a goal is set it shows the
explanation alone.

Under the stones, **Tonight: what helped today?** is one line that opens into
the optional daily note. Everything else (rewording the goal, changing
milestones or stones, what grows along the trail, earlier notes, the member's
data, starting a new goal) lives behind one **Change** menu, so the first
screen is only the three levels and the map.

Everything on the tab is **general wellness and self-help**. Nothing on it
screens, scores, diagnoses or treats anything, and the wellness note (with
links to find a therapist, help nearby and 988) sits above every screen.
**Nearby help** is on the member dashboard's menu bar (`dashboard.html#nearby`,
`docs/nearby-help.md`); `goals.html#map` forwards there.

| Piece | File |
|---|---|
| The tab: intro card, wellness note, zone, and the Premium lock | `site/dashboard.html` (`data-panel="goals"`); `site/goals.html` forwards to it |
| Everything on it | `site/assets/goals-ui.js` (`mountGoals(host, ctx)`), styles in `site/assets/goals.css` |
| The action library, themes (`VALUES`), categories, minutes, scenes, nudges | `site/assets/quest-paths.js` |
| The goal matcher and the milestone suggestions | `site/assets/quest-goals.js` |
| The trail map | `site/assets/quest-scene.js` (`trailMap`) |
| Test (no network) | `node tests/quest-paths/check.mjs` |

## Setup: three screens

1. **Your goal.** A text box ("Say it the way you would to a friend") with
   nine example goals to tap (`EXAMPLE_GOALS`, one per theme) and **Browse
   common goals**, the library in `site/assets/quest-goal-library.js`
   (`docs/goal-library.md`), grouped by theme with a search box. As the member
   types, `detectTheme()` reads the sentence **in the browser** for everyday
   words (`WORDS`, grouped under tags like `evening`, `screen`, `people`,
   `kind`, merged with the goal library's) and weighs them per theme
   (`THEME_TAGS`). A word inside a matched phrase counts once, for the
   phrase. The ninth theme, `calm` ("Feeling calmer day to day",
   `20261004090000_calm_theme.sql`), is where "feel less stressed" lands. The page says "Sounds
   like calmer evenings, because you wrote 'night', 'sleep', 'scrolling'",
   with the eight themes as chips to override it. When no word is known
   ("Be a better person") it asks "Which of these is closest?" instead. The
   screen says plainly that the words never leave the device and no AI reads
   them; that is also what the privacy policy promises, so keep it true.
2. **Milestones.** Five written for the theme (`MILESTONES`), or, when the
   goal's words carry a tag that has its own set (`MILESTONE_SETS`: a goal
   about a marriage or a partner), five written for that kind of goal. The
   first three come ticked, each editable in place, with move-up and remove, and a box to
   write one of their own. One to six.
3. **Stepping stones** for the first milestone: `suggestSteps()` ranks the
   library by words shared with the goal, words shared with the milestone,
   whether the milestone was written with the stone in mind, whether the
   stone suits the theme, and the member's time (the 2/5/10/20 minute chips).
   Each suggestion carries its reason ("because you mentioned 'night'",
   "written for this milestone"). The milestone's own four are pre-ticked.
   The member can add steps in their own words.

Later milestones get their recommended stones (or matched ones, for a
milestone the member wrote) when saved; **Change today's stepping stones**
reopens the picker for the current one at any time.

## How a day works

- Tap a stone's pebble: a `quest_steps` row with the current `milestone_id`.
  The first stone on a day is "today's step"; more are a bonus. A writing
  action (`write: true`) opens the note box first, as before.
- The pebbles under the milestone count distinct days with a step toward it.
  The hiker on the map moves the same way.
- Under the pebbles, **how far at one stepping stone a day**: days to this
  camp and days to the destination. The first is the day the weekly question
  (below) would next appear if the member took a stone every day: seven
  step-days, or seven days, since the camp opened or was last asked, whichever
  comes first, and never less than seven days since it was last asked. Each
  camp beyond adds seven. It reads "Today" when the question is already
  showing, and says it is a guide, not a clock: the member decides.
- **Is it happening for you now?** appears on the milestone once a week
  (seven steps, or seven days since it started or was last asked). *Yes,
  mostly* sets `reached_on` and opens the next milestone (a small
  celebration; reaching the last one is the goal). *Getting there* sets
  `checked_on` and asks again in a week. *Not yet, let me adjust it* opens
  the milestone editor. The member decides; no counter does.
- **Reaching the destination.** When the last milestone is reached, the
  milestone level becomes a **look back**: "Looking back to the day you set
  out: do you feel closer to your goal than you were then?", with a box for a
  few words. *Yes, closer*, *Some of the way* or *Not really* is written to
  `quests.arrived_closer` (with `arrived_on` and the optional `arrived_note`);
  the member's word, never a score, and it can be changed. Then the page offers
  what fits: after *yes*, a new milestone, the same trail again, or a new
  goal; after *some*, the same trail again, **change the milestones and go
  again**, or a different goal; after *not really*, changed milestones, a
  reworded goal, or a different goal. **Walk this trail again** (`walkAgain()`)
  closes the finished quest (it stays for the record, with its look back) and
  opens a new one with the same words and fresh copies of the milestones,
  nothing reached yet; days on the trail carry over because they are counted
  across every quest. Nothing is ever taken away.
- A **What helped** note (`quest_reflections`) and a log on one of the old
  SMART goals (`goals`, shown as "Your own steps, from before" with the same
  pebble) count as days on the trail (flowers, lanterns) but not as steps
  toward the milestone. No streaks, no missed days: nothing is ever taken away.

"Today" is the member's own calendar day (browser local date).

### Where the member is asked

Nobody should have to remember to open the Goals tab to be asked for today's
step, so the prompt comes to them in two places:

- **The dashboard's Today tab** has a **Today's stepping stones** zone above
  the mood check-in (`site/assets/today-step.js`, mounted from
  `site/dashboard.html`). It shows the same status box as the Goals tab
  ("Today is done." or "Today still needs one step."), the goal and the
  milestone being worked on, and the milestone's stones with pebbles that
  write the same `quest_steps` row. It is drawn again every time Today
  opens, and a tap there makes the Goals tab draw fresh next time. Premium
  only; the zone stays hidden for everyone else, and a Premium member with no
  goal sees one line and a **Set a goal** button. When the weekly question is
  due it says so and points at the Goals tab, where the answer is given.
- **The morning email** (`supabase/functions/daily-digest/index.ts`) carries a
  **Today's stepping stone** section for a Premium member with an unreached
  milestone: the goal, the milestone, "any one stepping stone counts the whole
  day", and a button to the Goals tab. It rides along with whatever else the
  member chose for the email; it never sends an email on its own.

## The trail map

`trailMap({ goal, milestones, current, stepFrac, days, scene })` is one SVG:
sky, hills and ground; a winding path with the walked part in lime; the
START signpost; camps at even spacing along the path (`campAt`); the hiker
(`hikerFraction`) with a "You are here" sign; the destination drawing for the
theme (`DESTINATIONS`); and the member's scene growing along the same path.
Only the current camp carries a label, so the picture stays calm; the pills
under the map name every milestone and the goal, and are what a phone uses
(the map's labels hide under 600px). Tapping a camp or pill shows that
milestone's stones. `goals.css` adds the motion: the hiker bobs, flags
flutter, and after a step the hiker hops and the newest flower pops
(`.stepped`); `prefers-reduced-motion` turns it all off.

Scenes (`SCENES`, keys are a data contract): **garden** plants a flower per
day shown up, **lights** lights a lantern per day under a dusk sky,
**scenery** warms the sky and fills in trees, birds and flowers as milestones
are reached. A day's flower never moves once planted (`dayFraction`).

## Data and privacy

| Table | What |
|---|---|
| `quests` | The goal: `intention` (the sentence, up to 240 characters), `value_key` (the theme), `minutes`, `scene`; one active at a time. Once every milestone is reached, the look back: `arrived_on`, `arrived_closer` (`yes`, `some`, `no`) and `arrived_note` |
| `quest_milestones` | The milestones in order: `title`, `position`, `actions` (library keys), `own_steps` (the member's words), `reached_on`, `checked_on` |
| `quest_steps` | One row per stone done on a day, with `milestone_id` and the note for a writing action |
| `quest_reflections` | One What helped note per day |
| `goals`, `goal_logs` | The older SMART goals, still shown and logged |

`supabase/migrations/20260927190000_quest_maps.sql` creates the quest tables,
`20260928010000_quest_step_notes.sql` adds notes on steps, and
`20261003120000_quest_milestones.sql` adds the milestones table, the
`milestone_id` on steps, the longer goal sentence, and lets a step key carry
digits (a step the member wrote is `own_<milestone>_<n>`), and
`20261007120000_quest_arrival.sql` adds the look-back columns on `quests`. Every row is
readable and deletable only by its owner; adding or changing needs Premium.
No therapist, admin screen or other member has a policy on these tables.
**Download everything** and the two delete buttons live under Change → Your
data; the account page's export includes these tables too.

**Apply the migration before merging.** The page reads `quest_milestones` as
soon as it deploys. A member with a quest from before the change is taken to
the milestones screen to finish setting up; their days on the trail carry
over.

## The matcher is a word list, not AI

`quest-goals.js` makes no network calls (the test checks). To make it
understand a new way of putting a goal, add the words to `WORDS` under the
right tag, or add a tag and weigh it in `THEME_TAGS`. To make a stone match
better, add it to `EXTRA_TAGS`. `docs/legal-pages.md` lists the state laws to
read before any generative or conversational feature is added here; the
privacy policy says personalization is rule-based and nothing written is sent
to an AI service.

## Data contract

`VALUES`, `CATEGORIES`, `MINUTES` and `SCENES` keys in `quest-paths.js` must
match the checks in the first migration, and the look back's three answers
(`data-arrive` in `goals-ui.js`) the check on `quests.arrived_closer`. Never change or remove an `ACTIONS`
key once shipped, because `quest_steps` rows point at it; retire one with
`retired: true`. Milestone titles in `MILESTONES` are suggestions copied into
the member's rows, so they can be reworded freely.

```bash
node tests/quest-paths/check.mjs
```

The test checks the lists against the migrations, that every milestone names
real actions, that a dozen goals in plain words find the right theme and
relevant stones with a stated reason, that the map draws cleanly for every
theme, scene, milestone count and day count and only ever gains things, that
nothing a member reads uses clinical or streak words, US spelling, and that
the page keeps the wellness note, the three levels in order, the weekly
question, the trail in words with its You are here arrow in the left third,
and the look back at the destination.

## Writing rules

- An action is an everyday thing anyone could do, sized to its `min`, ending
  in a period, with `values` naming the one or two themes it was written for.
- A milestone is something a person could point to in real life, in their
  own voice ("I reach out to one person most days"), under sixty characters,
  never a number to hit, never a streak.
- General wellness only: no symptoms, conditions, treatment, "healing",
  scores, or anything that sounds like therapy. A nudge asks what helped
  today and ends in a question mark. Gentle and optional, never "you should".
