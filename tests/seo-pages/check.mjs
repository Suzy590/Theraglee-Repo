// Checks on the generated search landing pages. Run from the repo root:
//   node tests/seo-pages/check.mjs
// Fails (exit 1) if an article has no generated page, a generated page is
// missing from the sitemap, a page has more or fewer than one <h1>, a page's
// structured data does not parse, or a hand-written FAQ question is not on
// the page it describes. The fix is almost always:
//   python3 tools/build_seo_pages.py
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const exists = (p) => existsSync(new URL(p, root));

const SEO = JSON.parse(read('data/seo-pages.json'));
const ARTICLES = JSON.parse(read('data/articles.json'));
const SITEMAP = read('site/sitemap.xml');
const site = SEO.site.replace(/\/$/, '');

const errors = [];
const err = (m) => errors.push(m);

const paths = [
  ...SEO.pages.map((p) => p.path),
  ...ARTICLES.map((a) => `articles/${a.slug}`),
  'tools/quizzes',
  'tools/worksheets',
  ...(SEO.cities || []).map((c) => c.path),
];

const seen = new Set();
for (const path of paths) {
  if (seen.has(path)) err(`${path}: two pages claim this URL`);
  seen.add(path);
  const file = `site/${path}/index.html`;
  if (!exists(file)) { err(`${path}: no ${file}; run python3 tools/build_seo_pages.py`); continue; }
  const html = read(file);
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) err(`${path}: ${h1s.length} <h1> elements, expected one`);
  if (!html.includes(`<link rel="canonical" href="${site}/${path}">`)) err(`${path}: canonical does not match its URL`);
  if (!html.includes('<base href="/">')) err(`${path}: missing <base href="/">, so relative links would break`);
  for (const [, body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(body.replace(/<\\\//g, '</')); } catch (e) { err(`${path}: structured data does not parse (${e.message})`); }
  }
  if (!SITEMAP.includes(`<loc>${site}/${path}</loc>`)) err(`${path}: not in site/sitemap.xml`);
}

// Every article page carries the article's own title and text, so a search
// engine indexes the words and not an empty shell.
for (const a of ARTICLES) {
  const file = `site/articles/${a.slug}/index.html`;
  if (!exists(file)) continue;
  const html = read(file);
  const first = String(a.body_md).split(/\n\s*\n/)[0].trim().slice(0, 40)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  if (!html.includes(first)) err(`articles/${a.slug}: the page does not carry the article text; rebuild it`);
}

// A hand-written FAQ answer that is not on the page would be structured data
// describing something a visitor cannot read.
for (const p of SEO.pages) {
  const file = `site/${p.path}/index.html`;
  if (!exists(file)) continue;
  const html = read(file);
  for (const f of p.faq || []) {
    const q = f.q.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    if (!html.includes(`<summary>${q}</summary>`)) err(`${p.path}: FAQ question not visible on the page: ${f.q}`);
  }
}

// The sitemap lists nothing that is not served.
for (const [, loc] of SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const rel = loc.replace(`${site}/`, '');
  if (rel === '' ) continue;
  if (rel.endsWith('.html')) { if (!exists(`site/${rel}`)) err(`sitemap: site/${rel} does not exist`); }
  else if (!exists(`site/${rel}/index.html`)) err(`sitemap: site/${rel}/index.html does not exist`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const urls = (SITEMAP.match(/<loc>/g) || []).length;
console.log(`ok: ${paths.length} generated pages, ${urls} sitemap urls`);
