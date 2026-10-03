# The quest map (Premium Goals & tracking)

`site/goals.html` is the Premium (level 3) Goals & tracking page. It turns
what a member would like more of into a **trail**: one illustrated map with
seven places on it, a hiker that moves a step for every day they show up, and
a short list of small actions chosen for their focus. Everything on it is
**general wellness and self-help**: habits, short self-care, reflection
prompts, gratitude, movement, nature, connection and creativity. Nothing on
it screens, scores, diagnoses or treats anything.

## Tabs

| Tab | Hash | What it does |
|---|---|---|
| Your trail | `#quest` (default) | Setup the first time, then the focus card (what the quest is toward, whether today is counted yet, how the trail works), the trail map, today's actions, the quest settings, and under all of that a second zone, **Goals of your own** (`#goals` scrolls to it) |
| What helped | `#reflect` | One optional note a day on what felt helpful, with what the member marked that day shown above the box; editable and deletable |
| Your data | `#data` | What happens to the data, download it, delete notes, or delete everything |

**Nearby help** used to be a tab here. It is now the last tab on the member
dashboard's menu bar (`dashboard.html#nearby`, `docs/nearby-help.md`), open to
every signed-in member; `goals.html#map` forwards there.

The wellness note ("General wellness and self-help only… not psychotherapy or
clinical care… not a substitute for help from a licensed professional"), with
links to find a therapist, help nearby and 988, sits above every tab. The setup
and the What helped box repeat the pathway to help.

## How a quest works

1. **Setup, a focus first.** The member picks what they would like more of in
   everyday life (`VALUES`, e.g. "More calm in the evenings"). Each choice
   says what its actions look like (`does`) and, once picked, shows three of
   them (`samplesFor`), so the member picks for the actions they want rather
   than the words. The optional line in their own words takes the picked
   focus's `example` as its placeholder ("Evenings that feel like mine
   again" under calm evenings, "Days with a shape to them" under steadier
   routines), so the words and the actions agree. Then the kinds of practice
   they like (`CATEGORIES`), how long they usually have (`MINUTES`: 2, 5, 10
   or 20), and what should grow along the trail (`SCENES`: flowers, lanterns,
   or a landscape that fills in). No question asks about symptoms, feelings,
   or how bad anything is.
2. **The map.** `buildQuest()` draws seven chapters (`CHAPTERS`), each a place
   on the trail with a short story line, three micro-actions from the member's
   own categories that fit their time, and one optional **side path** from a
   category they did not pick. Every focus has actions written for it in
   every category (`values` on an action; `suits()` tells); `pool()` lists
   those first, then the ones that suit anyone, and the deck deals the
   focus's own actions before the rest, so what a chapter shows speaks to
   what the member asked for. The page labels each action "for calmer
   evenings" or "good for anyone". The same choices always draw the same map,
   and no two chapters get the same set of actions when there are enough.
3. **Showing up.** A day counts when the member marks any micro-action, logs
   any goal, or writes a What helped note. Days need not be in a row.
   `progress()` counts distinct days; chapters open at 0, 3, 7, 12, 18, 25 and
   35 days. The focus card says it in three steps (do one action and tap its
   circle; that counts the day and moves you one step; reach the next place
   and it opens), shows "Today is counted" or "Today is not counted yet", and
   a bar from the place the member is at to the next one. Nothing is ever
   taken away: no streaks, no "missed" days. A milestone day (`MILESTONES`)
   or a new place gets a small celebration.
4. **The trail map** (`trailMap()` in `site/assets/quest-scene.js`) is one
   picture: sky, hills and ground, a winding path through all seven places,
   each drawn on the land (a signpost, a clearing, a stream with stepping
   stones, a grove, a lookout, a meadow, the hills), a hiker with a "You are
   here" sign, and the walked part of the path in lime. Places ahead sit in
   fog with a lock and "opens after N days". The scene decorates the same
   trail: a flower or a lantern is planted beside the path for every day
   shown up, at the spot the hiker had reached that day (`dayAt()`); the
   scenery warms the sky, raises the sun and adds trees, birds and flowers as
   places open. Tapping a place on the map, or its pill in the row under the
   map (which is also what a phone uses, since the map's labels hide under
   600px), shows that chapter's actions; a locked one shows a peek.
5. **Writing actions.** An action with `write: true` ("Write three things
   you are glad of today") is done by writing: tapping its circle (shown as a
   pencil) opens a note box with the prompt. The member can save a note and
   mark it done, or mark it done without writing. The note is kept on the
   step (`quest_steps.note`), shows under the action for the rest of the day
   with an edit link, and appears on the What helped tab under "Written on
   your trail". Every other action is marked done with one tap.
6. **Changing course.** "Change your focus" on the focus card and "Adjust"
   in the settings edit the quest in place. "Start a new quest" keeps the old
   one (inactive) and all days shown up carry over.

"Today" is the member's own calendar day (browser local date), as in the
mood check-in.

## The suggestion helper

Optional, off by default, chosen in setup. It is **rule-based, not AI**, and
runs in the browser. It can:

- offer a shorter action in the same category (`helper.shorter`), and
- offer a nudge for the What helped note (`helper.prompt`, from
  `PROMPT_IDEAS`): every nudge asks what helped today, in one of the member's
  own kinds of practice ("Which conversation or message helped today?").

It looks only at the minutes and categories the member picked. It never reads
what they write, never interprets mood or feelings, and makes no decisions
about them. The privacy policy states that personalization is rule-based and
there is no AI chatbot; `docs/legal-pages.md` lists the state laws to read
before any generative or conversational feature is added here.

## Goals of your own (SMART goals)

A second zone under the trail, so the relationship is plain: the trail hands
the member small actions; a goal is something they choose and track
themselves, and logging it counts as a day shown up on the trail too.

| Letter | Field |
|---|---|
| Specific | `goals.title`, "What exactly will you do?" plus `goals.cue`, "When and where?" |
| Measurable | `goals.target_per_week` |
| Achievable | `goals.minutes`, minutes each time |
| Relevant | `goals.value_key`, which focus it serves |
| Time-bound | `goals.review_on`, a day to look back; on that day the card offers to keep, change or archive it, all framed as fine |

## Data and privacy

| Table | What |
|---|---|
| `quests` | The member's choices; one active at a time (`quests_one_active`) |
| `quest_steps` | One row per micro-action marked done on a day, with the note for a writing action |
| `quest_reflections` | One What helped note per day |
| `goals`, `goal_logs` | Goals (with the SMART columns) and their daily logs |

`supabase/migrations/20260927190000_quest_maps.sql` creates the quest tables
and adds the goal columns; `20260928010000_quest_step_notes.sql` adds the
note on steps. Every row is readable and deletable only by its
owner. Adding or changing needs Premium, so a member who leaves Premium can
still download and delete. No therapist, admin screen or other member has a
policy on these tables. The account page's **Download my data** includes all
of them, and deleting an account removes them (every table cascades from
`auth.users`).

## Data contract

`VALUES`, `CATEGORIES`, `MINUTES` and `SCENES` keys in
`site/assets/quest-paths.js` must match the checks in the migration. To add
one, change both, in a new migration. Never change or remove an `ACTIONS` key
once shipped, because `quest_steps` rows point at it; retire one with
`retired: true` instead. Scene labels and blurbs are free to change; the keys
(`garden`, `lights`, `scenery`) are not.

```bash
node tests/quest-paths/check.mjs
```

The test checks the lists against the migration, that every focus has an
example and short actions of its own in every category, that every choice
draws a full map from the member's own picks and that most of what a chapter
shows was written for the focus, that progress only counts up, that the
hiker never steps back and the trail only ever gains flowers, lanterns and
open places, that the map draws cleanly for any scene and any number of days,
that nothing a member reads uses clinical, screening or streak words, US
spelling, that the page says how a day counts and keeps goals under the
trail, and that Nearby help is on the dashboard's menu bar.

## Writing rules for new actions and prompts

- An everyday action anyone could do, sized to its `min`, ending in a period.
- Give it `values`: the one or two focuses it was written for. An action with
  no `values` suits anyone and is dealt after the focus's own.
- General wellness only: no symptoms, conditions, treatment, "healing",
  scores, or anything that sounds like therapy.
- Reflection prompts are personal reflection ("What did you notice outside
  today?"), never assessment ("How anxious were you?"). A What helped nudge
  asks what helped today and ends in a question mark.
- Gentle and optional: "if you feel like it", never "you should".
