/* ==========================================================================
   Theraglee — the Discover browser: search, topic chips and the grid of the
   360 free discovery tools. Shared by discover.html and the Discover tab on
   the member dashboard, so both show the same thing.
   ========================================================================== */
import { esc } from './app.js';
import { library, isFavorite, isLater, favButton, statusBadge, bindLibrary,
         progressOf as memberProgress } from './library.js';
import { TOOLS, TOPICS } from './discover-tools.js';
import { loadState, progressOf, KIND_LABEL } from './discover.js';

/* Local (browser-only) status for anyone, member or not. Members also get the
   database-backed status via library.js, which is what the dashboard shows. */
export function localStatus(tool) {
  const s = loadState(tool.slug);
  if (s.finished) return 'completed';
  const p = progressOf(tool, s);
  return p.answered > 0 ? 'started' : 'not_started';
}
export const localBadge = (st) => st === 'completed' ? '<span class="badge done">Completed</span>'
  : st === 'started' ? '<span class="badge gray">In progress</span>' : '';

/**
 * Draws the tool browser into `root` and wires it up.
 *   topic     a topic to start filtered on, or '' for all
 *   onTopic   called with the topic when a chip is tapped (discover.html uses
 *             it to keep the address in step); optional
 * Returns { render } so the caller can repaint after progress changes.
 */
export async function mountDiscover(root, { topic = '', onTopic = null } = {}) {
  let lib = await library();
  let term = '';
  const id = 'disc-q-' + Math.random().toString(36).slice(2, 8);
  root.innerHTML = `
    <div class="card" style="margin:0 0 26px">
      <div class="field" style="margin-bottom:14px">
        <label for="${id}">What would help you today?</label>
        <input id="${id}" data-q type="text" placeholder="Try “sleep”, “boundaries”, “anger”…">
      </div>
      <div class="chips" data-topics>
        <button class="chip ${topic ? '' : 'on'}" data-t="">All topics</button>
        ${TOPICS.map(t => `<button class="chip ${topic === t ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>
    <p class="faint" data-count></p>
    <div class="grid g3" data-results></div>
    <div class="notice warn" style="margin-top:34px">These tools are for self-reflection. They cannot identify any condition,
      and they are not a substitute for care from a licensed professional. If you are in crisis, call or text
      <a href="tel:988">988</a>.</div>`;
  const $  = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  function render() {
    const t = term.trim().toLowerCase();
    const list = TOOLS.filter(r => (!topic || r.topic === topic) &&
      (!t || (r.title + ' ' + r.description + ' ' + r.topic + ' ' + r.tags.join(' ') + ' ' + KIND_LABEL[r.kind]).toLowerCase().includes(t)));
    $('[data-count]').textContent =
      `${list.length} tool${list.length === 1 ? '' : 's'}${topic ? ` about ${topic.toLowerCase()}` : ''}`;
    $('[data-results]').innerHTML = list.length ? list.map(r => {
      const p = lib.authenticated ? memberProgress(lib, 'discover', r.id) : null;
      const badge = p ? statusBadge(p) : localBadge(localStatus(r));
      return `<a class="tile" href="discover.html?slug=${encodeURIComponent(r.slug)}">
        ${favButton('discover', r.id, isFavorite(lib, 'discover', r.id), { size: 20, label: false })}
        <h3>${esc(r.title)}</h3>
        <p class="meta" style="color:var(--muted)">${esc(r.description.slice(0, 120))}${r.description.length > 120 ? '…' : ''}</p>
        <span class="meta">${esc(KIND_LABEL[r.kind])} · ${esc(r.topic)} · ${r.minutes} min</span>
        <div class="row" style="gap:7px;margin-top:2px">${badge}${lib.authenticated && isLater(lib, 'discover', r.id) ? '<span class="badge gray">Saved for later</span>' : ''}</div>
      </a>`;
    }).join('') : '<div class="empty" style="grid-column:1/-1">Nothing matches that yet. Try a different word.</div>';
  }
  $('[data-q]').addEventListener('input', e => { term = e.target.value; render(); });
  $$('[data-topics] .chip').forEach(c => c.addEventListener('click', () => {
    $$('[data-topics] .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); topic = c.dataset.t;
    onTopic?.(topic);
    render();
  }));
  bindLibrary($('[data-results]'), () => render());
  render();

  /* Coming back with the Back button often restores this page from the
     browser's cache exactly as it was, so a tool finished in the meantime
     would still show no badge. Re-read progress and repaint the list. */
  window.addEventListener('pageshow', async (e) => {
    if (!e.persisted) return;
    if (lib.authenticated) lib = await library(true);
    render();
  });

  return { render };
}
