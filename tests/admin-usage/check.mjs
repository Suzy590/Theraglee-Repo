// Checks for the admin Content tab's "What members are using" panel. Run from
// the repo root:
//   node tests/admin-usage/check.mjs
// Fails (exit 1) if a feature on the showcase strip (site/assets/showcase.js)
// has no card on the panel, a card's key is not counted by
// admin_feature_usage() in the newest migration that defines it, a key repeats, a card is missing
// its words, or the copy uses UK spelling.
import { readFileSync, readdirSync } from 'node:fs';
import { FEATURES, WINDOWS } from '../../site/assets/admin-usage.js';

const errors = [];
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

// The showcase strip's feature names, read from the file rather than imported:
// showcase.js imports app.js, which wants a browser.
const showcase = [...read('site/assets/showcase.js').matchAll(/^\s*\['([^']+)',$/gm)].map(m => m[1]);
if (showcase.length < 10) errors.push(`showcase: only ${showcase.length} feature names found`);

// The newest migration that defines admin_feature_usage() is the one that counts.
const migrationFile = readdirSync(new URL('../../supabase/migrations/', import.meta.url))
  .filter(f => /_admin_feature_usage/.test(f)).sort().at(-1);
const migration = read('supabase/migrations/' + migrationFile);
const counted = new Set([...migration.matchAll(/select '([a-z]+)'(?: as f)?,/g)].map(m => m[1]));

const seen = new Set();
const covered = new Set();
for (const row of FEATURES) {
  const [key, name, what, also, cards] = row;
  if (!key || !name || !what) errors.push(`${key || '?'}: missing key, name or what-a-use-is`);
  if (also !== null && !also) errors.push(`${key}: the second count needs words or null`);
  if (!Array.isArray(cards)) errors.push(`${key}: showcase cards must be a list`);
  if (seen.has(key)) errors.push(`duplicate key ${key}`);
  seen.add(key);
  if (!counted.has(key)) errors.push(`${key}: admin_feature_usage() does not count it`);
  for (const c of cards || []) {
    if (!showcase.includes(c)) errors.push(`${key}: "${c}" is not a showcase feature`);
    covered.add(c);
  }
}
for (const k of counted) if (!seen.has(k)) errors.push(`migration counts "${k}" but the panel has no card for it`);
for (const c of showcase) if (!covered.has(c)) errors.push(`showcase feature "${c}" has no card on the usage panel`);

if (!WINDOWS.length || WINDOWS.some(([d, l]) => !(d >= 7 && d <= 365) || !l))
  errors.push('WINDOWS must be labeled windows of 7 to 365 days, as the function allows');

const UK = [/\bcolour/i, /\bbehaviour/i, /\bfavourite/i, /\bcounselling/i, /\bpersonalis/i, /\bjudgement/i,
  /\bcentre\b/i, /\bcancelled\b/i, /\bgrey\b/i, /\blabelled\b/i, /\bprogramme\b/i, /\bpractis/i, /\blicence\b/i];
for (const [file, text] of [['admin-usage.js', read('site/assets/admin-usage.js')], ['migration', migration]])
  for (const re of UK) if (re.test(text)) errors.push(`${file}: UK spelling ${re}`);

if (errors.length) {
  console.error(errors.map(e => ' - ' + e).join('\n'));
  process.exit(1);
}
console.log(`ok: ${FEATURES.length} features on the usage panel cover all ${showcase.length} showcase cards`);
