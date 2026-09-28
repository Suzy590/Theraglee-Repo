/* ==========================================================================
   Theraglee — drawings for the quest map (Goals & tracking, Premium).
   Plain SVG strings, no imports. Every scene only ever gains things as days
   are added: nothing wilts, dims or goes out on a missed day.
   docs/quest-map.md is the guide.
   ========================================================================== */

const C = {
  green: '#187C1A', deep: '#0E5A10', lime: '#8DC61D', lime2: '#6AB21E', mist: '#C9DFA6',
  soft: '#F0F7E2', sand: '#F3F0E4', hair: '#E7E3D6', faint: '#8B978E', ink: '#16241C',
  sun: '#F6C453', petal: ['#F29E8E', '#F6C453', '#B9A3E3', '#F7F3EA', '#E98FB5'],
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * The quest map: chapter stops down a winding path, each with an optional
 * side-path branch. `open` is the newest open chapter; `current` the one on
 * screen. Each stop is a <g data-ch="i"> the page can click.
 */
export function questMap(chapters, open, current) {
  const W = 400, STEP = 86, TOP = 46;
  const pts = chapters.map((_, i) => ({ x: i % 2 ? 292 : 108, y: TOP + i * STEP }));
  const H = TOP + (chapters.length - 1) * STEP + 50;
  const seg = (a, b) => `M${a.x},${a.y} C${a.x},${a.y + STEP / 2} ${b.x},${b.y - STEP / 2} ${b.x},${b.y}`;
  const paths = pts.slice(1).map((b, i) => {
    const lit = i + 1 <= open;
    return `<path d="${seg(pts[i], b)}" fill="none" stroke="${lit ? C.lime2 : C.hair}" stroke-width="${lit ? 6 : 4}"
      stroke-linecap="round" ${lit ? '' : 'stroke-dasharray="2 10"'}/>`;
  }).join('');
  const stops = chapters.map((c, i) => {
    const p = pts[i], lit = i <= open, here = i === current;
    const out = i % 2 ? 1 : -1;                      // side paths branch outward
    const side = c.side ? `<path d="M${p.x},${p.y} q${out * 30},-6 ${out * 58},-26" fill="none"
        stroke="${lit ? C.mist : C.hair}" stroke-width="3" stroke-dasharray="3 6" stroke-linecap="round"/>
      <circle cx="${p.x + out * 58}" cy="${p.y - 26}" r="6" fill="${lit ? C.soft : '#fff'}" stroke="${lit ? C.lime2 : C.hair}" stroke-width="2"><title>Optional side path</title></circle>` : '';
    const label = `<text x="${p.x + (i % 2 ? -34 : 34)}" y="${p.y + 5}" text-anchor="${i % 2 ? 'end' : 'start'}"
        font-size="16" font-family="Outfit, sans-serif" fill="${lit ? C.ink : C.faint}">${esc(c.place)}</text>`;
    return `<g data-ch="${i}" role="button" tabindex="0" aria-label="${esc(c.place)}${lit ? '' : ', opens after ' + c.at + ' days'}" style="cursor:pointer">
      ${side}
      ${here ? `<circle cx="${p.x}" cy="${p.y}" r="30" fill="${C.soft}"/>` : ''}
      <circle cx="${p.x}" cy="${p.y}" r="20" fill="${lit ? C.green : '#fff'}" stroke="${lit ? C.deep : C.hair}" stroke-width="3"/>
      <text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14" font-weight="600"
        font-family="Outfit, sans-serif" fill="${lit ? '#fff' : C.faint}">${lit ? i + 1 : '🔒'}</text>
      ${label}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Your quest map">${paths}${stops}</svg>`;
}

/** A plant for each day shown up; each grows through four stages as later days are added. */
export function garden(days) {
  const W = 600, H = 220, GROUND = 170, SHOW = 48;
  const n = Math.min(days, SHOW);
  const plants = [];
  for (let i = 0; i < n; i++) {
    const age = days - i;                                   // older plants are taller
    const stage = age >= 9 ? 3 : age >= 5 ? 2 : age >= 2 ? 1 : 0;
    const x = 22 + ((i * 97) % 556);
    const y = GROUND + 4 + ((i * 13) % 26);
    const h = [10, 26, 42, 58][stage];
    const col = C.petal[i % C.petal.length];
    let g = `<path d="M${x},${y} q${i % 2 ? 4 : -4},-${h / 2} 0,-${h}" stroke="${C.lime2}" stroke-width="3" fill="none"/>`;
    if (stage >= 1) g += `<ellipse cx="${x - 7}" cy="${y - h / 2}" rx="7" ry="3.5" fill="${C.lime}" transform="rotate(-25 ${x - 7} ${y - h / 2})"/>
      <ellipse cx="${x + 7}" cy="${y - h / 2 - 5}" rx="7" ry="3.5" fill="${C.lime}" transform="rotate(25 ${x + 7} ${y - h / 2 - 5})"/>`;
    if (stage === 2) g += `<circle cx="${x}" cy="${y - h}" r="5" fill="${col}"/>`;
    if (stage === 3) g += [0, 72, 144, 216, 288].map(r =>
      `<ellipse cx="${x}" cy="${y - h - 7}" rx="4" ry="8" fill="${col}" transform="rotate(${r} ${x} ${y - h})"/>`).join('')
      + `<circle cx="${x}" cy="${y - h}" r="4" fill="${C.sun}"/>`;
    if (stage === 0) g += `<circle cx="${x}" cy="${y - h}" r="3" fill="${C.lime}"/>`;
    plants.push({ y, g });
  }
  plants.sort((a, b) => a.y - b.y);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Your garden: ${days} plant${days === 1 ? '' : 's'}">
    <rect width="${W}" height="${H}" rx="16" fill="${C.soft}"/>
    <circle cx="530" cy="46" r="24" fill="${C.sun}" opacity=".8"/>
    <path d="M0,${GROUND} Q150,${GROUND - 14} 300,${GROUND} T600,${GROUND} V${H} H0Z" fill="${C.mist}"/>
    ${plants.map(p => p.g).join('')}
    ${days === 0 ? `<text x="300" y="120" text-anchor="middle" font-family="Outfit, sans-serif" font-size="15" fill="${C.faint}">Your first plant appears the first day you show up.</text>` : ''}
  </svg>`;
}

/** A lantern lit for each day shown up, along a winding path. Always leaves unlit ones ahead to look forward to. */
export function lights(days) {
  const W = 600, H = 220;
  const total = Math.max(20, Math.ceil((days + 5) / 10) * 10);
  const shown = Math.min(total, 60);
  const lit = Math.min(days, shown);
  const at = (t) => ({ x: 30 + t * 540, y: 120 + Math.sin(t * Math.PI * 3) * 50 });
  let road = '';
  for (let k = 0; k <= 60; k++) { const p = at(k / 60); road += `${k ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)} `; }
  const lamps = Array.from({ length: shown }, (_, i) => {
    const p = at(shown === 1 ? 0 : i / (shown - 1));
    const on = i < lit;
    const r = shown > 40 ? 5 : 7;
    return `${on ? `<circle cx="${p.x}" cy="${p.y - 14}" r="${r * 2.2}" fill="${C.sun}" opacity=".25"/>` : ''}
      <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y - 10}" stroke="${C.faint}" stroke-width="1.5"/>
      <circle cx="${p.x}" cy="${p.y - 14}" r="${r}" fill="${on ? C.sun : '#fff'}" stroke="${on ? '#D9A12B' : C.hair}" stroke-width="1.5"/>`;
  }).join('');
  const more = days > shown ? `<text x="570" y="30" text-anchor="end" font-family="Outfit, sans-serif" font-size="13" fill="#E5F3C6">and ${days - shown} more lit behind you</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Your path of lights: ${days} lit">
    <rect width="${W}" height="${H}" rx="16" fill="#23372B"/>
    <path d="${road}" fill="none" stroke="#3E5647" stroke-width="16" stroke-linecap="round"/>
    ${lamps}${more}
  </svg>`;
}

/** The landscape fills in one layer per open chapter (0 to 6). */
export function scenery(open) {
  const W = 600, H = 220, s = Math.max(0, Math.min(6, open));
  const sky = ['#E9EEF0', '#EAF1F3', '#E3F0F6', '#DCEFF7', '#D6EEF8', '#FCE9D2', '#FBDDC3'][s];
  const layers = [];
  layers.push(`<rect width="${W}" height="${H}" rx="16" fill="${sky}"/>`);
  if (s >= 1) layers.push(`<circle cx="${480}" cy="${70 - s * 4}" r="26" fill="${C.sun}"/>`);
  if (s >= 2) layers.push(`<path d="M0,150 Q120,90 250,140 T600,120 V220 H0Z" fill="${C.mist}"/>`);
  layers.push(`<path d="M0,175 Q200,150 400,172 T600,165 V220 H0Z" fill="${s >= 2 ? C.lime : '#D9DCCF'}"/>`);
  if (s >= 3) layers.push([70, 130, 400, 455, 520].map((x, i) =>
    `<rect x="${x - 3}" y="${140 - (i % 2) * 8}" width="6" height="22" fill="#7A5A3A"/>
     <circle cx="${x}" cy="${130 - (i % 2) * 8}" r="${16 + (i % 3) * 3}" fill="${C.green}"/>`).join(''));
  if (s >= 4) layers.push(`<path d="M250,220 C270,200 230,185 280,172 S340,160 330,150" fill="none" stroke="#9FD3E6" stroke-width="10" stroke-linecap="round"/>`);
  if (s >= 5) layers.push(Array.from({ length: 16 }, (_, i) =>
    `<circle cx="${30 + (i * 37) % 560}" cy="${188 + (i * 7) % 24}" r="4" fill="${C.petal[i % 5]}"/>`).join(''));
  if (s >= 6) layers.push(`<path d="M150,60 q8,-8 16,0 q8,-8 16,0M200,48 q6,-6 12,0 q6,-6 12,0" fill="none" stroke="${C.ink}" stroke-width="2"/>
    <rect x="168" y="118" width="40" height="30" fill="#F7F3EA"/><path d="M162,120 L188,98 L214,120Z" fill="#B2541E"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Your scenery, chapter ${s + 1}">${layers.join('')}</svg>`;
}

export function scene(kind, { days, open }) {
  if (kind === 'lights') return lights(days);
  if (kind === 'scenery') return scenery(open);
  return garden(days);
}
