// Checks for the mandala drawings. Run from the repo root:
//   node tests/mandala-fixture/check.mjs
// Fails (exit 1) if a round mandala draws differently than it did before the
// shaped ones arrived, if a shaped mandala in the migrations draws differently
// than when it shipped (either would move the region indexes a saved coloring
// points at), or if a shaped row names an outline that does not exist.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mandala } from '../../site/assets/mandala.js';
import { SHAPES, flatten, inside } from '../../site/assets/mandala-shapes.js';

const errors = [];
const sha = (parts) => { const h = createHash('sha256'); for (const p of parts) h.update(p); return h.digest('hex'); };

// 1. Round mandalas: every seed from 1 to 6000, which covers all 200 rows.
const ROUND = '680642e3863071928c15438796e6d5a82f0e8ea17e86ed0ffa3d0f4551b06c46';
const round = [];
for (let s = 1; s <= 6000; s++) round.push(mandala(s, { title: 'T' + s }));
if (sha(round) !== ROUND) errors.push('round mandalas draw differently: mandala() drawing order is a data contract');

// 2. Every outline is well formed.
for (const [key, s] of Object.entries(SHAPES)) {
  if (!/^[a-z][a-z-]*$/.test(key)) errors.push(`${key}: key must be lowercase letters and hyphens`);
  if (!['animal', 'plant', 'symbol'].includes(s.kind)) errors.push(`${key}: kind must be animal, plant or symbol`);
  const pattern = s.parts.filter(p => p.layer === 'pattern');
  if (!pattern.length) errors.push(`${key}: needs a pattern part`);
  if (s.parts.some(p => !['back', 'pattern', 'front'].includes(p.layer))) errors.push(`${key}: unknown layer`);
  if (!inside(pattern.flatMap(p => flatten(p.d)), ...s.heart)) errors.push(`${key}: heart is outside the pattern`);
}

// 3. Shaped rows in the migrations: real outlines, and drawings frozen as shipped.
const dir = new URL('../../supabase/migrations/', import.meta.url);
const rows = [];
for (const f of readdirSync(dir).sort())
  for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/\('([a-z0-9-]+)', '[^']+', (\d+), '([a-z-]+)'\)/g))
    rows.push({ slug: m[1], seed: +m[2], shape: m[3] });
const seen = new Set();
for (const r of rows) {
  if (seen.has(r.slug)) errors.push(`${r.slug}: slug used twice`);
  seen.add(r.slug);
  if (!SHAPES[r.shape]) { errors.push(`${r.slug}: no outline named "${r.shape}"`); continue; }
  const svg = mandala(r.seed, { shape: r.shape });
  const idx = [...svg.matchAll(/data-i="(\d+)"/g)].map(m => +m[1]);
  if (idx.some((v, j) => v !== j)) errors.push(`${r.slug}: region indexes are not 0..n in order`);
  if (idx.length < 40 || idx.length > 160) errors.push(`${r.slug}: ${idx.length} shapes to color (40 to 160 expected)`);
}
// Each batch of shaped rows, in migration order, frozen as it shipped.
const BATCHES = [
  [42, '436210ba21fb744856bf9ca7e9265535fcb235aabad796e67acd5988e6eecd76'],   // 20260924180000_shaped_mandalas
  [12, 'de7aa538c95def523563f7d7318806f7370b48576753ac31d8f14e8f01ffba3d'],   // 20260924190000_more_animal_mandalas
];
let from = 0;
for (const [n, want] of BATCHES) {
  const got = sha(rows.slice(from, from + n).map(r => SHAPES[r.shape] ? mandala(r.seed, { shape: r.shape }) : ''));
  if (got !== want) errors.push(`shaped mandalas ${from + 1} to ${from + n} draw differently (${got}): add a new outline instead of reshaping one that shipped`);
  from += n;
}
if (rows.length !== from) errors.push(`${rows.length - from} shaped mandalas are not in BATCHES yet: add their batch and hash`);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`ok: 6000 round seeds unchanged, ${Object.keys(SHAPES).length} outlines, ${rows.length} shaped mandalas`);
