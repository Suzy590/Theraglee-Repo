/* ==========================================================================
   Theraglee — the quest map behind the Premium Goals & tracking page.
   --------------------------------------------------------------------------
   Everything here is general wellness: habits, short self-care, reflection
   prompts, gratitude, movement, nature, connection and creativity. Nothing
   asks about symptoms, screens, scores, diagnoses or treats anything.

   No imports, so tests/quest-paths/check.mjs can run it under plain Node.

   VALUES and CATEGORIES keys, and the scene and minute choices, are a data
   contract: supabase/migrations/20260927190000_quest_maps.sql lists them in
   its checks, and the test fails if the two stop matching. To add one, add it
   to both, in a new migration. Never change an ACTIONS key once shipped —
   quest_steps rows point at it; retire an action by adding `retired: true`.

   docs/quest-map.md is the guide.
   ========================================================================== */

/** What the member would like more of in everyday life. `phrase` finishes
 *  "a quest toward …". */
export const VALUES = [
  { key: 'calm_evenings',    label: 'More calm in the evenings',      phrase: 'calmer evenings',            icon: '🌙' },
  { key: 'steady_routines',  label: 'Steadier daily routines',        phrase: 'steadier days',              icon: '🧭' },
  { key: 'connection',       label: 'A stronger sense of connection', phrase: 'closer connection',          icon: '🤝' },
  { key: 'energy',           label: 'More energy in my days',         phrase: 'livelier days',              icon: '☀️' },
  { key: 'time_outdoors',    label: 'More time outdoors',             phrase: 'more time outside',          icon: '🌿' },
  { key: 'self_kindness',    label: 'Being kinder to myself',         phrase: 'a kinder way with yourself', icon: '💛' },
  { key: 'creativity',       label: 'More room for creativity',       phrase: 'room to make things',        icon: '🎨' },
  { key: 'focus',            label: 'More focus on what matters',     phrase: 'time for what matters',      icon: '🎯' },
];

/** Kinds of practice the member can choose from. */
export const CATEGORIES = [
  { key: 'habits',      label: 'Small habits',        icon: '🔁' },
  { key: 'self_care',   label: 'Short self-care',     icon: '🛁' },
  { key: 'reflection',  label: 'Reflection prompts',  icon: '📓' },
  { key: 'gratitude',   label: 'Gratitude',           icon: '🙏' },
  { key: 'movement',    label: 'Movement',            icon: '🚶' },
  { key: 'nature',      label: 'Nature',              icon: '🌳' },
  { key: 'connection',  label: 'Connection',          icon: '💬' },
  { key: 'creativity',  label: 'Creativity',          icon: '✏️' },
];

/** How long the member usually has, in minutes. */
export const MINUTES = [2, 5, 10, 20];

/** How progress is drawn. Nothing in any scene ever shrinks or wilts. */
export const SCENES = [
  { key: 'garden',  label: 'A growing garden',   blurb: 'A new plant for every day you show up.' },
  { key: 'lights',  label: 'A path of lights',   blurb: 'A lantern lights for every day you show up.' },
  { key: 'scenery', label: 'Evolving scenery',   blurb: 'The landscape fills in as chapters open.' },
];

/**
 * Micro-actions. `values` lists the VALUES each suits best; an action with no
 * `values` suits them all. `min` is roughly how long it takes. `write` marks
 * the ones done by writing something down: tapping one on the page opens a
 * note box, and what the member writes is kept with the step.
 */
export const ACTIONS = [
  // Small habits
  { key: 'hab_glass_water',     cat: 'habits', min: 2,  text: 'Drink a glass of water before your first screen of the day.', values: ['energy', 'steady_routines'] },
  { key: 'hab_same_wake',       cat: 'habits', min: 2,  text: 'Get up within the same half hour as yesterday.', values: ['steady_routines', 'energy'] },
  { key: 'hab_tidy_surface',    cat: 'habits', min: 5,  text: 'Clear one surface, like a nightstand or a corner of a desk.', values: ['steady_routines', 'focus', 'calm_evenings'] },
  { key: 'hab_tomorrow_three',  cat: 'habits', min: 5, write: true,  text: 'Write the three things you want to do tomorrow, then stop.', values: ['focus', 'steady_routines'] },
  { key: 'hab_screen_curfew',   cat: 'habits', min: 2,  text: 'Pick a time tonight when the phone goes to charge in another room.', values: ['calm_evenings'] },
  { key: 'hab_single_task',     cat: 'habits', min: 20, text: 'Work on one thing for twenty minutes with notifications off.', values: ['focus'] },
  { key: 'hab_evening_reset',   cat: 'habits', min: 10, text: 'Do a ten-minute evening reset: dishes, bag packed, clothes out.', values: ['calm_evenings', 'steady_routines'] },

  // Short self-care
  { key: 'sc_slow_breaths',     cat: 'self_care', min: 2,  text: 'Take five slow breaths, a little longer out than in.' },
  { key: 'sc_warm_drink',       cat: 'self_care', min: 5,  text: 'Make a warm drink and have it without a screen.', values: ['calm_evenings', 'self_kindness'] },
  { key: 'sc_stretch_neck',     cat: 'self_care', min: 2,  text: 'Roll your shoulders and stretch your neck, slowly, both sides.', values: ['energy', 'focus'] },
  { key: 'sc_kind_note',        cat: 'self_care', min: 2,  text: 'Say one thing to yourself you would say to a friend who had your day.', values: ['self_kindness'] },
  { key: 'sc_wind_down_music',  cat: 'self_care', min: 10, text: 'Put on three songs you find soothing and do nothing else.', values: ['calm_evenings', 'self_kindness'] },
  { key: 'sc_long_shower',      cat: 'self_care', min: 10, text: 'Take an unhurried shower or bath and notice the warmth.', values: ['calm_evenings', 'self_kindness'] },
  { key: 'sc_snack_sit',        cat: 'self_care', min: 5,  text: 'Eat a snack sitting down, without doing anything else.', values: ['self_kindness', 'energy'] },

  // Reflection prompts (personal reflection, not assessment)
  { key: 'ref_went_well',       cat: 'reflection', min: 5, write: true,  text: 'Write one thing that went a bit better than expected today.' },
  { key: 'ref_ideal_evening',   cat: 'reflection', min: 5, write: true,  text: 'Describe, in a few lines, an evening you would enjoy.', values: ['calm_evenings'] },
  { key: 'ref_small_win',       cat: 'reflection', min: 2, write: true,  text: 'Note a small thing you finished today, however small.', values: ['focus', 'steady_routines', 'self_kindness'] },
  { key: 'ref_what_matters',    cat: 'reflection', min: 10, write: true, text: 'List what you spent time on today, and star what you want more of.', values: ['focus'] },
  { key: 'ref_person_admire',   cat: 'reflection', min: 5, write: true,  text: 'Write about someone you admire and one thing they do that you like.', values: ['connection', 'self_kindness'] },
  { key: 'ref_future_self',     cat: 'reflection', min: 10, write: true, text: 'Write a short note from you a year from now, about an ordinary good day.', values: ['self_kindness', 'focus'] },
  { key: 'ref_idea_page',       cat: 'reflection', min: 10, write: true, text: 'Fill half a page with ideas you would like to try, good or silly.', values: ['creativity'] },

  // Gratitude
  { key: 'gr_three_things',     cat: 'gratitude', min: 5, write: true,  text: 'Write three things you are glad of today, one line each.' },
  { key: 'gr_one_thing',        cat: 'gratitude', min: 2, write: true,  text: 'Name one thing from today you are glad happened.' },
  { key: 'gr_thank_someone',    cat: 'gratitude', min: 5,  text: 'Send someone a short thank-you for something specific.', values: ['connection'] },
  { key: 'gr_senses',           cat: 'gratitude', min: 2,  text: 'Notice one pleasant thing for each of three senses.', values: ['calm_evenings', 'time_outdoors'] },
  { key: 'gr_letter',           cat: 'gratitude', min: 20, write: true, text: 'Write a longer thank-you letter, whether or not you send it.', values: ['connection', 'self_kindness'] },

  // Movement
  { key: 'mv_walk_block',       cat: 'movement', min: 10, text: 'Walk around the block at an easy pace.', values: ['energy', 'time_outdoors'] },
  { key: 'mv_stand_stretch',    cat: 'movement', min: 2,  text: 'Stand up and reach for the ceiling, then the floor.', values: ['energy', 'focus'] },
  { key: 'mv_dance_song',       cat: 'movement', min: 5,  text: 'Move however you like to one song you enjoy.', values: ['energy', 'creativity', 'self_kindness'] },
  { key: 'mv_stairs',           cat: 'movement', min: 2,  text: 'Take the stairs once today where you would take the elevator.', values: ['energy'] },
  { key: 'mv_gentle_stretch',   cat: 'movement', min: 10, text: 'Do ten minutes of gentle stretching before bed.', values: ['calm_evenings'] },
  { key: 'mv_long_walk',        cat: 'movement', min: 20, text: 'Take a twenty-minute walk somewhere you like.', values: ['energy', 'time_outdoors'] },

  // Nature
  { key: 'na_sky_minute',       cat: 'nature', min: 2,  text: 'Step outside, or to a window, and look at the sky for a minute.' },
  { key: 'na_plant_care',       cat: 'nature', min: 5,  text: 'Water or tend a plant, or pick one to bring home.', values: ['steady_routines', 'self_kindness'] },
  { key: 'na_find_green',       cat: 'nature', min: 10, text: 'Find the nearest patch of green and spend ten minutes there.', values: ['time_outdoors', 'energy'] },
  { key: 'na_sunset',           cat: 'nature', min: 10, text: 'Watch the light change at sunset, or the sky after dark.', values: ['calm_evenings', 'time_outdoors'] },
  { key: 'na_eat_outside',      cat: 'nature', min: 20, text: 'Have a meal or a drink outdoors.', values: ['time_outdoors', 'connection'] },
  { key: 'na_notice_five',      cat: 'nature', min: 5,  text: 'On a walk, notice five living things you had not noticed before.', values: ['time_outdoors', 'focus'] },

  // Connection
  { key: 'co_text_friend',      cat: 'connection', min: 2,  text: 'Send a friend a message about something that made you think of them.', values: ['connection'] },
  { key: 'co_call',             cat: 'connection', min: 10, text: 'Call someone you have not spoken to in a while.', values: ['connection'] },
  { key: 'co_ask_question',     cat: 'connection', min: 5,  text: 'Ask someone a question about their day, and listen to the answer.', values: ['connection'] },
  { key: 'co_shared_meal',      cat: 'connection', min: 20, text: 'Share a meal or a walk with someone.', values: ['connection', 'time_outdoors'] },
  { key: 'co_compliment',       cat: 'connection', min: 2,  text: 'Give someone a sincere compliment.', values: ['connection', 'self_kindness'] },

  // Creativity
  { key: 'cr_doodle',           cat: 'creativity', min: 5,  text: 'Doodle for five minutes, with no aim at all.', values: ['creativity', 'calm_evenings'] },
  { key: 'cr_photo',            cat: 'creativity', min: 2,  text: 'Take one photo of something ordinary that looks good.', values: ['creativity', 'time_outdoors'] },
  { key: 'cr_mandala',          cat: 'creativity', min: 20, text: 'Color part of a mandala on the Mandalas page.', values: ['creativity', 'calm_evenings'] },
  { key: 'cr_new_recipe',       cat: 'creativity', min: 20, text: 'Cook something slightly new, or an old favorite a new way.', values: ['creativity', 'connection'] },
  { key: 'cr_six_words',        cat: 'creativity', min: 2, write: true,  text: 'Describe today in exactly six words.', values: ['creativity', 'self_kindness'] },
];

/**
 * The chapters of every quest, in order. `at` is how many days the member must
 * have shown up — on any days, in a row or not — for the chapter to open.
 * The story lines are filled with the value's phrase.
 */
export const CHAPTERS = [
  { at: 0,  place: 'The Trailhead',     story: (p) => `You set out toward ${p}. The path is short to start, and there is no hurry.` },
  { at: 3,  place: 'The First Clearing', story: (p) => `Three days in, the trees open up. You have already made a little room for ${p}.` },
  { at: 7,  place: 'The Stream Crossing', story: () => `A week of showing up. The stepping stones are the small things you keep choosing.` },
  { at: 12, place: 'The Quiet Grove',    story: () => `The path is familiar now. Some days it will be longer, some shorter, and both count.` },
  { at: 18, place: 'The Lookout',        story: (p) => `From up here you can see how far you have come toward ${p}.` },
  { at: 25, place: 'The Open Meadow',    story: () => `This part of the map is yours to shape. Keep what helped and let the rest go.` },
  { at: 35, place: 'The Far Hills',      story: () => `The path keeps going as long as you like. Pick a new side path whenever you want one.` },
];

/** Actions shown on each chapter, and optional side paths. */
export const MAIN_PER_CHAPTER = 3;

const byKey = new Map(ACTIONS.map(a => [a.key, a]));
export const action = (key) => byKey.get(key) || null;
export const valueOf = (key) => VALUES.find(v => v.key === key) || null;

/** A small seeded shuffle so the same quest always draws the same map. */
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}
function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const fits = (a, value) => !a.values || a.values.includes(value);

/**
 * The actions that fit a member's choices, best first: the chosen categories,
 * no longer than their time (with a little slack at 20 minutes, since nothing
 * is longer), and suited to their value where possible.
 */
export function pool({ value, categories, minutes }) {
  const cats = new Set(categories || []);
  const live = ACTIONS.filter(a => !a.retired && cats.has(a.cat) && a.min <= minutes);
  const suited = live.filter(a => fits(a, value));
  return suited.length >= MAIN_PER_CHAPTER ? suited : live;
}

/**
 * Draws the quest map. Same inputs, same map.
 * Returns { value, chapters: [{ index, place, story, at, main: [action], side: action|null }] }.
 * Main actions come from the member's own categories; the side path on each
 * chapter is an optional idea from a category they did not pick, still no
 * longer than their time, so there is always something new to try but never
 * something they must do.
 */
export function buildQuest({ id = '', value, categories, minutes }) {
  const v = valueOf(value);
  if (!v) throw new Error(`unknown value ${value}`);
  const rand = seeded(`${id}|${value}|${[...categories].sort().join(',')}|${minutes}`);
  const fit = pool({ value, categories, minutes });
  const picked = new Set(categories);
  const others = shuffle(ACTIONS.filter(a => !a.retired && !picked.has(a.cat) && a.min <= minutes), rand);
  const size = Math.min(MAIN_PER_CHAPTER, fit.length);
  const seen = new Set();
  let deck = [];
  const chapters = CHAPTERS.map((c, i) => {
    // Deal from a shuffled deck, so every action turns up before any repeats.
    // If that would give this chapter the same set as an earlier one, draw a
    // fresh set instead (a few tries), so the story keeps offering new mixes.
    let main = [];
    for (let tries = 0; tries < 12; tries++) {
      const hand = new Map();
      while (hand.size < size) {
        if (!deck.length) deck = shuffle(fit, rand);
        const a = deck.shift();
        hand.set(a.key, a);
      }
      main = [...hand.values()];
      const id = main.map(a => a.key).sort().join();
      if (!seen.has(id)) { seen.add(id); break; }
      deck = shuffle(fit, rand);
    }
    return {
      index: i, place: c.place, at: c.at, story: c.story(v.phrase),
      main,
      side: others.length ? others[i % others.length] : null,
    };
  });
  return { value: v, chapters };
}

/**
 * How far along the member is. `days` is the list of dates (YYYY-MM-DD) on
 * which they did anything on the quest or logged a goal; duplicates are fine.
 * Only ever counts up: a missed day takes nothing away.
 */
export function progress(days, chapters = CHAPTERS) {
  const shown = new Set(days).size;
  let open = 0;
  chapters.forEach((c, i) => { if (shown >= c.at) open = i; });
  const next = chapters[open + 1] || null;
  return {
    days: shown,
    open,                                   // index of the newest open chapter
    next: next ? { index: open + 1, place: next.place, at: next.at, left: next.at - shown } : null,
  };
}

/** Milestones worth a small celebration, by days shown up. */
export const MILESTONES = [1, 3, 7, 12, 18, 25, 35, 50, 75, 100];
export const milestoneFor = (n) => MILESTONES.includes(n);

/**
 * The suggestion helper. Optional, off by default, and rule-based: it only
 * looks at the minutes and categories the member already chose, never at
 * anything they wrote, and makes no decisions about them.
 */
export const helper = {
  /** A shorter action in the same category, if there is one. */
  shorter(key, { categories } = {}) {
    const a = action(key);
    if (!a) return null;
    const cands = ACTIONS.filter(x => !x.retired && x.cat === a.cat && x.min < a.min);
    if (cands.length) return cands.sort((x, y) => y.min - x.min)[0];
    const cats = new Set(categories || []);
    return ACTIONS.filter(x => !x.retired && cats.has(x.cat) && x.min < a.min)
      .sort((x, y) => y.min - x.min)[0] || null;
  },
  /** A reflection prompt idea drawn from the member's own categories. */
  prompt(categories, seed = Date.now()) {
    const ideas = (categories || []).flatMap(c => PROMPT_IDEAS[c] || []);
    const list = ideas.length ? ideas : PROMPT_IDEAS.reflection;
    return list[Math.floor(seeded(seed)() * list.length)];
  },
};

/** Generic reflection prompt ideas, by category. Personal reflection only. */
export const PROMPT_IDEAS = {
  habits:     ['What small thing made today run a little smoother?', 'Which part of your day would you like to keep the same tomorrow?'],
  self_care:  ['What was one kind thing you did for yourself today?', 'When did you feel most comfortable today?'],
  reflection: ['What is something you are looking forward to?', 'What did you learn today, big or small?'],
  gratitude:  ['Who made your day a little better, and how?', 'What is an everyday thing you would miss if it were gone?'],
  movement:   ['What kind of movement did you enjoy most this week?', 'Where would you like to walk next?'],
  nature:     ['What did you notice outside today?', 'What is your favorite time of day to be outdoors, and why?'],
  connection: ['Who would you like to spend more time with?', 'What conversation stayed with you today?'],
  creativity: ['What would you make if it did not have to be good?', 'What caught your eye today?'],
};
