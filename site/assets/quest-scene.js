/* ==========================================================================
   Theraglee — the trail map on the Premium Goals & tracking page.
   --------------------------------------------------------------------------
   One picture does the whole job. A path winds from The Trailhead, bottom
   left, up to The Far Hills, top right, through every chapter of the quest:
   each chapter is a place drawn on the land (a signpost, a clearing, a stream
   with stepping stones, a grove, a lookout, a meadow, the hills). The member
   is a small hiker on the path. Each day they show up moves the hiker a step
   toward the next place; when they reach it, it opens and comes into full
   color. Places ahead sit in fog with a lock.

   The scene the member picked decorates the same trail: a flower (garden) or
   a lantern (lights) is planted beside the path for every day shown up, at
   the spot the hiker had reached that day; scenery fills the sky, trees and
   hills in as each place opens. Nothing ever shrinks, dims or wilts.

   Plain SVG strings, no imports, so tests/quest-paths/check.mjs can run it
   under plain Node. docs/quest-map.md is the guide.
   ========================================================================== */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (n) => Math.round(n * 10) / 10;

/** The canvas and where each chapter sits on it, Trailhead first. */
export const TRAIL = {
  W: 800, H: 520,
  points: [
    { x: 92,  y: 452 },   // The Trailhead
    { x: 252, y: 398 },   // The First Clearing
    { x: 418, y: 432 },   // The Stream Crossing
    { x: 566, y: 352 },   // The Quiet Grove
    { x: 446, y: 276 },   // The Lookout
    { x: 594, y: 222 },   // The Open Meadow
    { x: 716, y: 150 },   // The Far Hills
  ],
};

/* Daylight for the garden and the scenery; dusk for the lanterns, so they glow. */
const DAY = {
  skyTop: '#D3E9F6', skyBottom: '#F4F8EC', far: '#D9E7CB', mid: '#BFDA9A', ground: '#E3F0C6', ground2: '#D3E8AC',
  path: '#EBE1C8', pathEdge: '#D6C9A4', walked: '#6AB21E', ahead: '#B9B19A',
  tree: ['#3A9A48', '#187C1A', '#0E5A10'], trunk: '#7A5A3A', water: '#8FCBE3', waterLight: '#C7E7F3',
  stone: '#CFCBBE', sun: '#F6C453', label: '#16241C', pill: '#FFFFFF', fog: '#FFFFFF',
};
const DUSK = {
  skyTop: '#22394B', skyBottom: '#F0B288', far: '#5E7E6E', mid: '#4A7152', ground: '#5F8C4B', ground2: '#527D3F',
  path: '#CBB88F', pathEdge: '#AE9A6C', walked: '#8DC61D', ahead: '#8D9B86',
  tree: ['#2C6B3A', '#1E5229', '#153E1E'], trunk: '#4A3524', water: '#6FAAC8', waterLight: '#9CCBE0',
  stone: '#B8B3A6', sun: null, label: '#16241C', pill: '#FFFFFF', fog: '#DDE6DD',
};
const PETALS = ['#F29E8E', '#F6C453', '#B9A3E3', '#F7F3EA', '#E98FB5', '#8DC61D'];

/* ------------------------------------------------------------ the path */
/* A smooth curve through the chapter points (Catmull-Rom as cubic Beziers),
   sampled so anything can be placed a given fraction of the way along a
   segment by distance walked, not by the curve's own parameter. */
const SAMPLES = 32;
function buildPath(points) {
  const P = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    const pts = [], len = [0];
    for (let k = 0; k <= SAMPLES; k++) {
      const t = k / SAMPLES, u = 1 - t;
      const x = u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x;
      const y = u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y;
      pts.push({ x, y });
      if (k) len.push(len[k - 1] + Math.hypot(x - pts[k - 1].x, y - pts[k - 1].y));
    }
    segs.push({ pts, len, total: len[SAMPLES] });
  }
  return segs;
}
const SEGS = buildPath(TRAIL.points);

/** The point (and heading) a fraction `u` of the way along segment `seg`. */
function along(seg, u) {
  const s = SEGS[Math.max(0, Math.min(SEGS.length - 1, seg))];
  const want = Math.max(0, Math.min(1, u)) * s.total;
  let k = 1;
  while (k < SAMPLES && s.len[k] < want) k++;
  const a = s.pts[k - 1], b = s.pts[k], span = s.len[k] - s.len[k - 1] || 1;
  const f = (want - s.len[k - 1]) / span;
  const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x, y, nx: -(b.y - a.y) / d, ny: (b.x - a.x) / d };   // nx,ny: a unit normal
}

/** Where the hiker stands after `days` shown up: on segment `open`, part way to the next place. */
export function hikerAt(days, chapters) {
  let open = 0;
  chapters.forEach((c, i) => { if (days >= c.at) open = i; });
  const next = chapters[open + 1];
  if (!next) return { seg: SEGS.length - 1, u: 1, open };
  return { seg: open, u: (days - chapters[open].at) / (next.at - chapters[open].at), open };
}

/**
 * Where day number `k` (1-based) is planted beside the path: the spot the
 * hiker had reached that day. Days past the last place are scattered evenly
 * back along the whole trail, so it keeps filling in for as long as the
 * member likes.
 */
export function dayAt(k, chapters) {
  const last = chapters[chapters.length - 1].at;
  if (k > last) {
    const g = ((k - last) * 0.6180339887) % 1;
    return { seg: Math.min(SEGS.length - 1, Math.floor(g * SEGS.length)), u: (g * SEGS.length) % 1 };
  }
  const h = hikerAt(k, chapters);
  return { seg: h.seg, u: h.u };
}

/* Things near the bottom of the picture are nearer, so they draw a little larger. */
const persp = (y) => 0.68 + 0.32 * Math.max(0, Math.min(1, (y - 120) / 340));

/* ------------------------------------------------------- small drawings */
const tree = (x, y, k, pal, shade = 1) => `<g>
  <rect x="${r1(x - 2.2 * k)}" y="${r1(y - 14 * k)}" width="${r1(4.4 * k)}" height="${r1(15 * k)}" rx="1.5" fill="${pal.trunk}"/>
  <circle cx="${r1(x)}" cy="${r1(y - 20 * k)}" r="${r1(11 * k)}" fill="${pal.tree[shade]}"/>
  <circle cx="${r1(x - 7 * k)}" cy="${r1(y - 14 * k)}" r="${r1(8 * k)}" fill="${pal.tree[shade]}"/>
  <circle cx="${r1(x + 7 * k)}" cy="${r1(y - 15 * k)}" r="${r1(8.5 * k)}" fill="${pal.tree[Math.min(2, shade + 1)]}"/>
  <circle cx="${r1(x - 3 * k)}" cy="${r1(y - 24 * k)}" r="${r1(5 * k)}" fill="${pal.tree[Math.max(0, shade - 1)]}" opacity=".9"/></g>`;

const bush = (x, y, k, pal) => `<g>
  <ellipse cx="${r1(x)}" cy="${r1(y - 4 * k)}" rx="${r1(9 * k)}" ry="${r1(6 * k)}" fill="${pal.tree[1]}"/>
  <ellipse cx="${r1(x + 7 * k)}" cy="${r1(y - 3 * k)}" rx="${r1(7 * k)}" ry="${r1(5 * k)}" fill="${pal.tree[0]}"/></g>`;

const flower = (x, y, k, color, i) => {
  const petals = [0, 72, 144, 216, 288].map(a =>
    `<ellipse cx="${r1(x)}" cy="${r1(y - 12 * k - 3.2 * k)}" rx="${r1(2.3 * k)}" ry="${r1(4 * k)}" fill="${color}" transform="rotate(${a + i * 7} ${r1(x)} ${r1(y - 12 * k)})"/>`).join('');
  return `<g><path d="M${r1(x)},${r1(y)} q${i % 2 ? 2 : -2},-${r1(6 * k)} 0,-${r1(12 * k)}" stroke="#6AB21E" stroke-width="${r1(1.6 * k)}" fill="none"/>
    <ellipse cx="${r1(x - 3 * k)}" cy="${r1(y - 6 * k)}" rx="${r1(3 * k)}" ry="${r1(1.5 * k)}" fill="#8DC61D" transform="rotate(-30 ${r1(x - 3 * k)} ${r1(y - 6 * k)})"/>
    ${petals}<circle cx="${r1(x)}" cy="${r1(y - 12 * k)}" r="${r1(1.8 * k)}" fill="#F6C453"/></g>`;
};

const lantern = (x, y, k) => `<g>
  <circle cx="${r1(x)}" cy="${r1(y - 15 * k)}" r="${r1(13 * k)}" fill="#F6C453" opacity=".22"/>
  <line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(y - 10 * k)}" stroke="#4A3524" stroke-width="${r1(1.8 * k)}"/>
  <rect x="${r1(x - 3.6 * k)}" y="${r1(y - 20 * k)}" width="${r1(7.2 * k)}" height="${r1(10 * k)}" rx="${r1(1.6 * k)}" fill="#FFD36B" stroke="#B2541E" stroke-width="${r1(0.9 * k)}"/>
  <circle cx="${r1(x)}" cy="${r1(y - 15 * k)}" r="${r1(2 * k)}" fill="#FFF4D0"/></g>`;

const bird = (x, y) => `<path d="M${x},${y} q5,-5 10,0 q5,-5 10,0" fill="none" stroke="#3B4F45" stroke-width="1.6" stroke-linecap="round"/>`;

/* The hiker: a small figure with a lime backpack, and a "You are here" sign. */
const hiker = (x, y, k) => `<g aria-hidden="true">
  <ellipse cx="${r1(x)}" cy="${r1(y + 2)}" rx="${r1(9 * k)}" ry="${r1(3 * k)}" fill="#16241C" opacity=".18"/>
  <rect x="${r1(x - 7.5 * k)}" y="${r1(y - 22 * k)}" width="${r1(6 * k)}" height="${r1(11 * k)}" rx="${r1(2 * k)}" fill="#8DC61D"/>
  <path d="M${r1(x - 4 * k)},${r1(y - 24 * k)} h${r1(8 * k)} q${r1(4 * k)},0 ${r1(4 * k)},${r1(4 * k)} v${r1(12 * k)} h-${r1(16 * k)} v-${r1(12 * k)} q0,-${r1(4 * k)} ${r1(4 * k)},-${r1(4 * k)}z" fill="#16241C"/>
  <circle cx="${r1(x)}" cy="${r1(y - 29 * k)}" r="${r1(5.2 * k)}" fill="#16241C"/>
  <path d="M${r1(x - 3 * k)},${r1(y - 8 * k)} l-${r1(2 * k)},${r1(8 * k)} M${r1(x + 3 * k)},${r1(y - 8 * k)} l${r1(3 * k)},${r1(8 * k)}" stroke="#16241C" stroke-width="${r1(2.6 * k)}" stroke-linecap="round"/>
  <g class="trail-you">
    <rect x="${r1(x - 40)}" y="${r1(y - 58 * k)}" width="80" height="22" rx="11" fill="#16241C"/>
    <path d="M${r1(x - 5)},${r1(y - 36 * k)} l5,6 l5,-6z" fill="#16241C"/>
    <text x="${r1(x)}" y="${r1(y - 58 * k + 15)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="12.5" font-weight="600" fill="#fff">You are here</text>
  </g></g>`;

/* --------------------------------------------------------- the places */
/* Each place is drawn around its point. `k` is the perspective scale; `on`
   says whether it is open (full color) or still ahead (fog and a lock). */
const PLACES = [
  // The Trailhead: a wooden signpost pointing up the trail.
  (x, y, k, pal) => `${bush(x - 26 * k, y + 2, k, pal)}
    <rect x="${r1(x + 10 * k)}" y="${r1(y - 46 * k)}" width="${r1(4 * k)}" height="${r1(48 * k)}" fill="${pal.trunk}"/>
    <path d="M${r1(x + 4 * k)},${r1(y - 44 * k)} h${r1(34 * k)} l${r1(8 * k)},${r1(7 * k)} l-${r1(8 * k)},${r1(7 * k)} h-${r1(34 * k)}z" fill="#F7F3EA" stroke="${pal.trunk}" stroke-width="${r1(1.6 * k)}"/>
    <text x="${r1(x + 21 * k)}" y="${r1(y - 32 * k)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="${r1(8 * k)}" font-weight="600" fill="#7A5A3A">TRAIL</text>`,
  // The First Clearing: open grass with trees standing back from it.
  (x, y, k, pal) => `<ellipse cx="${r1(x)}" cy="${r1(y - 4 * k)}" rx="${r1(52 * k)}" ry="${r1(18 * k)}" fill="${pal.ground2}" opacity=".9"/>
    ${tree(x - 48 * k, y - 10 * k, k * 0.9, pal, 1)}${tree(x - 20 * k, y - 26 * k, k * 0.8, pal, 0)}
    ${tree(x + 34 * k, y - 24 * k, k * 0.85, pal, 1)}${tree(x + 56 * k, y - 6 * k, k, pal, 2)}`,
  // The Stream Crossing: a stream across the path, with stepping stones.
  (x, y, k, pal) => `<path d="M${r1(x - 60 * k)},${r1(y - 70 * k)} C${r1(x - 20 * k)},${r1(y - 40 * k)} ${r1(x + 10 * k)},${r1(y - 20 * k)} ${r1(x - 6 * k)},${r1(y + 6 * k)} S${r1(x + 24 * k)},${r1(y + 50 * k)} ${r1(x + 50 * k)},${r1(y + 70 * k)}" fill="none" stroke="${pal.water}" stroke-width="${r1(14 * k)}" stroke-linecap="round"/>
    <path d="M${r1(x - 54 * k)},${r1(y - 64 * k)} C${r1(x - 18 * k)},${r1(y - 38 * k)} ${r1(x + 8 * k)},${r1(y - 18 * k)} ${r1(x - 6 * k)},${r1(y + 4 * k)}" fill="none" stroke="${pal.waterLight}" stroke-width="${r1(3 * k)}" stroke-linecap="round" opacity=".8"/>
    ${[-14, 0, 14].map(d => `<ellipse cx="${r1(x + d * k)}" cy="${r1(y - 2 * k + Math.abs(d) * 0.1 * k)}" rx="${r1(7 * k)}" ry="${r1(4.5 * k)}" fill="${pal.stone}" stroke="#AFA994" stroke-width="1"/>`).join('')}
    ${bush(x + 44 * k, y - 20 * k, k * 0.8, pal)}`,
  // The Quiet Grove: a close stand of trees.
  (x, y, k, pal) => `${tree(x - 40 * k, y + 4 * k, k * 1.05, pal, 2)}${tree(x - 14 * k, y - 18 * k, k * 0.95, pal, 1)}
    ${tree(x + 18 * k, y - 22 * k, k, pal, 2)}${tree(x + 44 * k, y - 2 * k, k * 1.1, pal, 1)}${tree(x + 8 * k, y + 8 * k, k * 0.8, pal, 0)}`,
  // The Lookout: a knoll with a bench and a pennant.
  (x, y, k, pal) => `<ellipse cx="${r1(x)}" cy="${r1(y + 6 * k)}" rx="${r1(58 * k)}" ry="${r1(16 * k)}" fill="${pal.mid}"/>
    <rect x="${r1(x - 24 * k)}" y="${r1(y - 14 * k)}" width="${r1(22 * k)}" height="${r1(3 * k)}" fill="${pal.trunk}"/>
    <rect x="${r1(x - 22 * k)}" y="${r1(y - 11 * k)}" width="${r1(2.5 * k)}" height="${r1(9 * k)}" fill="${pal.trunk}"/>
    <rect x="${r1(x - 6 * k)}" y="${r1(y - 11 * k)}" width="${r1(2.5 * k)}" height="${r1(9 * k)}" fill="${pal.trunk}"/>
    <rect x="${r1(x - 24 * k)}" y="${r1(y - 20 * k)}" width="${r1(22 * k)}" height="${r1(2.5 * k)}" fill="${pal.trunk}"/>
    <line x1="${r1(x + 22 * k)}" y1="${r1(y + 2 * k)}" x2="${r1(x + 22 * k)}" y2="${r1(y - 38 * k)}" stroke="${pal.trunk}" stroke-width="${r1(2 * k)}"/>
    <path d="M${r1(x + 22 * k)},${r1(y - 38 * k)} l${r1(20 * k)},${r1(5 * k)} l-${r1(20 * k)},${r1(6 * k)}z" fill="#8DC61D"/>`,
  // The Open Meadow: a wide bright patch full of flowers.
  (x, y, k, pal) => `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(70 * k)}" ry="${r1(20 * k)}" fill="${pal.ground2}" opacity=".9"/>
    ${Array.from({ length: 11 }, (_, i) => flower(x - 58 * k + i * 11.6 * k, y - 8 * k + ((i * 7) % 16) * k, k * 0.55, PETALS[i % PETALS.length], i)).join('')}`,
  // The Far Hills: layered hills with the sun above them, higher as the scenery fills in.
  (x, y, k, pal, lift = 0) => `${pal.sun ? `<circle cx="${r1(x + 30 * k)}" cy="${r1(y - 50 * k - lift)}" r="${r1(20 * k)}" fill="${pal.sun}"/>
    <circle cx="${r1(x + 30 * k)}" cy="${r1(y - 50 * k - lift)}" r="${r1(30 * k)}" fill="${pal.sun}" opacity=".2"/>` : ''}
    <path d="M${r1(x - 90 * k)},${r1(y + 12 * k)} q${r1(40 * k)},-${r1(54 * k)} ${r1(84 * k)},-${r1(8 * k)} q${r1(36 * k)},-${r1(40 * k)} ${r1(96 * k)},${r1(8 * k)}z" fill="${pal.far}"/>
    <path d="M${r1(x - 40 * k)},${r1(y + 14 * k)} q${r1(36 * k)},-${r1(44 * k)} ${r1(80 * k)},-${r1(4 * k)} q${r1(20 * k)},-${r1(20 * k)} ${r1(50 * k)},${r1(4 * k)}z" fill="${pal.mid}"/>
    ${tree(x - 20 * k, y + 10 * k, k * 0.6, pal, 1)}${tree(x + 2 * k, y + 12 * k, k * 0.5, pal, 2)}`,
];

/* Where each place's name sits, so no label covers the path or another label. */
const LABEL_AT = [
  { dx: 0, dy: 36, anchor: 'middle' }, { dx: 0, dy: -52, anchor: 'middle' }, { dx: 34, dy: 10, anchor: 'start' },
  { dx: 72, dy: -8, anchor: 'start' }, { dx: -40, dy: -36, anchor: 'end' }, { dx: 0, dy: 44, anchor: 'middle' },
  { dx: -30, dy: -42, anchor: 'end' },
];

/* ------------------------------------------------------------ the map */
/**
 * The trail map.
 *   chapters  from buildQuest(): [{ place, at, ... }], seven of them
 *   prog      from progress(): { days, open, next }
 *   scene     'garden' | 'lights' | 'scenery' (what grows along the trail)
 *   current   the chapter on screen, highlighted (defaults to the newest open one)
 * Each place is a <g data-ch="i"> the page can click.
 */
export function trailMap(chapters, prog, { scene = 'garden', current = prog.open } = {}) {
  const { W, H, points } = TRAIL;
  const pal = scene === 'lights' ? DUSK : DAY;
  const open = Math.max(0, Math.min(chapters.length - 1, prog.open));
  const s = scene === 'scenery' ? open : 6;             // how far the landscape has filled in
  const days = Math.max(0, prog.days | 0);
  const here = hikerAt(days, chapters);
  const hp = along(here.seg, here.u);

  // Sky, hills and ground. With the scenery scene the sky warms and the sun
  // climbs as chapters open; the other scenes start with the full landscape.
  const skies = [['#E7ECEE', '#F2F3EE'], ['#E2ECF2', '#F3F6EE'], ['#DCEBF5', '#F3F7EC'], ['#D3E9F6', '#F4F8EC'],
    ['#CFE7F7', '#F6F8EB'], ['#F8E5CC', '#FBF1DF'], ['#F7D9BE', '#FBEBD6']];
  const [skyTop, skyBottom] = scene === 'scenery' ? skies[s] : [pal.skyTop, pal.skyBottom];
  const land = `
    <defs>
      <linearGradient id="tm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient>
      <linearGradient id="tm-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.ground}"/><stop offset="1" stop-color="${pal.ground2}"/></linearGradient>
      <clipPath id="tm-clip"><rect width="${W}" height="${H}" rx="18"/></clipPath>
    </defs>
    <g clip-path="url(#tm-clip)">
    <rect width="${W}" height="${H}" fill="url(#tm-sky)"/>
    ${scene === 'lights' ? `<circle cx="150" cy="78" r="18" fill="#F7F3EA"/><circle cx="150" cy="78" r="30" fill="#F7F3EA" opacity=".15"/>
      ${[60, 220, 330, 470, 560, 700, 760].map((x, i) => `<circle cx="${x}" cy="${30 + (i * 23) % 70}" r="1.6" fill="#fff" opacity=".8"/>`).join('')}` : ''}
    <path d="M0,232 C120,190 220,240 340,214 S560,150 660,196 S760,196 800,180 V${H} H0Z" fill="${pal.far}"/>
    <path d="M0,290 C90,246 200,286 300,266 S480,222 600,262 S740,258 800,238 V${H} H0Z" fill="${pal.mid}"/>
    <path d="M0,330 C100,300 220,336 340,318 S560,292 680,318 S760,320 800,312 V${H} H0Z" fill="url(#tm-ground)"/>
    ${s >= 3 ? `${bird(300, 96)}${bird(330, 84)}${bird(360, 100)}` : ''}
    ${s >= 2 ? `${tree(40, 380, 1.1, pal, 1)}${tree(760, 300, 0.8, pal, 2)}${tree(350, 300, 0.75, pal, 1)}${tree(690, 330, 0.9, pal, 0)}${bush(130, 340, 0.9, pal)}${bush(520, 470, 1.1, pal)}` : ''}
    ${s >= 5 ? Array.from({ length: 14 }, (_, i) => flower(60 + (i * 53) % 700, 492 - (i * 17) % 40, 0.6, PETALS[i % PETALS.length], i)).join('') : ''}`;

  // The path: a sandy ribbon the whole way, the walked part in lime, the part ahead dotted.
  const all = SEGS.flatMap((sg, i) => sg.pts.slice(i ? 1 : 0));
  const poly = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)},${r1(p.y)}`).join(' ');
  const walkedPts = [];
  for (let i = 0; i < here.seg; i++) walkedPts.push(...SEGS[i].pts.slice(walkedPts.length ? 1 : 0));
  const sg = SEGS[here.seg];
  const want = here.u * sg.total;
  for (let k = 0; k <= SAMPLES && sg.len[k] <= want + 1e-6; k++) if (!walkedPts.length || k) walkedPts.push(sg.pts[k]);
  walkedPts.push({ x: hp.x, y: hp.y });
  const path = `
    <path d="${poly(all)}" fill="none" stroke="${pal.pathEdge}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${poly(all)}" fill="none" stroke="${pal.path}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${poly(all)}" fill="none" stroke="${pal.ahead}" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round" opacity=".8"/>
    ${walkedPts.length > 1 ? `<path d="${poly(walkedPts)}" fill="none" stroke="${pal.walked}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` : ''}`;

  // A flower or a lantern beside the path for every day shown up.
  const planted = [];
  if (scene !== 'scenery') {
    const n = Math.min(days, 120);
    for (let k = 1; k <= n; k++) {
      const d = dayAt(k, chapters);
      const p = along(d.seg, d.u);
      const side = k % 2 ? 1 : -1, off = 13 + ((k * 7) % 9);
      const x = p.x + p.nx * side * off, y = p.y + p.ny * side * off;
      planted.push({ y, g: scene === 'lights' ? lantern(x, y, persp(y) * 0.8) : flower(x, y, persp(y) * 0.75, PETALS[k % PETALS.length], k) });
    }
  }

  // The places, nearest (lowest) drawn last so they overlap naturally.
  const order = points.map((p, i) => i).sort((a, b) => points[a].y - points[b].y);
  const places = order.map(i => {
    const p = points[i], c = chapters[i], k = persp(p.y), on = i <= open, me = i === current;
    const lab = LABEL_AT[i];
    const name = esc(c.place);
    const wide = Math.max(70, name.length * 8.2 + 22);
    const lx = p.x + lab.dx, ly = p.y + lab.dy;
    const px = lab.anchor === 'start' ? lx - 11 : lab.anchor === 'end' ? lx - wide + 11 : lx - wide / 2;
    const label = `<g class="trail-label">
      <rect x="${r1(px)}" y="${r1(ly - 15)}" width="${r1(wide)}" height="22" rx="11" fill="${pal.pill}" opacity="${on ? '.92' : '.8'}" stroke="${on ? '#C9DFA6' : '#E7E3D6'}"/>
      <text x="${r1(lx)}" y="${r1(ly)}" text-anchor="${lab.anchor}" font-family="Outfit, sans-serif" font-size="13.5" font-weight="500" fill="${on ? pal.label : '#8B978E'}">${name}</text></g>`;
    const stop = on
      ? `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${r1(13 * k)}" fill="#187C1A" stroke="#fff" stroke-width="3"/>
         <text x="${r1(p.x)}" y="${r1(p.y + 4.5 * k)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="${r1(12.5 * k)}" font-weight="600" fill="#fff">${i + 1}</text>`
      : `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${r1(13 * k)}" fill="#fff" stroke="#C9C4B4" stroke-width="2.5"/>
         <path d="M${r1(p.x - 4 * k)},${r1(p.y - 1 * k)} v-${r1(2.5 * k)} a${r1(4 * k)},${r1(4 * k)} 0 0 1 ${r1(8 * k)},0 v${r1(2.5 * k)}" fill="none" stroke="#8B978E" stroke-width="${r1(1.8 * k)}"/>
         <rect x="${r1(p.x - 5.5 * k)}" y="${r1(p.y - 1 * k)}" width="${r1(11 * k)}" height="${r1(7.5 * k)}" rx="1.5" fill="#8B978E"/>`;
    const fog = on ? '' : `<ellipse cx="${r1(p.x)}" cy="${r1(p.y - 10 * k)}" rx="${r1(90 * k)}" ry="${r1(40 * k)}" fill="${pal.fog}" opacity=".55"/>`;
    const soon = on ? '' : `<g class="trail-label"><text x="${r1(lx)}" y="${r1(ly + 18)}" text-anchor="${lab.anchor}" font-family="Outfit, sans-serif" font-size="11.5" fill="#8B978E">opens after ${c.at} days</text></g>`;
    return `<g data-ch="${i}" role="button" tabindex="0" aria-label="${name}${on ? (me ? ', showing now' : ', open') : `, opens after ${c.at} days shown up`}" style="cursor:pointer">
      <g opacity="${on ? 1 : 0.5}">${PLACES[i](p.x, p.y, k, pal, scene === 'scenery' ? s * 6 : 24)}</g>${fog}
      ${me ? `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${r1(24 * k)}" fill="#8DC61D" opacity=".35"/><circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${r1(19 * k)}" fill="none" stroke="#8DC61D" stroke-width="2"/>` : ''}
      ${stop}${label}${soon}</g>`;
  });

  // Planted things and the hiker sit among the places by height, so a flower
  // near the bottom can stand in front of a far-off grove.
  const layer = [...planted.map(x => ({ y: x.y, g: x.g })), { y: hp.y + 0.5, g: hiker(hp.x, hp.y, persp(hp.y)) }]
    .sort((a, b) => a.y - b.y).map(x => x.g).join('');

  const what = scene === 'lights' ? 'lantern' : scene === 'garden' ? 'flower' : null;
  const summary = `Your trail map: ${days} day${days === 1 ? '' : 's'} shown up, at ${chapters[open].place}`
    + (prog.next ? `, ${prog.next.left} more day${prog.next.left === 1 ? '' : 's'} to ${prog.next.place}` : ', every place open')
    + (what ? `, one ${what} planted for every day` : '');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(summary)}" class="trail-map">
    ${land}${path}${places.join('')}${layer}</g></svg>`;
}

/** How far the hiker is along the way to the next place, 0 to 1, for a progress bar. */
export function towardNext(prog, chapters) {
  if (!prog.next) return 1;
  const from = chapters[prog.open].at;
  return Math.max(0, Math.min(1, (prog.days - from) / (prog.next.at - from)));
}
