/* ==========================================================================
   Theraglee — the trail map on the Premium Goals & tracking page.
   --------------------------------------------------------------------------
   One picture, three levels, the same three the page is built from:

     the goal        the destination at the top right, drawn for its theme
                     (a lit cabin for calmer evenings, a sunrise for more
                     energy, a peak with a flag for time outdoors …)
     the milestones  camps along the path, a tent and a flag each; reached
                     ones fly a green flag, the one being worked on glows,
                     the ones ahead sit a little faded
     the steps       the hiker, who moves a little toward the next camp for
                     every day a stepping stone is done

   The scene the member picked grows along the same path: a flower (garden)
   or a lantern (lights) for every day shown up, or a landscape that warms
   and fills in as milestones are reached (scenery). Nothing ever shrinks,
   dims or wilts.

   Plain SVG strings, no imports, so tests/quest-paths/check.mjs can run it
   under plain Node. The page adds the motion (a bobbing hiker, fluttering
   flags) with CSS on the classes set here. docs/quest-map.md is the guide.
   ========================================================================== */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (n) => Math.round(n * 10) / 10;
const cut = (s, n) => (s = String(s || ''), s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** The canvas and the bends of the path, bottom left to top right. */
export const TRAIL = {
  W: 800, H: 520,
  points: [
    { x: 92,  y: 452 }, { x: 252, y: 398 }, { x: 418, y: 432 }, { x: 566, y: 352 },
    { x: 446, y: 276 }, { x: 594, y: 222 }, { x: 716, y: 150 },
  ],
};

/* Daylight for the garden and the scenery; dusk for the lanterns, so they glow. */
const DAY = {
  skyTop: '#D3E9F6', skyBottom: '#F4F8EC', far: '#D9E7CB', mid: '#BFDA9A', ground: '#E3F0C6', ground2: '#D3E8AC',
  path: '#EBE1C8', pathEdge: '#D6C9A4', walked: '#6AB21E', ahead: '#B9B19A',
  tree: ['#3A9A48', '#187C1A', '#0E5A10'], trunk: '#7A5A3A', water: '#8FCBE3', waterLight: '#C7E7F3',
  stone: '#CFCBBE', sun: '#F6C453', label: '#16241C', pill: '#FFFFFF', tent: '#F7F3EA', tentShade: '#E3DCC9',
};
const DUSK = {
  skyTop: '#22394B', skyBottom: '#F0B288', far: '#5E7E6E', mid: '#4A7152', ground: '#5F8C4B', ground2: '#527D3F',
  path: '#CBB88F', pathEdge: '#AE9A6C', walked: '#8DC61D', ahead: '#8D9B86',
  tree: ['#2C6B3A', '#1E5229', '#153E1E'], trunk: '#4A3524', water: '#6FAAC8', waterLight: '#9CCBE0',
  stone: '#B8B3A6', sun: null, label: '#16241C', pill: '#FFFFFF', tent: '#EFE8D6', tentShade: '#CFC5AD',
};
/* Petal colors: none of them green, so a flower never melts into the grass. */
const PETALS = ['#F29E8E', '#F6C453', '#B9A3E3', '#F7F3EA', '#E98FB5', '#F28C3B'];
const TODAY_PETAL = '#F2705E';

/* ------------------------------------------------------------ the path */
const SAMPLES = 32;
function buildPath(points) {
  const P = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  const pts = [], len = [0];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    for (let k = i ? 1 : 0; k <= SAMPLES; k++) {
      const t = k / SAMPLES, u = 1 - t;
      const x = u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x;
      const y = u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y;
      if (pts.length) len.push(len[len.length - 1] + Math.hypot(x - pts[pts.length - 1].x, y - pts[pts.length - 1].y));
      pts.push({ x, y });
    }
  }
  return { pts, len, total: len[len.length - 1] };
}
const PATH = buildPath(TRAIL.points);

/** The point (and a unit normal) a fraction `f` of the way along the whole trail. */
export function along(f) {
  const want = Math.max(0, Math.min(1, f)) * PATH.total;
  let k = 1;
  while (k < PATH.pts.length - 1 && PATH.len[k] < want) k++;
  const a = PATH.pts[k - 1], b = PATH.pts[k], span = PATH.len[k] - PATH.len[k - 1] || 1;
  const t = (want - PATH.len[k - 1]) / span;
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx: -(b.y - a.y) / d, ny: (b.x - a.x) / d };
}
const polyTo = (f) => {
  const want = Math.max(0, Math.min(1, f)) * PATH.total;
  const out = PATH.pts.filter((_, i) => PATH.len[i] <= want);
  const end = along(f);
  out.push({ x: end.x, y: end.y });
  return out;
};
const poly = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)},${r1(p.y)}`).join(' ');

/** Where camp `i` of `n` sits along the trail (0 to 1); the goal sits at 1. */
export const campAt = (i, n) => (i + 1) / (n + 1);

/** Where the hiker stands: between the last reached camp and the next, by `stepFrac`. */
export function hikerFraction({ milestones = [], current = 0, stepFrac = 0 }) {
  const n = milestones.length;
  if (!n || current >= n) return 0.985;              // at the destination, beside its drawing
  const from = current === 0 ? 0 : campAt(current - 1, n);
  return Math.max(0.03, from + (campAt(current, n) - from) * Math.max(0, Math.min(1, stepFrac)));
}

/** A stable spread for day number `k`, 0 to 1 (golden-ratio scatter). */
export const dayFraction = (k) => 0.03 + ((k * 0.6180339887) % 1) * 0.94;
/** Where day `k` of `total` is planted: on the walked part of the trail, behind the hiker at `hf`. */
export const plantFraction = (k, hf) => 0.015 + (dayFraction(k) - 0.03) / 0.94 * Math.max(0.03, hf - 0.04);

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

const flower = (x, y, k, color, i, bold = false) => {
  const petals = [0, 72, 144, 216, 288].map(a =>
    `<ellipse cx="${r1(x)}" cy="${r1(y - 15.2 * k)}" rx="${r1(2.3 * k)}" ry="${r1(4 * k)}" fill="${color}"${bold ? ' stroke="#fff" stroke-width="1"' : ''} transform="rotate(${a + i * 7} ${r1(x)} ${r1(y - 12 * k)})"/>`).join('');
  return `<g class="trail-bloom"><path d="M${r1(x)},${r1(y)} q${i % 2 ? 2 : -2},-${r1(6 * k)} 0,-${r1(12 * k)}" stroke="#6AB21E" stroke-width="${r1(1.6 * k)}" fill="none"/>
    <ellipse cx="${r1(x - 3 * k)}" cy="${r1(y - 6 * k)}" rx="${r1(3 * k)}" ry="${r1(1.5 * k)}" fill="#8DC61D" transform="rotate(-30 ${r1(x - 3 * k)} ${r1(y - 6 * k)})"/>
    ${petals}<circle cx="${r1(x)}" cy="${r1(y - 12 * k)}" r="${r1(1.8 * k)}" fill="#F6C453"/></g>`;
};

const lantern = (x, y, k) => `<g class="trail-bloom">
  <circle cx="${r1(x)}" cy="${r1(y - 15 * k)}" r="${r1(13 * k)}" fill="#F6C453" opacity=".22"/>
  <line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(y - 10 * k)}" stroke="#4A3524" stroke-width="${r1(1.8 * k)}"/>
  <rect x="${r1(x - 3.6 * k)}" y="${r1(y - 20 * k)}" width="${r1(7.2 * k)}" height="${r1(10 * k)}" rx="${r1(1.6 * k)}" fill="#FFD36B" stroke="#B2541E" stroke-width="${r1(0.9 * k)}"/>
  <circle cx="${r1(x)}" cy="${r1(y - 15 * k)}" r="${r1(2 * k)}" fill="#FFF4D0"/></g>`;

const bird = (x, y) => `<path d="M${x},${y} q5,-5 10,0 q5,-5 10,0" fill="none" stroke="#3B4F45" stroke-width="1.6" stroke-linecap="round"/>`;

/* The hiker: a small figure with a lime backpack, and a "You are here" sign
   with an arrow pointing down at them. The page bobs `.trail-hiker`, and on a
   phone scales `.trail-hiker-body` up so the sign stays readable. */
const hiker = (x, y, k) => `<g class="trail-hiker" aria-hidden="true" style="transform-box:fill-box;transform-origin:50% 100%">
  <g class="trail-hiker-body" style="transform-box:fill-box;transform-origin:50% 100%">
  <ellipse cx="${r1(x)}" cy="${r1(y + 2)}" rx="${r1(9 * k)}" ry="${r1(3 * k)}" fill="#16241C" opacity=".18"/>
  <rect x="${r1(x - 7.5 * k)}" y="${r1(y - 22 * k)}" width="${r1(6 * k)}" height="${r1(11 * k)}" rx="${r1(2 * k)}" fill="#8DC61D"/>
  <path d="M${r1(x - 4 * k)},${r1(y - 24 * k)} h${r1(8 * k)} q${r1(4 * k)},0 ${r1(4 * k)},${r1(4 * k)} v${r1(12 * k)} h-${r1(16 * k)} v-${r1(12 * k)} q0,-${r1(4 * k)} ${r1(4 * k)},-${r1(4 * k)}z" fill="#16241C"/>
  <circle cx="${r1(x)}" cy="${r1(y - 29 * k)}" r="${r1(5.2 * k)}" fill="#16241C"/>
  <path d="M${r1(x - 3 * k)},${r1(y - 8 * k)} l-${r1(2 * k)},${r1(8 * k)} M${r1(x + 3 * k)},${r1(y - 8 * k)} l${r1(3 * k)},${r1(8 * k)}" stroke="#16241C" stroke-width="${r1(2.6 * k)}" stroke-linecap="round"/>
  <g class="trail-you" filter="url(#tm-shadow)">
    <rect x="${r1(x - 44)}" y="${r1(y - 76 * k)}" width="88" height="24" rx="12" fill="#16241C"/>
    <text x="${r1(x)}" y="${r1(y - 76 * k + 16.5)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="13" font-weight="600" fill="#fff">You are here</text>
    <line x1="${r1(x)}" y1="${r1(y - 52 * k)}" x2="${r1(x)}" y2="${r1(y - 42 * k)}" stroke="#16241C" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M${r1(x - 6)},${r1(y - 44 * k)} L${r1(x)},${r1(y - 36 * k)} L${r1(x + 6)},${r1(y - 44 * k)}z" fill="#16241C"/>
  </g></g></g>`;

/* A camp: a tent, and a flag on a pole. Reached camps fly a green flag with a
   check; the current one a lime flag; the ones ahead a pale one. */
function camp(x, y, k, pal, state, n) {
  const flag = state === 'reached' ? '#187C1A' : state === 'current' ? '#8DC61D' : '#E7E3D6';
  const ink = state === 'ahead' ? '#8B978E' : '#fff';
  return `<g>
    <ellipse cx="${r1(x)}" cy="${r1(y + 3 * k)}" rx="${r1(26 * k)}" ry="${r1(7 * k)}" fill="#16241C" opacity=".10"/>
    <path d="M${r1(x - 24 * k)},${r1(y + 2 * k)} L${r1(x - 2 * k)},${r1(y - 26 * k)} L${r1(x + 22 * k)},${r1(y + 2 * k)}z" fill="${pal.tent}" stroke="${pal.tentShade}" stroke-width="1.2"/>
    <path d="M${r1(x - 2 * k)},${r1(y - 26 * k)} L${r1(x + 22 * k)},${r1(y + 2 * k)} H${r1(x + 8 * k)}z" fill="${pal.tentShade}" opacity=".55"/>
    <path d="M${r1(x - 9 * k)},${r1(y + 2 * k)} L${r1(x - 2 * k)},${r1(y - 12 * k)} L${r1(x + 5 * k)},${r1(y + 2 * k)}z" fill="${state === 'ahead' ? '#DAD5C6' : '#5A6760'}"/>
    <line x1="${r1(x + 18 * k)}" y1="${r1(y + 1 * k)}" x2="${r1(x + 18 * k)}" y2="${r1(y - 44 * k)}" stroke="${pal.trunk}" stroke-width="${r1(2 * k)}"/>
    <g class="trail-flag" style="transform-box:fill-box;transform-origin:0% 50%">
      <path d="M${r1(x + 18 * k)},${r1(y - 44 * k)} h${r1(26 * k)} l-${r1(6 * k)},${r1(8 * k)} l${r1(6 * k)},${r1(8 * k)} h-${r1(26 * k)}z" fill="${flag}"/>
      <text x="${r1(x + 29 * k)}" y="${r1(y - 31.5 * k)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="${r1(11 * k)}" font-weight="700" fill="${ink}">${state === 'reached' ? '✓' : n}</text>
    </g></g>`;
}

/* The destination, drawn for the goal's theme, up by the far hills. */
const DESTINATIONS = {
  // A cabin with one warm window, under a crescent moon.
  calm_evenings: (x, y, k) => `<path d="M${r1(x - 26 * k)},${r1(y)} v-${r1(24 * k)} l${r1(26 * k)},-${r1(18 * k)} l${r1(26 * k)},${r1(18 * k)} v${r1(24 * k)}z" fill="#7A5A3A"/>
    <path d="M${r1(x - 30 * k)},${r1(y - 22 * k)} l${r1(30 * k)},-${r1(22 * k)} l${r1(30 * k)},${r1(22 * k)}" fill="none" stroke="#5A3F28" stroke-width="${r1(4 * k)}" stroke-linecap="round"/>
    <rect x="${r1(x - 8 * k)}" y="${r1(y - 18 * k)}" width="${r1(16 * k)}" height="${r1(13 * k)}" rx="1.5" fill="#FFD36B"/>
    <circle cx="${r1(x)}" cy="${r1(y - 11 * k)}" r="${r1(18 * k)}" fill="#FFD36B" opacity=".18"/>
    <rect x="${r1(x + 12 * k)}" y="${r1(y - 46 * k)}" width="${r1(6 * k)}" height="${r1(12 * k)}" fill="#5A3F28"/>
    <path d="M${r1(x + 44 * k)},${r1(y - 66 * k)} a${r1(13 * k)},${r1(13 * k)} 0 1 0 ${r1(10 * k)},${r1(18 * k)} a${r1(10 * k)},${r1(10 * k)} 0 1 1 -${r1(10 * k)},-${r1(18 * k)}z" fill="#F7F3EA"/>`,
  // A lighthouse, with its beam on.
  steady_routines: (x, y, k) => `<path d="M${r1(x - 12 * k)},${r1(y)} l${r1(4 * k)},-${r1(52 * k)} h${r1(16 * k)} l${r1(4 * k)},${r1(52 * k)}z" fill="#F7F3EA" stroke="#D6C9A4" stroke-width="1"/>
    <path d="M${r1(x - 9 * k)},${r1(y - 14 * k)} h${r1(18 * k)} M${r1(x - 10 * k)},${r1(y - 32 * k)} h${r1(20 * k)}" stroke="#B2541E" stroke-width="${r1(6 * k)}"/>
    <rect x="${r1(x - 9 * k)}" y="${r1(y - 62 * k)}" width="${r1(18 * k)}" height="${r1(10 * k)}" rx="2" fill="#16241C"/>
    <rect x="${r1(x - 6 * k)}" y="${r1(y - 60 * k)}" width="${r1(12 * k)}" height="${r1(7 * k)}" fill="#FFD36B"/>
    <path d="M${r1(x + 6 * k)},${r1(y - 57 * k)} l${r1(60 * k)},-${r1(14 * k)} v${r1(22 * k)}z" fill="#FFD36B" opacity=".35"/>
    <path d="M${r1(x - 12 * k)},${r1(y - 64 * k)} l${r1(12 * k)},-${r1(8 * k)} l${r1(12 * k)},${r1(8 * k)}z" fill="#B2541E"/>`,
  // A campfire with two log seats.
  connection: (x, y, k) => `<rect x="${r1(x - 40 * k)}" y="${r1(y - 8 * k)}" width="${r1(22 * k)}" height="${r1(8 * k)}" rx="${r1(4 * k)}" fill="#7A5A3A"/>
    <rect x="${r1(x + 18 * k)}" y="${r1(y - 8 * k)}" width="${r1(22 * k)}" height="${r1(8 * k)}" rx="${r1(4 * k)}" fill="#7A5A3A"/>
    <path d="M${r1(x - 12 * k)},${r1(y)} l${r1(24 * k)},-${r1(6 * k)} M${r1(x + 12 * k)},${r1(y)} l-${r1(24 * k)},-${r1(6 * k)}" stroke="#5A3F28" stroke-width="${r1(3 * k)}" stroke-linecap="round"/>
    <path d="M${r1(x)},${r1(y - 4 * k)} c-${r1(12 * k)},-${r1(10 * k)} -${r1(4 * k)},-${r1(20 * k)} ${r1(2 * k)},-${r1(30 * k)} c${r1(2 * k)},${r1(10 * k)} ${r1(10 * k)},${r1(14 * k)} ${r1(6 * k)},${r1(24 * k)}z" fill="#F29E8E"/>
    <path d="M${r1(x)},${r1(y - 4 * k)} c-${r1(6 * k)},-${r1(6 * k)} -${r1(2 * k)},-${r1(12 * k)} ${r1(1 * k)},${r1(-18 * k)} c${r1(1 * k)},${r1(6 * k)} ${r1(5 * k)},${r1(8 * k)} ${r1(3 * k)},${r1(14 * k)}z" fill="#FFD36B"/>
    <circle cx="${r1(x)}" cy="${r1(y - 14 * k)}" r="${r1(24 * k)}" fill="#FFD36B" opacity=".16"/>`,
  // A sunrise with rays.
  energy: (x, y, k) => `${[-60, -35, -10, 15, 40, 65].map(a => `<line x1="${r1(x)}" y1="${r1(y - 8 * k)}" x2="${r1(x + Math.sin(a * Math.PI / 180) * 54 * k)}" y2="${r1(y - 8 * k - Math.cos(a * Math.PI / 180) * 54 * k)}" stroke="#F6C453" stroke-width="${r1(3 * k)}" stroke-linecap="round" opacity=".7"/>`).join('')}
    <circle cx="${r1(x)}" cy="${r1(y - 8 * k)}" r="${r1(22 * k)}" fill="#F6C453"/>
    <circle cx="${r1(x)}" cy="${r1(y - 8 * k)}" r="${r1(34 * k)}" fill="#F6C453" opacity=".18"/>`,
  // A mountain peak with a flag at the top.
  time_outdoors: (x, y, k) => `<path d="M${r1(x - 54 * k)},${r1(y + 4 * k)} L${r1(x - 6 * k)},${r1(y - 64 * k)} L${r1(x + 46 * k)},${r1(y + 4 * k)}z" fill="#9FB7A3"/>
    <path d="M${r1(x - 22 * k)},${r1(y - 40 * k)} L${r1(x - 6 * k)},${r1(y - 64 * k)} L${r1(x + 12 * k)},${r1(y - 38 * k)} l-${r1(6 * k)},${r1(4 * k)} l-${r1(6 * k)},-${r1(5 * k)} l-${r1(6 * k)},${r1(5 * k)}z" fill="#F7F3EA"/>
    <line x1="${r1(x - 6 * k)}" y1="${r1(y - 64 * k)}" x2="${r1(x - 6 * k)}" y2="${r1(y - 84 * k)}" stroke="#16241C" stroke-width="${r1(1.6 * k)}"/>
    <path d="M${r1(x - 6 * k)},${r1(y - 84 * k)} h${r1(14 * k)} l-${r1(3 * k)},${r1(4 * k)} l${r1(3 * k)},${r1(4 * k)} h-${r1(14 * k)}z" fill="#8DC61D"/>`,
  // A bench under a tree, with a blanket folded on it.
  self_kindness: (x, y, k, pal) => `${tree(x - 26 * k, y - 2 * k, k * 1.5, pal, 1)}
    <rect x="${r1(x - 4 * k)}" y="${r1(y - 16 * k)}" width="${r1(40 * k)}" height="${r1(4 * k)}" rx="1" fill="#7A5A3A"/>
    <rect x="${r1(x - 4 * k)}" y="${r1(y - 24 * k)}" width="${r1(40 * k)}" height="${r1(3 * k)}" rx="1" fill="#7A5A3A"/>
    <rect x="${r1(x - 1 * k)}" y="${r1(y - 12 * k)}" width="${r1(3 * k)}" height="${r1(12 * k)}" fill="#5A3F28"/>
    <rect x="${r1(x + 30 * k)}" y="${r1(y - 12 * k)}" width="${r1(3 * k)}" height="${r1(12 * k)}" fill="#5A3F28"/>
    <rect x="${r1(x + 14 * k)}" y="${r1(y - 22 * k)}" width="${r1(16 * k)}" height="${r1(6 * k)}" rx="2" fill="#E98FB5"/>`,
  // An easel with a half-painted canvas, and a kite.
  creativity: (x, y, k) => `<path d="M${r1(x - 16 * k)},${r1(y)} L${r1(x - 4 * k)},${r1(y - 52 * k)} M${r1(x + 16 * k)},${r1(y)} L${r1(x + 4 * k)},${r1(y - 52 * k)} M${r1(x)},${r1(y - 50 * k)} V${r1(y)}" stroke="#7A5A3A" stroke-width="${r1(2.2 * k)}" stroke-linecap="round"/>
    <rect x="${r1(x - 18 * k)}" y="${r1(y - 46 * k)}" width="${r1(36 * k)}" height="${r1(28 * k)}" rx="1.5" fill="#F7F3EA" stroke="#D6C9A4"/>
    <path d="M${r1(x - 14 * k)},${r1(y - 26 * k)} q${r1(10 * k)},-${r1(14 * k)} ${r1(20 * k)},0 t${r1(10 * k)},-${r1(6 * k)}" fill="none" stroke="#8DC61D" stroke-width="${r1(3 * k)}" stroke-linecap="round"/>
    <circle cx="${r1(x + 6 * k)}" cy="${r1(y - 38 * k)}" r="${r1(4 * k)}" fill="#F6C453"/>
    <path d="M${r1(x + 40 * k)},${r1(y - 74 * k)} l${r1(12 * k)},${r1(10 * k)} l-${r1(12 * k)},${r1(14 * k)} l-${r1(12 * k)},-${r1(14 * k)}z" fill="#F29E8E"/>
    <path d="M${r1(x + 40 * k)},${r1(y - 50 * k)} q-${r1(10 * k)},${r1(14 * k)} -${r1(22 * k)},${r1(20 * k)}" fill="none" stroke="#16241C" stroke-width="1.2"/>`,
  // A still lake with a little dock, and a boat tied up for the day.
  calm: (x, y, k, pal) => `<ellipse cx="${r1(x + 6 * k)}" cy="${r1(y + 2 * k)}" rx="${r1(62 * k)}" ry="${r1(14 * k)}" fill="${pal.water}"/>
    <ellipse cx="${r1(x + 6 * k)}" cy="${r1(y + 2 * k)}" rx="${r1(40 * k)}" ry="${r1(6 * k)}" fill="${pal.waterLight}" opacity=".5"/>
    <path d="M${r1(x - 30 * k)},${r1(y - 4 * k)} h${r1(34 * k)}" stroke="#7A5A3A" stroke-width="${r1(4 * k)}" stroke-linecap="round"/>
    <path d="M${r1(x - 22 * k)},${r1(y - 4 * k)} v${r1(8 * k)} M${r1(x - 6 * k)},${r1(y - 4 * k)} v${r1(8 * k)}" stroke="#5A3F28" stroke-width="${r1(2 * k)}"/>
    <path d="M${r1(x + 10 * k)},${r1(y - 2 * k)} h${r1(26 * k)} l-${r1(4 * k)},${r1(7 * k)} h-${r1(18 * k)}z" fill="#F7F3EA" stroke="#D6C9A4" stroke-width="1"/>
    <line x1="${r1(x + 22 * k)}" y1="${r1(y - 2 * k)}" x2="${r1(x + 22 * k)}" y2="${r1(y - 26 * k)}" stroke="#7A5A3A" stroke-width="${r1(1.6 * k)}"/>
    <path d="M${r1(x + 22 * k)},${r1(y - 26 * k)} l${r1(14 * k)},${r1(18 * k)} h-${r1(14 * k)}z" fill="#8DC61D" opacity=".9"/>
    ${tree(x - 44 * k, y - 6 * k, k * 0.8, pal, 1)}`,
  // A lookout tower with a telescope.
  focus: (x, y, k) => `<path d="M${r1(x - 16 * k)},${r1(y)} L${r1(x - 10 * k)},${r1(y - 44 * k)} M${r1(x + 16 * k)},${r1(y)} L${r1(x + 10 * k)},${r1(y - 44 * k)} M${r1(x - 13 * k)},${r1(y - 20 * k)} h${r1(26 * k)}" stroke="#7A5A3A" stroke-width="${r1(2.4 * k)}" stroke-linecap="round"/>
    <rect x="${r1(x - 16 * k)}" y="${r1(y - 56 * k)}" width="${r1(32 * k)}" height="${r1(14 * k)}" rx="2" fill="#F7F3EA" stroke="#D6C9A4"/>
    <path d="M${r1(x - 20 * k)},${r1(y - 56 * k)} h${r1(40 * k)} l-${r1(6 * k)},-${r1(8 * k)} h-${r1(28 * k)}z" fill="#187C1A"/>
    <rect x="${r1(x - 14 * k)}" y="${r1(y - 46 * k)}" width="${r1(28 * k)}" height="${r1(2 * k)}" fill="#D6C9A4"/>
    <path d="M${r1(x + 2 * k)},${r1(y - 48 * k)} l${r1(16 * k)},-${r1(10 * k)}" stroke="#16241C" stroke-width="${r1(3.5 * k)}" stroke-linecap="round"/>`,
};

/* Scenery along the way that is always there: a clearing, a stream, a grove,
   a knoll, a meadow. Drawn at fixed bends of the path. */
function scenery(pal, s) {
  const P = TRAIL.points;
  const k1 = persp(P[1].y), k2 = persp(P[2].y), k3 = persp(P[3].y), k4 = persp(P[4].y), k5 = persp(P[5].y);
  return `
    <ellipse cx="${P[1].x}" cy="${P[1].y - 4}" rx="${r1(52 * k1)}" ry="${r1(18 * k1)}" fill="${pal.ground2}" opacity=".9"/>
    ${tree(P[1].x - 48 * k1, P[1].y - 10 * k1, k1 * 0.9, pal, 1)}${tree(P[1].x + 56 * k1, P[1].y - 6 * k1, k1, pal, 2)}
    <path d="M${r1(P[2].x - 60 * k2)},${r1(P[2].y - 70 * k2)} C${r1(P[2].x - 20 * k2)},${r1(P[2].y - 40 * k2)} ${r1(P[2].x + 10 * k2)},${r1(P[2].y - 20 * k2)} ${r1(P[2].x - 6 * k2)},${r1(P[2].y + 6 * k2)} S${r1(P[2].x + 24 * k2)},${r1(P[2].y + 50 * k2)} ${r1(P[2].x + 50 * k2)},${r1(P[2].y + 70 * k2)}" fill="none" stroke="${pal.water}" stroke-width="${r1(14 * k2)}" stroke-linecap="round"/>
    <path d="M${r1(P[2].x - 54 * k2)},${r1(P[2].y - 64 * k2)} C${r1(P[2].x - 18 * k2)},${r1(P[2].y - 38 * k2)} ${r1(P[2].x + 8 * k2)},${r1(P[2].y - 18 * k2)} ${r1(P[2].x - 6 * k2)},${r1(P[2].y + 4 * k2)}" fill="none" stroke="${pal.waterLight}" stroke-width="${r1(3 * k2)}" stroke-linecap="round" opacity=".8"/>
    ${[-14, 0, 14].map(d => `<ellipse cx="${r1(P[2].x + d * k2)}" cy="${r1(P[2].y - 2 * k2 + Math.abs(d) * 0.1 * k2)}" rx="${r1(7 * k2)}" ry="${r1(4.5 * k2)}" fill="${pal.stone}" stroke="#AFA994" stroke-width="1"/>`).join('')}
    ${s >= 1 ? `${tree(P[3].x - 40 * k3, P[3].y + 4 * k3, k3 * 1.05, pal, 2)}${tree(P[3].x + 44 * k3, P[3].y - 2 * k3, k3 * 1.1, pal, 1)}${tree(P[3].x + 18 * k3, P[3].y - 26 * k3, k3, pal, 2)}` : ''}
    <ellipse cx="${P[4].x}" cy="${r1(P[4].y + 6 * k4)}" rx="${r1(58 * k4)}" ry="${r1(16 * k4)}" fill="${pal.mid}"/>
    <ellipse cx="${P[5].x}" cy="${P[5].y}" rx="${r1(70 * k5)}" ry="${r1(20 * k5)}" fill="${pal.ground2}" opacity=".9"/>
    ${s >= 2 ? Array.from({ length: 11 }, (_, i) => flower(P[5].x - 58 * k5 + i * 11.6 * k5, P[5].y - 8 * k5 + ((i * 7) % 16) * k5, k5 * 0.55, PETALS[i % PETALS.length], i)).join('') : ''}
    ${s >= 1 ? `${tree(40, 380, 1.1, pal, 1)}${tree(760, 300, 0.8, pal, 2)}${tree(350, 300, 0.75, pal, 1)}${tree(690, 330, 0.9, pal, 0)}${bush(130, 340, 0.9, pal)}${bush(520, 470, 1.1, pal)}` : ''}
    ${s >= 3 ? `${bird(250, 96)}${bird(280, 84)}${bird(310, 100)}` : ''}
    ${s >= 4 ? Array.from({ length: 14 }, (_, i) => flower(60 + (i * 53) % 700, 492 - (i * 17) % 40, 0.6, PETALS[i % PETALS.length], i)).join('') : ''}`;
}

/* ------------------------------------------------------------ the map */
/**
 * The trail map.
 *   goal        { text, theme }         the destination
 *   milestones  [{ title, reached }]    the camps, in order
 *   current     index of the milestone being worked on (milestones.length when all are reached)
 *   stepFrac    0 to 1, how far along the way to the current camp
 *   days        days shown up, for the flowers or lanterns
 *   scene       'garden' | 'lights' | 'scenery'
 * Each camp is a <g data-ms="i"> and the destination a <g data-goal>, so the page can click them.
 */
export function trailMap({ goal = {}, milestones = [], current = 0, stepFrac = 0, days = 0, scene = 'garden', today = false } = {}) {
  const { W, H } = TRAIL;
  const pal = scene === 'lights' ? DUSK : DAY;
  const n = milestones.length;
  const reached = milestones.filter(m => m.reached).length;
  const done = n > 0 && current >= n;
  // How far the scenery has filled in: with the scenery scene, by milestones reached; otherwise all of it.
  const s = scene === 'scenery' ? Math.min(4, Math.round(4 * (n ? reached / n : 0))) : 4;
  const hf = hikerFraction({ milestones, current, stepFrac });
  const hp = along(hf);

  const skies = [['#E7ECEE', '#F2F3EE'], ['#DCEBF5', '#F3F7EC'], ['#CFE7F7', '#F6F8EB'], ['#F8E5CC', '#FBF1DF'], ['#F7D9BE', '#FBEBD6']];
  const [skyTop, skyBottom] = scene === 'scenery' ? skies[s] : [pal.skyTop, pal.skyBottom];
  const land = `
    <defs>
      <linearGradient id="tm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient>
      <linearGradient id="tm-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.ground}"/><stop offset="1" stop-color="${pal.ground2}"/></linearGradient>
      <radialGradient id="tm-glow"><stop offset="0" stop-color="#8DC61D" stop-opacity=".55"/><stop offset="1" stop-color="#8DC61D" stop-opacity="0"/></radialGradient>
      <filter id="tm-shadow" x="-20%" y="-40%" width="140%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#16241C" flood-opacity=".22"/></filter>
      <clipPath id="tm-clip"><rect width="${W}" height="${H}" rx="18"/></clipPath>
    </defs>
    <g clip-path="url(#tm-clip)">
    <rect width="${W}" height="${H}" fill="url(#tm-sky)"/>
    ${scene === 'lights' ? `<circle cx="150" cy="78" r="18" fill="#F7F3EA"/><circle cx="150" cy="78" r="30" fill="#F7F3EA" opacity=".15"/>
      ${[60, 220, 330, 470, 560, 700, 760].map((x, i) => `<circle cx="${x}" cy="${30 + (i * 23) % 70}" r="1.6" fill="#fff" opacity=".8"/>`).join('')}` : ''}
    ${pal.sun && goal.theme !== 'energy' ? `<circle cx="470" cy="${112 - s * 6}" r="24" fill="${pal.sun}"/><circle cx="470" cy="${112 - s * 6}" r="38" fill="${pal.sun}" opacity=".18"/>` : ''}
    <path d="M0,232 C120,190 220,240 340,214 S560,150 660,196 S760,196 800,180 V${H} H0Z" fill="${pal.far}"/>
    <path d="M0,290 C90,246 200,286 300,266 S480,222 600,262 S740,258 800,238 V${H} H0Z" fill="${pal.mid}"/>
    <path d="M0,330 C100,300 220,336 340,318 S560,292 680,318 S760,320 800,312 V${H} H0Z" fill="url(#tm-ground)"/>
    ${scenery(pal, s)}`;

  // The path: a sandy ribbon the whole way, the walked part in lime, the part ahead dotted.
  const walked = polyTo(hf);
  const path = `
    <path d="${poly(PATH.pts)}" fill="none" stroke="${pal.pathEdge}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${poly(PATH.pts)}" fill="none" stroke="${pal.path}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${poly(PATH.pts)}" fill="none" stroke="${pal.ahead}" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round" opacity=".8"/>
    ${walked.length > 1 ? `<path d="${poly(walked)}" fill="none" stroke="${pal.walked}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` : ''}`;

  // The trailhead signpost.
  const t0 = along(0), kt = persp(t0.y);
  const trailhead = `<g>${bush(t0.x - 26 * kt, t0.y + 2, kt, pal)}
    <rect x="${r1(t0.x + 10 * kt)}" y="${r1(t0.y - 46 * kt)}" width="${r1(4 * kt)}" height="${r1(48 * kt)}" fill="${pal.trunk}"/>
    <path d="M${r1(t0.x + 4 * kt)},${r1(t0.y - 44 * kt)} h${r1(34 * kt)} l${r1(8 * kt)},${r1(7 * kt)} l-${r1(8 * kt)},${r1(7 * kt)} h-${r1(34 * kt)}z" fill="#F7F3EA" stroke="${pal.trunk}" stroke-width="${r1(1.6 * kt)}"/>
    <text x="${r1(t0.x + 21 * kt)}" y="${r1(t0.y - 32 * kt)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="${r1(8 * kt)}" font-weight="600" fill="#7A5A3A">START</text></g>`;

  // A flower or a lantern beside the path for every day shown up, on the
  // stretch already walked. Today's, when today is counted, blooms right
  // beside the hiker, larger and with a glow, so it is easy to find.
  const planted = [];
  if (scene !== 'scenery') {
    const n = Math.min(days, 150);
    for (let k = 1; k <= n; k++) {
      const isToday = today && k === n;
      const p = isToday ? hp : along(plantFraction(k, hf));
      const side = isToday ? -1 : (k % 2 ? 1 : -1), off = isToday ? 24 : 14 + ((k * 7) % 9);
      const x = p.x + (isToday ? -off : p.nx * side * off), y = p.y + (isToday ? 9 : p.ny * side * off);
      const k2 = persp(y) * (isToday ? 1.5 : 0.75);
      const glow = isToday ? `<circle class="trail-today-glow" cx="${r1(x)}" cy="${r1(y - 10 * k2)}" r="${r1(22 * k2)}" fill="url(#tm-glow)"/>` : '';
      const g = scene === 'lights' ? lantern(x, y, persp(y) * (isToday ? 1.3 : 0.8))
        : flower(x, y, k2, isToday ? TODAY_PETAL : PETALS[k % PETALS.length], k, isToday);
      planted.push({ y: y + (isToday ? 1 : 0), g: `${glow}<g class="${isToday ? 'trail-today' : ''}">${g}</g>` });
    }
  }

  // The camps, with a label for the reached ones, the current one and the next one.
  const camps = milestones.map((m, i) => {
    const p = along(campAt(i, n)), k = persp(p.y);
    const state = m.reached ? 'reached' : i === current ? 'current' : 'ahead';
    // Only the camp being worked on carries a label: the page's card names the
    // rest, and a quiet map reads better than a labeled one.
    const title = cut(m.title, 34);
    const wide = Math.max(60, title.length * 7.4 + 24);
    const ly = p.y + 30 * k;
    const lx = Math.max(wide / 2 + 6, Math.min(W - wide / 2 - 6, p.x));
    const label = state === 'current' ? `<g class="trail-label" filter="url(#tm-shadow)">
        <rect x="${r1(lx - wide / 2)}" y="${r1(ly - 14)}" width="${r1(wide)}" height="34" rx="11" fill="${pal.pill}" opacity=".96"/>
        <text x="${r1(lx)}" y="${r1(ly - 2)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="9.5" font-weight="700" letter-spacing=".08em" fill="#187C1A">WORKING ON NOW</text>
        <text x="${r1(lx)}" y="${r1(ly + 14)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="12.5" font-weight="500" fill="${pal.label}">${esc(title)}</text></g>` : '';
    const glow = state === 'current' ? `<circle cx="${r1(p.x)}" cy="${r1(p.y - 8 * k)}" r="${r1(54 * k)}" fill="url(#tm-glow)"/>` : '';
    return { y: p.y, g: `<g data-ms="${i}" role="button" tabindex="0" style="cursor:pointer" aria-label="Milestone ${i + 1}, ${esc(m.title)}: ${state === 'reached' ? 'reached' : state === 'current' ? 'working on now' : 'ahead'}">
      ${glow}<g opacity="${state === 'ahead' ? .6 : 1}">${camp(p.x, p.y, k, pal, state, i + 1)}</g>${label}</g>` };
  });

  // The destination.
  const gp = along(1), kg = persp(gp.y) * 0.95;
  const draw = DESTINATIONS[goal.theme] || DESTINATIONS.time_outdoors;
  const gt = cut(goal.text || 'Your goal', 36);
  const gw = Math.max(90, gt.length * 7.2 + 28);
  const destination = `<g data-goal role="button" tabindex="0" style="cursor:pointer" aria-label="Your goal: ${esc(goal.text || '')}${done ? ', reached' : ''}">
    ${done ? `<circle cx="${r1(gp.x + 10)}" cy="${r1(gp.y - 30)}" r="70" fill="url(#tm-glow)"/>` : ''}
    <path d="M${r1(gp.x - 90 * kg)},${r1(gp.y + 12 * kg)} q${r1(40 * kg)},-${r1(54 * kg)} ${r1(84 * kg)},-${r1(8 * kg)} q${r1(36 * kg)},-${r1(40 * kg)} ${r1(96 * kg)},${r1(8 * kg)}z" fill="${pal.far}"/>
    <path d="M${r1(gp.x - 40 * kg)},${r1(gp.y + 14 * kg)} q${r1(36 * kg)},-${r1(44 * kg)} ${r1(80 * kg)},-${r1(4 * kg)} q${r1(20 * kg)},-${r1(20 * kg)} ${r1(50 * kg)},${r1(4 * kg)}z" fill="${pal.mid}"/>
    <g opacity="${done || !n ? 1 : .92}">${draw(gp.x + 14, gp.y - 2, kg, pal)}</g>
    <g class="trail-label" filter="url(#tm-shadow)">
      <rect x="${r1(gp.x - gw + 40)}" y="${r1(gp.y - 118)}" width="${r1(gw)}" height="36" rx="12" fill="#16241C"/>
      <text x="${r1(gp.x - gw / 2 + 40)}" y="${r1(gp.y - 104)}" text-anchor="middle" font-family="Outfit, sans-serif" font-size="9.5" font-weight="700" letter-spacing=".08em" fill="#8DC61D">${done ? 'GOAL REACHED' : 'YOUR GOAL'}</text>
      <text x="${r1(gp.x - gw / 2 + 40)}" y="${r1(gp.y - 90)}" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-style="italic" font-size="14.5" fill="#fff">${esc(gt)}</text></g></g>`;

  // Everything that stands on the ground, nearest (lowest) drawn last.
  const layer = [...planted, ...camps, { y: hp.y + 0.5, g: hiker(hp.x, hp.y, persp(hp.y)) }]
    .sort((a, b) => a.y - b.y).map(x => x.g).join('');

  const what = scene === 'lights' ? 'lantern' : scene === 'garden' ? 'flower' : null;
  const summary = `Your trail: ${n} milestone${n === 1 ? '' : 's'}, ${reached} reached`
    + (done ? ', goal reached' : n ? `, working on ${milestones[current].title}` : '')
    + `, ${days} day${days === 1 ? '' : 's'} shown up` + (what ? `, one ${what} planted for every day` : '');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(summary)}" class="trail-map">
    ${land}${path}${trailhead}${destination}${layer}</g></svg>`;
}
