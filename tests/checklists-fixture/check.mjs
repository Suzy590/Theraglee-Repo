// Data checks for the checklists in data/checklists.json. Run from the repo root:
//   node tests/checklists-fixture/check.mjs
// Fails (exit 1) if a checklist is malformed, repeats a slug, a title or another
// checklist's items, is missing its description, uses an unknown tag or theme,
// or is written in language the library avoids.
import { readFileSync } from 'node:fs';

const CL = JSON.parse(readFileSync(new URL('../../data/checklists.json', import.meta.url), 'utf8'));

const errors = [];
const err = (c, msg) => errors.push(`${c.slug || '?'}: ${msg}`);

// The four imported from the original Word documents predate the daily run.
// They carry a description like everything else, but no published_at, so the
// "two a day" rule below does not look at them.
const LEGACY = new Set([
  'daily-mental-health-checklist', 'recognizing-warning-signs',
  'coping-self-care-strategies', 'long-term-mental-wellness-practices',
]);

// Tags are the same controlled vocabulary the worksheets and articles use, so
// one search box covers the whole library. Add a tag here before using it.
export const TAGS = new Set([
  'Anger', 'Anxiety', 'Assertiveness', 'Body', 'Boundaries', 'Burnout', 'Caregiving', 'CBT',
  'Communication', 'DBT', 'Decision Making', 'Depression', 'Emotion Regulation', 'Family', 'Food',
  'Goals', 'Grief', 'Grounding', 'Habits', 'Life Transitions', 'Loneliness', 'Loss', 'Mindfulness',
  'Money', 'Motivation', 'Movement', 'Panic', 'Parenting', 'Perfectionism', 'Relationships',
  'Resilience', 'Self-Care', 'Self-Compassion', 'Self-Esteem', 'Shame', 'Sleep', 'Social Anxiety',
  'Stress', 'Thinking Traps', 'Trauma', 'Values', 'Work', 'Worry',
]);

// The theme a checklist belongs to. It is the word after "Checklist" on the
// library tile, so it is short and plain. Add one here before using it.
export const CATEGORIES = new Set([
  'Anger', 'Anxiety', 'Body', 'Boundaries', 'Burnout', 'Caregiving', 'Communication',
  'Confidence', 'Connection', 'Focus', 'Grief', 'Grounding', 'Habits', 'Home', 'Loneliness',
  'Mindfulness', 'Money', 'Mornings', 'Motivation', 'Parenting', 'Relationships', 'Rest',
  'Self-Care', 'Self-Compassion', 'Sleep', 'Social Anxiety', 'Stress', 'Study', 'Transitions',
  'Wellbeing', 'Work', 'Worry',
]);

const CADENCE = new Set(['daily', 'weekly', 'as needed']);

// Checklists about grief, loss, trauma and panic carry the crisis line.
const SAFETY = /\b988\b/;
const NEEDS_SAFETY = ['Grief', 'Loss', 'Trauma', 'Panic'];

// A checklist talks with the member, never about their diagnosis, and never
// talks down to anyone.
const BANNED = [
  /\byou (may |might |probably |likely )?(have|are suffering from|meet the criteria for|are diagnosed with) (a |an |the )?(condition|disorder|illness|problem|diagnosis)/i,
  /\byour (condition|diagnosis|disorder|illness)\b/i,
  /\byou are (depressed|bipolar|traumatized|addicted|mentally ill|an? \w+ic)\b/i,
  /\bcommit(ted|s|ting)? suicide\b/i, /\bsuccessful suicide\b/i,
  /\bthe mentally ill\b/i, /\ban? (addict|schizophrenic|anorexic|bulimic|borderline)\b/i,
  /\b(crazy|insane|psycho|lunatic)\b(?!-)/i,
  /\bcalories?\b/i, /\bweight loss\b/i, /\blose weight\b/i,
  /\bscience-backed\b/i, /\bevidence-based\b/i, /\bclinically proven\b/i,
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
// "Slow the out-breath — In for four…" → "slow the out breath". The action half
// alone is what two checklists would repeat, so that is what is compared.
const action = (item) => String(item).split(/\s+[—–]\s+/)[0]
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const KEYS = ['slug', 'title', 'description', 'category', 'cadence', 'tags', 'min_level', 'items', 'published_at'];
const slugs = new Set(), titles = new Set();
const perDay = new Map();

for (const c of CL) {
  const got = Object.keys(c);
  if (got.length !== KEYS.length || KEYS.some(k => !(k in c))) err(c, `keys must be exactly ${KEYS.join(', ')}`);
  if (!/^[a-z0-9-]+$/.test(c.slug || '')) err(c, 'slug must be lowercase, digits and dashes');
  if (slugs.has(c.slug)) err(c, 'duplicate slug');
  slugs.add(c.slug);

  if (!c.title || c.title.length > 60) err(c, 'title must be there and under 60 characters');
  if (/[.!]$/.test(c.title || '')) err(c, 'title should not end with a period');
  if (titles.has(nameKey(c.title))) err(c, `another checklist is already called "${c.title}"`);
  titles.add(nameKey(c.title));

  // The description is what a member reads on the library tile and at the top
  // of the checklist: one or two sentences on what this list is for.
  const d = String(c.description || '');
  if (!d) err(c, 'description is required — one or two sentences on what this checklist is for');
  else {
    if (words(d) < 15 || words(d) > 55) err(c, `description is ${words(d)} words, wanted 15 to 55`);
    const sentences = d.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    if (sentences > 2) err(c, `description is ${sentences} sentences, wanted one or two`);
    if (!/[.!?]$/.test(d)) err(c, 'description should end with a period');
    if (!/^[A-Z"“]/.test(d)) err(c, 'description should start with a capital letter');
    if (nameKey(d).startsWith(nameKey(c.title))) err(c, 'description should say what the list is for, not repeat the title');
  }

  if (!CATEGORIES.has(c.category)) err(c, `unknown category "${c.category}" — add it to CATEGORIES first`);
  if (!CADENCE.has(c.cadence)) err(c, `cadence must be one of ${[...CADENCE].join(', ')}`);
  if (c.min_level !== 1) err(c, 'min_level must be 1 — checklists come with the free member tier');

  if (!Array.isArray(c.tags) || c.tags.length < 1 || c.tags.length > 3) err(c, 'needs 1 to 3 tags');
  else {
    for (const t of c.tags) if (!TAGS.has(t)) err(c, `unknown tag "${t}" — add it to TAGS first`);
    if (new Set(c.tags).size !== c.tags.length) err(c, 'repeated tag');
  }

  if (!Array.isArray(c.items) || c.items.length < 5 || c.items.length > 12) err(c, 'needs 5 to 12 items');
  else {
    const seen = new Set();
    for (const [i, item] of c.items.entries()) {
      const where = `item ${i + 1}`;
      if (typeof item !== 'string' || !item.trim()) { err(c, `${where} is empty`); continue; }
      if (item.length > 160) err(c, `${where} is ${item.length} characters, wanted 160 or fewer`);
      // Every row is "Action — why it helps": the document build bands the two
      // halves differently, and the action half is what a member scans.
      const halves = item.split(/\s+[—–]\s+/);
      if (halves.length !== 2) err(c, `${where} must read "Action — why it helps", with a single dash between the halves`);
      else {
        const [act, why] = halves;
        // "Check — in with your emotions" was "Check-in" before it was imported.
        // One word before the dash followed by a lowercase word is always that bug.
        if (act.trim().split(/\s+/).length < 2 && /^[a-z]/.test(why.trim())) {
          err(c, `${where}: "${act.trim()} — ${why.trim().slice(0, 24)}…" is a lost hyphen, not an action`);
        }
        if (act.length > 60) err(c, `${where}: the action half is ${act.length} characters, wanted 60 or fewer`);
        if (!why.trim()) err(c, `${where} has nothing after the dash`);
        else if (!/[.?!][”’"']?$/.test(why.trim())) err(c, `${where} should end with a period or a question mark`);
      }
      if (seen.has(action(item))) err(c, `${where} repeats an earlier item`);
      seen.add(action(item));
    }
  }

  if (!LEGACY.has(c.slug)) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/.test(c.published_at || '')) {
      err(c, 'published_at must be an ISO timestamp like 2026-09-21T16:00:00+00:00');
    } else {
      const day = c.published_at.slice(0, 10);
      perDay.set(day, (perDay.get(day) || 0) + 1);
    }
  } else if (c.published_at !== null) {
    err(c, 'the four imported checklists keep published_at null');
  }

  const text = [c.title, c.description, c.category, ...(c.tags || []), ...(c.items || [])].join('\n');
  for (const re of BANNED) { const m = text.match(re); if (m) err(c, `avoid the phrase "${m[0]}"`); }
  for (const re of UK) { const m = text.match(re); if (m) err(c, `US spelling: "${m[0]}"`); }
  if ((c.tags || []).some(t => NEEDS_SAFETY.includes(t)) && !SAFETY.test(text)) {
    err(c, `a checklist tagged ${NEEDS_SAFETY.join('/')} names 988 in one of its items`);
  }
}

// Two a day, every day, and never the same list twice. Checklists that share
// most of their actions are the same checklist under a new name.
for (const [day, n] of [...perDay].sort()) {
  if (n !== 2) errors.push(`${day}: ${n} checklist${n === 1 ? '' : 's'} published that day, wanted 2`);
}
for (let i = 0; i < CL.length; i++) {
  for (let j = i + 1; j < CL.length; j++) {
    const a = new Set((CL[i].items || []).map(action));
    const b = new Set((CL[j].items || []).map(action));
    if (!a.size || !b.size) continue;
    const shared = [...a].filter(x => b.has(x)).length;
    const overlap = shared / Math.min(a.size, b.size);
    if (overlap >= 0.5) {
      errors.push(`${CL[i].slug} and ${CL[j].slug}: ${shared} of the same items — write a different checklist`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const items = CL.reduce((n, c) => n + c.items.length, 0);
const themes = new Set(CL.map(c => c.category));
console.log(`ok: ${CL.length} checklists, ${items} items, ${themes.size} themes`);
