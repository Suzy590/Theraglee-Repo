// Data checks for the mental health trivia quizzes ("sets" in code). Run from the repo root:
//   node tests/trivia-fixture/check.mjs
// Fails (exit 1) if any set is malformed, any id does not match its slug, or
// the copy uses language the trivia must avoid.
import { createHash } from 'node:crypto';
import { SETS, TOPICS } from '../../site/assets/trivia-sets.js';
import { QUESTIONS_PER_SET, band, playOrder, score, summarize, rng } from '../../site/assets/trivia.js';

const errors = [];
const err = (s, msg) => errors.push(`${s.slug || '?'}: ${msg}`);

const EXPECTED_TOTAL = 150, PER_TOPIC = 10;
if (SETS.length !== EXPECTED_TOTAL) errors.push(`expected ${EXPECTED_TOTAL} sets, found ${SETS.length}`);
if (TOPICS.length !== EXPECTED_TOTAL / PER_TOPIC) errors.push(`expected ${EXPECTED_TOTAL / PER_TOPIC} topics, found ${TOPICS.length}`);

// v5 UUID of a URL, so every id can be checked against its slug.
function uuid5url(url) {
  const NS = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const h = createHash('sha1').update(Buffer.concat([NS, Buffer.from(url, 'utf8')])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

// Trivia is about the subject, never the player, and it never talks down to
// anyone. These are the phrasings that would cross that line.
const BANNED = [
  /\byou (may |might |probably |likely )?(have|are suffering from|meet the criteria for|are diagnosed with) (a |an |the )?(condition|disorder|illness|problem|diagnosis)/i,
  /\byour (condition|diagnosis|symptoms|disorder|illness)\b/i,
  /\byou are (depressed|bipolar|traumatized|addicted|mentally ill|anxious|an? \w+ic)\b/i,
  /\bcommit(ted|s|ting)? suicide\b/i, /\bsuccessful suicide\b/i,
  /\bthe mentally ill\b/i, /\ban? (addict|schizophrenic|anorexic|bulimic|borderline)\b/i,
  /\b(crazy|insane|psycho|lunatic)\b(?!-)/i,
  /\b(all|none) of the above\b/i,
];
// Two kinds of set teach which words to retire, so they may quote them:
// the word-origin sets in the history topic, and the set about language in
// the stigma topic. Everywhere else the phrases above are simply banned.
const MAY_QUOTE_RETIRED_WORDS = (s) => /^history-/.test(s.slug) || (s.tags || []).includes('language');
const UK = [/\bcolour/i, /\bbehaviour/i, /\bfavourite/i, /\bcounselling/i, /\bpersonalis/i, /\bjudgement/i,
  /\bcentre\b/i, /\bcancelled\b/i, /\bgrey\b/i, /\blabelled/i, /\bprogramme\b/i, /\bpractis/i, /\blicence\b/i,
  /\brealis(e|ed|es|ing)\b/i, /\brecognis(e|ed|es|ing)\b/i, /\bapologis(e|ed|es|ing)\b/i, /\borganis(e|ed|es|ing)\b/i,
  /\bminimis(e|ed|es|ing)\b/i, /\bemphasis(e|ed|es|ing)\b/i, /\bnormalis(e|ed|es|ing)\b/i, /\bhospitalis/i];

function walkText(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => walkText(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => walkText(x, out));
  return out;
}

const slugs = new Set(), ids = new Set(), titles = new Set(), questions = new Map();
const perTopic = {};
for (const s of SETS) {
  for (const k of ['slug', 'id', 'title', 'topic', 'difficulty', 'description', 'tags', 'questions'])
    if (s[k] == null || s[k] === '') err(s, `missing ${k}`);
  if (slugs.has(s.slug)) err(s, 'duplicate slug'); slugs.add(s.slug);
  if (ids.has(s.id)) err(s, 'duplicate id'); ids.add(s.id);
  if (titles.has(s.title)) err(s, 'duplicate title'); titles.add(s.title);
  if (!/^[a-z0-9-]+$/.test(s.slug || '')) err(s, 'slug must be lowercase, digits and dashes');
  if (s.id !== uuid5url('https://theraglee.com/trivia/' + s.slug)) err(s, `id does not match slug: ${s.id}`);
  if (!TOPICS.includes(s.topic)) err(s, `unknown topic ${s.topic}`);
  perTopic[s.topic] = (perTopic[s.topic] || 0) + 1;
  if (![1, 2, 3].includes(s.difficulty)) err(s, 'difficulty must be 1, 2 or 3');
  if (!Array.isArray(s.tags) || !s.tags.length) err(s, 'tags must be a non-empty array');
  if (/\b(trivia|quiz)\b/i.test(s.title || '')) err(s, 'title should not say trivia or quiz');
  const words = String(s.description || '').split(/\s+/).length;
  if (words < 8 || words > 32) err(s, `description is ${words} words`);

  if (!Array.isArray(s.questions) || s.questions.length !== QUESTIONS_PER_SET)
    err(s, `expected ${QUESTIONS_PER_SET} questions, found ${s.questions?.length}`);
  const used = new Set();
  for (const [i, q] of (s.questions || []).entries()) {
    const where = `q${i + 1}`;
    if (!q.q || !q.why) err(s, `${where} needs q and why`);
    if (!Array.isArray(q.options) || q.options.length !== 4) err(s, `${where} needs exactly 4 options`);
    else if (new Set(q.options.map(o => String(o).trim().toLowerCase())).size !== 4) err(s, `${where} has duplicate options`);
    if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4)) err(s, `${where} answer index out of range`);
    used.add(q.answer);
    const key = String(q.q).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (questions.has(key)) err(s, `${where} repeats a question from ${questions.get(key)}`);
    questions.set(key, s.slug);
  }
  if (used.size < 4) err(s, 'correct answers should land on every position at least once');

  let text = walkText(s).join('\n');
  for (const re of BANNED) {
    if (MAY_QUOTE_RETIRED_WORDS(s) && !String(re).includes('of the above') && !String(re).includes('your ')) continue;
    const m = text.match(re); if (m) err(s, `avoid the phrase "${m[0]}"`);
  }
  for (const re of UK) { const m = text.match(re); if (m) err(s, `US spelling: "${m[0]}"`); }

  // The engine must be able to run every set.
  try {
    const play = playOrder(s, 42);
    if (play.length !== QUESTIONS_PER_SET) err(s, 'playOrder lost questions');
    for (const [i, q] of play.entries()) {
      if (q.options[q.answer] !== s.questions[i].options[s.questions[i].answer]) err(s, `playOrder q${i + 1} lost the answer`);
    }
    const all = score(play, play.map(q => q.answer));
    if (all !== QUESTIONS_PER_SET) err(s, 'scoring a perfect play did not give full marks');
  } catch (e) { err(s, `engine threw: ${e.message}`); }
}
for (const t of TOPICS) if ((perTopic[t] || 0) !== PER_TOPIC) errors.push(`${t}: expected ${PER_TOPIC} sets, found ${perTopic[t] || 0}`);

// Pure helpers.
if (band(10).key !== 'perfect' || band(8).key !== 'strong' || band(6).key !== 'solid' || band(4).key !== 'learning' || band(0).key !== 'fresh')
  errors.push('band() thresholds moved');
const r1 = rng(7), r2 = rng(7);
if (r1() !== r2()) errors.push('rng is not deterministic');
const sum = summarize(SETS.slice(0, 3), new Map([[SETS[0]?.slug, { best: 10, total: 10 }], [SETS[1]?.slug, { best: 5, total: 10 }]]));
if (sum.played !== 2 || sum.perfect !== 1 || sum.avg !== 75) errors.push(`summarize() gave ${JSON.stringify(sum)}`);

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const nq = SETS.reduce((n, s) => n + s.questions.length, 0);
console.log(`ok: ${SETS.length} sets, ${TOPICS.length} topics, ${nq} questions`);
