/* =============================================================================
   Theraglee — one-touch coloring for the mandalas.
   -----------------------------------------------------------------------------
   Works on any SVG whose shapes carry class "rg" and a data-i index (see
   mandala.js). Tap a shape and it takes the chosen color; tap with the eraser
   and it goes back to white. "Whole ring" fills every shape in the same data-g
   group at once, which is what makes a mandala quick to color.

   State is a plain object { [index]: '#rrggbb' } so it can be saved anywhere
   (localStorage, mandala_colorings) and put back with apply().
   ============================================================================= */

export const BLANK = '#ffffff';

/* A calm palette. Muted enough to print well, bright enough to feel like color. */
export const PALETTE = [
  ['#F4B6C2', 'Blush'],   ['#E58A8A', 'Coral'],   ['#C94F4F', 'Brick'],
  ['#F6C98F', 'Peach'],   ['#E9A23B', 'Marigold'],['#F3E27A', 'Butter'],
  ['#C9DFA6', 'Mist'],    ['#8DC61D', 'Lime'],    ['#187C1A', 'Green'],
  ['#5C8A5E', 'Sage'],    ['#A8DCE0', 'Aqua'],    ['#4FA3C7', 'Sky'],
  ['#2E5E9E', 'Ocean'],   ['#8E7CC3', 'Lavender'],['#5B3F8C', 'Plum'],
  ['#D9A8D6', 'Lilac'],   ['#C8A27A', 'Sand'],    ['#7A5230', 'Cocoa'],
  ['#9AA39E', 'Stone'],   ['#2C3A32', 'Ink'],
];

export function colorbook(host, { onChange } = {}) {
  const svg = host.querySelector('svg');
  if (!svg) throw new Error('colorbook: no svg in host');
  const regions = [...svg.querySelectorAll('.rg')];
  const byIndex = new Map(regions.map(el => [el.dataset.i, el]));

  let color = PALETTE[0][0];
  let mode = 'fill';            // fill | erase
  let ring = false;             // color the whole ring at once
  const history = [];           // [{ i, from }] per tap, for undo

  svg.classList.add('coloring');
  svg.style.touchAction = 'manipulation';

  const paint = (el, c) => {
    const from = el.getAttribute('fill') || BLANK;
    if (from.toLowerCase() === c.toLowerCase()) return null;
    el.setAttribute('fill', c);
    return { i: el.dataset.i, from };
  };

  const fills = () => {
    const out = {};
    for (const el of regions) {
      const f = (el.getAttribute('fill') || BLANK).toLowerCase();
      if (f !== BLANK && f !== '#fff') out[el.dataset.i] = f;
    }
    return out;
  };

  const changed = () => onChange?.(fills(), { colored: Object.keys(fills()).length, total: regions.length });

  svg.addEventListener('click', (e) => {
    const el = e.target.closest?.('.rg');
    if (!el || !svg.contains(el)) return;
    e.preventDefault();
    const c = mode === 'erase' ? BLANK : color;
    const targets = ring ? regions.filter(r => r.dataset.g === el.dataset.g) : [el];
    const step = targets.map(t => paint(t, c)).filter(Boolean);
    if (!step.length) return;
    history.push(step);
    if (history.length > 200) history.shift();
    changed();
  });

  return {
    regions: regions.length,
    fills,
    setColor(c) { color = c; mode = 'fill'; },
    get color() { return color; },
    setMode(m) { mode = m; },
    get mode() { return mode; },
    setRing(on) { ring = !!on; },
    get ring() { return ring; },
    undo() {
      const step = history.pop();
      if (!step) return false;
      for (const { i, from } of step) byIndex.get(i)?.setAttribute('fill', from);
      changed();
      return true;
    },
    clear() {
      const step = regions.map(el => paint(el, BLANK)).filter(Boolean);
      if (!step.length) return;
      history.push(step);
      changed();
    },
    /* Put a saved coloring back. Does not touch undo history. */
    apply(saved) {
      for (const el of regions) el.setAttribute('fill', BLANK);
      for (const [i, c] of Object.entries(saved || {})) {
        if (/^#[0-9a-f]{6}$/i.test(c)) byIndex.get(String(i))?.setAttribute('fill', c);
      }
    },
    /* A PNG of the colored figure on white, for saving or sharing. */
    async toPNG(size = 1600) {
      const clone = svg.cloneNode(true);
      clone.classList.remove('coloring');
      clone.removeAttribute('style');
      clone.setAttribute('width', size); clone.setAttribute('height', size);
      const xml = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const img = await new Promise((ok, no) => {
          const im = new Image();
          im.onload = () => ok(im); im.onerror = () => no(new Error('render failed'));
          im.src = url;
        });
        const cv = document.createElement('canvas');
        cv.width = size; cv.height = size;
        const cx = cv.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, size, size);
        cx.drawImage(img, 0, 0, size, size);
        return await new Promise(ok => cv.toBlob(ok, 'image/png'));
      } finally { URL.revokeObjectURL(url); }
    },
  };
}

/* The palette as markup: one swatch per color, plus a custom color well. */
export function paletteHtml(current = PALETTE[0][0]) {
  return `<div class="swatches" role="radiogroup" aria-label="Colors">
    ${PALETTE.map(([c, name]) => `<button type="button" class="swatch${c === current ? ' on' : ''}"
        data-color="${c}" style="--c:${c}" role="radio" aria-checked="${c === current}"
        aria-label="${name}" title="${name}"></button>`).join('')}
    <label class="swatch custom" title="Pick any color">
      <input type="color" value="${current}" aria-label="Pick any color"><span>+</span></label>
  </div>`;
}
