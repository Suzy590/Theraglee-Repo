// Data checks for the articles in data/articles.json. Run from the repo root:
//   node tests/articles-fixture/check.mjs
// Fails (exit 1) if any article is malformed, any slug or title repeats, an
// article is not free, or the copy uses language the articles avoid.
import { readFileSync } from 'node:fs';

const ARTICLES = JSON.parse(readFileSync(new URL('../../data/articles.json', import.meta.url), 'utf8'));

const errors = [];
const err = (a, msg) => errors.push(`${a.slug || '?'}: ${msg}`);

// The two imported from the original Word documents predate the house style
// (one is a quiz in prose, the other quotes studies it does not cite). They
// keep their shape. Everything written since follows the rules below.
const LEGACY = new Set([
  '10-daily-habits-to-boost-your-mental-health-in-just-5-minutes',
  'spotting-cognitive-distortions',
]);

// Tags are a controlled vocabulary so the library's filters stay tidy. The
// same list the worksheets use, so a tag means one thing across the site.
export const TAGS = new Set([
  'Anger', 'Anxiety', 'Assertiveness', 'Body', 'Boundaries', 'Burnout', 'Caregiving', 'CBT',
  'Communication', 'DBT', 'Decision Making', 'Depression', 'Emotion Regulation', 'Family', 'Food',
  'Goals', 'Grief', 'Grounding', 'Habits', 'Life Transitions', 'Loneliness', 'Loss', 'Mindfulness',
  'Money', 'Motivation', 'Movement', 'Panic', 'Parenting', 'Perfectionism', 'Relationships',
  'Resilience', 'Self-Care', 'Self-Compassion', 'Self-Esteem', 'Shame', 'Sleep', 'Social Anxiety',
  'Stress', 'Thinking Traps', 'Trauma', 'Values', 'Work', 'Worry',
]);

// Articles on grief, trauma and other heavy ground carry this line.
const SAFETY = 'In the US you can call or text 988 at any time';
const NEEDS_SAFETY = ['Grief', 'Loss', 'Trauma', 'Panic', 'Depression'];

// An article talks with the reader, never about their diagnosis, never talks
// down to anyone, and never invents a study to sound authoritative.
const BANNED = [
  /\byou (may |might |probably |likely )?(have|are suffering from|meet the criteria for|are diagnosed with) (a |an |the )?(condition|disorder|illness|problem|diagnosis)/i,
  /\byour (condition|diagnosis|disorder|illness)\b/i,
  /\byou are (depressed|bipolar|traumatized|addicted|mentally ill|an? \w+ic)\b/i,
  /\bcommit(ted|s|ting)? suicide\b/i, /\bsuccessful suicide\b/i,
  /\bthe mentally ill\b/i, /\ban? (addict|schizophrenic|anorexic|bulimic|borderline)\b/i,
  /\b(crazy|insane|psycho|lunatic)\b(?!-)/i,
  /\bcalories?\b/i, /\bweight loss\b/i, /\blose weight\b/i,
];
// A new article never leans on a study it does not cite or a number it cannot
// source. (The imported habits article does; its words are not rewritten here.)
const UNSOURCED = [
  /\ba (19|20)\d\d (study|survey|paper|review) (found|showed|shows|reported)/i,
  /\b\d+(\.\d+)?% (of|fewer|more|less|reduction|increase)/i,
  /\bstudies (show|prove|have shown|have found)\b/i, /\bresearch (shows|proves)\b/i,
  /\bscience-backed\b/i, /\bclinically proven\b/i,
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

const slugs = new Set(), titles = new Set();
const KEYS = ['slug', 'title', 'tags', 'min_level', 'published_at', 'excerpt', 'body_md'];
for (const a of ARTICLES) {
  const legacy = LEGACY.has(a.slug);
  const got = Object.keys(a);
  if (got.length !== KEYS.length || KEYS.some(k => !(k in a))) err(a, `keys must be exactly ${KEYS.join(', ')}`);
  if (!/^[a-z0-9-]+$/.test(a.slug || '')) err(a, 'slug must be lowercase, digits and dashes');
  if (slugs.has(a.slug)) err(a, 'duplicate slug'); slugs.add(a.slug);
  const t = String(a.title || '').trim().toLowerCase();
  if (titles.has(t)) err(a, 'duplicate title'); titles.add(t);
  if (!a.title || a.title.length > 110) err(a, 'title missing or too long');
  // Every article is free to everyone, signed in or not.
  if (a.min_level !== 0) err(a, `min_level must be 0, got ${a.min_level}`);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?\+00:00$/.test(a.published_at || ''))
    err(a, 'published_at must be an ISO timestamp in UTC (…+00:00)');
  if (!Array.isArray(a.tags)) err(a, 'tags must be an array');
  else for (const tag of a.tags) if (!TAGS.has(tag)) err(a, `unknown tag "${tag}"`);

  const body = String(a.body_md || '');
  if (!legacy) {
    if (a.title.length > 70) err(a, `title is ${a.title.length} characters; keep it under 70`);
    if (/[.!]$/.test(a.title)) err(a, 'title should not end with a period');
    if (!a.tags.length || a.tags.length > 3) err(a, 'needs 1 to 3 tags');
    const x = words(a.excerpt); if (x < 15 || x > 45) err(a, `excerpt is ${x} words; write 15 to 45`);
    if (body.startsWith(String(a.excerpt || '').slice(0, 40))) err(a, 'excerpt must be a written summary, not the opening lines');
    const n = words(body); if (n < 600 || n > 1300) err(a, `body is ${n} words; write 600 to 1300`);
    if (/^#|\n- |\*\*|<[a-z]/m.test(body)) err(a, 'body is plain text: blank lines between paragraphs, headings as short lines, no markup');
    // Headings are short lines with no closing punctuation, so the page and the
    // print build both recognize them. The article needs a few, and every
    // block must be one paragraph.
    const blocks = body.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const heads = blocks.filter(b => b.length < 90 && !/[.?!]$/.test(b));
    if (heads.length < 3) err(a, `only ${heads.length} headings; break the article into sections`);
    if (blocks.some(b => b.includes('\n'))) err(a, 'a paragraph holds a single line break; use a blank line between paragraphs');
    if (a.tags.some(x => NEEDS_SAFETY.includes(x)) && !body.includes(SAFETY))
      err(a, 'heavy topic: the closing paragraph must carry the 988 safety line');
    if (!/therapist|doctor|counselor|professional/i.test(blocks[blocks.length - 1] || ''))
      err(a, 'the closing paragraph should point to a professional when things are heavier than an article can help with');
  }

  const text = [a.title, a.excerpt, body].join('\n');
  for (const re of BANNED) { const m = text.match(re); if (m) err(a, `avoid the phrase "${m[0]}"`); }
  if (!legacy) for (const re of UNSOURCED) { const m = text.match(re); if (m) err(a, `unsourced claim: "${m[0]}"`); }
  for (const re of UK) { const m = text.match(re); if (m) err(a, `US spelling: "${m[0]}"`); }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const nw = ARTICLES.reduce((n, a) => n + words(a.body_md), 0);
const tags = new Set(ARTICLES.flatMap(a => a.tags));
console.log(`ok: ${ARTICLES.length} articles, ${nw} words, ${tags.size} tags`);
