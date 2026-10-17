// Checks on the generated search landing pages. Run from the repo root:
//   node tests/seo-pages/check.mjs
// Fails (exit 1) if an article, topic, challenge, checklist or Discover topic
// has no generated page, a generated page is missing from the sitemap, a page
// has more or fewer than one <h1>, a page's structured data does not parse, a
// hand-written FAQ question is not on the page it describes, a description is
// too short or too long for a search result, a page has no share image, or a
// public page at the site root lacks its canonical and share tags. The fix is
// almost always:
//   python3 tools/build_seo_pages.py
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const exists = (p) => existsSync(new URL(p, root));

const SEO = JSON.parse(read('data/seo-pages.json'));
const ARTICLES = JSON.parse(read('data/articles.json'));
const CHALLENGES = JSON.parse(read('data/challenges.json'));
const CHECKLISTS = JSON.parse(read('data/checklists.json'));
const SITEMAP = read('site/sitemap.xml');
const site = SEO.site.replace(/\/$/, '');

// The same slug rule as tag_slug() in the generator.
const slug = (s) => String(s).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const tags = new Set(ARTICLES.flatMap((a) => a.tags));
const { TOPICS } = await import(new URL('site/assets/discover-tools.js', root));

const errors = [];
const err = (m) => errors.push(m);
const unescape = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const paths = [
  ...SEO.pages.map((p) => p.path),
  ...ARTICLES.map((a) => `articles/${a.slug}`),
  'articles/topics',
  ...[...tags].map((t) => `articles/topics/${slug(t)}`),
  'tools/quizzes',
  'tools/worksheets',
  'tools/journal-prompts',
  'challenges/themes',
  ...CHALLENGES.map((c) => `challenges/${c.slug}`),
  'checklists',
  ...CHECKLISTS.map((c) => `checklists/${c.slug}`),
  'discover/topics',
  ...TOPICS.map((t) => `discover/${slug(t)}`),
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
  if (!html.includes('<meta property="og:image" content="')) err(`${path}: no og:image, so a shared link shows no picture`);
  if (!html.includes('"@type": "BreadcrumbList"')) err(`${path}: no BreadcrumbList structured data`);
  const desc = unescape(html.match(/<meta name="description" content="([^"]*)">/)?.[1] ?? '');
  if (desc.length < 50) err(`${path}: description is ${desc.length} characters; write at least 50`);
  if (desc.length > 165) err(`${path}: description is ${desc.length} characters; keep it under 165`);
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
  for (const t of a.tags) {
    if (!html.includes(`href="/articles/topics/${slug(t)}"`)) err(`articles/${a.slug}: no link to the ${t} topic hub`);
  }
}

// A topic hub lists every article that carries its tag; a challenge page
// carries its first week; a checklist page carries every item.
for (const t of tags) {
  const file = `site/articles/topics/${slug(t)}/index.html`;
  if (!exists(file)) continue;
  const html = read(file);
  for (const a of ARTICLES.filter((a) => a.tags.includes(t))) {
    if (!html.includes(`href="/articles/${a.slug}"`)) err(`articles/topics/${slug(t)}: does not list ${a.slug}`);
  }
}
const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
for (const c of CHALLENGES) {
  const file = `site/challenges/${c.slug}/index.html`;
  if (!exists(file)) continue;
  const html = read(file);
  for (const task of (c.tasks || []).slice(0, 7)) {
    if (!html.includes(escape(task))) { err(`challenges/${c.slug}: the first week is not on the page; rebuild it`); break; }
  }
  if (/streak/i.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) err(`challenges/${c.slug}: mentions streaks`);
}
for (const c of CHECKLISTS) {
  const file = `site/checklists/${c.slug}/index.html`;
  if (!exists(file)) continue;
  const html = read(file);
  for (const item of c.items || []) {
    if (!html.includes(escape(item))) { err(`checklists/${c.slug}: an item is missing from the page; rebuild it`); break; }
  }
}

// A hand-written FAQ answer that is not on the page would be structured data
// describing something a visitor cannot read.
for (const p of SEO.pages) {
  const file = `site/${p.path}/index.html`;
  if (!exists(file)) continue;
  const html = read(file);
  for (const f of p.faq || []) {
    if (!html.includes(`<summary>${escape(f.q)}</summary>`)) err(`${p.path}: FAQ question not visible on the page: ${f.q}`);
  }
}

// The sitemap lists nothing that is not served, and no generated folder is
// left out of it.
for (const [, loc] of SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const rel = loc.replace(`${site}/`, '');
  if (rel === '' ) continue;
  if (rel.endsWith('.html')) { if (!exists(`site/${rel}`)) err(`sitemap: site/${rel} does not exist`); }
  else if (!exists(`site/${rel}/index.html`)) err(`sitemap: site/${rel}/index.html does not exist`);
}
for (const folder of ['articles', 'articles/topics', 'challenges', 'checklists', 'discover', 'tools']) {
  if (!exists(`site/${folder}`)) continue;
  for (const name of readdirSync(new URL(`site/${folder}`, root))) {
    const rel = `${folder}/${name}`;
    if (exists(`site/${rel}/index.html`) && !seen.has(rel)) err(`site/${rel}/index.html: a page no source row asks for; delete it or run the build`);
  }
}

// Every public page at the site root carries a canonical, a description and
// the share image, and the pages that only forward or hold member tools say
// noindex.
for (const [, loc] of SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const rel = loc.replace(`${site}/`, '');
  if (seen.has(rel)) continue; // generated pages are checked above
  const file = rel === '' ? 'site/index.html' : rel.endsWith('.html') ? `site/${rel}` : `site/${rel}/index.html`;
  if (!exists(file)) continue;
  const html = read(file);
  const canonical = rel === '' ? `${site}/` : `${site}/${rel}`;
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) err(`${file}: canonical should be ${canonical}`);
  if (!/<meta name="description" content="[^"]{50,}">/.test(html)) err(`${file}: no description of at least 50 characters`);
  if (!html.includes(`${site}/assets/social-card.png`)) err(`${file}: no og:image share tag`);
  if (/name="robots" content="noindex"/.test(html)) err(`${file}: is in the sitemap but says noindex`);
}
for (const shell of ['journal.html', 'goals.html', 'quiz.html', 'worksheet.html', 'checklist.html']) {
  if (!/name="robots" content="noindex"/.test(read(`site/${shell}`))) err(`site/${shell}: a member-only shell should say noindex`);
}
if (!exists('site/assets/social-card.png')) err('site/assets/social-card.png is missing; run python3 tools/social_card.py');

// llms.txt points only at pages that exist.
if (!exists('site/llms.txt')) err('site/llms.txt is missing; run python3 tools/build_seo_pages.py');
else {
  for (const [, url] of read('site/llms.txt').matchAll(/\]\((https?:[^)]+)\)/g)) {
    const rel = url.replace(`${site}/`, '').split('?')[0];
    if (rel === '' || rel === 'sitemap.xml') continue;
    const ok = rel.endsWith('.html') ? exists(`site/${rel}`) : exists(`site/${rel}/index.html`);
    if (!ok) err(`llms.txt: ${url} is not a page on the site`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}
const urls = (SITEMAP.match(/<loc>/g) || []).length;
console.log(`ok: ${paths.length} generated pages, ${urls} sitemap urls, ${tags.size} topic hubs`);
