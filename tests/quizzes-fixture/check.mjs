// Data checks for the self-assessment quizzes in data/quizzes.txt. Run from
// the repo root:
//   node tests/quizzes-fixture/check.mjs            # the library
//   node tests/quizzes-fixture/check.mjs draft.txt  # a draft file, any count
// Fails (exit 1) if any quiz is malformed, any slug or title repeats, a score
// falls outside every band, or the copy uses language the quizzes avoid.
import { readFileSync } from 'node:fs';

const path = process.argv[2] || new URL('../../data/quizzes.txt', import.meta.url);
const DRAFT = Boolean(process.argv[2]);
const EXPECTED_TOTAL = 312;

// The sixty-two imported from the original Word documents predate the house
// style: three to eight questions, sometimes three bands, free-form tags and
// "Quiz" in the title. They keep their shape; documents/CONTENT-HEALTH.md
// lists their known defects. Everything written since follows the rules below.
const LEGACY = new Set([
  'adaptability-quiz', 'assertiveness-quiz', 'authenticity-quiz', 'boundary-setting-quiz',
  'conflict-avoidance-quiz', 'conflict-resolution-quiz', 'conflict-resolution-style-quiz',
  'creativity-tendencies-quiz', 'curiosity-level-quiz', 'decision-making-confidence-quiz',
  'decision-making-style-quiz', 'emotional-expression-quiz', 'emotional-intelligence-quiz',
  'emotional-regulation-quiz', 'emotional-resilience-quiz', 'empathetic-listening-quiz',
  'empathy-for-self-quiz', 'empathy-in-action-quiz', 'empathy-level-quiz',
  'forgiveness-tendencies-quiz', 'goal-orientation-quiz', 'goal-setting-quiz',
  'gratitude-awareness-quiz', 'gratitude-expression-quiz', 'gratitude-practice-quiz',
  'growth-mindset-quiz', 'how-well-do-you-know-yourself-quiz', 'learning-style-quiz',
  'listening-skills-quiz', 'mindful-breathing-quiz', 'mindful-communication-quiz',
  'mindful-eating-quiz', 'mindfulness-awareness-quiz', 'motivation-style-quiz',
  'openness-to-feedback-quiz', 'openness-to-new-experiences-quiz', 'optimism-vs-pessimism-quiz',
  'optimistic-thinking-quiz', 'patience-level-quiz', 'perseverance-quiz',
  'personal-growth-focus-quiz', 'personality-type-quiz', 'problem-solving-style-quiz',
  'ptsd-symptom-awareness', 'resilience-level-quiz', 'resolving-ambiguity-quiz',
  'risk-taking-tendencies-quiz', 'self-awareness-quiz', 'self-care-practices-quiz',
  'self-compassion-quiz', 'self-confidence-quiz', 'self-discipline-quiz', 'self-motivation-quiz',
  'self-reflection-habits-quiz', 'social-confidence-quiz', 'social-connection-quiz',
  'stress-response-quiz', 'stress-tolerance-quiz', 'teamwork-tendencies-quiz',
  'time-management-quiz', 'trust-in-others-quiz', 'values-clarity-quiz',
]);

// A quiz written for the site: five questions, each with four options scored
// 4, 3, 2, 1 in that order (4 is always the more settled or resourced answer),
// and four bands that together cover every score from 0 to 20.
const QUESTIONS = 5, OPTION_VALUES = [4, 3, 2, 1], BANDS = 4;
const MAX_SCORE = QUESTIONS * OPTION_VALUES[0];

// Tags are a controlled vocabulary so the library's filters stay tidy. It is
// the worksheet vocabulary plus a few areas only the quizzes cover.
export const TAGS = new Set([
  'Anger', 'Anxiety', 'Assertiveness', 'Body', 'Boundaries', 'Burnout', 'Caregiving', 'CBT',
  'Communication', 'DBT', 'Decision Making', 'Depression', 'Emotion Regulation', 'Family', 'Food',
  'Goals', 'Grief', 'Grounding', 'Habits', 'Life Transitions', 'Loneliness', 'Loss', 'Mindfulness',
  'Money', 'Motivation', 'Movement', 'Panic', 'Parenting', 'Perfectionism', 'Relationships',
  'Resilience', 'Self-Care', 'Self-Compassion', 'Self-Esteem', 'Shame', 'Sleep', 'Social Anxiety',
  'Stress', 'Thinking Traps', 'Trauma', 'Values', 'Work', 'Worry',
  // quiz-only
  'Aging', 'Change', 'Confidence', 'Digital Life', 'Focus', 'Friendship', 'Identity', 'Meaning',
  'Play', 'Rest',
]);

// Quizzes on heavy ground point to the 988 line in their lowest band.
const SAFETY = 'call or text 988';
const NEEDS_SAFETY = ['Grief', 'Loss', 'Trauma', 'Panic', 'Depression'];

// A quiz reflects the member back to themselves. It never diagnoses, never
// labels, and never talks down to anyone. The page already carries the
// "not a diagnosis" notice, so the copy does not repeat it.
const BANNED = [
  /\byou (may |might |probably |likely )?(have|are suffering from|meet the criteria for|are diagnosed with) (a |an |the )?(condition|disorder|illness|problem|diagnosis)/i,
  /\byour (condition|diagnosis|disorder|illness)\b/i,
  /\byou are (depressed|bipolar|traumatized|addicted|mentally ill|anxious|an? \w+ic)\b/i,
  /\bcommit(ted|s|ting)? suicide\b/i, /\bsuccessful suicide\b/i,
  /\bthe mentally ill\b/i, /\ban? (addict|schizophrenic|anorexic|bulimic|borderline)\b/i,
  /\b(crazy|insane|psycho|lunatic)\b(?!-)/i,
  /\bcalories?\b/i, /\bweight loss\b/i, /\blose weight\b/i,
];
const BANNED_NEW = [/diagnos/i, /\bdisorder\b/i, /\bsymptoms?\b/i, /\bclinical/i, /\bpatholog/i];
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

// ---------------------------------------------------------------- parse ---
const errors = [];
const err = (q, msg) => errors.push(`${q?.slug || '?'}: ${msg}`);
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

const quizzes = [];
const lines = readFileSync(path, 'utf8').split('\n');
for (const [i, raw] of lines.entries()) {
  const line = raw.replace(/\r$/, '');
  if (!line.trim()) continue;
  const at = `line ${i + 1}`;
  const [tag, ...rest] = line.split('|');
  const q = quizzes[quizzes.length - 1];
  if (/\t/.test(line)) errors.push(`${at}: tab character`);
  if (/^\s|\s$/.test(line)) errors.push(`${at}: leading or trailing whitespace`);
  if (tag === 'Q') {
    if (rest.length !== 5) { errors.push(`${at}: Q needs slug|title|description|tags|level (${rest.length} fields)`); continue; }
    const [slug, title, description, tags, level] = rest;
    quizzes.push({ slug, title, description, tags: tags ? tags.split(',') : [], level, questions: [], bands: [], line: i + 1 });
  } else if (tag === 'P') {
    if (!q) { errors.push(`${at}: P before any Q`); continue; }
    if (rest.length !== 1) errors.push(`${at}: P has a stray | in it`);
    q.questions.push({ prompt: rest.join('|'), options: [] });
  } else if (tag === 'O') {
    const x = q?.questions[q.questions.length - 1];
    if (!x) { errors.push(`${at}: O before any P`); continue; }
    if (rest.length !== 2) errors.push(`${at}: O needs value|label`);
    x.options.push({ value: Number(rest[0]), label: rest.slice(1).join('|') });
  } else if (tag === 'B') {
    if (!q) { errors.push(`${at}: B before any Q`); continue; }
    if (rest.length !== 4) errors.push(`${at}: B needs min|max|label|interpretation (${rest.length} fields)`);
    q.bands.push({ min: Number(rest[0]), max: Number(rest[1]), label: rest[2], interp: rest.slice(3).join('|') });
  } else {
    errors.push(`${at}: unknown line type "${tag}"`);
  }
}

// ---------------------------------------------------------------- check ---
if (!DRAFT && quizzes.length !== EXPECTED_TOTAL) errors.push(`expected ${EXPECTED_TOTAL} quizzes, found ${quizzes.length}`);

const slugs = new Set(), titles = new Set();
for (const q of quizzes) {
  const legacy = LEGACY.has(q.slug);
  if (!/^[a-z0-9-]+$/.test(q.slug || '')) err(q, 'slug must be lowercase, digits and dashes');
  if (slugs.has(q.slug)) err(q, 'duplicate slug'); slugs.add(q.slug);
  const t = String(q.title || '').trim().toLowerCase();
  if (titles.has(t)) err(q, 'duplicate title'); titles.add(t);
  if (!q.title) err(q, 'title missing');
  if (q.level !== '2') err(q, `level must be 2, got ${q.level}`);
  if (!q.tags.length) err(q, 'needs at least one tag');
  if (q.questions.length < 3) err(q, `only ${q.questions.length} questions`);
  for (const [n, x] of q.questions.entries()) {
    if (!x.prompt.trim()) err(q, `question ${n + 1} is empty`);
    if (x.options.length < 2) err(q, `question ${n + 1} has ${x.options.length} options`);
    for (const o of x.options) {
      if (!Number.isInteger(o.value)) err(q, `question ${n + 1} has a non-numeric value`);
      if (!o.label.trim()) err(q, `question ${n + 1} has an empty option`);
    }
  }
  for (const b of q.bands) {
    if (!Number.isInteger(b.min) || !Number.isInteger(b.max) || b.min > b.max) err(q, `band "${b.label}" has a bad range`);
    if (!b.label.trim()) err(q, 'a band has no label');
  }
  if (legacy) continue;

  // House style for quizzes written for the site.
  if (/\bquiz\b/i.test(q.title)) err(q, 'title should not say quiz');
  if (q.title.length > 60) err(q, `title is ${q.title.length} characters; keep it under 60`);
  if (/[.!]$/.test(q.title)) err(q, 'title should not end with punctuation');
  const d = words(q.description); if (d < 12 || d > 40) err(q, `description is ${d} words; keep it 12 to 40`);
  if (!/[.?!]$/.test(q.description.trim())) err(q, 'description should end with a period');
  if (q.tags.length > 3) err(q, 'needs 1 to 3 tags');
  for (const tag of q.tags) if (!TAGS.has(tag)) err(q, `unknown tag "${tag}"`);
  if (new Set(q.tags).size !== q.tags.length) err(q, 'repeated tag');

  if (q.questions.length !== QUESTIONS) err(q, `expected ${QUESTIONS} questions, found ${q.questions.length}`);
  const prompts = new Set();
  for (const [n, x] of q.questions.entries()) {
    const where = `question ${n + 1}`;
    const pw = words(x.prompt);
    if (pw < 5 || pw > 28) err(q, `${where} is ${pw} words; keep it 5 to 28`);
    if (!/[?.…]$/.test(x.prompt.trim())) err(q, `${where} should end with a question mark, period or ellipsis`);
    const key = x.prompt.toLowerCase().replace(/[^a-z ]/g, '');
    if (prompts.has(key)) err(q, `${where} repeats an earlier question`); prompts.add(key);
    const values = x.options.map(o => o.value);
    if (values.join() !== OPTION_VALUES.join()) err(q, `${where} options must be scored ${OPTION_VALUES.join(', ')} in that order (got ${values.join(', ')})`);
    const labels = new Set();
    for (const o of x.options) {
      const ow = words(o.label);
      if (ow < 1 || ow > 16) err(q, `${where} option "${o.label}" is ${ow} words; keep it 1 to 16`);
      const k = o.label.toLowerCase(); if (labels.has(k)) err(q, `${where} repeats the option "${o.label}"`); labels.add(k);
    }
  }

  if (q.bands.length !== BANDS) err(q, `expected ${BANDS} bands, found ${q.bands.length}`);
  const bands = [...q.bands].sort((a, b) => a.min - b.min);
  if (bands.length && bands[0].min !== 0) err(q, `bands start at ${bands[0].min}; the first must start at 0`);
  if (bands.length && bands[bands.length - 1].max !== MAX_SCORE) err(q, `bands end at ${bands[bands.length - 1].max}; the last must end at ${MAX_SCORE}`);
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].min !== bands[i - 1].max + 1) err(q, `bands "${bands[i - 1].label}" and "${bands[i].label}" leave a gap or overlap`);
  }
  if (q.bands.some((b, i) => bands[i] !== b)) err(q, 'bands must be listed from lowest to highest');
  const labels = new Set();
  for (const b of q.bands) {
    const lw = words(b.label);
    if (lw < 1 || lw > 6) err(q, `band label "${b.label}" is ${lw} words; keep it 1 to 6`);
    if (b.label.length > 40) err(q, `band label "${b.label}" is over 40 characters`);
    const k = b.label.toLowerCase(); if (labels.has(k)) err(q, `band label "${b.label}" repeats`); labels.add(k);
    const iw = words(b.interp);
    if (iw < 20 || iw > 70) err(q, `band "${b.label}" interpretation is ${iw} words; keep it 20 to 70`);
  }
  if (q.tags.some(x => NEEDS_SAFETY.includes(x)) && !(bands[0]?.interp || '').includes(SAFETY))
    err(q, 'heavy topic: the lowest band must mention that you can call or text 988');

  const text = [q.title, q.description, ...q.questions.flatMap(x => [x.prompt, ...x.options.map(o => o.label)]),
    ...q.bands.flatMap(b => [b.label, b.interp])].join('\n');
  for (const re of [...BANNED, ...BANNED_NEW]) { const m = text.match(re); if (m) err(q, `avoid the phrase "${m[0]}"`); }
  for (const re of UK) { const m = text.match(re); if (m) err(q, `US spelling: "${m[0]}"`); }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const nq = quizzes.reduce((n, q) => n + q.questions.length, 0);
const nb = quizzes.reduce((n, q) => n + q.bands.length, 0);
const tags = new Set(quizzes.flatMap(q => q.tags));
console.log(`ok: ${quizzes.length} quizzes, ${nq} questions, ${nb} bands, ${tags.size} tags`);
