/* Deterministic mandala line-art. Same seed always draws the same figure, so a
   member can print the one they were coloring, or come back to it online.

   Every closed shape is a region: an element with class "rg", a stable index
   in data-i (the order the shapes are drawn, so a saved coloring maps back to
   the same shapes) and a ring group in data-g (so "color the whole ring" can
   find its siblings). Regions start white, which is what prints. The bands
   between the rings are regions too, so every tap inside the mandala lands on
   something that can take a color. */

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

export function mandala(seed, { stroke = '#16241C', width = 1.1, title = '' } = {}){
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
