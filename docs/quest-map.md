# The quest map (Premium Goals & tracking)

`site/goals.html` is the Premium (level 3) Goals & tracking page. It turns
goals into a story-like map that grows as the member shows up. Everything on
it is **general wellness and self-help**: habits, short self-care, reflection
prompts, gratitude, movement, nature, connection and creativity. Nothing on
it screens, scores, diagnoses or treats anything.

## Tabs

| Tab | Hash | What it does |
|---|---|---|
| Your quest | `#quest` (default) | Setup the first time, then the map, the progress scene and the open chapter's micro-actions |
| Goals | `#goals` | SMART-style goals the member writes, with a week strip and a "look back" date |
| What helped | `#reflect` | One optional note a day on what felt helpful; editable and deletable |
| Your data | `#data` | What happens to the data, download it, delete notes, or delete everything |
| Nearby help | `#map` | The resource map (`docs/nearby-help.md`) |

The wellness note ("General wellness and self-help only… not psychotherapy or
clinical care… not a substitute for help from a licensed professional"), with
links to find a therapist, help nearby and 988, sits above every tab. The setup
and the What helped box repeat the pathway to help.

## How a quest works

1. **Setup, values first.** The member picks what they would like more of in
   everyday life (`VALUES`, e.g. "More calm in the evenings"), optionally in
   their own words, then the kinds of practice they like (`CATEGORIES`), how
   long they usually have (`MINUTES`: 2, 5, 10 or 20), and how progress
   should look (`SCENES`: garden, path of lights, or evolving scenery). No
   question asks about symptoms, feelings, or how bad anything is.
2. **The map.** `buildQuest()` draws seven chapters (`CHAPTERS`), each with a
   place name, a short story line, three micro-actions from the member's own
   categories that fit their time, and one optional **side path** from a
   category they did not pick. The same choices always draw the same map, and
   no two chapters get the same set of actions when there are enough.
3. **Showing up.** A day counts when the member marks any micro-action, logs
   any goal, or writes a What helped note. Days need not be in a row.
   `progress()` counts distinct days; chapters open at 0, 3, 7, 12, 18, 25 and
   35 days. Nothing is ever taken away: no streaks, no "missed" days, and the
   scenes (`site/assets/quest-scene.js`) only gain plants, lanterns or
   scenery. A milestone day (`MILESTONES`) or a new chapter gets a small
   celebration.
4. **Writing actions.** An action with `write: true` ("Write three things
   you are glad of today") is done by writing: tapping its circle (shown as a
   pencil) opens a note box with the prompt. The member can save a note and
   mark it done, or mark it done without writing. The note is kept on the
   step (`quest_steps.note`), shows under the action for the rest of the day
   with an edit link, and appears on the What helped tab under "From your
   quest map". Every other action is marked done with one tap.
5. **Changing course.** "Adjust" edits the quest in place. "Start a new quest"
   keeps the old one (inactive) and all days shown up carry over.

"Today" is the member's own calendar day (browser local date), as on the
Mood tab.

## The suggestion helper

Optional, off by default, chosen in setup. It is **rule-based, not AI**, and
runs in the browser. It can:

- offer a shorter action in the same category (`helper.shorter`), and
- offer a generic reflection prompt idea from the member's chosen categories
  (`helper.prompt`).

It looks only at the minutes and categories the member picked. It never reads
what they write, never interprets mood or feelings, and makes no decisions
about them. The privacy policy states that personalization is rule-based and
there is no AI chatbot; `docs/legal-pages.md` lists the state laws to read
before any generative or conversational feature is added here.

## SMART goals

| Letter | Field |
|---|---|
| Specific | `goals.title`, "What exactly will you do?" plus `goals.cue`, "When and where?" |
| Measurable | `goals.target_per_week` |
| Achievable | `goals.minutes`, minutes each time |
| Relevant | `goals.value_key`, which value it serves |
| Time-bound | `goals.review_on`, a day to look back; on that day the card offers to keep, change or archive it, all framed as fine |

## Data and privacy

| Table | What |
|---|---|
| `quests` | The member's choices; one active at a time (`quests_one_active`) |
| `quest_steps` | One row per micro-action marked done on a day, with the note for a writing action |
| `quest_reflections` | One What helped note per day |
| `goals`, `goal_logs` | Goals (with the new SMART columns) and their daily logs |

`supabase/migrations/20260927190000_quest_maps.sql` creates the quest tables
and adds the goal columns; `20260928010000_quest_step_notes.sql` adds the
note on steps. Every row is readable and deletable only by its
owner. Adding or changing needs Premium, so a member who leaves Premium can
still download and delete. No therapist, admin screen or other member has a
policy on these tables. The account page's **Download my data** includes all
of them, and deleting an account removes them (every table cascades from
`auth.users`).

**Apply the migration before merging.** The page reads the new tables as soon
as it deploys.

## Data contract

`VALUES`, `CATEGORIES`, `MINUTES` and `SCENES` keys in
`site/assets/quest-paths.js` must match the checks in the migration. To add
one, change both, in a new migration. Never change or remove an `ACTIONS` key
once shipped, because `quest_steps` rows point at it; retire one with
`retired: true` instead.

```bash
node tests/quest-paths/check.mjs
```

The test checks the lists against the migration, that every choice draws a
full map from the member's own picks, that progress only counts up, that the
drawings never break, that nothing a member reads uses clinical, screening or
streak words, US spelling, and that the page carries the wellness note and
crisis line.

## Writing rules for new actions and prompts

- An everyday action anyone could do, sized to its `min`, ending in a period.
- General wellness only: no symptoms, conditions, treatment, "healing",
  scores, or anything that sounds like therapy.
- Reflection prompts are personal reflection ("What did you notice outside
  today?"), never assessment ("How anxious were you?").
- Gentle and optional: "if you feel like it", never "you should".
