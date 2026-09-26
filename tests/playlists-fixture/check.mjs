// Data checks for the dashboard playlists. Run from the repo root:
//   node tests/playlists-fixture/check.mjs
// Fails (exit 1) if a genre or mood is missing a list, a list is not exactly
// forty songs, a song is repeated within a genre (a cover counts), an entry
// is missing its title or artist, or the copy uses UK spelling.
import { GENRES, MOODS, PLAYLISTS } from '../../site/assets/playlists.js';

export const SONGS_PER_LIST = 40;
const errors = [];

const UK = [/\bcolour/i, /\bbehaviour/i, /\bfavourite/i, /\bcounselling/i, /\bpersonalis/i, /\bjudgement/i,
  /\bcentre\b/i, /\bcancelled\b/i, /\bgrey\b/i, /\blabelled/i, /\bprogramme\b/i, /\bpractis/i, /\blicence\b/i];

const keys = (rows, what) => {
  const seen = new Set();
  for (const r of rows) {
    for (const k of ['key', 'name', 'blurb']) if (!r[k]) errors.push(`${what} ${r.key || '?'}: missing ${k}`);
    if (seen.has(r.key)) errors.push(`${what}: duplicate key ${r.key}`);
    seen.add(r.key);
  }
};
keys(GENRES, 'genre'); keys(MOODS, 'mood');
if (GENRES.length < 2) errors.push('fewer than two genres');
if (MOODS.length < 2) errors.push('fewer than two moods');

const norm = (s) => String(s).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

for (const g of GENRES) {
  const lists = PLAYLISTS[g.key];
  if (!lists) { errors.push(`${g.key}: no playlists`); continue; }
  const inGenre = new Map();    // title → first mood it appeared in
  for (const m of MOODS) {
    const l = lists[m.key], tag = `${g.key}/${m.key}`;
    if (!l) { errors.push(`${tag}: missing`); continue; }
    if (!l.title) errors.push(`${tag}: missing title`);
    if (!l.blurb) errors.push(`${tag}: missing blurb`);
    if (!Array.isArray(l.songs) || l.songs.length !== SONGS_PER_LIST)
      errors.push(`${tag}: ${l.songs?.length ?? 0} songs, want ${SONGS_PER_LIST}`);
    for (const s of l.songs || []) {
      if (!Array.isArray(s) || s.length !== 2 || !s[0]?.trim() || !s[1]?.trim()) {
        errors.push(`${tag}: bad entry ${JSON.stringify(s)}`); continue;
      }
      const k = norm(s[0]);
      if (inGenre.has(k)) errors.push(`${tag}: "${s[0]}" already in ${g.key}/${inGenre.get(k)}`);
      else inGenre.set(k, m.key);
    }
  }
  for (const k of Object.keys(lists)) if (!MOODS.some(m => m.key === k)) errors.push(`${g.key}: unknown mood ${k}`);
}
for (const k of Object.keys(PLAYLISTS)) if (!GENRES.some(g => g.key === k)) errors.push(`unknown genre ${k}`);

const text = JSON.stringify([GENRES, MOODS, Object.values(PLAYLISTS).flatMap(g => Object.values(g).map(l => [l.title, l.blurb]))]);
for (const re of UK) if (re.test(text)) errors.push(`UK spelling: ${re}`);

const n = Object.values(PLAYLISTS).reduce((t, g) => t + Object.values(g).reduce((u, l) => u + (l.songs?.length || 0), 0), 0);
if (errors.length) { console.error(errors.join('\n')); console.error(`\n${errors.length} problem(s)`); process.exit(1); }
console.log(`ok: ${GENRES.length} genres × ${MOODS.length} moods, ${n} songs`);
