// Data checks for the interactive worksheets in data/worksheets.json. Run from
// the repo root:
//   node tests/worksheets-fixture/check.mjs
// Fails (exit 1) if any worksheet is malformed, any slug or title repeats, a
// field id is out of sequence, or the copy uses language the worksheets avoid.
import { readFileSync } from 'node:fs';

const WS = JSON.parse(readFileSync(new URL('../../data/worksheets.json', import.meta.url), 'utf8'));

const errors = [];
const err = (w, msg) => errors.push(`${w.slug || '?'}: ${msg}`);

const EXPECTED_TOTAL = 186;
if (WS.length !== EXPECTED_TOTAL) errors.push(`expected ${EXPECTED_TOTAL} worksheets, found ${WS.length}`);

// The sixteen imported from the original Word documents predate the house
// style; they keep their shape. Everything written since must carry a
// description and an intro.
const LEGACY = new Set([
  'behavioral-activation-planner', 'core-beliefs-explorer', 'daily-energy-allocation-chart',
  'daily-gratitude-journal', 'daily-mindfulness-moment-tracker', 'daily-pleasure-and-mastery-log',
  'emotion-regulation-plan-worksheet', 'getting-to-know-yourself',
  'managing-depressive-symptoms-a-self-reflection-worksheet', 'self-compassion-letter',
  'self-soothing-techniques-worksheet', 'social-support-map', 'thought-record-worksheet',
  'values-and-goals-worksheet', 'what-your-procrastination-is-protecting',
  'working-with-intrusive-thoughts',
]);

// Tags are a controlled vocabulary so the library's filters stay tidy.
export const TAGS = new Set([
  'Anger', 'Anxiety', 'Assertiveness', 'Body', 'Boundaries', 'Burnout', 'Caregiving', 'CBT',
  'Communication', 'DBT', 'Decision Making', 'Depression', 'Emotion Regulation', 'Family', 'Food',
  'Goals', 'Grief', 'Grounding', 'Habits', 'Life Transitions', 'Loneliness', 'Loss', 'Mindfulness',
  'Money', 'Motivation', 'Movement', 'Panic', 'Parenting', 'Perfectionism', 'Relationships',
  'Resilience', 'Self-Care', 'Self-Compassion', 'Self-Esteem', 'Shame', 'Sleep', 'Social Anxiety',
  'Stress', 'Thinking Traps', 'Trauma', 'Values', 'Work', 'Worry',
]);

// Worksheets about grief, trauma and other heavy ground carry this line.
const SAFETY = 'in the US you can call or text 988 at any time';
const NEEDS_SAFETY = ['Grief', 'Loss', 'Trauma', 'Panic'];

// A worksheet talks with the member, never about their diagnosis, and never
// talks down to anyone.
const BANNED = [
  /\byou (may |might |probably |likely )?(have|are suffering from|meet the criteria for|are diagnosed with) (a |an |the )?(condition|disorder|illness|problem|diagnosis)/i,
  /\byour (condition|diagnosis|disorder|illness)\b/i,
  /\byou are (depressed|bipolar|traumatized|addicted|mentally ill|an? \w+ic)\b/i,
  /\bcommit(ted|s|ting)? suicide\b/i, /\bsuccessful suicide\b/i,
  /\bthe mentally ill\b/i, /\ban? (addict|schizophrenic|anorexic|bulimic|borderline)\b/i,
  /\b(crazy|insane|psycho|lunatic)\b(?!-)/i,
  /\bcalories?\b/i, /\bweight loss\b/i, /\blose weight\b/i,
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

function walkText(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => walkText(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => walkText(x, out));
  return out;
}
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

const slugs = new Set(), titles = new Set();
const KEYS = ['slug', 'title', 'description', 'category', 'intro_md', 'tags', 'min_level', 'fields'];
for (const w of WS) {
  const legacy = LEGACY.has(w.slug);
  const got = Object.keys(w);
  if (got.length !== KEYS.length || KEYS.some(k => !(k in w))) err(w, `keys must be exactly ${KEYS.join(', ')}`);
  if (!/^[a-z0-9-]+$/.test(w.slug || '')) err(w, 'slug must be lowercase, digits and dashes');
  if (slugs.has(w.slug)) err(w, 'duplicate slug'); slugs.add(w.slug);
  const t = String(w.title || '').trim().toLowerCase();
  if (titles.has(t)) err(w, 'duplicate title'); titles.add(t);
  if (!w.title || w.title.length > 110) err(w, 'title missing or too long');
  if (w.category !== 'Worksheet') err(w, `category must be Worksheet, got ${w.category}`);
  if (w.min_level !== 2) err(w, `min_level must be 2, got ${w.min_level}`);
  if (!Array.isArray(w.tags)) err(w, 'tags must be an array');
  else for (const tag of w.tags) if (!TAGS.has(tag)) err(w, `unknown tag "${tag}"`);

  if (!legacy) {
    if (/\bworksheet\b/i.test(w.title)) err(w, 'title should not say worksheet');
    if (w.title.length > 60) err(w, `title is ${w.title.length} characters; keep it under 60`);
    if (!w.tags.length || w.tags.length > 3) err(w, 'needs 1 to 3 tags');
    const d = words(w.description); if (d < 15 || d > 45) err(w, `description is ${d} words`);
    const i = words(w.intro_md); if (i < 30 || i > 110) err(w, `intro is ${i} words`);
    if (/^#|\n- |\*\*/.test(w.intro_md || '')) err(w, 'intro must be plain prose');
    if (w.tags.some(x => NEEDS_SAFETY.includes(x)) && !(w.intro_md || '').includes(SAFETY))
      err(w, 'heavy topic: intro must end with the 988 safety line');
    if (!Array.isArray(w.fields) || w.fields.length < 8 || w.fields.length > 16)
      err(w, `expected 8 to 16 fields, found ${w.fields?.length}`);
  }

  const seenSections = [], fieldIds = new Set();
  let lastSection;
  for (const [i, f] of (w.fields || []).entries()) {
    const where = `field ${i}`;
    if (f.id !== `f${i}`) err(w, `${where} id should be f${i}, got ${f.id}`);
    if (fieldIds.has(f.id)) err(w, `${where} repeats id ${f.id}`); fieldIds.add(f.id);
    if (!['textarea', 'table'].includes(f.type)) err(w, `${where} has unknown type ${f.type}`);
    if (!f.label || !String(f.label).trim()) err(w, `${where} needs a label`);
    if (/:\s*$/.test(f.label || '')) err(w, `${where} label ends with a colon`);
    if (!('section' in f)) err(w, `${where} needs a section key (may be null)`);
    // Three imported worksheets carry placeholder lines in their sections (a
    // known import defect, listed in documents/CONTENT-HEALTH.md); nothing new may.
    if (!legacy && f.section && (/\[_/.test(f.section) || /^- /.test(f.section))) err(w, `${where} section holds placeholder text`);
    if (f.type === 'table') {
      if (!Array.isArray(f.columns) || f.columns.length < 2 || f.columns.length > 6) err(w, `${where} table needs 2 to 6 columns`);
      if (!(Number.isInteger(f.rows) && f.rows >= 3 && f.rows <= 10)) err(w, `${where} table needs 3 to 10 rows`);
      const extra = Object.keys(f).filter(k => !['id', 'type', 'label', 'rows', 'columns', 'section'].includes(k));
      if (extra.length) err(w, `${where} has unexpected keys ${extra.join(', ')}`);
    } else {
      const extra = Object.keys(f).filter(k => !['id', 'type', 'label', 'section'].includes(k));
      if (extra.length) err(w, `${where} has unexpected keys ${extra.join(', ')}`);
    }
    // Sections group consecutive fields; a section name that comes back after
    // a different one renders as two headings with the same name.
    if (f.section !== lastSection) {
      if (f.section && seenSections.includes(f.section)) err(w, `section "${f.section}" is split in two`);
      if (f.section) seenSections.push(f.section);
      lastSection = f.section;
    }
  }

  const text = walkText(w).join('\n');
  for (const re of BANNED) { const m = text.match(re); if (m) err(w, `avoid the phrase "${m[0]}"`); }
  for (const re of UK) { const m = text.match(re); if (m) err(w, `US spelling: "${m[0]}"`); }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const nf = WS.reduce((n, w) => n + w.fields.length, 0);
const tags = new Set(WS.flatMap(w => w.tags));
console.log(`ok: ${WS.length} worksheets, ${nf} fields, ${tags.size} tags`);
