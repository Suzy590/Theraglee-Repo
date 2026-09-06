// Data checks for the 100 free discovery tools. Run from the repo root:
//   node tests/discover-fixture/check.mjs
// Fails (exit 1) if any tool is malformed or uses language the tools must avoid.
import { TOOLS, TOPICS } from '../../site/assets/discover-tools.js';
import { KIND_LABEL, progressOf, ready, summaryOf } from '../../site/assets/discover.js';

const errors = [];
const err = (t, msg) => errors.push(`${t.slug || '?'}: ${msg}`);

if (TOOLS.length !== 100) errors.push(`expected 100 tools, found ${TOOLS.length}`);

const slugs = new Set(), ids = new Set(), titles = new Set();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Words the copy must never use about the person: the tools notice patterns,
// they do not diagnose, screen, or treat. "Diagnosis" is allowed only inside
// the standing "not a diagnosis" disclaimers, which live in discover.js.
const BANNED = [/\bdiagnos/i, /\bdisorder\b/i, /\bsymptom/i, /\btreatment\b/i,
  /\byou (may |might |probably |likely )?(have|are suffering from|meet the criteria for) (a |an |the )?(condition|disorder|illness|problem)/i,
  /\byou are (depressed|bipolar|traumatized|addicted|mentally ill)\b/i,
  /\bclinical(ly)?\b/i, /\bscreen(ing)? for\b/i, /\bcure\b/i, /\bpatient\b/i];
// A tool may say what it is not. Those phrases are removed before the check.
const ALLOWED = [/\bnot a diagnosis\b/gi, /\bnot a treatment\b/gi];
const UK = [/\bcolour/i, /\bbehaviour/i, /\bfavourite/i, /\bcounselling/i, /\bpersonalis/i, /\bjudgement/i,
  /\bcentre\b/i, /\bcancelled\b/i, /\bgrey\b/i, /\blabelled/i, /\bprogramme/i, /\bpractis/i,
  /\brealis(e|ed|es|ing)\b/i, /\brecognis(e|ed|es|ing)\b/i, /\bapologis(e|ed|es|ing)\b/i, /\borganis(e|ed|es|ing)\b/i];

const REQUIRED = {
  reflect: ['items', 'bands'], sliders: ['dims'], sort: ['buckets', 'items'], pick: ['cards', 'max'],
  prompts: ['steps'], check: ['items', 'bands'], breathe: ['phases', 'cycles'], guide: ['steps'],
  track: ['measures'], wheel: ['core', 'bodies', 'needs'], build: ['groups'], flip: ['cards'],
  matrix: ['x', 'y', 'quads'], rank: ['items'], allocate: ['cats'], heat: [],
};

function walkText(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => walkText(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => walkText(x, out));
  return out;
}

for (const t of TOOLS) {
  for (const k of ['slug', 'id', 'title', 'description', 'topic', 'kind', 'minutes', 'tags', 'ask'])
    if (t[k] == null || t[k] === '') err(t, `missing ${k}`);
  if (slugs.has(t.slug)) err(t, 'duplicate slug'); slugs.add(t.slug);
  if (ids.has(t.id)) err(t, 'duplicate id'); ids.add(t.id);
  if (titles.has(t.title)) err(t, 'duplicate title'); titles.add(t.title);
  if (!UUID.test(t.id || '')) err(t, `id is not a v5 UUID: ${t.id}`);
  if (!/^[a-z0-9-]+$/.test(t.slug || '')) err(t, 'slug must be lowercase, digits and dashes');
  if (!TOPICS.includes(t.topic)) err(t, `unknown topic ${t.topic}`);
  if (!KIND_LABEL[t.kind]) err(t, `unknown kind ${t.kind}`);
  for (const k of REQUIRED[t.kind] || []) if (t[k] == null) err(t, `kind ${t.kind} needs ${k}`);
  if (!(t.minutes >= 1 && t.minutes <= 20)) err(t, 'minutes should be 1–20');
  if (!Array.isArray(t.tags) || !t.tags.length) err(t, 'tags must be a non-empty array');

  if (t.kind === 'reflect' || t.kind === 'check') {
    const last = t.bands[t.bands.length - 1];
    if (last.upTo !== 100) err(t, 'last band must reach 100');
    t.bands.forEach(b => { if (!b.label || !b.text) err(t, 'band needs label and text'); });
  }
  if (t.kind === 'pick' && t.max > t.cards.length) err(t, 'max exceeds number of cards');
  if (t.kind === 'matrix' && t.quads.length !== 4) err(t, 'matrix needs exactly four quadrants');
  if (t.kind === 'sort') {
    const keys = new Set(t.buckets.map(b => b.key));
    if (keys.size !== t.buckets.length) err(t, 'bucket keys must be unique');
    for (const k of Object.keys(t.reflect || {})) if (!keys.has(k)) err(t, `reflect key ${k} is not a bucket`);
  }
  if (t.kind === 'breathe' && t.phases.some(p => !p.secs || !p.label)) err(t, 'each phase needs label and secs');

  let text = walkText(t).join('\n');
  for (const re of ALLOWED) text = text.replace(re, '');
  for (const re of BANNED) { const m = text.match(re); if (m) err(t, `avoid the word "${m[0]}"`); }
  for (const re of UK) { const m = text.match(re); if (m) err(t, `US spelling: "${m[0]}"`); }

  // The engine must handle every tool in its empty state and in a finished state.
  try {
    const p0 = progressOf(t, {});
    if (!(p0.total >= 1)) err(t, 'total must be at least 1 when empty');
    ready(t, {});
    const html = summaryOf(t, {});
    if (typeof html !== 'string' || !html.includes('<h2>')) err(t, 'summary should render a heading even when empty');
  } catch (e) { err(t, `engine threw: ${e.message}`); }
}

const perTopic = {};
for (const t of TOOLS) perTopic[t.topic] = (perTopic[t.topic] || 0) + 1;
for (const topic of TOPICS) if (!perTopic[topic]) errors.push(`topic ${topic} has no tools`);

if (errors.length) { console.error(errors.join('\n')); console.error(`\n${errors.length} problem(s)`); process.exit(1); }
console.log(`OK: ${TOOLS.length} tools, ${Object.keys(perTopic).length} topics, ${new Set(TOOLS.map(t => t.kind)).size} interaction kinds`);
