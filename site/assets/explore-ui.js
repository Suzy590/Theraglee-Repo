/* ==========================================================================
   Theraglee — the library browser: search, filters and the results grid.
   Shared by explore.html and the Explore Library tab on the member dashboard,
   so both show the same thing and are maintained in one place.
   ========================================================================== */
import { sb, esc, tierName, unlockHref } from './app.js';
import { library, isFavorite, isLater, favButton, statusBadge,
         bindLibrary, progressOf } from './library.js';
import { TOOLS } from './discover-tools.js';
import { SETS as TRIVIA } from './trivia-sets.js';

const HREF = {
  discover:  r => `discover.html?slug=${encodeURIComponent(r.slug)}`,
  quiz:      r => `quiz.html?slug=${encodeURIComponent(r.slug)}`,
  worksheet: r => `worksheet.html?slug=${encodeURIComponent(r.slug)}`,
  checklist: r => `checklist.html?slug=${encodeURIComponent(r.slug)}`,
  challenge: r => `challenges.html?template=${encodeURIComponent(r.slug)}`,
  article:   r => `articles/${encodeURIComponent(r.slug)}`,
  mandala:   r => `mandalas.html?slug=${encodeURIComponent(r.slug)}`,
  trivia:    r => `trivia.html?slug=${encodeURIComponent(r.slug)}`,
};
const LABEL = { discover:'Discovery tool', quiz:'Quiz', worksheet:'Worksheet', checklist:'Checklist',
                challenge:'Challenge', article:'Article', mandala:'Mandala', trivia:'Trivia' };
// "3 items in quizzes", not "quizs".
const PLURAL = { discover:'discovery tools', quiz:'quizzes', worksheet:'worksheets', checklist:'checklists',
                 challenge:'challenges', article:'articles', mandala:'mandalas', trivia:'trivia quizzes' };

const SHELL = `
  <div class="card" style="margin:0 0 26px">
    <div class="field" style="margin-bottom:14px">
      <label for="__Q__">Search</label>
      <input id="__Q__" data-q type="text" placeholder="Try “anxiety”, “gratitude”, “sleep”…">
    </div>
    <div class="chips" data-types>
      <button class="chip on" data-t="">Everything</button>
      <button class="chip" data-t="discover">Free discovery tools</button>
      <button class="chip" data-t="quiz">Quizzes</button>
      <button class="chip" data-t="worksheet">Worksheets</button>
      <button class="chip" data-t="checklist">Checklists</button>
      <button class="chip" data-t="challenge">Challenges</button>
      <button class="chip" data-t="article">Articles</button>
      <button class="chip" data-t="mandala">Mandalas</button>
      <button class="chip" data-t="trivia">Trivia</button>
    </div>
    <div class="chips" data-tiers style="margin-top:12px">
      <button class="chip on" data-l="">Any tier</button>
      <button class="chip" data-l="unlocked">Available to me</button>
    </div>
    <!-- Member-only views; hidden for signed-out visitors. -->
    <div class="chips hide" data-views style="margin-top:12px">
      <button class="chip" data-v="favorite">Favorites</button>
      <button class="chip" data-v="later">Saved for later</button>
      <button class="chip" data-v="started">In progress</button>
      <button class="chip" data-v="completed">Completed</button>
    </div>
  </div>
  <p class="faint" data-count></p>
  <div class="grid g3" data-results>
    <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
  </div>`;

/**
 * Draws the library into `root` and wires it up.
 *   a     the access object from chrome() or requireAuth()
 *   type  a kind to start filtered on (quiz, worksheet, …), or '' for everything
 *   view  a member view to start on (favorite, later, started, completed), or ''
 */
export async function mountLibrary(root, a, { type = '', view = '' } = {}) {
  // One search box per mount, so the label points at the right one when two share a page.
  root.innerHTML = SHELL.replaceAll('__Q__', 'lib-q-' + Math.random().toString(36).slice(2, 8));
  const $  = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  // The 360 discovery tools live in the site itself (assets/discover-tools.js),
  // not in the database, so they are free for every visitor. They are shaped like
  // catalog rows here so the filters, favorites and progress treat them the same.
  const discoverRows = TOOLS.map(t => ({
    kind: 'discover', id: t.id, slug: t.slug, title: t.title, description: t.description,
    category: t.topic, tags: t.tags, min_level: 0,
  }));

  // The 150 trivia quizzes ship with the site too (assets/trivia-sets.js). They are
  // Basic, so they carry min_level 2 and lock like any catalog row.
  const triviaRows = TRIVIA.map(t => ({
    kind: 'trivia', id: t.id, slug: t.slug, title: t.title, description: t.description,
    category: t.topic, tags: t.tags, min_level: 2,
  }));

  const { data: rows, error } = await sb.from('content_catalog').select('*');
  const lib = await library();
  if (lib.authenticated) $('[data-views]').classList.remove('hide');
  if (error) console.error(error);
  const all = [...discoverRows, ...(rows || []), ...triviaRows];

  let term = '', onlyMine = false;
  if (type) $$('[data-types] .chip').forEach(c => c.classList.toggle('on', c.dataset.t === type));
  if (view) $(`[data-views] .chip[data-v="${view}"]`)?.classList.add('on');

  function render(){
    const t = term.trim().toLowerCase();
    const list = all.filter(r =>
      (!type || r.kind === type) &&
      (!onlyMine || r.min_level <= a.level) &&
      (!view ||
        (view === 'favorite' && isFavorite(lib, r.kind, r.id)) ||
        (view === 'later'    && isLater(lib, r.kind, r.id))    ||
        (view === 'started'  && progressOf(lib, r.kind, r.id)?.status === 'started') ||
        (view === 'completed'&& progressOf(lib, r.kind, r.id)?.status === 'completed')) &&
      (!t || (r.title + ' ' + (r.description||'') + ' ' + (r.tags||[]).join(' ')).toLowerCase().includes(t))
    ).sort((x,y) => x.min_level - y.min_level || x.title.localeCompare(y.title));

    $('[data-count]').textContent =
      `${list.length} item${list.length===1?'':'s'}${type?` in ${PLURAL[type]}`:''}`;

    $('[data-results]').innerHTML = list.length
      ? list.map(r => {
          const locked = r.min_level > a.level;
          const href = locked ? unlockHref(r.min_level, a.authenticated) : HREF[r.kind](r);
          const p = progressOf(lib, r.kind, r.id);
          const pct = p && p.total ? Math.round(Math.min(1, p.answered / p.total) * 100) : 0;
          return `<a class="tile ${locked?'locked':''}" href="${href}">
            ${locked ? '' : favButton(r.kind, r.id, isFavorite(lib, r.kind, r.id), { size:20, label:false })}
            <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
              <h3>${esc(r.title)}</h3>
              ${locked ? `<span class="badge lock">${tierName(r.min_level)}</span>` : ''}
            </div>
            ${r.description ? `<p class="meta" style="color:var(--muted)">${esc(String(r.description).slice(0,120))}${String(r.description).length>120?'…':''}</p>` : ''}
            <span class="meta">${LABEL[r.kind]}${r.category && r.category!==LABEL[r.kind] ? ' · '+esc(r.category) : ''}</span>
            <div class="row" style="gap:7px;margin-top:2px">
              ${statusBadge(p)}${isLater(lib, r.kind, r.id) ? '<span class="badge gray">Saved for later</span>' : ''}
            </div>
            ${pct ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ''}
          </a>`;
        }).join('')
      : `<div class="empty" style="grid-column:1/-1">Nothing matches that yet. Try a different word.</div>`;
  }

  $('[data-q]').addEventListener('input', e => { term = e.target.value; render(); });
  $$('[data-types] .chip').forEach(c => c.addEventListener('click', () => {
    $$('[data-types] .chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on'); type = c.dataset.t; render();
  }));
  $$('[data-tiers] .chip').forEach(c => c.addEventListener('click', () => {
    $$('[data-tiers] .chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on'); onlyMine = c.dataset.l === 'unlocked'; render();
  }));

  bindLibrary($('[data-results]'), () => render());

  $$('[data-views] .chip').forEach(c => c.addEventListener('click', () => {
    const was = view === c.dataset.v;
    $$('[data-views] .chip').forEach(x => x.classList.remove('on'));
    view = was ? '' : c.dataset.v;
    if (!was) c.classList.add('on');
    render();
  }));

  render();
  return { render };
}
