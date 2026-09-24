// Data checks for the themed challenges in data/challenges.json. Run from the repo root:
//   node tests/challenges-fixture/check.mjs
// Fails (exit 1) if a challenge is malformed, repeats a slug, a title or another
// challenge's to-dos, is missing its description, has too few to-dos, uses an
// unknown tag or theme, or is written in language the library avoids.
import { readFileSync } from 'node:fs';

const CH = JSON.parse(readFileSync(new URL('../../data/challenges.json', import.meta.url), 'utf8'));

const errors = [];
const err = (c, msg) => errors.push(`${c.slug || '?'}: ${msg}`);

// The day the themed challenges replaced the old fixed-length ones. Twenty
// arrived at once; every day after that adds exactly two.
const LAUNCH_DAY = '2026-09-24';
const LAUNCH_COUNT = 20;
const PER_DAY = 2;

// A challenge carries at least this many to-dos, so the 7-, 21- and 30-day
// runs never repeat one. Longer runs go through the bank again from the top.
export const MIN_TASKS = 30;
export const MAX_TASKS = 60;

// Tags are the same controlled vocabulary the worksheets, articles and
// checklists use, so one search box covers the whole library.
export const TAGS = new Set([
  'Anger', 'Anxiety', 'Assertiveness', 'Body', 'Boundaries', 'Burnout', 'Caregiving', 'CBT',
  'Communication', 'DBT', 'Decision Making', 'Depression', 'Emotion Regulation', 'Family', 'Food',
  'Goals', 'Grief', 'Grounding', 'Habits', 'Life Transitions', 'Loneliness', 'Loss', 'Mindfulness',
  'Money', 'Motivation', 'Movement', 'Panic', 'Parenting', 'Perfectionism', 'Relationships',
  'Resilience', 'Self-Care', 'Self-Compassion', 'Self-Esteem', 'Shame', 'Sleep', 'Social Anxiety',
  'Stress', 'Thinking Traps', 'Trauma', 'Values', 'Work', 'Worry',
]);

// The theme a challenge belongs to: the word on the library tile and under
// the title on the challenge page. Add one here before using it.
export const CATEGORIES = new Set([
  'Anger', 'Anxiety', 'Body', 'Boundaries', 'Burnout', 'Caregiving', 'Communication',
  'Confidence', 'Connection', 'Creativity', 'Focus', 'Gratitude', 'Grief', 'Grounding', 'Habits',
  'Home', 'Kindness', 'Loneliness', 'Mindfulness', 'Money', 'Mornings', 'Motivation', 'Parenting',
  'Play', 'Relationships', 'Rest', 'Self-Care', 'Self-Compassion', 'Sleep', 'Social Anxiety',
  'Stress', 'Study', 'Thinking', 'Transitions', 'Values', 'Wellbeing', 'Work', 'Worry',
]);

// Challenges about grief, loss, trauma and panic carry the crisis line.
const SAFETY = /\b988\b/;
const NEEDS_SAFETY = ['Grief', 'Loss', 'Trauma', 'Panic'];

// A challenge talks with the member, never about their diagnosis, never
// promises a cure, and never talks down to anyone.
const BANNED = [
  /\byou (may |might |probably |likely )?(have|are suffering from|meet the criteria for|are diagnosed with) (a |an |the )?(condition|disorder|illness|problem|diagnosis)/i,
  /\byour (condition|diagnosis|disorder|illness)\b/i,
  /\byou are (depressed|bipolar|traumatized|addicted|mentally ill|an? \w+ic)\b/i,
  /\bcommit(ted|s|ting)? suicide\b/i, /\bsuccessful suicide\b/i,
  /\bthe mentally ill\b/i, /\ban? (addict|schizophrenic|anorexic|bulimic|borderline)\b/i,
  /\b(crazy|insane|psycho|lunatic)\b(?!-)/i,
  /\bcalories?\b/i, /\bweight loss\b/i, /\blose weight\b/i,
  /\bscience-backed\b/i, /\bevidence-based\b/i, /\bclinically proven\b/i,
  /\b(cure|cures|curing|treat|treats|treating|diagnose|diagnoses|diagnosing) (your |any |a |an )?(anxiety|depression|trauma|condition|disorder|illness)/i,
  /\bstreak\b/i,
];
const UK = [/\bcolour/i, /\bbehaviour/i, /\bfavourite/i, /\bcounselling/i, /\bpersonalis/i, /\bjudgement/i,
  /\bcentre\b/i, /\bcancelled\b/i, /\bgrey\b/i, /\blabelled/i, /\bprogramme\b/i, /\bpractis/i, /\blicence\b/i,
  /\brealis(e|ed|es|ing)\b/i, /\brecognis(e|ed|es|ing)\b/i, /\bapologis(e|ed|es|ing)\b/i, /\borganis(e|ed|es|ing)\b/i,
  /\bminimis(e|ed|es|ing)\b/i, /\bemphasis(e|ed|es|ing)\b/i, /\bnormalis(e|ed|es|ing)\b/i, /\bhospitalis/i,
  /\bprioritis(e|ed|es|ing)\b/i, /\bempathis(e|ed|es|ing)\b/i, /\bcatastrophis(e|ed|es|ing)\b/i,
  /\banalys(e|ed|es|ing)\b/i, /\bmum\b/i, /\bwhilst\b/i, /\bamongst\b/i, /\btowards\b/i,
  /\blearnt\b/i, /\bspelt\b/i, /\bdreamt\b/i, /\bfortnight/i, /\bmaths\b/i,
  /\bmobile phone/i, /\btelly\b/i, /\bfavour/i,
  /\bhonour/i, /\bhumour/i, /\bneighbour/i, /\brumour/i, /\btraveller/i, /\bcounsellor/i, /\bjewellery/i,
  /\bpaediatric/i, /\boestrogen/i, /\bdefence\b/i, /\boffence\b/i, /\bpractising\b/i, /\benrol\b/i,
  /\bskilful/i, /\bfulfil\b/i, /\bfulfilment/i, /\bsceptic/i, /\bpyjamas/i, /\btyre\b/i, /\bkerb\b/i];

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// "Walk for ten minutes today, anywhere." → "walk for ten minutes today anywhere".
// Two to-dos with the same words are the same to-do, wherever they live.
const taskKey = (s) => nameKey(s);

const KEYS = ['slug', 'title', 'description', 'category', 'tags', 'min_level', 'published_at', 'tasks'];
const slugs = new Set(), titles = new Set();
const perDay = new Map();
const everyTask = new Map();   // taskKey → slug of the first challenge that used it

for (const c of CH) {
  const got = Object.keys(c);
  if (got.length !== KEYS.length || KEYS.some(k => !(k in c))) err(c, `keys must be exactly ${KEYS.join(', ')}`);
  if (!/^[a-z0-9-]+$/.test(c.slug || '')) err(c, 'slug must be lowercase, digits and dashes');
  if (slugs.has(c.slug)) err(c, 'duplicate slug');
  slugs.add(c.slug);

  if (!c.title || c.title.length > 60) err(c, 'title must be there and under 60 characters');
  if (/[.!]$/.test(c.title || '')) err(c, 'title should not end with a period');
  if (/^\d+[- ]day\b/i.test(c.title || '')) err(c, 'a themed challenge is not named for a number of days — the member picks the length');
  if (titles.has(nameKey(c.title))) err(c, `another challenge is already called "${c.title}"`);
  titles.add(nameKey(c.title));

  // The description is what a member reads on the library tile and at the top
  // of the challenge: one or two sentences on what this challenge is for.
  const d = String(c.description || '');
  if (!d) err(c, 'description is required — one or two sentences on what this challenge is for');
  else {
    if (words(d) < 15 || words(d) > 55) err(c, `description is ${words(d)} words, wanted 15 to 55`);
    const sentences = d.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    if (sentences > 2) err(c, `description is ${sentences} sentences, wanted one or two`);
    if (!/[.!?]$/.test(d)) err(c, 'description should end with a period');
    if (!/^[A-Z"“]/.test(d)) err(c, 'description should start with a capital letter');
    if (nameKey(d).startsWith(nameKey(c.title))) err(c, 'description should say what the challenge is for, not repeat the title');
  }

  if (!CATEGORIES.has(c.category)) err(c, `unknown category "${c.category}" — add it to CATEGORIES first`);
  if (c.min_level !== 1) err(c, 'min_level must be 1 — every registered member can start any theme (the length is what the tiers decide)');

  if (!Array.isArray(c.tags) || c.tags.length < 1 || c.tags.length > 3) err(c, 'needs 1 to 3 tags');
  else {
    for (const t of c.tags) if (!TAGS.has(t)) err(c, `unknown tag "${t}" — add it to TAGS first`);
    if (new Set(c.tags).size !== c.tags.length) err(c, 'repeated tag');
  }

  if (!Array.isArray(c.tasks) || c.tasks.length < MIN_TASKS || c.tasks.length > MAX_TASKS) {
    err(c, `needs ${MIN_TASKS} to ${MAX_TASKS} to-dos, has ${Array.isArray(c.tasks) ? c.tasks.length : 0}`);
  } else {
    const seen = new Set();
    for (const [i, t] of c.tasks.entries()) {
      const where = `to-do ${i + 1}`;
      if (typeof t !== 'string' || !t.trim()) { err(c, `${where} is empty`); continue; }
      if (t !== t.trim()) err(c, `${where} has stray whitespace at an end`);
      if (t.length < 20) err(c, `${where} is ${t.length} characters, wanted 20 or more — say what to do`);
      if (t.length > 220) err(c, `${where} is ${t.length} characters, wanted 220 or fewer — one small thing`);
      if (!/^[A-Z"“]/.test(t)) err(c, `${where} should start with a capital letter`);
      if (!/[.?!][”’"']?$/.test(t)) err(c, `${where} should end with a period, a question mark or an exclamation point`);
      if (/\bday \d+\b/i.test(t)) err(c, `${where} names a day number — to-dos are reused at any length, so they never say which day they are`);
      const k = taskKey(t);
      if (seen.has(k)) err(c, `${where} repeats an earlier to-do in the same challenge`);
      seen.add(k);
      if (everyTask.has(k) && everyTask.get(k) !== c.slug) {
        err(c, `${where} is the same to-do as one in ${everyTask.get(k)} — write it differently or drop it`);
      } else if (!everyTask.has(k)) everyTask.set(k, c.slug);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/.test(c.published_at || '')) {
    err(c, 'published_at must be an ISO timestamp like 2026-09-25T17:00:00+00:00');
  } else {
    const day = c.published_at.slice(0, 10);
    perDay.set(day, (perDay.get(day) || 0) + 1);
  }

  const text = [c.title, c.description, c.category, ...(c.tags || []), ...(c.tasks || [])].join('\n');
  for (const re of BANNED) { const m = text.match(re); if (m) err(c, `avoid the phrase "${m[0]}"`); }
  for (const re of UK) { const m = text.match(re); if (m) err(c, `US spelling: "${m[0]}"`); }
  if ((c.tags || []).some(t => NEEDS_SAFETY.includes(t)) && !SAFETY.test(text)) {
    err(c, `a challenge tagged ${NEEDS_SAFETY.join('/')} names 988 in one of its to-dos`);
  }
}

// Twenty on launch day, then two a day, every day, and never the same
// challenge twice. Challenges that share many of their to-dos are the same
// challenge under a new name.
for (const [day, n] of [...perDay].sort()) {
  const want = day === LAUNCH_DAY ? LAUNCH_COUNT : PER_DAY;
  if (n !== want) errors.push(`${day}: ${n} challenge${n === 1 ? '' : 's'} published that day, wanted ${want}`);
}
for (let i = 0; i < CH.length; i++) {
  for (let j = i + 1; j < CH.length; j++) {
    const a = new Set((CH[i].tasks || []).map(taskKey));
    const b = new Set((CH[j].tasks || []).map(taskKey));
    if (!a.size || !b.size) continue;
    const shared = [...a].filter(x => b.has(x)).length;
    if (shared / Math.min(a.size, b.size) >= 0.25) {
      errors.push(`${CH[i].slug} and ${CH[j].slug}: ${shared} of the same to-dos — write a different challenge`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const tasks = CH.reduce((n, c) => n + c.tasks.length, 0);
const themes = new Set(CH.map(c => c.category));
console.log(`ok: ${CH.length} challenges, ${tasks} to-dos, ${themes.size} themes`);
