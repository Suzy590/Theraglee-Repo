# Goals & tracking: the goal, the milestones, the stepping stones

`site/goals.html` is the Premium (level 3) Goals & tracking page. It is built
from three levels, top to bottom, and one picture beside them:

| Level | What it is | On the map |
|---|---|---|
| **Your goal** | One sentence in the member's own words ("Evenings that feel like mine again"). The destination. It does not change day to day. | The far hills, with a drawing for the goal's theme: a lit cabin, a lighthouse, a campfire, a sunrise, a peak with a flag, a bench under a tree, an easel, a lookout tower |
| **Working on now** | One of three to five milestones the member chose: things they could notice in real life ("The phone charges outside the bedroom most nights"), never numbers. Reached when the member says so. | Camps along the path, a tent and a numbered flag each; a green check flag once reached, a glow on the current one, fog on the ones ahead |
| **Today's stepping stones** | A few small actions from the library (`ACTIONS` in `quest-paths.js`), or ones the member wrote, that serve the current milestone. Any one of them done today is today's step. Small on purpose, and the page says so. | The hiker, who moves a little toward the next camp for every day a stone is done (seven steps is the suggested distance) |

Under the stones, **Tonight: what helped today?** is one line that opens into
the optional daily note. Everything else (rewording the goal, changing
milestones or stones, what grows along the trail, earlier notes, the member's
data, starting a new goal) lives behind one **Change** menu, so the first
screen is only the three levels and the map.

Everything on the page is **general wellness and self-help**. Nothing on it
screens, scores, diagnoses or treats anything, and the wellness note (with
links to find a therapist, help nearby and 988) sits above every screen.
**Nearby help** is on the member dashboard's menu bar (`dashboard.html#nearby`,
`docs/nearby-help.md`); `goals.html#map` forwards there.

| Piece | File |
|---|---|
| The page shell: chrome, wellness note, zone | `site/goals.html` |
| Everything on it | `site/assets/goals-ui.js` (`mountGoals(host, ctx)`), styles in `site/assets/goals.css` |
| The action library, themes (`VALUES`), categories, minutes, scenes, nudges | `site/assets/quest-paths.js` |
| The goal matcher and the milestone suggestions | `site/assets/quest-goals.js` |
| The trail map | `site/assets/quest-scene.js` (`trailMap`) |
| Test (no network) | `node tests/quest-paths/check.mjs` |

## Setup: three screens

1. **Your goal.** A text box ("Say it the way you would to a friend") with
   eight example goals to tap (`EXAMPLE_GOALS`, one per theme). As the member
   types, `detectTheme()` reads the sentence **in the browser** for everyday
   words (`WORDS`, grouped under tags like `evening`, `screen`, `people`,
   `kind`) and weighs them per theme (`THEME_TAGS`). The page says "Sounds
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
- **Is it happening for you now?** appears on the milestone once a week
  (seven steps, or seven days since it started or was last asked). *Yes,
  mostly* sets `reached_on` and opens the next milestone (a small
  celebration; reaching the last one is the goal). *Getting there* sets
  `checked_on` and asks again in a week. *Not yet, let me adjust it* opens
  the milestone editor. The member decides; no counter does.
- A **What helped** note (`quest_reflections`) and a log on one of the old
  SMART goals (`goals`, shown as "Your own steps, from before" with the same
  pebble) count as days on the trail (flowers, lanterns) but not as steps
  toward the milestone. No streaks, no missed days: nothing is ever taken away.

"Today" is the member's own calendar day (browser local date).

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
| `quests` | The goal: `intention` (the sentence, up to 240 characters), `value_key` (the theme), `minutes`, `scene`; one active at a time |
| `quest_milestones` | The milestones in order: `title`, `position`, `actions` (library keys), `own_steps` (the member's words), `reached_on`, `checked_on` |
| `quest_steps` | One row per stone done on a day, with `milestone_id` and the note for a writing action |
| `quest_reflections` | One What helped note per day |
| `goals`, `goal_logs` | The older SMART goals, still shown and logged |

`supabase/migrations/20260927190000_quest_maps.sql` creates the quest tables,
`20260928010000_quest_step_notes.sql` adds notes on steps, and
`20261003120000_quest_milestones.sql` adds the milestones table, the
`milestone_id` on steps, the longer goal sentence, and lets a step key carry
digits (a step the member wrote is `own_<milestone>_<n>`). Every row is
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
match the checks in the first migration. Never change or remove an `ACTIONS`
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
the page keeps the wellness note, the three levels in order, and the weekly
question.

## Writing rules

- An action is an everyday thing anyone could do, sized to its `min`, ending
  in a period, with `values` naming the one or two themes it was written for.
- A milestone is something a person could point to in real life, in their
  own voice ("I reach out to one person most days"), under sixty characters,
  never a number to hit, never a streak.
- General wellness only: no symptoms, conditions, treatment, "healing",
  scores, or anything that sounds like therapy. A nudge asks what helped
  today and ends in a question mark. Gentle and optional, never "you should".
