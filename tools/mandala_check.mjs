#!/usr/bin/env node
/* Check shaped mandalas in a real browser, and pick seeds for new ones.

     node tools/mandala_check.mjs shape:seed ...          check these figures
     node tools/mandala_check.mjs shape ...               find a good seed for each shape
     node tools/mandala_check.mjs --png out.png shape ... also save a picture of the result
     node tools/mandala_check.mjs --preview out.png shape ...
                                                          just draw each shape with three seeds

   A figure passes when every region it draws can be tapped (something shows
   of it and the tap lands on it), every tap fills, nothing inside the outline
   is left uncolorable, and it has between 45 and 130 shapes to color. For a
   shape given without a seed, seeds are tried in order from a starting point
   derived from the shape's name until one passes; its line is printed as JSON
   and "ok": true.

   Uses the Playwright that is installed with Chromium in the cloud sessions
   (globally, or in the project). Nothing here touches the database. */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = join(ROOT, 'site');
const MIN = 45, MAX = 130;

const { mandala } = await import(pathToFileURL(join(SITE, 'assets/mandala.js')));
const { SHAPES } = await import(pathToFileURL(join(SITE, 'assets/mandala-shapes.js')));

async function playwright() {
  try { return await import('playwright'); } catch {}
  const g = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(join(g, 'playwright/index.mjs')));
}

/* ---------------------------------------------------------------- args */
const args = process.argv.slice(2);
let png = null, preview = null;
const wanted = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--png') png = args[++i];
  else if (args[i] === '--preview') preview = args[++i];
  else wanted.push(args[i]);
}
if (!wanted.length) {
  console.error('usage: node tools/mandala_check.mjs [--png out.png | --preview out.png] shape[:seed] ...');
  process.exit(2);
}
for (const w of wanted) {
  const shape = w.split(':')[0];
  if (!SHAPES[shape]) { console.error(`no outline named "${shape}" in site/assets/mandala-shapes.js`); process.exit(2); }
}

const regions = (shape, seed) => (mandala(seed, { shape }).match(/class="rg"/g) || []).length;
const startSeed = (shape) => 20001 + [...shape].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 40000, 7) * 7;

/* ------------------------------------------------------ a static server */
const PAGE = `<!doctype html><html><body style="margin:0;background:#eee">
<div id="h" style="width:800px"></div><div id="g" style="display:grid;grid-template-columns:repeat(3,300px);gap:6px;padding:6px"></div>
<script type="module">
import { mandala } from '/assets/mandala.js';
import { colorbook } from '/assets/coloring.js';
window.check = (shape, seed) => {
  const h = document.getElementById('h');
  h.innerHTML = mandala(seed, { shape });
  const book = colorbook(h);
  const regs = [...h.querySelectorAll('.rg')];
  const miss = [];
  for (const el of regs) {
    const b = el.getBoundingClientRect(); let hit = null;
    for (let gx = 0; gx <= 40 && !hit; gx++) for (let gy = 0; gy <= 40 && !hit; gy++) {
      const x = b.left + b.width * gx / 40, y = b.top + b.height * gy / 40;
      if (document.elementFromPoint(x, y) === el) hit = [x, y];
    }
    if (!hit) miss.push(+el.dataset.i);
    else document.elementFromPoint(...hit).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
  const svg = h.querySelector('svg'), sb = svg.getBoundingClientRect(), k = sb.width / 200;
  const outline = [...svg.querySelectorAll('clipPath path')];
  let gaps = 0;
  for (let x = 1; x < 200; x += 1.5) for (let y = 1; y < 200; y += 1.5) {
    const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    if (!outline.some(o => o.isPointInFill(pt))) continue;
    const el = document.elementFromPoint(sb.left + x * k, sb.top + y * k);
    if (!el?.classList.contains('rg')) gaps++;
  }
  h.innerHTML = '';
  return { regions: regs.length, untappable: miss, gaps, colored: Object.keys(book.fills()).length };
};
window.draw = (pairs) => {
  document.getElementById('g').innerHTML = pairs.map(([shape, seed]) =>
    '<div style="background:#fff;font:13px sans-serif;padding:4px">' + mandala(seed, { shape, title: shape })
    + '<div>' + shape + ' ' + seed + '</div></div>').join('');
};
window.ready = true;
</script></body></html>`;

const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/__check.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const file = resolve(join(SITE, path));
  if (!file.startsWith(SITE)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await playwright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 940, height: 900 } });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`${base}/__check.html`);
await page.waitForFunction(() => window.ready);

let failed = false;
try {
  if (preview) {
    const pairs = wanted.flatMap(w => [7, 2024, 555].map(s => [w.split(':')[0], s]));
    await page.evaluate(p => window.draw(p), pairs);
    await page.locator('#g').screenshot({ path: preview });
    console.log(`saved ${preview}`);
  } else {
    const chosen = [];
    for (const w of wanted) {
      const [shape, given] = w.split(':');
      const seeds = given ? [+given] : [];
      if (!given) for (let s = startSeed(shape), n = 0; n < 4000 && seeds.length < 60; s += 7, n++) {
        const r = regions(shape, s);
        if (r >= MIN && r <= MAX) seeds.push(s);
      }
      let pick = null;
      for (const seed of seeds) {
        const r = await page.evaluate(([a, b]) => window.check(a, b), [shape, seed]);
        const ok = r.untappable.length === 0 && r.gaps === 0 && r.colored === r.regions
          && r.regions >= MIN && r.regions <= MAX;
        if (given || ok) {
          console.log(JSON.stringify({ shape, seed, ok, ...r, untappable: r.untappable.length }));
          if (ok) pick = seed;
          break;
        }
      }
      if (pick == null) {
        failed = true;
        if (!given) console.log(JSON.stringify({ shape, ok: false, reason: 'no seed passed; rework the outline (see docs/mandalas.md)' }));
      } else chosen.push([shape, pick]);
    }
    if (png && chosen.length) {
      await page.evaluate(p => window.draw(p), chosen);
      await page.locator('#g').screenshot({ path: png });
      console.log(`saved ${png}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
