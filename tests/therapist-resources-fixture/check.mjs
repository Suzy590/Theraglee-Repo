// Data checks for the clinician library in data/therapist-resources.json (the
// therapist_resources table). Run from the repo root:
//   node tests/therapist-resources-fixture/check.mjs
// Fails (exit 1) if a resource is malformed, a slug or title repeats, a kind
// is unknown, the client prompts are out of sequence, the copy uses language
// the library avoids, or a day's batch is short of its five per kind and
// five per topic.
import { readFileSync } from 'node:fs';

const ROWS = JSON.parse(readFileSync(new URL('../../data/therapist-resources.json', import.meta.url), 'utf8'));

const errors = [];
const err = (r, msg) => errors.push(`${r.slug || '?'}: ${msg}`);

// The kinds are the values of the resource_kind enum in the database, and the
// chips on the therapist dashboard's Library tab. Five new resources of every
// kind arrive each day (docs/therapist-resources.md). When a new kind is added
// to the enum, add it here and to KINDS in site/therapist-dashboard.html.
export const KINDS = ['worksheet', 'cbt', 'act', 'dbt', 'couples', 'kids', 'game'];

// Who a resource is for. The dashboard prints these as written.
export const AUDIENCES = new Set(['Adults', 'Teens', 'Children', 'Couples', 'Groups']);

// The topics the daily routine covers, five resources each per day since
// 2026-09-16 (docs/therapist-resources.md). A topic resource carries the topic
// as one of its tags, spelled exactly like this, so the library's search finds
// every tool on a topic with one word. Add a topic here to add it to the day.
export const TOPICS = [
  'PTSD and trauma', 'anxiety', 'depression', 'ADHD', 'addiction', 'anger management', 'OCD',
  'panic attacks', 'parenting', 'perinatal and postpartum', 'self-esteem', 'social anxiety',
  'grief and loss', 'relationship issues', 'sexual abuse', 'coping skills', 'phobias', 'body image',
];
const KIND_QUOTA_FROM = '2026-09-13';   // five of every kind, every day since
const TOPIC_QUOTA_FROM = '2026-09-16';  // five of every topic, every day since

// A resource speaks to the clinician about their client. It never labels a
// person by a diagnosis and never invents a study to sound authoritative.
const BANNED = [
  /\bcommit(ted|s|ting)? suicide\b/i, /\bsuccessful suicide\b/i,
  /\bthe mentally ill\b/i, /\ban? (addict|schizophrenic|anorexic|bulimic|borderline)\b/i,
  /\b(crazy|insane|psycho|lunatic)\b(?!-)/i,
  /\bcalories?\b/i, /\bweight loss\b/i, /\blose weight\b/i,
];
// Every resource is an adjunct to the clinician's own judgment, never a
// protocol: nothing here diagnoses, screens for, or treats anything.
const NOT_A_PROTOCOL = [
  /\bdiagnos(e|es|ed|ing|is|tic|tics)\b/i, /\bscreen(s|ed|ing)? for\b/i, /\bscreening (tool|questionnaire|measure)\b/i,
  /\btreatment\b/i, /\btreats? (the |their |a |an )?(condition|symptoms|illness)\b/i, /\bcures?\b/i, /\bcured\b/i,
  /\bprotocol\b/i, /\bmanualized\b/i, /\b(meets?|meeting) (the )?criteria\b/i, /\bdisorder\b/i,
  /\bevidence-based\b/i, /\b(assess|assesses|assessment) for\b/i, /\bdos(e|age|es)\b/i, /\bprescri(be|bed|ption)\b/i,
];
const UNSOURCED = [
  /\ba (19|20)\d\d (study|survey|paper|review) (found|showed|shows|reported)/i,
  /\b\d+(\.\d+)?% (of|fewer|more|less|reduction|increase)/i,
  /\bstudies (show|prove|have shown|have found)\b/i, /\bresearch (shows|proves)\b/i,
  /\bscience-backed\b/i, /\bclinically proven\b/i,
];
// US spelling throughout (CLAUDE.md). Slugs are keys and are not checked.
const UK = [/\bcolour/i, /\bbehaviour/i, /\bfavourite/i, /\bcounselling/i, /\bpersonalis/i, /\bjudgement/i,
  /\bcentre\b/i, /\bcancelled\b/i, /\bgrey\b/i, /\blabelled/i, /\bprogramme\b/i, /\bpractis/i, /\blicence\b/i,
  /\brealis(e|ed|es|ing)\b/i, /\brecognis(e|ed|es|ing)\b/i, /\bapologis(e|ed|es|ing)\b/i, /\borganis(e|ed|es|ing)\b/i,
  /\bminimis(e|ed|es|ing)\b/i, /\bemphasis(e|ed|es|ing)\b/i, /\bnormalis(e|ed|es|ing)\b/i, /\bhospitalis/i,
  /\bprioritis/i, /\bempathis(e|ed|es|ing)\b/i, /\bcatastrophis(e|ed|es|ing)\b/i, /\bexternalis/i, /\binternalis/i,
  /\bgeneralis/i, /\bvisualis/i, /\bverbalis/i, /\bsummaris/i, /\bstabilis/i, /\bcharacteris/i, /\bconceptualis/i,
  /\banalys(e|ed|es|ing)\b/i, /\bmum\b/i, /\bwhilst\b/i, /\bamongst\b/i, /\btowards\b/i,
  /\blearnt\b/i, /\bspelt\b/i, /\bdreamt\b/i, /\bfortnight/i, /\bmaths\b/i,
  /\bmobile phone/i, /\btelly\b/i, /\bfavour/i,
  /\bhonour/i, /\bhumour/i, /\bneighbour/i, /\brumour/i, /\btraveller/i, /\bcounsellor/i, /\bjewellery/i,
  /\bpaediatric/i, /\boestrogen/i, /\bdefence\b/i, /\boffence\b/i, /\benrol\b/i,
  /\bskilful/i, /\bfulfil\b/i, /\bfulfilment/i, /\bsceptic/i, /\bpyjamas/i, /\btyre\b/i, /\bkerb\b/i,
  /\bmodelling\b/i, /\bmodelled\b/i, /\bsignalling\b/i, /\btravelling\b/i, /\bcounselled\b/i];

const slugs = new Set(), titles = new Set();
const KEYS = ['slug', 'title', 'kind', 'summary', 'goal', 'audience', 'duration', 'body_md', 'fields', 'tags', 'created_at'];
for (const r of ROWS) {
  const got = Object.keys(r);
  if (got.length !== KEYS.length || KEYS.some((k, i) => got[i] !== k)) err(r, `keys must be exactly ${KEYS.join(', ')}, in that order`);
  if (!/^[a-z0-9-]+$/.test(r.slug || '')) err(r, 'slug must be lowercase, digits and dashes');
  if (slugs.has(r.slug)) err(r, 'duplicate slug'); slugs.add(r.slug);
  const t = String(r.title || '').trim().toLowerCase();
  if (titles.has(t)) err(r, 'duplicate title'); titles.add(t);
  if (!r.title || r.title.length > 60) err(r, 'title missing or longer than 60 characters');
  if (/[.!]$/.test(r.title || '')) err(r, 'title should not end with a period');
  if (!KINDS.includes(r.kind)) err(r, `unknown kind "${r.kind}" (one of ${KINDS.join(', ')})`);

  const summary = String(r.summary || '').trim();
  if (summary.length < 30 || summary.length > 140) err(r, `summary is ${summary.length} characters; write one sentence of 30 to 140`);
  if (!/[.?!]$/.test(summary)) err(r, 'summary should end with a period');
  const goal = String(r.goal || '').trim();
  if (goal.length < 20 || goal.length > 140) err(r, `goal is ${goal.length} characters; write one line of 20 to 140`);
  if (!/[.?!]$/.test(goal)) err(r, 'goal should end with a period');

  if (!Array.isArray(r.audience) || !r.audience.length) err(r, 'audience must list at least one group');
  else for (const a of r.audience) if (!AUDIENCES.has(a)) err(r, `unknown audience "${a}" (one of ${[...AUDIENCES].join(', ')})`);
  if (!String(r.duration || '').trim()) err(r, 'duration is missing');

  const body = String(r.body_md || '');
  if (body.length < 100 || body.length > 600) err(r, `clinician notes are ${body.length} characters; write 100 to 600`);
  if (/^#|\n- |\*\*|<[a-z]|\n/m.test(body)) err(r, 'clinician notes are one plain paragraph: no markup, no line breaks');

  if (!Array.isArray(r.fields) || r.fields.length < 3 || r.fields.length > 10) err(r, 'needs 3 to 10 client prompts in fields');
  else r.fields.forEach((f, i) => {
    if (f.id !== `f${i}`) err(r, `field ${i} id should be f${i}, got ${f.id}`);
    if (f.type !== 'textarea') err(r, `field ${f.id} type should be textarea`);
    if (!String(f.label || '').trim() || String(f.label).length > 120) err(r, `field ${f.id} label missing or over 120 characters`);
    if (Object.keys(f).some(k => !['id', 'type', 'label'].includes(k))) err(r, `field ${f.id} has keys other than id, type, label`);
  });

  if (!Array.isArray(r.tags) || r.tags.length < 2 || r.tags.length > 4) err(r, 'needs 2 to 4 tags');
  else {
    if (new Set(r.tags).size !== r.tags.length) err(r, 'a tag repeats');
    for (const tag of r.tags) if (!/^[A-Za-z0-9][A-Za-z0-9 \-']*$/.test(tag) || tag.length > 30) err(r, `tag "${tag}" is not a short plain phrase`);
  }
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?\+00:00$/.test(r.created_at || ''))
    err(r, 'created_at must be an ISO timestamp in UTC (…+00:00)');

  const text = [r.title, summary, goal, r.duration, body, ...(r.fields || []).map(f => f.label), ...(r.tags || [])].join('\n');
  for (const re of BANNED) { const m = text.match(re); if (m) err(r, `avoid the phrase "${m[0]}"`); }
  for (const re of NOT_A_PROTOCOL) { const m = text.match(re); if (m) err(r, `an adjunct, not a protocol: avoid "${m[0]}"`); }
  for (const re of UNSOURCED) { const m = text.match(re); if (m) err(r, `unsourced claim: "${m[0]}"`); }
  for (const re of UK) { const m = text.match(re); if (m) err(r, `US spelling: "${m[0]}"`); }
}

// Each day's batch is five of every kind (since 2026-09-13) plus five of every
// topic (since 2026-09-16). A day that is present but short is a mistake in
// that day's run, so the check refuses it.
const days = [...new Set(ROWS.map(r => String(r.created_at).slice(0, 10)))].sort();
for (const day of days) {
  const batch = ROWS.filter(r => String(r.created_at).startsWith(day));
  if (day >= KIND_QUOTA_FROM) for (const k of KINDS) {
    const n = batch.filter(r => r.kind === k).length;
    if (n < 5) errors.push(`${day}: only ${n} ${k} resource${n === 1 ? '' : 's'}; every day adds five of every kind`);
  }
  if (day >= TOPIC_QUOTA_FROM) for (const t of TOPICS) {
    const n = batch.filter(r => (r.tags || []).includes(t)).length;
    if (n < 5) errors.push(`${day}: only ${n} tagged "${t}"; every day adds five on every topic`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const byKind = KINDS.map(k => `${k} ${ROWS.filter(r => r.kind === k).length}`).join(', ');
const onTopic = ROWS.filter(r => (r.tags || []).some(t => TOPICS.includes(t))).length;
console.log(`ok: ${ROWS.length} resources (${byKind}); ${onTopic} on the ${TOPICS.length} daily topics`);
