/* Deterministic mandala line-art. Same seed always draws the same figure, so a
   member can print the one they were coloring, or come back to it online.

   Every closed shape is a region: an element with class "rg", a stable index
   in data-i (the order the shapes are drawn, so a saved coloring maps back to
   the same shapes) and a ring group in data-g (so "color the whole ring" can
   find its siblings). Regions start white, which is what prints. The bands
   between the rings are regions too, so every tap inside the mandala lands on
   something that can take a color.

   A shaped mandala (an animal, a plant, a symbol; see mandala-shapes.js) is
   the same rings of petals, dots and scallops, centered on the shape and
   clipped to its outline, with plain parts (legs, a stem, an eye) around
   them. Only shapes that show inside the outline become regions, so every
   region can be tapped. */

import { SHAPES, flatten, inside } from './mandala-shapes.js';

function rng(seed){ let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, a, b) => a + r() * (b - a);
const f1 = (n) => n.toFixed(1);

function petalPath(r1, r2, w, curve){
  const top = 100 - r2, bot = 100 - r1;
  return `M100 ${f1(bot)} C${f1(100-w)} ${f1(bot-curve)} `
       + `${f1(100-w)} ${f1(top+curve)} 100 ${f1(top)} `
       + `C${f1(100+w)} ${f1(top+curve)} ${f1(100+w)} `
       + `${f1(bot-curve)} 100 ${f1(bot)} Z`;
}

/* A scallop sitting on the inner edge of a band and bulging outward. */
function scallopPath(r1, r2, n){
  const span = Math.PI / n;                        // half the angle each one covers
  const a0 = -Math.PI/2 - span, a1 = -Math.PI/2 + span;
  const x0 = 100 + r1*Math.cos(a0), y0 = 100 + r1*Math.sin(a0);
  const x1 = 100 + r1*Math.cos(a1), y1 = 100 + r1*Math.sin(a1);
  const rx = (x1 - x0) / 2, ry = Math.min(rx, (r2 - r1) * .85);
  return `M${f1(x0)} ${f1(y0)} A${f1(rx)} ${f1(ry)} 0 0 1 ${f1(x1)} ${f1(y1)} `
       + `A${f1(r1)} ${f1(r1)} 0 0 0 ${f1(x0)} ${f1(y0)} Z`;
}

/* A ring-shaped band between two radii. */
const bandPath = (r1, r2) =>
  `M100 ${f1(100-r2)} A${f1(r2)} ${f1(r2)} 0 1 1 100 ${f1(100+r2)} A${f1(r2)} ${f1(r2)} 0 1 1 100 ${f1(100-r2)} Z `
  + `M100 ${f1(100-r1)} A${f1(r1)} ${f1(r1)} 0 1 0 100 ${f1(100+r1)} A${f1(r1)} ${f1(r1)} 0 1 0 100 ${f1(100-r1)} Z`;

export function mandala(seed, { stroke = '#16241C', width = 1.1, title = '', shape = null } = {}){
  if (shape && SHAPES[shape]) return shaped(seed, SHAPES[shape], shape, { stroke, width, title });
  const r = rng(seed);
  const out = [];
  let i = 0;
  const region = (g, markup) =>
    out.push(markup.replace(/^<(\w+)/, `<$1 class="rg" data-i="${i++}" data-g="${g}"`));
  const rotated = (g, d, n) => {
    for (let k = 0; k < n; k++)
      region(g, `<path d="${d}" transform="rotate(${f1(360*k/n)} 100 100)"/>`);
  };

  const rings = 4 + Math.floor(r() * 3);
  let rad = 16;

  // Center and the band between the center and the first ring.
  region('c',  '<circle cx="100" cy="100" r="7"/>');
  region('b0', `<path fill-rule="evenodd" d="${bandPath(7, 16)}"/>`);

  for (let k = 0; k < rings; k++){
    const n  = pick(r, [8, 12, 16, 6, 10]);
    const r1 = rad, r2 = Math.min(rad + between(r, 13, 22), 94);   // stays inside the page
    const style = pick(r, ['petal','petal','dots','arcs']);

    // The band first, so the shapes drawn on it sit on top.
    region(`b${k+1}`, `<path fill-rule="evenodd" d="${bandPath(r1, r2)}"/>`);

    if (style === 'petal'){
      rotated(`p${k+1}`, petalPath(r1, r2, between(r,4,11), between(r,4,14)), n);
    } else if (style === 'dots'){
      const rr = (r1 + r2) / 2, dot = between(r, 2.2, 4.5);
      for (let j = 0; j < n; j++){
        const a = 2*Math.PI*j/n - Math.PI/2;
        region(`d${k+1}`, `<circle cx="${f1(100+rr*Math.cos(a))}" cy="${f1(100+rr*Math.sin(a))}" r="${f1(dot)}"/>`);
      }
    } else {
      rotated(`s${k+1}`, scallopPath(r1, r2, n), n);
    }
    rad = r2;
    if (rad > 88) break;
  }
  // The thin margin band out to the edge.
  region('bx', `<path fill-rule="evenodd" d="${bandPath(rad, Math.min(rad + 4, 96))}"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="#fff"
    stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"
    role="img" aria-label="${title ? title.replace(/"/g, '&quot;') + ' mandala' : 'Mandala'}"
    style="width:100%;height:auto;display:block">${out.join('')}</svg>`;
}

const svgWrap = (inner, { stroke, width, title }, what) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="#fff"
    stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"
    role="img" aria-label="${title ? title.replace(/"/g, '&quot;') + ' — ' + what : what}"
    style="width:100%;height:auto;display:block">${inner}</svg>`;

/* A mandala inside an outline. The drawing order is a data contract, like
   mandala()'s: back parts, the center, then ring by ring (band, then its
   shapes), then front parts. */
function shaped(seed, s, key, opts){
  const r = rng(seed);
  const out = [];
  let i = 0;
  const region = (g, markup) =>
    out.push(markup.replace(/^<(\w+)/, `<$1 class="rg" data-i="${i++}" data-g="${g}"`));

  const [hx, hy] = s.heart;
  const pattern = s.parts.filter(p => p.layer === 'pattern');
  const polys = pattern.flatMap(p => flatten(p.d));
  const fronts = s.parts.filter(p => p.layer === 'front').map(p => flatten(p.d));
  // Showing: inside the outline and not under an eye, an ear or a body.
  const isIn = (x, y) => inside(polys, x, y) && !fronts.some(f => inside(f, x, y));
  const at = (a, rad) => [hx + rad * Math.cos(a), hy + rad * Math.sin(a)];
  const share = (pts) => pts.filter(([x, y]) => isIn(x, y)).length / pts.length;
  // Far enough out that the last band covers every corner of the outline.
  const reach = Math.ceil(Math.max(...polys.flat().map(([x, y]) => Math.hypot(x - hx, y - hy)))) + 2;

  const plain = (layer) => s.parts.forEach((p, k) => {
    if (p.layer === layer) region(p.g || `${layer}${k}`, `<path d="${p.d}"/>`);
  });

  plain('back');

  const clip = `tg-${key}-${seed}`;
  out.push(`<defs><clipPath id="${clip}">${pattern.map(p => `<path d="${p.d}"/>`).join('')}</clipPath></defs>`,
           `<g clip-path="url(#${clip})"><g transform="translate(${f1(hx - 100)} ${f1(hy - 100)})">`);

  // A band shows if enough of it is left between the edges and the parts on top.
  const showing = (r1, r2) => {
    const pts = [];
    for (let j = 0; j < 96; j++) for (const t of [.1, .5, .9]) pts.push(at(2 * Math.PI * j / 96, r1 + (r2 - r1) * t));
    return share(pts) * pts.length;
  };
  const band = (r1, r2) => showing(r1, r2) >= 6;
  const disc = [[hx, hy], ...[0, 1, 2, 3, 4, 5].map(j => at(j * Math.PI / 3, 4))];
  if (share(disc) === 1) region('c', '<circle cx="100" cy="100" r="7"/>');
  if (band(7, 16)) region('b0', `<path fill-rule="evenodd" d="${bandPath(7, 16)}"/>`);

  let rad = 16;
  for (let k = 0; rad < reach; k++){
    const r1 = rad;
    let r2 = Math.min(rad + between(r, 13, 22), reach);
    if (reach - r2 < 9 || showing(r2, reach) < 24) r2 = reach;     // no sliver of a last band
    const style = pick(r, ['petal','petal','dots','arcs']);
    const mid = (r1 + r2) / 2;
    const n = Math.max(6, 2 * Math.round(Math.PI * mid / between(r, 8, 12)));
    const gap = 2 * Math.PI * mid / n;                             // room each shape has along the ring
    const angle = (j) => 2 * Math.PI * j / n - Math.PI / 2;
    const depth = (t) => r1 + (r2 - r1) * t;

    if (band(r1, r2)) region(`b${k+1}`, `<path fill-rule="evenodd" d="${bandPath(r1, r2)}"/>`);

    if (style === 'petal'){
      const d = petalPath(r1, r2, gap * between(r, .22, .42), Math.min(between(r, 4, 14), (r2 - r1) * .6));
      for (let j = 0; j < n; j++){
        const pts = [.2, .35, .5, .65, .8].map(t => at(angle(j), depth(t)));
        if (share(pts) >= .6) region(`p${k+1}`, `<path d="${d}" transform="rotate(${f1(360*j/n)} 100 100)"/>`);
      }
    } else if (style === 'dots'){
      const dot = Math.min(between(r, 2.2, 4.5) * (1 + mid / 120), gap * .35, (r2 - r1) * .4);
      for (let j = 0; j < n; j++){
        const a = angle(j), [x, y] = at(a, mid);
        const pts = [[x, y], [x + dot, y], [x - dot, y], [x, y + dot], [x, y - dot]];
        if (share(pts) === 1) region(`d${k+1}`,
          `<circle cx="${f1(100 + mid*Math.cos(a))}" cy="${f1(100 + mid*Math.sin(a))}" r="${f1(dot)}"/>`);
      }
    } else {
      const d = scallopPath(r1, r2, n);
      for (let j = 0; j < n; j++){
        const a = angle(j), w = Math.PI / n * .6;
        const pts = [at(a, depth(.15)), at(a, depth(.5)), at(a - w, depth(.15)), at(a + w, depth(.15))];
        if (share(pts) >= .75) region(`s${k+1}`, `<path d="${d}" transform="rotate(${f1(360*j/n)} 100 100)"/>`);
      }
    }
    rad = r2;
  }
  out.push('</g></g>');

  // The outline on top, a little heavier, so the clipped edge reads cleanly.
  const heavy = f1(opts.width * 1.7);
  out.push(...pattern.map(p => `<path d="${p.d}" fill="none" stroke-width="${heavy}" pointer-events="none"/>`));
  plain('front');
  for (const l of s.lines || []) out.push(`<path d="${l}" fill="none" pointer-events="none"/>`);
  for (const [x, y, rr] of s.dots || [])
    out.push(`<circle cx="${x}" cy="${y}" r="${rr}" fill="${opts.stroke}" pointer-events="none"/>`);

  return svgWrap(out.join(''), opts, `${s.label.toLowerCase()} mandala`);
}

/* Make hand-drawn SVG (the `svg` column) colorable the same way: every closed
   shape becomes a region, in document order. */
export function colorable(svgMarkup){
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg || doc.querySelector('parsererror')) return svgMarkup;
  let i = 0;
  for (const el of svg.querySelectorAll('path, circle, ellipse, rect, polygon')) {
    if (el.closest('defs')) continue;
    el.classList.add('rg');
    el.setAttribute('data-i', String(i++));
    el.setAttribute('data-g', el.parentElement === svg ? 'x' : (el.parentElement.getAttribute('id') || 'x'));
    const fill = el.getAttribute('fill');
    if (!fill || fill === 'none') el.setAttribute('fill', '#fff');
  }
  if (!svg.getAttribute('fill') || svg.getAttribute('fill') === 'none') svg.setAttribute('fill', '#fff');
  svg.setAttribute('style', 'width:100%;height:auto;display:block');
  return new XMLSerializer().serializeToString(svg);
}
