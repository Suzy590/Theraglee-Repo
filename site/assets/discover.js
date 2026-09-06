/* =============================================================================
   Theraglee — Discover: the engine behind the free self-discovery tools.
   -----------------------------------------------------------------------------
   Every tool in discover-tools.js is data. This module turns that data into an
   interactive activity, keeps its state, and writes the reflection shown at the
   end. It has no imports on purpose, so it can be exercised in a plain browser
   fixture without Supabase; the page (discover.html) wires it to app.js.

   Interaction kinds
     reflect   rate statements on a five-point frequency scale
     sliders   set several 0–10 dials and compare them
     sort      place items into two or three buckets
     pick      choose a handful of cards, then rank them
     prompts   answer a short sequence of writing prompts
     check     tick the observations that fit, see a tally
     breathe   a paced breathing animation
     guide     a step-by-step exercise, some steps timed
     track     a seven-day log of one to three measures
     wheel     narrow a feeling from a broad word to a precise one
     build     assemble a personal plan from options, add your own
     flip      turn cards over and keep the ones that help
     matrix    place items in a two-by-two grid
     rank      order items from first to last
     allocate  divide 100 points across categories
     heat      mark when something happens across a week

   Nothing here scores, diagnoses, or labels anyone. Every summary is written as
   "what you noticed", and the closing note points to a licensed professional.
   ============================================================================= */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const KIND_LABEL = {
  reflect: 'Reflection', sliders: 'Dials', sort: 'Sorter', pick: 'Card pick',
  prompts: 'Guided writing', check: 'Noticing list', breathe: 'Breathing', guide: 'Guided exercise',
  track: '7-day log', wheel: 'Feelings wheel', build: 'Plan builder', flip: 'Perspective cards',
  matrix: 'Grid', rank: 'Ranking', allocate: 'Budget', heat: 'Week map',
};

export const DEFAULT_SCALE = ['Never', 'Rarely', 'Sometimes', 'Often', 'Almost always'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
const band = (bands, p) => bands.find(b => p <= b.upTo) || bands[bands.length - 1];
const label = (c) => typeof c === 'string' ? c : c.label;
const hint  = (c) => typeof c === 'string' ? '' : (c.hint || '');
const dayKey = (d) => d.toISOString().slice(0, 10);

/* ----------------------------------------------------------------- storage */
export const storeKey = (slug) => 'tg.discover.' + slug;
export function loadState(slug) {
  try { return JSON.parse(localStorage.getItem(storeKey(slug)) || 'null') || {}; }
  catch { return {}; }
}
export function saveState(slug, state) {
  try { localStorage.setItem(storeKey(slug), JSON.stringify(state)); } catch {}
}
export function clearState(slug) {
  try { localStorage.removeItem(storeKey(slug)); } catch {}
}

/* ---------------------------------------------------------------- progress */
/** { answered, total } for any tool, so the page can show Started / Completed. */
export function progressOf(tool, state = {}) {
  const t = tool, s = state;
  switch (t.kind) {
    case 'reflect':  return { answered: Object.keys(s.a || {}).length, total: t.items.length };
    case 'sliders':  return { answered: Object.keys(s.touched || {}).length, total: t.dims.length };
    case 'sort':     return { answered: Object.keys(s.b || {}).length,
                              total: Math.max(1, t.items.length + (s.extra || []).length) };
    case 'pick':     return { answered: Math.min((s.p || []).length, t.max), total: t.max };
    case 'prompts':  return { answered: t.steps.filter((_, i) => (s.t?.[i] || '').trim()).length,
                              total: t.steps.length };
    case 'check':    return { answered: Object.keys(s.k || {}).length ? 1 : 0, total: 1 };
    case 'breathe':  return { answered: Math.min(s.c || 0, t.cycles), total: t.cycles };
    case 'guide':    return { answered: (s.done || []).length, total: t.steps.length };
    case 'track':    return { answered: Math.min(Object.keys(s.d || {}).length, 7), total: 7 };
    case 'wheel':    return { answered: [s.c != null, (s.w || []).length, (s.b || []).length, s.n != null]
                                .filter(Boolean).length, total: 4 };
    case 'build':    return { answered: t.groups.filter((_, i) => (s.g?.[i] || []).length).length,
                              total: t.groups.length };
    case 'flip':     return { answered: Object.keys(s.r || {}).length, total: t.cards.length };
    case 'matrix':   return { answered: Object.keys(s.q || {}).length,
                              total: Math.max(1, (t.items || []).length + (s.extra || []).length) };
    case 'rank':     return { answered: s.done ? t.items.length : (s.moved ? 1 : 0), total: t.items.length };
    case 'allocate': return { answered: Object.keys(s.v || {}).length, total: t.cats.length };
    case 'heat':     return { answered: new Set(Object.keys(s.g || {}).map(k => k.split('-')[0])).size,
                              total: (t.rows || DAYS).length };
    default:         return { answered: 0, total: 1 };
  }
}

/** Whether the "See my reflection" button should be enabled. */
export function ready(tool, state = {}) {
  const p = progressOf(tool, state);
  switch (tool.kind) {
    case 'pick':     return (state.p || []).length >= (tool.min || 1);
    case 'prompts':  return p.answered >= 1;
    case 'check':    return true;
    case 'breathe':  return (state.c || 0) >= 1;
    case 'guide':    return p.answered >= p.total;
    case 'track':    return p.answered >= 1;
    case 'wheel':    return state.c != null && (state.w || []).length >= 1;
    case 'build':    return p.answered >= 1;
    case 'rank':     return true;
    case 'allocate': return total(state) === 100;
    case 'heat':     return Object.keys(state.g || {}).length >= 1;
    case 'sort': case 'matrix': case 'reflect': case 'sliders': case 'flip':
      return p.answered >= p.total;
    default: return p.answered >= 1;
  }
}
const total = (s) => Object.values(s.v || {}).reduce((a, b) => a + Number(b || 0), 0);

/* ---------------------------------------------------------------- mounting */
/**
 * Render `tool` into `host`.
 *   opts.state      previously saved state (from loadState)
 *   opts.onChange   (state) => void, called after every interaction
 *   opts.onFinish   (state) => void, called when the reflection is shown
 * Returns { state, rerender }.
 */
export function mount(host, tool, opts = {}) {
  const state = opts.state || {};
  const api = {
    state,
    save() { opts.onChange?.(state); },
    rerender() { paint(); },
    finish() { state.finished = true; api.save(); opts.onFinish?.(state); paint(); },
    restart() { for (const k of Object.keys(state)) delete state[k]; api.save(); paint(); },
  };

  function paint() {
    if (state.finished) {
      host.innerHTML = `<div class="d-result">
          <span class="badge">What you noticed</span>
          ${summaryOf(tool, state)}
          ${tool.ask ? `<div class="d-ask"><strong>Worth sitting with:</strong> ${esc(tool.ask)}</div>` : ''}
        </div>
        <div class="notice warn d-legal">This is a way to notice your own patterns, not a diagnosis or
          a treatment. Nothing here can tell you whether you have a condition. If something you
          noticed worries you, a licensed professional can help you make sense of it.</div>
        <div class="row no-print d-actions">
          <a class="btn" href="discover.html">Try another tool</a>
          <button class="btn ghost" type="button" data-act="print">Print</button>
          <button class="btn ghost" type="button" data-act="restart">Start over</button>
          <a class="btn ghost" href="therapists.html">Find a therapist</a>
        </div>`;
      host.querySelector('[data-act="print"]').onclick = () => window.print();
      host.querySelector('[data-act="restart"]').onclick = () => api.restart();
      return;
    }
    host.innerHTML = '';
    const body = document.createElement('div');
    body.className = 'd-body d-' + tool.kind;
    host.appendChild(body);
    (RENDER[tool.kind] || RENDER.missing)(body, tool, api);

    const foot = document.createElement('div');
    foot.className = 'row d-foot no-print';
    const p = progressOf(tool, state);
    const okay = ready(tool, state);
    foot.innerHTML = `<span class="faint d-prog">${footText(tool, p, state)}</span>
      <button class="btn lg" type="button" data-act="finish" ${okay ? '' : 'disabled'}>${finishLabel(tool)}</button>`;
    foot.querySelector('[data-act="finish"]').onclick = () => api.finish();
    host.appendChild(foot);
  }

  paint();
  return { state, rerender: paint };
}

function footText(tool, p, state) {
  switch (tool.kind) {
    case 'pick':     return `${p.answered} of ${tool.max} chosen`;
    case 'breathe':  return `${Math.min(state.c || 0, tool.cycles)} of ${tool.cycles} rounds`;
    case 'track':    return `${p.answered} of 7 days logged`;
    case 'check':    return '';
    case 'rank':     return state.moved ? 'Order changed' : 'Move items until the order feels right';
    case 'allocate': return `${total(state)} of 100 points placed`;
    case 'heat':     return `${Object.keys(state.g || {}).length} time${Object.keys(state.g || {}).length === 1 ? '' : 's'} marked`;
    case 'wheel':    return `Step ${p.answered} of 4`;
    default:         return `${p.answered} of ${p.total}`;
  }
}
function finishLabel(tool) {
  switch (tool.kind) {
    case 'breathe': case 'guide': return 'Finish';
    case 'build': return 'See my plan';
    case 'track': return 'See the week so far';
    case 'prompts': return 'Read it back';
    default: return 'See what I noticed';
  }
}

/* ============================================================== renderers */
const RENDER = {};

RENDER.missing = (el, tool) => {
  el.innerHTML = `<div class="empty">This tool (${esc(tool.kind)}) is not available yet.</div>`;
};

/* ---- reflect: rate statements ------------------------------------------- */
RENDER.reflect = (el, tool, api) => {
  const scale = tool.scale || DEFAULT_SCALE;
  const s = api.state; s.a ||= {};
  el.innerHTML = `<p class="faint d-instr">For each line, choose how often it has been true for you lately.
      There are no right answers; go with your first instinct.</p>` +
    tool.items.map((it, i) => `
      <div class="d-item" data-i="${i}">
        <p>${esc(it)}</p>
        <div class="chips">${scale.map((lab, v) =>
          `<button type="button" class="chip ${s.a[i] === v ? 'on' : ''}" data-v="${v}">${esc(lab)}</button>`).join('')}
        </div>
      </div>`).join('');
  el.querySelectorAll('.d-item').forEach(row => row.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    s.a[row.dataset.i] = Number(b.dataset.v);
    row.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
    api.save(); refreshFoot(el, tool, api);
  }));
};

/* ---- sliders: 0–10 dials --------------------------------------------------- */
RENDER.sliders = (el, tool, api) => {
  const s = api.state; s.v ||= {}; s.touched ||= {};
  el.innerHTML = `<p class="faint d-instr">Slide each one to where it sits for you right now.
      Touch every dial, even the ones that stay in the middle.</p>` +
    tool.dims.map((d, i) => {
      const v = s.v[i] ?? 5;
      return `<div class="d-dial ${s.touched[i] ? 'touched' : ''}" data-i="${i}">
        <div class="spread"><label>${esc(label(d))}</label><span class="d-val">${v}</span></div>
        ${hint(d) ? `<p class="help" style="margin:0 0 6px">${esc(hint(d))}</p>` : ''}
        <input type="range" min="0" max="10" step="1" value="${v}" aria-label="${esc(label(d))}">
        <div class="spread faint d-ends"><span>${esc(d.low || 'Not at all')}</span><span>${esc(d.high || 'Completely')}</span></div>
      </div>`;
    }).join('');
  el.querySelectorAll('.d-dial').forEach(row => {
    const inp = row.querySelector('input');
    const mark = () => {
      s.v[row.dataset.i] = Number(inp.value); s.touched[row.dataset.i] = true;
      row.classList.add('touched'); row.querySelector('.d-val').textContent = inp.value;
      api.save(); refreshFoot(el, tool, api);
    };
    inp.addEventListener('input', mark);
    inp.addEventListener('change', mark);
    inp.addEventListener('click', mark);
  });
};

/* ---- sort: items into buckets ------------------------------------------- */
RENDER.sort = (el, tool, api) => {
  const s = api.state; s.b ||= {}; s.extra ||= [];
  const all = [...tool.items, ...s.extra];
  el.innerHTML = `<p class="faint d-instr">Tap a label for each one. ${esc(tool.instr || 'Go with what is true most of the time, not on your best or worst day.')}</p>
    <div class="d-legend">${tool.buckets.map(b => `<span class="badge gray">${esc(b.label)}</span>${b.hint ? `<span class="faint">${esc(b.hint)}</span>` : ''}`).join('')}</div>` +
    all.map((it, i) => `
      <div class="d-item d-sortrow ${s.b[i] != null ? 'placed' : ''}" data-i="${i}">
        <p>${esc(it)}</p>
        <div class="chips">${tool.buckets.map(b =>
          `<button type="button" class="chip ${s.b[i] === b.key ? 'on' : ''}" data-k="${esc(b.key)}">${esc(b.label)}</button>`).join('')}
        </div>
      </div>`).join('') +
    (tool.custom ? `<div class="d-add"><input type="text" placeholder="${esc(tool.customPlaceholder || 'Add one of your own…')}" maxlength="120">
        <button type="button" class="btn sm ghost">Add</button></div>` : '');
  el.querySelectorAll('.d-sortrow').forEach(row => row.addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    s.b[row.dataset.i] = b.dataset.k; row.classList.add('placed');
    row.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
    api.save(); refreshFoot(el, tool, api);
  }));
  wireAdd(el, (txt) => { s.extra.push(txt); api.save(); api.rerender(); });
};

/* ---- pick: choose cards, then rank -------------------------------------- */
RENDER.pick = (el, tool, api) => {
  const s = api.state; s.p ||= [];
  const full = s.p.length >= tool.max;
  el.innerHTML = `<p class="faint d-instr">${esc(tool.instr || `Choose up to ${tool.max}. Tap again to un-choose.`)}</p>
    <div class="d-cards">${tool.cards.map((c, i) => {
      const on = s.p.includes(i);
      return `<button type="button" class="d-card ${on ? 'on' : ''}" data-i="${i}" ${(!on && full) ? 'disabled' : ''}>
        <strong>${esc(label(c))}</strong>${hint(c) ? `<span>${esc(hint(c))}</span>` : ''}</button>`;
    }).join('')}</div>
    ${tool.rank && s.p.length > 1 ? `<h3 class="d-sub">Now put them in order</h3>
      <p class="faint">Most important at the top. Use the arrows.</p>
      <ol class="d-ranklist">${s.p.map((idx, pos) => `<li>
        <span>${esc(label(tool.cards[idx]))}</span>
        <span class="d-arrows">
          <button type="button" class="btn sm ghost" data-up="${pos}" ${pos === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button type="button" class="btn sm ghost" data-down="${pos}" ${pos === s.p.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        </span></li>`).join('')}</ol>` : ''}`;
  el.querySelectorAll('.d-card').forEach(c => c.addEventListener('click', () => {
    const i = Number(c.dataset.i);
    const at = s.p.indexOf(i);
    if (at >= 0) s.p.splice(at, 1); else if (s.p.length < tool.max) s.p.push(i);
    api.save(); api.rerender();
  }));
  el.querySelectorAll('[data-up],[data-down]').forEach(b => b.addEventListener('click', () => {
    const up = b.dataset.up != null, pos = Number(up ? b.dataset.up : b.dataset.down);
    const j = up ? pos - 1 : pos + 1;
    [s.p[pos], s.p[j]] = [s.p[j], s.p[pos]];
    api.save(); api.rerender();
  }));
};

/* ---- prompts: guided writing -------------------------------------------- */
RENDER.prompts = (el, tool, api) => {
  const s = api.state; s.t ||= {}; s.i ||= 0;
  const n = tool.steps.length, i = Math.min(s.i, n - 1), st = tool.steps[i];
  el.innerHTML = `
    <div class="d-stepbar">${tool.steps.map((_, k) => `<i class="${k < i ? 'done' : ''} ${k === i ? 'now' : ''} ${(s.t[k] || '').trim() ? 'filled' : ''}"></i>`).join('')}</div>
    <p class="faint d-instr">Prompt ${i + 1} of ${n}. Write as much or as little as you like; nothing is sent anywhere.</p>
    <div class="d-prompt">
      <h3>${esc(st.prompt)}</h3>
      ${st.hint ? `<p class="help">${esc(st.hint)}</p>` : ''}
      <textarea id="d-ta" placeholder="${esc(st.placeholder || 'Start anywhere…')}">${esc(s.t[i] || '')}</textarea>
    </div>
    <div class="row">
      <button type="button" class="btn ghost" data-nav="-1" ${i === 0 ? 'disabled' : ''}>Back</button>
      <button type="button" class="btn ${i === n - 1 ? 'ghost' : ''}" data-nav="1" ${i === n - 1 ? 'disabled' : ''}>Next prompt</button>
    </div>`;
  const ta = el.querySelector('#d-ta');
  ta.addEventListener('input', () => { s.t[i] = ta.value; api.save(); refreshFoot(el, tool, api); });
  el.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
    s.i = Math.max(0, Math.min(n - 1, i + Number(b.dataset.nav))); api.save(); api.rerender();
    el.querySelector('#d-ta')?.focus();
  }));
};

/* ---- check: tick observations -------------------------------------------- */
RENDER.check = (el, tool, api) => {
  const s = api.state; s.k ||= {};
  el.innerHTML = `<p class="faint d-instr">${esc(tool.instr || 'Tick anything that has been true for you in the last couple of weeks. Leave the rest.')}</p>` +
    tool.items.map((it, i) => `
      <label class="d-check ${s.k[i] ? 'on' : ''}"><input type="checkbox" data-i="${i}" ${s.k[i] ? 'checked' : ''}>
        <span>${esc(it)}</span></label>`).join('');
  el.querySelectorAll('input').forEach(c => c.addEventListener('change', () => {
    if (c.checked) s.k[c.dataset.i] = true; else delete s.k[c.dataset.i];
    c.closest('.d-check').classList.toggle('on', c.checked);
    api.save();
  }));
};

/* ---- breathe: paced breathing ------------------------------------------- */
RENDER.breathe = (el, tool, api) => {
  const s = api.state; s.c ||= 0;
  const phases = tool.phases;
  const per = phases.reduce((a, p) => a + p.secs, 0);
  el.innerHTML = `
    <p class="faint d-instr">${esc(tool.instr || `Follow the circle. One round is ${per} seconds; the tool counts ${tool.cycles} rounds, and you can stop whenever you like.`)}</p>
    <div class="d-breath">
      <div class="d-orb" id="d-orb"><span id="d-phase">Ready</span><small id="d-count"></small></div>
    </div>
    <div class="row" style="justify-content:center">
      <button type="button" class="btn lg" id="d-go">Start</button>
      <span class="faint" id="d-rounds">${s.c} of ${tool.cycles} rounds</span>
    </div>
    <div class="d-legend" style="justify-content:center;margin-top:14px">${phases.map(p =>
      `<span class="badge gray">${esc(p.label)} · ${p.secs}s</span>`).join('')}</div>`;
  const orb = el.querySelector('#d-orb'), ph = el.querySelector('#d-phase'),
        cnt = el.querySelector('#d-count'), go = el.querySelector('#d-go'),
        rounds = el.querySelector('#d-rounds');
  let timer = null, pi = 0, left = 0;
  const stop = () => { clearInterval(timer); timer = null; go.textContent = 'Resume'; orb.dataset.phase = 'hold'; };
  const tick = () => {
    if (left <= 0) {
      pi = (pi + 1) % phases.length;
      if (pi === 0) {
        s.c += 1; rounds.textContent = `${s.c} of ${tool.cycles} rounds`; api.save(); refreshFoot(el, tool, api);
        if (s.c >= tool.cycles) { stop(); ph.textContent = 'Done'; cnt.textContent = ''; go.textContent = 'Go again'; orb.dataset.phase = 'rest'; return; }
      }
      left = phases[pi].secs;
    }
    const p = phases[pi];
    ph.textContent = p.label; cnt.textContent = left;
    orb.dataset.phase = p.dir || 'hold';
    orb.style.setProperty('--dur', p.secs + 's');
    left -= 1;
  };
  go.addEventListener('click', () => {
    if (timer) { stop(); return; }
    if (s.c >= tool.cycles) { s.c = 0; api.save(); rounds.textContent = `0 of ${tool.cycles} rounds`; }
    go.textContent = 'Pause';
    if (left <= 0) { pi = phases.length - 1; left = 0; }
    tick(); timer = setInterval(tick, 1000);
  });
  el.closest('body')?.addEventListener('visibilitychange', () => { if (document.hidden && timer) stop(); }, { once: true });
};

/* ---- guide: step-by-step -------------------------------------------------- */
RENDER.guide = (el, tool, api) => {
  const s = api.state; s.done ||= []; s.i ||= 0;
  const n = tool.steps.length, i = Math.min(s.i, n - 1), st = tool.steps[i];
  const isDone = s.done.includes(i);
  el.innerHTML = `
    <div class="d-stepbar">${tool.steps.map((_, k) => `<i class="${s.done.includes(k) ? 'done filled' : ''} ${k === i ? 'now' : ''}"></i>`).join('')}</div>
    <p class="faint d-instr">Step ${i + 1} of ${n}</p>
    <div class="d-guide">
      <h3>${esc(st.title)}</h3>
      <p>${esc(st.text)}</p>
      ${st.secs ? `<div class="d-timer"><span class="d-clock" id="d-clock">${fmtSecs(st.secs)}</span>
        <button type="button" class="btn sm ghost" id="d-tgo">Start ${st.secs >= 60 ? 'timer' : 'count'}</button></div>` : ''}
      ${st.input ? `<textarea id="d-gin" placeholder="${esc(st.input)}">${esc(s.n?.[i] || '')}</textarea>` : ''}
    </div>
    <div class="row">
      <button type="button" class="btn ghost" data-nav="-1" ${i === 0 ? 'disabled' : ''}>Back</button>
      <button type="button" class="btn" data-done="1">${isDone ? (i === n - 1 ? 'Done' : 'Next step') : (i === n - 1 ? 'Mark done' : 'Done, next step')}</button>
    </div>`;
  if (st.secs) {
    let left = st.secs, t = null;
    const clock = el.querySelector('#d-clock'), b = el.querySelector('#d-tgo');
    b.addEventListener('click', () => {
      if (t) { clearInterval(t); t = null; b.textContent = 'Resume'; return; }
      b.textContent = 'Pause';
      t = setInterval(() => {
        left -= 1; clock.textContent = fmtSecs(Math.max(0, left));
        if (left <= 0) { clearInterval(t); t = null; b.textContent = 'Time'; clock.classList.add('up'); }
      }, 1000);
    });
  }
  el.querySelector('#d-gin')?.addEventListener('input', e => { (s.n ||= {})[i] = e.target.value; api.save(); });
  el.querySelector('[data-nav]').addEventListener('click', () => { s.i = Math.max(0, i - 1); api.save(); api.rerender(); });
  el.querySelector('[data-done]').addEventListener('click', () => {
    if (!s.done.includes(i)) s.done.push(i);
    if (i < n - 1) s.i = i + 1;
    api.save(); api.rerender();
  });
};
const fmtSecs = (n) => n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : String(n);

/* ---- track: seven-day log ------------------------------------------------ */
RENDER.track = (el, tool, api) => {
  const s = api.state; s.d ||= {};
  const days = [];
  for (let k = 0; k < 7; k++) { const d = new Date(); d.setDate(d.getDate() - k); days.push(d); }
  el.innerHTML = `<p class="faint d-instr">${esc(tool.instr || 'Log today, and come back tomorrow. After a few days a shape starts to show. Earlier days can be filled in from memory.')}</p>
    <div class="scroll-x"><table class="data d-track"><thead><tr><th>Day</th>${tool.measures.map(m =>
      `<th>${esc(m.label)}<br><span class="faint" style="text-transform:none;letter-spacing:0">1 = ${esc(m.low)} · 5 = ${esc(m.high)}</span></th>`).join('')}</tr></thead>
    <tbody>${days.map((d, k) => {
      const key = dayKey(d), row = s.d[key] || {};
      return `<tr data-k="${key}"><td><strong>${k === 0 ? 'Today' : k === 1 ? 'Yesterday' : DAYS[(d.getDay() + 6) % 7]}</strong><br><span class="faint">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></td>
        ${tool.measures.map(m => `<td><div class="d-five">${[1, 2, 3, 4, 5].map(v =>
          `<button type="button" class="${row[m.key] === v ? 'on' : ''}" data-m="${esc(m.key)}" data-v="${v}" aria-label="${esc(m.label)} ${v}">${v}</button>`).join('')}</div></td>`).join('')}
      </tr>`;
    }).join('')}</tbody></table></div>`;
  el.querySelectorAll('tr[data-k]').forEach(tr => tr.addEventListener('click', e => {
    const b = e.target.closest('button[data-m]'); if (!b) return;
    const row = (s.d[tr.dataset.k] ||= {});
    row[b.dataset.m] = row[b.dataset.m] === Number(b.dataset.v) ? undefined : Number(b.dataset.v);
    if (row[b.dataset.m] === undefined) delete row[b.dataset.m];
    if (!Object.keys(row).length) delete s.d[tr.dataset.k];
    tr.querySelectorAll(`button[data-m="${b.dataset.m}"]`).forEach(x => x.classList.toggle('on', x === b && row[b.dataset.m] != null));
    api.save(); refreshFoot(el, tool, api);
  }));
};

/* ---- wheel: broad feeling → precise word → body → need ------------------- */
RENDER.wheel = (el, tool, api) => {
  const s = api.state; s.w ||= []; s.b ||= [];
  const core = s.c != null ? tool.core[s.c] : null;
  el.innerHTML = `
    <p class="faint d-instr">Start broad and get more precise. A feeling named accurately is usually a little easier to be with.</p>
    <h3 class="d-sub">1. Roughly, what is it?</h3>
    <div class="chips d-big">${tool.core.map((c, i) => `<button type="button" class="chip ${s.c === i ? 'on' : ''}" data-c="${i}">${esc(c.label)}</button>`).join('')}</div>
    ${core ? `<h3 class="d-sub">2. Closer to…</h3><p class="faint">Pick up to three words.</p>
      <div class="chips">${core.words.map(w => `<button type="button" class="chip ${s.w.includes(w) ? 'on' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>` : ''}
    ${core && s.w.length ? `<h3 class="d-sub">3. Where does it sit in your body?</h3>
      <div class="chips">${tool.bodies.map(w => `<button type="button" class="chip ${s.b.includes(w) ? 'on' : ''}" data-b="${esc(w)}">${esc(w)}</button>`).join('')}</div>
      <h3 class="d-sub">4. If it could ask for something, what would it be?</h3>
      <div class="chips">${tool.needs.map(w => `<button type="button" class="chip ${s.n === w ? 'on' : ''}" data-n="${esc(w)}">${esc(w)}</button>`).join('')}</div>` : ''}`;
  el.addEventListener('click', e => {
    const b = e.target.closest('button[data-c],button[data-w],button[data-b],button[data-n]'); if (!b) return;
    if (b.dataset.c != null) { const c = Number(b.dataset.c); if (s.c !== c) { s.c = c; s.w = []; } }
    else if (b.dataset.w) toggleIn(s.w, b.dataset.w, 3);
    else if (b.dataset.b) toggleIn(s.b, b.dataset.b, 4);
    else if (b.dataset.n) s.n = s.n === b.dataset.n ? null : b.dataset.n;
    api.save(); api.rerender();
  });
};
function toggleIn(arr, v, max) {
  const at = arr.indexOf(v);
  if (at >= 0) arr.splice(at, 1); else if (arr.length < max) arr.push(v);
}

/* ---- build: assemble a plan ---------------------------------------------- */
RENDER.build = (el, tool, api) => {
  const s = api.state; s.g ||= {};
  el.innerHTML = `<p class="faint d-instr">${esc(tool.instr || 'Pick what you would actually do, not what sounds impressive. Add your own where the list misses something.')}</p>` +
    tool.groups.map((g, gi) => {
      const chosen = s.g[gi] || [];
      return `<div class="d-group" data-g="${gi}">
        <h3 class="d-sub">${esc(g.title)}</h3>${g.hint ? `<p class="faint">${esc(g.hint)}</p>` : ''}
        <div class="chips">${g.options.map(o => `<button type="button" class="chip ${chosen.includes(o) ? 'on' : ''}" data-o="${esc(o)}">${esc(o)}</button>`).join('')}
          ${chosen.filter(o => !g.options.includes(o)).map(o => `<button type="button" class="chip on" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        <div class="d-add"><input type="text" placeholder="Add your own…" maxlength="80"><button type="button" class="btn sm ghost">Add</button></div>
      </div>`;
    }).join('');
  el.querySelectorAll('.d-group').forEach(grp => {
    const gi = grp.dataset.g;
    grp.addEventListener('click', e => {
      const b = e.target.closest('button[data-o]'); if (!b) return;
      const arr = (s.g[gi] ||= []); toggleIn(arr, b.dataset.o, 99);
      api.save(); api.rerender();
    });
    wireAdd(grp, txt => { (s.g[gi] ||= []).push(txt); api.save(); api.rerender(); });
  });
};

/* ---- flip: perspective cards --------------------------------------------- */
RENDER.flip = (el, tool, api) => {
  const s = api.state; s.r ||= {}; s.i ||= 0;
  const n = tool.cards.length, i = Math.min(s.i, n - 1), c = tool.cards[i];
  const flipped = !!s.f;
  const back = Array.isArray(c.back) ? c.back : [c.back];
  el.innerHTML = `
    <p class="faint d-instr">Card ${i + 1} of ${n}. Read the front, turn it over, and decide whether the other side is one you would keep.</p>
    <div class="d-flip ${flipped ? 'flipped' : ''}" id="d-flipcard" tabindex="0" role="button" aria-pressed="${flipped}">
      <div class="d-face d-front"><span class="badge gray">${esc(tool.frontLabel || 'The thought')}</span><p>${esc(c.front)}</p><span class="faint">Tap to turn over</span></div>
      <div class="d-face d-back"><span class="badge">${esc(tool.backLabel || 'Another angle')}</span>${back.map(l => `<p>${esc(l)}</p>`).join('')}</div>
    </div>
    <div class="row" style="justify-content:center;margin-top:14px">
      <button type="button" class="btn ghost" data-nav="-1" ${i === 0 ? 'disabled' : ''}>Back</button>
      <button type="button" class="btn lime" data-r="yes" ${flipped ? '' : 'disabled'}>${s.r[i] === 'yes' ? '✓ ' : ''}Keep this one</button>
      <button type="button" class="btn ghost" data-r="no" ${flipped ? '' : 'disabled'}>${s.r[i] === 'no' ? '✓ ' : ''}Not for me</button>
    </div>`;
  const card = el.querySelector('#d-flipcard');
  const turn = () => { s.f = !s.f; api.save(); api.rerender(); };
  card.addEventListener('click', turn);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); turn(); } });
  el.querySelector('[data-nav]').addEventListener('click', () => { s.i = Math.max(0, i - 1); s.f = false; api.save(); api.rerender(); });
  el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => {
    s.r[i] = b.dataset.r; s.f = false;
    if (i < n - 1) s.i = i + 1;
    api.save(); api.rerender();
  }));
};

/* ---- matrix: two-by-two --------------------------------------------------- */
RENDER.matrix = (el, tool, api) => {
  const s = api.state; s.q ||= {}; s.extra ||= [];
  const all = [...(tool.items || []), ...s.extra];
  el.innerHTML = `<p class="faint d-instr">${esc(tool.instr || 'For each item, choose the corner that fits best.')}</p>
    <div class="d-axes faint">Across: <strong>${esc(tool.x.label)}</strong> (${esc(tool.x.low)} → ${esc(tool.x.high)}) ·
      Up: <strong>${esc(tool.y.label)}</strong> (${esc(tool.y.low)} → ${esc(tool.y.high)})</div>` +
    all.map((it, i) => `<div class="d-item d-sortrow ${s.q[i] != null ? 'placed' : ''}" data-i="${i}">
        <p>${esc(it)}</p>
        <div class="d-quadpick">${tool.quads.map((q, k) => `<button type="button" class="chip ${s.q[i] === k ? 'on' : ''}" data-k="${k}">${esc(q)}</button>`).join('')}</div>
      </div>`).join('') +
    (tool.custom !== false ? `<div class="d-add"><input type="text" placeholder="${esc(tool.customPlaceholder || 'Add one of your own…')}" maxlength="100"><button type="button" class="btn sm ghost">Add</button></div>` : '');
  el.querySelectorAll('.d-sortrow').forEach(row => row.addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    s.q[row.dataset.i] = Number(b.dataset.k); row.classList.add('placed');
    row.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
    api.save(); refreshFoot(el, tool, api);
  }));
  wireAdd(el, txt => { s.extra.push(txt); api.save(); api.rerender(); });
};

/* ---- rank: order items ---------------------------------------------------- */
RENDER.rank = (el, tool, api) => {
  const s = api.state; s.o ||= tool.items.map((_, i) => i);
  el.innerHTML = `<p class="faint d-instr">${esc(tool.instr || 'Move items up and down until the order feels honest. Top means first or most.')}</p>
    <div class="spread faint d-ends"><span>${esc(tool.top || 'Top')}</span><span>${esc(tool.bottom || 'Bottom')}</span></div>
    <ol class="d-ranklist">${s.o.map((idx, pos) => `<li>
      <span><strong>${pos + 1}.</strong> ${esc(tool.items[idx])}</span>
      <span class="d-arrows">
        <button type="button" class="btn sm ghost" data-up="${pos}" ${pos === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button type="button" class="btn sm ghost" data-down="${pos}" ${pos === s.o.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
      </span></li>`).join('')}</ol>`;
  el.querySelectorAll('[data-up],[data-down]').forEach(b => b.addEventListener('click', () => {
    const up = b.dataset.up != null, pos = Number(up ? b.dataset.up : b.dataset.down), j = up ? pos - 1 : pos + 1;
    [s.o[pos], s.o[j]] = [s.o[j], s.o[pos]]; s.moved = true;
    api.save(); api.rerender();
  }));
};

/* ---- allocate: 100 points ------------------------------------------------- */
RENDER.allocate = (el, tool, api) => {
  const s = api.state; s.v ||= {};
  const sum = total(s);
  el.innerHTML = `<p class="faint d-instr">${esc(tool.instr || 'You have 100 points. Spread them to match how things actually are, not how you wish they were.')}</p>
    <div class="d-total ${sum === 100 ? 'ok' : sum > 100 ? 'over' : ''}"><strong>${sum}</strong> of 100 placed ${sum > 100 ? '· take some back' : sum < 100 ? `· ${100 - sum} left` : '· all placed'}</div>` +
    tool.cats.map((c, i) => `<div class="d-dial touched" data-i="${i}">
        <div class="spread"><label>${esc(label(c))}</label><span class="d-val">${s.v[i] ?? 0}</span></div>
        ${hint(c) ? `<p class="help" style="margin:0 0 6px">${esc(hint(c))}</p>` : ''}
        <input type="range" min="0" max="100" step="5" value="${s.v[i] ?? 0}" aria-label="${esc(label(c))}">
      </div>`).join('');
  el.querySelectorAll('.d-dial').forEach(row => {
    const inp = row.querySelector('input');
    inp.addEventListener('input', () => {
      s.v[row.dataset.i] = Number(inp.value); row.querySelector('.d-val').textContent = inp.value;
      const t = total(s), box = el.querySelector('.d-total');
      box.className = 'd-total ' + (t === 100 ? 'ok' : t > 100 ? 'over' : '');
      box.innerHTML = `<strong>${t}</strong> of 100 placed ${t > 100 ? '· take some back' : t < 100 ? `· ${100 - t} left` : '· all placed'}`;
      api.save(); refreshFoot(el, tool, api);
    });
  });
};

/* ---- heat: week map ------------------------------------------------------- */
RENDER.heat = (el, tool, api) => {
  const s = api.state; s.g ||= {};
  const rows = tool.rows || DAYS, cols = tool.cols || ['Morning', 'Midday', 'Afternoon', 'Evening', 'Night'];
  el.innerHTML = `<p class="faint d-instr">${esc(tool.instr || 'Tap a cell once for "some", twice for "a lot", a third time to clear it. Think about a typical recent week.')}</p>
    <div class="scroll-x"><table class="d-heat"><thead><tr><th></th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, ri) => `<tr><th>${esc(r)}</th>${cols.map((c, ci) => {
      const v = s.g[`${ri}-${ci}`] || 0;
      return `<td><button type="button" class="d-cell l${v}" data-k="${ri}-${ci}" aria-label="${esc(r)} ${esc(c)}: ${['none', 'some', 'a lot'][v]}"></button></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="d-legend" style="margin-top:10px"><span class="d-cell l0"></span><span class="faint">none</span>
      <span class="d-cell l1"></span><span class="faint">some</span><span class="d-cell l2"></span><span class="faint">a lot</span></div>`;
  el.querySelectorAll('.d-cell[data-k]').forEach(b => b.addEventListener('click', () => {
    const v = ((s.g[b.dataset.k] || 0) + 1) % 3;
    if (v) s.g[b.dataset.k] = v; else delete s.g[b.dataset.k];
    b.className = 'd-cell l' + v;
    api.save(); refreshFoot(el, tool, api);
  }));
};

/* --------------------------------------------------------------- helpers */
function wireAdd(scope, onAdd) {
  const box = scope.querySelector(':scope > .d-add, :scope .d-add:last-of-type');
  if (!box) return;
  const inp = box.querySelector('input'), btn = box.querySelector('button');
  const go = () => { const v = inp.value.trim(); if (!v) return; inp.value = ''; onAdd(v); };
  btn.addEventListener('click', go);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
}
function refreshFoot(el, tool, api) {
  const host = el.parentElement; if (!host) return;
  const p = progressOf(tool, api.state);
  const prog = host.querySelector('.d-prog'), btn = host.querySelector('[data-act="finish"]');
  if (prog) prog.textContent = footText(tool, p, api.state);
  if (btn) btn.disabled = !ready(tool, api.state);
}

/* ============================================================== summaries */
export function summaryOf(tool, s = {}) {
  return (SUMMARY[tool.kind] || (() => ''))(tool, s);
}
const SUMMARY = {};
const li = (arr) => arr.length ? `<ul class="d-list">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="faint">Nothing here.</p>';
const bars = (rows, max) => `<div class="d-bars">${rows.map(([lab, v]) =>
  `<div class="d-bar"><span>${esc(lab)}</span><div class="bar"><i style="width:${pct(v, max)}%"></i></div><b>${v}</b></div>`).join('')}</div>`;

SUMMARY.reflect = (t, s) => {
  const scale = t.scale || DEFAULT_SCALE, vals = t.items.map((_, i) => s.a?.[i] ?? 0);
  const sum = vals.reduce((a, b) => a + b, 0), max = t.items.length * (scale.length - 1);
  const p = pct(sum, max), b = band(t.bands, p);
  const high = t.items.filter((_, i) => vals[i] >= scale.length - 2);
  const low = t.items.filter((_, i) => vals[i] <= 1);
  return `<h2>${esc(b.label)}</h2><p>${esc(b.text)}</p>
    <div class="d-cols">
      <div><h4>Rated ${esc(scale[scale.length - 2].toLowerCase())} or ${esc(scale[scale.length - 1].toLowerCase())}</h4>${li(high)}</div>
      <div><h4>Rated ${esc(scale[0].toLowerCase())} or ${esc(scale[1].toLowerCase())}</h4>${li(low)}</div>
    </div>`;
};
SUMMARY.sliders = (t, s) => {
  const rows = t.dims.map((d, i) => [label(d), s.v?.[i] ?? 5]).sort((a, b) => b[1] - a[1]);
  const hi = rows[0], lo = rows[rows.length - 1];
  return `<h2>${esc(t.resultTitle || 'Your dials')}</h2>
    <p>Highest: <strong>${esc(hi[0])}</strong> at ${hi[1]}. Lowest: <strong>${esc(lo[0])}</strong> at ${lo[1]}.
      ${hi[1] - lo[1] >= 5 ? 'That is a wide spread, which often means one area is quietly carrying more than the rest.' : 'These sit fairly close together.'}</p>
    ${bars(rows, 10)}${t.resultNote ? `<p class="muted">${esc(t.resultNote)}</p>` : ''}`;
};
SUMMARY.sort = (t, s) => {
  const all = [...t.items, ...(s.extra || [])];
  return `<h2>${esc(t.resultTitle || 'How you sorted them')}</h2><div class="d-cols">${t.buckets.map(b => {
    const got = all.filter((_, i) => s.b?.[i] === b.key);
    return `<div><h4>${esc(b.label)} <span class="faint">(${got.length})</span></h4>${li(got)}
      ${t.reflect?.[b.key] && got.length ? `<p class="muted">${esc(t.reflect[b.key])}</p>` : ''}</div>`;
  }).join('')}</div>`;
};
SUMMARY.pick = (t, s) => {
  const chosen = (s.p || []).map(i => t.cards[i]);
  return `<h2>${esc(t.resultTitle || 'What you chose')}</h2>
    <ol class="d-picked">${chosen.map(c => `<li><strong>${esc(label(c))}</strong>${hint(c) ? `<span class="faint"> — ${esc(hint(c))}</span>` : ''}</li>`).join('')}</ol>
    ${t.resultNote ? `<p class="muted">${esc(t.resultNote)}</p>` : ''}`;
};
SUMMARY.prompts = (t, s) => `<h2>${esc(t.resultTitle || 'What you wrote')}</h2>
  ${t.steps.map((st, i) => (s.t?.[i] || '').trim() ? `<div class="d-qa"><h4>${esc(st.prompt)}</h4><p>${esc(s.t[i]).replace(/\n/g, '<br>')}</p></div>` : '').join('')}
  ${t.resultNote ? `<p class="muted">${esc(t.resultNote)}</p>` : ''}`;
SUMMARY.check = (t, s) => {
  const got = t.items.filter((_, i) => s.k?.[i]);
  const b = band(t.bands, pct(got.length, t.items.length));
  return `<h2>${esc(b.label)}</h2><p>${esc(b.text)}</p><h4>You ticked ${got.length} of ${t.items.length}</h4>${li(got)}`;
};
SUMMARY.breathe = (t, s) => `<h2>${Math.min(s.c || 0, t.cycles)} round${(s.c || 0) === 1 ? '' : 's'} of ${esc(t.title)}</h2>
  <p>${esc(t.resultNote || 'Paced breathing is not a fix for anything; it is a way to notice how quickly your body can shift when you give it a steady rhythm. If it left you calmer, that is worth remembering the next time things speed up. If it made you more aware of your breath in an uncomfortable way, that is common too, and worth mentioning to someone you trust.')}</p>`;
SUMMARY.guide = (t, s) => `<h2>${esc(t.resultTitle || 'You went through all ' + t.steps.length + ' steps')}</h2>
  <p>${esc(t.resultNote || 'Guided exercises work best as something you return to, not something you get right. What did you notice this time that you did not expect?')}</p>
  ${Object.values(s.n || {}).some(v => (v || '').trim()) ? t.steps.map((st, i) => (s.n?.[i] || '').trim() ? `<div class="d-qa"><h4>${esc(st.title)}</h4><p>${esc(s.n[i])}</p></div>` : '').join('') : ''}`;
SUMMARY.track = (t, s) => {
  const keys = Object.keys(s.d || {}).sort();
  const out = t.measures.map(m => {
    const vals = keys.map(k => s.d[k][m.key]).filter(v => v != null);
    const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    return { m, vals, avg, rows: keys.map(k => [new Date(k + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }), s.d[k][m.key] ?? 0]) };
  });
  return `<h2>${keys.length} day${keys.length === 1 ? '' : 's'} logged</h2>
    ${out.map(o => `<h4>${esc(o.m.label)} <span class="faint">· average ${o.avg ? o.avg.toFixed(1) : '—'} of 5</span></h4>${bars(o.rows, 5)}`).join('')}
    <p class="muted">${esc(t.resultNote || 'A week is a small window. Look for the shape, not the score: which days were different, and what was different about them?')}</p>`;
};
SUMMARY.wheel = (t, s) => {
  const core = t.core[s.c]?.label || '';
  return `<h2>Naming it</h2>
    <p class="d-sentence">“I feel <strong>${esc(core.toLowerCase())}</strong>${s.w?.length ? `, more precisely <strong>${esc(s.w.join(', ').toLowerCase())}</strong>` : ''}${s.b?.length ? `. I notice it in my <strong>${esc(s.b.join(' and ').toLowerCase())}</strong>` : ''}${s.n ? `. What it seems to want is <strong>${esc(s.n.toLowerCase())}</strong>` : ''}.”</p>
    <p class="muted">${esc(t.resultNote || 'You can say this sentence out loud, write it down, or share it with someone. Precise words tend to make a feeling feel more manageable, even when nothing else changes.')}</p>`;
};
SUMMARY.build = (t, s) => `<div class="d-plan"><h2>${esc(t.card || t.title)}</h2>
  ${t.groups.map((g, i) => (s.g?.[i] || []).length ? `<h4>${esc(g.title)}</h4>${li(s.g[i])}` : '').join('')}</div>
  <p class="muted">${esc(t.resultNote || 'Print this or take a photo of it. Plans made in a calm moment are easiest to follow in a hard one when they are somewhere you can see them.')}</p>`;
SUMMARY.flip = (t, s) => {
  const keep = t.cards.filter((_, i) => s.r?.[i] === 'yes');
  return `<h2>${keep.length} card${keep.length === 1 ? '' : 's'} to keep</h2>
    ${keep.length ? keep.map(c => `<div class="d-qa"><h4>${esc(c.front)}</h4>${(Array.isArray(c.back) ? c.back : [c.back]).map(l => `<p>${esc(l)}</p>`).join('')}</div>`).join('') : '<p class="faint">None of these landed for you, and that is useful information too. Your own words may work better than any card.</p>'}
    ${t.resultNote ? `<p class="muted">${esc(t.resultNote)}</p>` : ''}`;
};
SUMMARY.matrix = (t, s) => {
  const all = [...(t.items || []), ...(s.extra || [])];
  return `<h2>${esc(t.resultTitle || 'Your grid')}</h2><div class="d-grid2">${t.quads.map((q, k) => {
    const got = all.filter((_, i) => s.q?.[i] === k);
    return `<div class="d-quad"><h4>${esc(q)} <span class="faint">(${got.length})</span></h4>${li(got)}${t.reflect?.[k] && got.length ? `<p class="muted">${esc(t.reflect[k])}</p>` : ''}</div>`;
  }).join('')}</div>`;
};
SUMMARY.rank = (t, s) => `<h2>${esc(t.resultTitle || 'Your order')}</h2>
  <ol class="d-picked">${(s.o || t.items.map((_, i) => i)).map(i => `<li>${esc(t.items[i])}</li>`).join('')}</ol>
  ${t.resultNote ? `<p class="muted">${esc(t.resultNote)}</p>` : ''}`;
SUMMARY.allocate = (t, s) => {
  const rows = t.cats.map((c, i) => [label(c), s.v?.[i] ?? 0]).sort((a, b) => b[1] - a[1]);
  return `<h2>${esc(t.resultTitle || 'Where the points went')}</h2>${bars(rows, 100)}
    <p>Most went to <strong>${esc(rows[0][0])}</strong>. ${rows.filter(r => r[1] === 0).length ? `Nothing went to ${rows.filter(r => r[1] === 0).map(r => esc(r[0])).join(', ')}.` : ''}</p>
    ${t.resultNote ? `<p class="muted">${esc(t.resultNote)}</p>` : ''}`;
};
SUMMARY.heat = (t, s) => {
  const rows = t.rows || DAYS, cols = t.cols || ['Morning', 'Midday', 'Afternoon', 'Evening', 'Night'];
  const rSum = rows.map(() => 0), cSum = cols.map(() => 0);
  for (const [k, v] of Object.entries(s.g || {})) { const [r, c] = k.split('-').map(Number); rSum[r] += v; cSum[c] += v; }
  const top = (arr, names) => { const m = Math.max(...arr); return m ? names.filter((_, i) => arr[i] === m) : []; };
  const tr = top(rSum, rows), tc = top(cSum, cols);
  return `<h2>${esc(t.resultTitle || 'The shape of your week')}</h2>
    <p>${tc.length ? `It shows up most in the <strong>${esc(tc.join(' and ').toLowerCase())}</strong>` : 'No time of day stands out'}${tr.length ? `, and most on <strong>${esc(tr.join(' and '))}</strong>` : ''}.</p>
    ${bars(cols.map((c, i) => [c, cSum[i]]), Math.max(1, ...cSum))}
    ${t.resultNote ? `<p class="muted">${esc(t.resultNote)}</p>` : ''}`;
};
