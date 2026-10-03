/* ==========================================================================
   Theraglee — from a goal in the member's own words to milestones and
   stepping stones (the Premium Goals & tracking page).
   --------------------------------------------------------------------------
   The member types a goal ("Evenings that feel like mine again, less phone,
   more sleep"). Everything below runs in the browser, by matching words:

     detectTheme(text)        → which of the eight themes the words point to,
                                with the words that pointed there
     suggestMilestones(theme) → five milestones written for that theme,
                                each with the stepping stones that serve it
     suggestSteps(...)        → actions from the library ranked for the goal's
                                words, the theme and the milestone, each with
                                the reason it was suggested

   No AI and no network: the goal sentence is read only here, on the member's
   device, and nothing leaves it. The matcher is a word list, so it is easy to
   read, test and extend. docs/quest-map.md is the guide.
   ========================================================================== */
import { VALUES, ACTIONS, action, suits } from './quest-paths.js';

/* ------------------------------------------------------------- words */
/* Everyday words a member might use, grouped under one tag each. A word in
   the goal (or in an action's text) that matches any of these counts as its
   tag. Word stems: 'evening' matches 'evenings', 'scroll' matches 'scrolling'. */
export const WORDS = {
  evening:  ['evening', 'tonight', 'night', 'nights', 'late', 'after work', 'after dinner', 'wind down', 'unwind', 'bedtime', 'pm'],
  sleep:    ['sleep', 'asleep', 'bed', 'rest', 'rested', 'tired at night', 'lie in', 'nap'],
  screen:   ['phone', 'screen', 'scroll', 'social media', 'instagram', 'tiktok', 'youtube', 'netflix', 'tv', 'laptop', 'notifications', 'doomscroll', 'online', 'offline'],
  calm:     ['calm', 'relax', 'peace', 'peaceful', 'quiet', 'slow', 'slower', 'stress', 'stressed', 'overwhelm', 'overwhelmed', 'breathe', 'breath', 'settle', 'unwind', 'frazzled', 'wound up', 'tense', 'ease'],
  routine:  ['routine', 'routines', 'schedule', 'consistent', 'consistency', 'regular', 'same time', 'habit', 'habits', 'structure', 'structured', 'organized', 'organised', 'order', 'steady', 'steadier', 'rhythm', 'on track', 'discipline', 'shape'],
  morning:  ['morning', 'mornings', 'wake', 'waking', 'alarm', 'start the day', 'get up', 'getting up', 'early'],
  people:   ['friend', 'friends', 'family', 'people', 'partner', 'husband', 'wife', 'kids', 'children', 'parents', 'mom', 'dad', 'sister', 'brother', 'lonely', 'alone', 'isolated', 'connect', 'connected', 'connection', 'talk', 'call', 'social', 'relationship', 'relationships', 'community', 'neighbors', 'conversation', 'conversations', 'reach out'],
  energy:   ['energy', 'energetic', 'tired', 'exhausted', 'drained', 'awake', 'sluggish', 'alive', 'lively', 'alert', 'fatigue', 'worn out', 'run down', 'burned out', 'burnt out', 'motivation', 'motivated', 'vitality'],
  move:     ['move', 'moving', 'movement', 'exercise', 'stretch', 'walk', 'walking', 'walks', 'run', 'running', 'dance', 'active', 'body', 'gym', 'fit', 'fitness', 'steps', 'yoga', 'bike', 'swim'],
  outside:  ['outside', 'outdoors', 'outdoor', 'nature', 'fresh air', 'sun', 'sunshine', 'sunlight', 'daylight', 'park', 'garden', 'yard', 'hike', 'hiking', 'trail', 'trees', 'green', 'sky', 'beach', 'woods', 'weather'],
  focus:    ['focus', 'focused', 'concentrate', 'concentration', 'distracted', 'distraction', 'distractions', 'procrastinate', 'procrastinating', 'procrastination', 'work', 'productive', 'productivity', 'attention', 'tabs', 'deadline', 'study', 'studying', 'priorities', 'priority', 'what matters', 'matters', 'intentional', 'present', 'mind', 'clear head', 'overthinking', 'busy'],
  kind:     ['kind', 'kinder', 'kindness', 'gentle', 'gentler', 'myself', 'self', 'critical', 'harsh', 'forgive', 'forgiving', 'compassion', 'compassionate', 'confidence', 'confident', 'worth', 'enough', 'guilt', 'guilty', 'patient with myself', 'easier on myself', 'beat myself up', 'love myself', 'self-care', 'care for myself', 'like a friend', 'talk to myself', 'talking to myself', 'hard on myself', 'inner critic'],
  create:   ['create', 'creative', 'creativity', 'make', 'making', 'draw', 'drawing', 'paint', 'painting', 'write', 'writing', 'music', 'play', 'art', 'hobby', 'hobbies', 'craft', 'crafts', 'cook', 'cooking', 'bake', 'baking', 'photo', 'photos', 'photography', 'sing', 'singing', 'garden', 'knit', 'sew', 'build', 'imagination', 'ideas', 'doodle', 'journal'],
  grateful: ['grateful', 'gratitude', 'thankful', 'appreciate', 'appreciation', 'positive', 'glad', 'blessings', 'count my blessings', 'look on the bright side'],
  reflect:  ['reflect', 'reflection', 'notice', 'noticing', 'mindful', 'mindfulness', 'aware', 'awareness', 'journal', 'journaling', 'diary', 'remember'],
  tidy:     ['tidy', 'clean', 'clutter', 'declutter', 'mess', 'messy', 'home', 'house', 'space', 'room', 'desk', 'organized', 'organised'],
  food:     ['eat', 'eating', 'meal', 'meals', 'food', 'dinner', 'breakfast', 'lunch', 'water', 'hydrate', 'hydrated', 'drink', 'snack', 'cook', 'cooking'],
  me:       ['mine', 'for me', 'myself', 'my own', 'me time', 'own time', 'time for me', 'time to myself', 'just for me'],
  partner:  ['marriage', 'married', 'spouse', 'husband', 'wife', 'partner', 'boyfriend', 'girlfriend', 'fiance', 'fiancee', 'couple', 'romance', 'romantic', 'date night', 'date nights', 'intimacy', 'intimate', 'love', 'loving', 'loved', 'affection', 'affectionate', 'together', 'closer', 'argue', 'arguing', 'arguments', 'fight', 'fighting', 'bicker', 'bickering', 'communicate', 'communication', 'listen', 'listening', 'my relationship', 'our relationship'],
};

/* What each theme is made of: a tag and how strongly it points there. */
export const THEME_TAGS = {
  calm_evenings:   { evening: 3, sleep: 2, screen: 2, calm: 2, me: 1 },
  steady_routines: { routine: 3, morning: 2, sleep: 1, tidy: 1, food: 1 },
  connection:      { people: 3, partner: 3 },
  energy:          { energy: 3, move: 2, morning: 1, food: 1, sleep: 1 },
  time_outdoors:   { outside: 3, move: 1 },
  self_kindness:   { kind: 3, me: 2, calm: 1, grateful: 1 },
  creativity:      { create: 3, me: 1 },
  focus:           { focus: 3, screen: 1, tidy: 1, routine: 1 },
};

/* A few actions whose wording does not carry the words a member would use
   for them. Every action also gets tags from its own text and its focuses. */
const EXTRA_TAGS = {
  hab_screen_curfew: ['screen', 'evening', 'sleep'], hab_lamp_light: ['evening', 'calm', 'sleep'], hab_same_bed: ['sleep', 'routine'],
  hab_clothes_out: ['routine', 'morning'], hab_same_wake: ['morning', 'routine', 'sleep'], hab_morning_light: ['morning', 'energy'],
  hab_glass_water: ['morning', 'food', 'energy'], hab_single_task: ['focus', 'screen'], hab_one_tab: ['focus', 'screen'],
  hab_tomorrow_three: ['focus', 'routine', 'evening'], hab_close_the_day: ['evening', 'focus'], hab_evening_reset: ['tidy', 'evening', 'routine'],
  hab_tidy_surface: ['tidy', 'focus'], hab_dinner_time: ['food', 'routine'], hab_bag_by_door: ['routine', 'morning'],
  sc_dim_lights: ['evening', 'sleep', 'calm'], sc_same_wind_down: ['evening', 'sleep', 'routine'], sc_wind_down_music: ['evening', 'calm'],
  sc_warm_drink: ['evening', 'calm', 'screen'], sc_long_shower: ['calm', 'kind', 'evening'], sc_screen_free_meal: ['screen', 'food', 'people', 'partner'],
  sc_slow_breaths: ['calm'], sc_do_nothing: ['calm', 'focus'], sc_snack_sit: ['food', 'energy'], sc_sit_in_sun: ['outside', 'energy'],
  sc_kind_note: ['kind'], sc_hand_lotion: ['kind', 'calm'], sc_face_same_time: ['routine', 'evening'],
  ref_ideal_evening: ['evening', 'me'], ref_keep_from_tonight: ['evening'], ref_what_matters: ['focus'], ref_small_win: ['kind', 'focus'],
  ref_energy_high: ['energy'], ref_one_thing_tomorrow: ['focus'], ref_routine_held: ['routine'],
  gr_evening_glad: ['evening', 'grateful'], gr_body_thanks: ['kind', 'energy'], gr_senses: ['calm', 'outside'],
  mv_gentle_stretch: ['evening', 'sleep', 'move'], mv_evening_stroll: ['evening', 'outside', 'move'], mv_morning_stretch: ['morning', 'routine'],
  mv_between_tasks: ['focus', 'screen', 'move'], mv_kind_pace: ['kind', 'move'], mv_shake_out: ['evening', 'energy'],
  na_evening_air: ['evening', 'outside'], na_sunset: ['evening', 'outside'], na_park_phone_away: ['screen', 'outside', 'focus'],
  na_sit_by_tree: ['calm', 'outside', 'kind'], na_same_spot: ['routine', 'outside'], na_morning_birds: ['morning', 'outside'],
  co_evening_chat: ['evening', 'screen', 'people', 'partner'], co_goodnight: ['evening', 'people', 'partner'], co_morning_message: ['morning', 'people', 'routine'],
  co_small_favor: ['kind', 'people'], cr_evening_page: ['evening', 'create'], cr_doodle_before_task: ['focus', 'create'],
  cr_rearrange_corner: ['tidy', 'create'], cr_mandala: ['create', 'calm'],
  co_ask_question: ['partner', 'people'], co_shared_meal: ['partner', 'people', 'food'], co_compliment: ['partner', 'people'],
  co_walk_and_talk: ['partner', 'people', 'outside'], mv_walk_with: ['partner', 'people'], co_plan_to_meet: ['partner', 'people'],
  gr_thank_someone: ['partner', 'people', 'grateful'], gr_letter: ['partner', 'people', 'grateful'], sc_two_warm_drinks: ['partner', 'people', 'kind'],
  cr_tiny_note: ['partner', 'people', 'create'], cr_card_for_someone: ['partner', 'people', 'create'], co_share_find: ['partner', 'people'],
  hab_dinner_time: ['partner', 'food', 'routine'],
};

/* Milestones written for each theme, in a sensible order, each with the
   stepping stones that serve it. A milestone is something the member can
   notice in real life, never a number to hit. */
export const MILESTONES = {
  calm_evenings: [
    { title: 'The phone charges outside the bedroom most nights', steps: ['hab_screen_curfew', 'hab_lamp_light', 'sc_dim_lights', 'hab_close_the_day'] },
    { title: 'A short wind-down that is the same most nights',    steps: ['sc_same_wind_down', 'sc_warm_drink', 'sc_wind_down_music', 'mv_gentle_stretch'] },
    { title: 'In bed within the same half hour most nights',      steps: ['hab_same_bed', 'hab_clothes_out', 'sc_slow_face_wash', 'gr_evening_glad'] },
    { title: 'One screen-free evening a week',                     steps: ['sc_screen_free_meal', 'co_evening_chat', 'cr_doodle', 'na_sunset'] },
    { title: 'An evening a week that is just for me',              steps: ['ref_ideal_evening', 'sc_long_shower', 'cr_evening_page', 'na_sit_by_tree'] },
  ],
  steady_routines: [
    { title: 'Up within the same half hour most mornings',  steps: ['hab_same_wake', 'hab_morning_light', 'hab_glass_water', 'mv_morning_stretch'] },
    { title: 'Tomorrow is set up before bed',                steps: ['hab_clothes_out', 'hab_bag_by_door', 'hab_tomorrow_three', 'hab_close_the_day'] },
    { title: 'Meals land at about the same times',           steps: ['hab_dinner_time', 'sc_screen_free_meal', 'sc_snack_sit', 'mv_one_foot'] },
    { title: 'A ten-minute evening reset most nights',       steps: ['hab_evening_reset', 'hab_tidy_surface', 'sc_face_same_time', 'gr_routine_glad'] },
    { title: 'One small routine I can count on every day',   steps: ['na_same_spot', 'co_morning_message', 'ref_routine_held', 'cr_same_shape'] },
  ],
  connection: [
    { title: 'I reach out to one person most days',            steps: ['co_text_friend', 'co_morning_message', 'co_compliment', 'hab_hello_passerby'] },
    { title: 'A real conversation each week',                   steps: ['co_call', 'co_ask_question', 'co_evening_chat', 'mv_walk_on_phone'] },
    { title: 'Time with someone, face to face, each week',      steps: ['co_shared_meal', 'co_walk_and_talk', 'co_plan_to_meet', 'mv_walk_with'] },
    { title: 'I say thank you out loud more often',             steps: ['gr_thank_someone', 'gr_letter', 'co_small_favor', 'ref_who_crossed_mind'] },
    { title: 'I share what I make and find',                    steps: ['co_share_find', 'co_photo_of_made', 'na_share_view', 'cr_card_for_someone'] },
  ],
  energy: [
    { title: 'Water and daylight before the first screen',     steps: ['hab_glass_water', 'hab_morning_light', 'na_morning_birds', 'sc_sit_in_sun'] },
    { title: 'I move a little every day',                       steps: ['mv_stand_stretch', 'mv_stairs', 'mv_between_tasks', 'mv_shake_out'] },
    { title: 'A real break in the middle of the day',           steps: ['sc_snack_sit', 'mv_walk_block', 'sc_bright_song', 'hab_outside_first'] },
    { title: 'A proper walk most days',                         steps: ['mv_long_walk', 'na_find_green', 'mv_one_lap', 'co_walk_and_talk'] },
    { title: 'I notice when my energy is high and use it',      steps: ['ref_energy_high', 'mv_dance_song', 'gr_body_thanks', 'co_swap_energy'] },
  ],
  time_outdoors: [
    { title: 'Outside for a few minutes every day',   steps: ['na_sky_minute', 'na_evening_air', 'hab_outside_first', 'sc_drink_outside'] },
    { title: 'A daily walk, even a short one',         steps: ['mv_walk_block', 'mv_one_lap', 'na_notice_five', 'na_photo_sky'] },
    { title: 'Time in green most days',                steps: ['na_find_green', 'na_park_phone_away', 'na_same_spot', 'na_sit_by_tree'] },
    { title: 'One meal or drink outside a week',       steps: ['na_eat_outside', 'sc_drink_outside', 'co_step_out_together', 'gr_outdoors_glad'] },
    { title: 'A longer outing most weeks',             steps: ['mv_long_walk', 'co_walk_and_talk', 'cr_sketch_outside', 'ref_outside_moment'] },
  ],
  self_kindness: [
    { title: 'I talk to myself like a friend',             steps: ['sc_kind_note', 'hab_kind_start', 'ref_handled_well', 'gr_body_thanks'] },
    { title: 'One unhurried thing for myself each day',     steps: ['sc_warm_drink', 'sc_hand_lotion', 'sc_long_shower', 'sc_slow_face_wash'] },
    { title: 'I move at a pace that feels kind',            steps: ['mv_kind_pace', 'mv_dance_song', 'mv_move_to_music', 'na_sit_by_tree'] },
    { title: 'I let people help',                           steps: ['co_small_favor', 'sc_two_warm_drinks', 'co_compliment', 'ref_person_admire'] },
    { title: 'I keep a record of what went well',           steps: ['ref_small_win', 'gr_one_thing', 'ref_future_self', 'cr_six_words'] },
  ],
  creativity: [
    { title: 'A few minutes of making most days',             steps: ['cr_doodle', 'hab_pen_by_chair', 'cr_six_words', 'cr_hum_a_song'] },
    { title: 'I notice things worth making something of',     steps: ['cr_photo', 'na_photo_sky', 'gr_made_thing', 'ref_three_odd_words'] },
    { title: 'One longer making session a week',              steps: ['cr_mandala', 'cr_new_recipe', 'cr_sketch_outside', 'cr_evening_page'] },
    { title: 'I share what I make',                           steps: ['co_share_find', 'co_photo_of_made', 'cr_card_for_someone', 'cr_tiny_note'] },
    { title: 'A space and a time that are for making',        steps: ['cr_rearrange_corner', 'ref_idea_page', 'cr_friendly_playlist', 'hab_pen_by_chair'] },
  ],
  focus: [
    { title: 'One stretch of single-task time a day',       steps: ['hab_single_task', 'hab_one_tab', 'mv_between_tasks', 'cr_doodle_before_task'] },
    { title: "Tomorrow's three things are chosen tonight",  steps: ['hab_tomorrow_three', 'ref_one_thing_tomorrow', 'hab_close_the_day', 'hab_bag_by_door'] },
    { title: 'I know where my time goes',                    steps: ['ref_what_matters', 'gr_own_time', 'ref_small_win', 'sc_do_nothing'] },
    { title: 'A clear surface to work at',                   steps: ['hab_tidy_surface', 'cr_rearrange_corner', 'hab_one_tab', 'sc_screen_free_meal'] },
    { title: 'Real breaks between tasks',                    steps: ['mv_between_tasks', 'na_park_phone_away', 'sc_do_nothing', 'na_sky_minute'] },
  ],
};

/* Milestone sets for a particular kind of goal within a theme, picked when the
   goal's words carry the tag. A goal about a marriage or a partner gets these
   instead of the general connection milestones. */
export const MILESTONE_SETS = {
  partner: {
    theme: 'connection',
    milestones: [
      { title: 'One meal a day together with no screens',            steps: ['sc_screen_free_meal', 'hab_dinner_time', 'co_ask_question', 'gr_thank_someone'] },
      { title: 'A real conversation most evenings, even ten minutes', steps: ['co_evening_chat', 'co_ask_question', 'co_goodnight', 'sc_two_warm_drinks'] },
      { title: 'I say one specific thank-you to them each day',       steps: ['gr_thank_someone', 'co_compliment', 'cr_tiny_note', 'gr_letter'] },
      { title: 'One walk or outing together each week',               steps: ['co_walk_and_talk', 'mv_walk_with', 'co_shared_meal', 'co_plan_to_meet'] },
      { title: 'A small kindness they did not ask for, most days',    steps: ['cr_tiny_note', 'sc_two_warm_drinks', 'co_share_find', 'cr_card_for_someone'] },
    ],
  },
};

/** Goals in a member's words, one per theme, offered as examples to tap. */
export const EXAMPLE_GOALS = VALUES.map(v => ({ theme: v.key, text: v.example }));

/* How many stepping-stone days we suggest before asking whether a milestone
   is happening for real. A nudge, not a rule: the member decides. */
export const STEPS_PER_MILESTONE = 7;

/* ----------------------------------------------------------- matching */
const stem = (w) => w.replace(/(ings?|ers?|ed|es|s|ly)$/, '').replace(/ie$/, 'y');
const norm = (s) => String(s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();

/* Each tag's words as stems and as whole phrases, built once. */
const TAG_INDEX = Object.entries(WORDS).map(([tag, list]) => ({
  tag,
  phrases: list.filter(w => w.includes(' ')).map(norm),
  stems: new Set(list.filter(w => !w.includes(' ')).map(w => stem(norm(w)))),
}));

/** The tags a piece of text carries, with the words that put them there. */
export function tagsIn(text) {
  const t = norm(text);
  if (!t) return {};
  const found = {};
  const add = (tag, word) => { (found[tag] ||= new Set()).add(word); };
  const words = t.split(' ').filter(w => w.length > 1);
  for (const { tag, phrases, stems } of TAG_INDEX) {
    for (const p of phrases) if (t.includes(p)) add(tag, p);
    for (const w of words) if (stems.has(stem(w))) add(tag, w);
  }
  return Object.fromEntries(Object.entries(found).map(([k, v]) => [k, [...v]]));
}

/**
 * Which theme the goal's words point to.
 * Returns { theme, score, because: [words], ranked: [{theme, score}] }, or
 * theme null when nothing in the text is a word we know.
 */
export function detectTheme(text) {
  const tags = tagsIn(text);
  const ranked = Object.entries(THEME_TAGS).map(([theme, weights]) => {
    let score = 0; const because = new Set();
    for (const [tag, w] of Object.entries(weights)) {
      if (tags[tag]) { score += w * Math.min(2, tags[tag].length); tags[tag].forEach(x => because.add(x)); }
    }
    return { theme, score, because: [...because] };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score === 0) return { theme: null, score: 0, because: [], ranked };
  return { theme: best.theme, score: best.score, because: best.because, ranked };
}

/** The five milestones written for a theme (copies, safe to edit). With the
 *  goal's words, a set written for that kind of goal wins when one fits. */
export function suggestMilestones(theme, text = '') {
  const tags = tagsIn(text);
  const special = Object.values(MILESTONE_SETS).find(set => set.theme === theme && tags[Object.keys(MILESTONE_SETS).find(k => MILESTONE_SETS[k] === set)]);
  return (special?.milestones || MILESTONES[theme] || []).map(m => ({ title: m.title, steps: [...m.steps] }));
}

/* Tags an action carries: from its own text, its focuses' words, and EXTRA_TAGS. */
const actionTags = new Map(ACTIONS.map(a => {
  const tags = new Set(Object.keys(tagsIn(a.text)));
  for (const t of EXTRA_TAGS[a.key] || []) tags.add(t);
  return [a.key, tags];
}));
export const tagsOf = (key) => [...(actionTags.get(key) || [])];

/**
 * Stepping stones for a goal, best first.
 *   text       the goal in the member's words
 *   theme      the theme (detected or picked)
 *   milestone  { title, steps } the stones are for, or null for the goal as a whole
 *   minutes    how long the member usually has (actions longer than this sink)
 *   limit      how many to return
 * Each result is { action, score, because: [words from the goal that matched] }.
 */
export function suggestSteps({ text = '', theme = null, milestone = null, minutes = 10, limit = 8 } = {}) {
  const goalTags = tagsIn(text);
  const milestoneTags = tagsIn(milestone?.title || '');
  const recommended = new Set(milestone?.steps || []);
  const scored = ACTIONS.filter(a => !a.retired).map(a => {
    const tags = actionTags.get(a.key);
    let score = 0; const because = new Set();
    for (const [tag, words] of Object.entries(goalTags)) if (tags.has(tag)) { score += 2; words.slice(0, 2).forEach(w => because.add(w)); }
    for (const tag of Object.keys(milestoneTags)) if (tags.has(tag)) score += 1;
    if (recommended.has(a.key)) score += 6;
    if (theme && suits(a, theme)) score += 3;
    else if (theme && !a.values) score += 1;
    if (a.min > minutes) score -= 4;
    score += (20 - a.min) / 40;                                  // shorter edges ahead on a tie
    return { action: a, score, because: [...because] };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** The words in a goal we recognized, for "because you mentioned …". */
export function recognizedWords(text) {
  return [...new Set(Object.values(tagsIn(text)).flat())];
}

/** A short, plain reason for a suggestion. */
export function reasonFor(s, milestone = null) {
  if (s.because.length) return `because you mentioned ${s.because.slice(0, 3).map(w => `“${w}”`).join(', ')}`;
  if (milestone && milestone.steps?.includes(s.action.key)) return 'written for this milestone';
  return 'fits this kind of goal';
}

/** Checks every milestone's steps name real actions (the test runs this). */
export function milestoneProblems() {
  const out = [];
  const sets = [...Object.entries(MILESTONES), ...Object.entries(MILESTONE_SETS).map(([k, s]) => [`${s.theme}/${k}`, s.milestones])];
  for (const [theme, list] of sets) {
    if (!VALUES.some(v => v.key === theme.split('/')[0])) out.push(`${theme}: not a theme`);
    for (const m of list) for (const k of m.steps) if (!action(k)) out.push(`${theme} / ${m.title}: unknown action ${k}`);
  }
  for (const k of Object.keys(MILESTONE_SETS)) if (!WORDS[k]) out.push(`${k}: no words for this set`);
  return out;
}
