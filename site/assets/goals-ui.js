/* ==========================================================================
   Theraglee — the Premium Goals & tracking page (goals.html).
   --------------------------------------------------------------------------
   Three levels, top to bottom, and the map beside them:

     YOUR GOAL              one sentence in the member's words, the destination
     WORKING ON NOW         the milestone they are on, of three to five they
                            chose; reached when they say so, once a week
     TODAY'S STEPPING STONES  a few small actions toward that milestone; any
                            one of them done today is today's step

   `mountGoals(host, ctx)` draws everything into `host`. `ctx` carries the
   Supabase client and the page helpers, so a preview can hand in a fake
   client. docs/quest-map.md is the guide.
   ========================================================================== */
import { VALUES, CATEGORIES, MINUTES, SCENES, action, valueOf, helper } from './quest-paths.js';
import { detectTheme, suggestMilestones, suggestSteps, reasonFor, recognizedWords,
  EXAMPLE_GOALS, STEPS_PER_MILESTONE } from './quest-goals.js';
import { trailMap } from './quest-scene.js';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => ymd(new Date());
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
const ownKey = (ms, i) => `own_${String(ms.id).replace(/-/g, '').slice(0, 8)}_${i}`;

export async function mountGoals(host, ctx) {
  const { sb, uid, esc, toast, busy, modal, fmtDate } = ctx;
  let flash = false;                      // the hiker hops after a step is marked

  /* ------------------------------------------------------------ data */
  async function load() {
    const [q, m, s, r, g] = await Promise.all([
      sb.from('quests').select('*').eq('user_id', uid).eq('active', true).maybeSingle(),
      sb.from('quest_milestones').select('*').eq('user_id', uid).order('position', { ascending: true }),
      sb.from('quest_steps').select('quest_id,milestone_id,action_key,done_on,note').eq('user_id', uid),
      sb.from('quest_reflections').select('*').eq('user_id', uid).order('noted_on', { ascending: false }),
      sb.from('goals').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);
    const quest = q.data;
    const milestones = (m.data || []).filter(x => quest && x.quest_id === quest.id);
    const goals = (g.data || []).filter(x => x.active);
    let logs = [];
    if (goals.length) ({ data: logs } = await sb.from('goal_logs').select('*').in('goal_id', goals.map(x => x.id)), logs ||= []);
    const steps = s.data || [], reflections = r.data || [];
    const days = new Set([...steps.map(x => x.done_on), ...logs.map(x => x.logged_on), ...reflections.map(x => x.noted_on)]);
    const current = milestones.findIndex(x => !x.reached_on);
    const ci = current < 0 ? milestones.length : current;
    const cur = milestones[ci] || null;
    const stepDays = cur ? new Set(steps.filter(x => x.milestone_id === cur.id).map(x => x.done_on)) : new Set();
    const startedOn = cur ? (ci ? milestones[ci - 1].reached_on : (quest.created_at || '').slice(0, 10)) : null;
    return { quest, milestones, steps, reflections, goals, logs, days, ci, cur, stepDays, startedOn };
  }

  const themeOf = (q) => valueOf(q.value_key) || VALUES[0];
  const stonesOf = (ms) => [
    ...(ms.actions || []).map(k => action(k)).filter(Boolean).map(a => ({ key: a.key, text: a.text, min: a.min, write: !!a.write, lib: true })),
    ...(ms.own_steps || []).map((t, i) => ({ key: ownKey(ms, i), text: t, min: null, write: false, lib: false })),
  ];

  /* ---------------------------------------------------------- pieces */
  const pebbles = (n, of = STEPS_PER_MILESTONE) => `<span class="pebbles" aria-hidden="true">${Array.from({ length: of }, (_, i) =>
    `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

  const stoneRow = (st, { done = false, note = null, reason = null, optional = false } = {}) => `<div class="stone ${done ? 'done' : ''}">
      <button class="pebble ${done ? 'on' : ''}" data-step="${esc(st.key)}" aria-pressed="${done}"
        aria-label="${done ? 'Done today. Tap to undo' : st.write ? 'Open a note box, then mark done' : 'Mark done today'}">${done ? '✓' : st.write ? '✎' : ''}</button>
      <div class="txt"><div class="what">${esc(st.text)}</div>
        <div class="meta">${[st.min ? `about ${st.min} min` : 'your own step', optional ? 'optional' : null, reason].filter(Boolean).join(' · ')}</div>
        ${done && st.write ? `<div class="note">${note ? `<div style="white-space:pre-wrap">${esc(note)}</div>` : '<span class="faint">Marked done without a note.</span>'}
          <a href="#" data-note="${esc(st.key)}">${note ? 'Edit note' : 'Add a note'}</a></div>` : ''}</div></div>`;

  /* ------------------------------------------------------------ main */
  async function main() {
    const d = await load();
    if (!d.quest) return setup({ fresh: true });
    if (!d.milestones.length) return setup({ quest: d.quest });
    const { quest: q, milestones: ms, ci, cur, stepDays } = d;
    const theme = themeOf(q);
    const t = today();
    const done = ci >= ms.length;
    const reached = ms.filter(x => x.reached_on).length;
    const doneToday = new Map(d.steps.filter(x => x.done_on === t && (!cur || x.milestone_id === cur.id)).map(x => [x.action_key, x]));
    const steppedToday = cur ? stepDays.has(t) : false;
    const stones = cur ? stonesOf(cur) : [];
    const stepsN = Math.min(stepDays.size, STEPS_PER_MILESTONE);
    const sinceStart = d.startedOn ? daysBetween(d.startedOn, t) : 0;
    const sinceCheck = cur?.checked_on ? daysBetween(cur.checked_on, t) : 99;
    const checkDue = cur && sinceCheck >= 7 && (stepDays.size >= STEPS_PER_MILESTONE || sinceStart >= 7);
    const next = ms[ci + 1] || null;
    const scene = SCENES.find(x => x.key === q.scene) || SCENES[0];
    const loggedToday = new Set(d.logs.filter(l => l.logged_on === t).map(l => l.goal_id));

    host.innerHTML = `
      <div class="card pad-lg levels ${flash ? 'stepped' : ''}">
        <section class="level goal">
          <div class="spread" style="align-items:flex-start">
            <span class="kicker"><i class="ico">⛰</i> Your goal</span>
            <div class="menu"><button class="btn sm ghost" id="more" aria-haspopup="true" aria-expanded="false">Change ▾</button>
              <div class="menu-list" id="menu" hidden>
                <button data-do="goal">Reword my goal</button>
                <button data-do="milestones">Change my milestones</button>
                <button data-do="stones">Change today's stepping stones</button>
                <button data-do="scene">What grows along the trail</button>
                <button data-do="notes">Earlier notes</button>
                <button data-do="data">Your data</button>
                <button data-do="restart">Start a new goal</button>
              </div></div>
          </div>
          <h2 class="goal-text">“${esc(q.intention || theme.label)}”</h2>
          <p class="faint" style="margin:0">${theme.icon} ${esc(theme.label)} · started ${fmtDate((q.created_at || '').slice(0, 10) + 'T12:00')}
            · ${reached} of ${ms.length} milestone${ms.length === 1 ? '' : 's'} reached · ${d.days.size} day${d.days.size === 1 ? '' : 's'} on the trail</p>
        </section>

        ${done ? `<section class="level milestone reached-all">
          <span class="kicker"><i class="ico">🚩</i> Every milestone reached</span>
          <h3>You did what you set out to do.</h3>
          <p class="muted">Keep the trail going with a new milestone, or set a new goal. Either way, nothing here goes away.</p>
          <div class="row"><button class="btn" data-do="milestones">Add a milestone</button><button class="btn ghost" data-do="restart">Set a new goal</button></div>
        </section>` : `<section class="level milestone">
          <span class="kicker"><i class="ico">🚩</i> Working on now <span class="faint" style="text-transform:none;letter-spacing:0;font-weight:400">· milestone ${ci + 1} of ${ms.length}</span></span>
          <h3>${esc(cur.title)}</h3>
          <div class="row" style="gap:14px">${pebbles(stepsN)}
            <span class="faint">${stepDays.size} step${stepDays.size === 1 ? '' : 's'} so far · each day you do a stepping stone adds one</span></div>
          ${checkDue ? `<div class="checkin">
            <strong>${stepDays.size >= STEPS_PER_MILESTONE ? `You have taken ${stepDays.size} steps toward this.` : 'A week in.'} Is it happening for you now?</strong>
            <p class="faint" style="margin:4px 0 10px">You decide, not a counter. Any answer is a fine answer.</p>
            <div class="row"><button class="btn sm" data-check="yes">Yes, mostly</button>
              <button class="btn sm ghost" data-check="getting">Getting there</button>
              <button class="btn sm ghost" data-check="adjust">Not yet, let me adjust it</button></div></div>` : ''}
          ${next ? `<p class="faint" style="margin:10px 0 0">Up next: ${esc(next.title)}</p>` : '<p class="faint" style="margin:10px 0 0">This is the last milestone before your goal.</p>'}
        </section>`}

        ${cur ? `<section class="level stones" id="today">
          <div class="spread">
            <span class="kicker"><i class="ico">◦</i> Today's stepping stones</span>
            <span class="today-pill ${steppedToday ? 'yes' : ''}">${steppedToday ? '✓ A step today' : 'No step yet today'}</span>
          </div>
          <p class="faint" style="margin:2px 0 6px">Small on purpose. Any one of them, done today, is today's step toward the milestone above.</p>
          ${stones.length ? stones.map(st => stoneRow(st, { done: doneToday.has(st.key), note: doneToday.get(st.key)?.note })).join('')
            : '<p class="muted">No stepping stones picked yet. Choose a few below.</p>'}
          ${d.goals.length ? `<div class="own-steps"><span class="kicker" style="margin:14px 0 4px">Your own steps, from before</span>
            ${d.goals.map(g => `<div class="stone ${loggedToday.has(g.id) ? 'done' : ''}">
              <button class="pebble ${loggedToday.has(g.id) ? 'on' : ''}" data-goal="${g.id}" data-on="${loggedToday.has(g.id) ? 1 : ''}" aria-pressed="${loggedToday.has(g.id)}" aria-label="${loggedToday.has(g.id) ? 'Logged today. Tap to undo' : 'Log today'}">${loggedToday.has(g.id) ? '✓' : ''}</button>
              <div class="txt"><div class="what">${esc(g.title)}</div>
                <div class="meta">${[g.cue && esc(g.cue), g.target_per_week && `${g.target_per_week}× a week`, 'counts as a day on the trail'].filter(Boolean).join(' · ')}
                  · <a href="#" data-archive="${g.id}">archive</a></div></div></div>`).join('')}</div>` : ''}
          <div class="row" style="margin-top:12px;gap:16px">
            <a href="#" data-do="own">+ Add a step of your own</a>
            <a href="#" data-do="stones">Change these stones</a>
          </div>
        </section>` : ''}

        <section class="level tonight">
          <button class="tonight-toggle" id="tonight" aria-expanded="false"><span class="kicker"><i class="ico">☾</i> Tonight</span>
            <span class="what">What helped today?</span><span class="faint">${d.reflections.find(r => r.noted_on === t) ? 'Noted · tap to edit' : 'A line or two, only if you want to'}</span></button>
          <div id="tonight-box" hidden>
            <p class="faint" style="margin:8px 0 10px">Yours alone: nobody else reads these. A note also counts as a day on the trail.</p>
            <div class="nudge"><span class="faint">Need a nudge?</span> <em id="idea"></em><button class="btn sm ghost" id="another">Another</button></div>
            <textarea id="helped" rows="4" maxlength="1000" placeholder="e.g. The walk after lunch. Tea without my phone.">${esc(d.reflections.find(r => r.noted_on === t)?.helped || '')}</textarea>
            <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sm" id="save-note">Save tonight's note</button></div>
          </div>
        </section>
      </div>

      <div class="card mapcard ${flash ? 'stepped' : ''}">
        ${trailMap({ goal: { text: q.intention || theme.label, theme: theme.key }, milestones: ms.map(x => ({ title: x.title, reached: !!x.reached_on })),
          current: ci, stepFrac: stepDays.size / STEPS_PER_MILESTONE, days: d.days.size, scene: q.scene })}
        <div class="stops" role="list" aria-label="Your milestones">${ms.map((x, i) => `<button role="listitem" data-ms="${i}"
            class="${x.reached_on ? 'open' : ''} ${i === ci ? 'here' : ''}">
            <b>${x.reached_on ? '✓' : i + 1}</b>${esc(x.title)}</button>`).join('')}
          <button role="listitem" data-goal-pill class="goal-pill"><b>⛰</b>${esc(q.intention || theme.label)}</button></div>
        <p class="faint" style="margin:10px 6px 2px">${scene.blurb} Tap a camp to see its stepping stones.</p>
      </div>`;
    flash = false;

    /* ---- wiring ---- */
    const $ = (s) => host.querySelector(s);
    const menu = $('#menu'), more = $('#more');
    const closeMenu = () => { menu.hidden = true; more.setAttribute('aria-expanded', 'false'); };
    more.onclick = () => {
      if (!menu.hidden) return closeMenu();
      menu.hidden = false; more.setAttribute('aria-expanded', 'true');
      setTimeout(() => document.addEventListener('click', (e) => { if (!e.target.closest('.menu-list')) closeMenu(); }, { once: true }), 0);
    };
    host.querySelectorAll('[data-do]').forEach(b => b.onclick = (e) => {
      e.preventDefault(); menu.hidden = true;
      ({ goal: () => setup({ quest: q, milestones: ms, step: 0 }),
         milestones: () => editMilestones(q, ms),
         stones: () => cur && pickStones(q, cur),
         scene: () => pickScene(q),
         notes: () => notesModal(d),
         data: () => dataModal(),
         restart: () => setup({ fresh: true, restart: true }),
         own: () => cur && addOwnStep(cur),
      })[b.dataset.do]?.();
    });

    const markDone = async (key, note = null) => {
      const { error } = await sb.from('quest_steps').insert({ quest_id: q.id, user_id: uid, milestone_id: cur.id, action_key: key, done_on: t, note });
      if (error) { toast(error.message, 'err'); return false; }
      const n = stepDays.size + (stepDays.has(t) ? 0 : 1);
      if (!stepDays.has(t)) toast(n === 1 ? 'Your first step toward this milestone.' : `Step ${n} toward “${cur.title}”.`, 'ok');
      else toast('Marked. Today is already a step; this one is a bonus.', 'ok');
      flash = !stepDays.has(t);
      main();
      return true;
    };
    const noteBox = (key, existing = null) => {
      const st = stones.find(x => x.key === key);
      const back = modal(`<p class="faint" style="margin:0 0 4px">${st.min ? `about ${st.min} min` : 'your own step'}</p>
        <h2 style="margin-bottom:6px">${esc(st.text)}</h2>
        <p class="muted">Only you can read this. Keep it as short as you like.</p>
        <textarea id="stepnote" rows="5" maxlength="1000" placeholder="Write it here…">${esc(existing?.note || '')}</textarea>
        <div class="row" style="justify-content:flex-end;margin-top:12px">
          <button class="btn ghost" id="no">Cancel</button>
          ${existing ? '' : '<button class="btn ghost" id="skip">Mark done without writing</button>'}
          <button class="btn" id="yes">${existing ? 'Save note' : 'Save and mark done'}</button></div>`);
      back.querySelector('#stepnote').focus();
      back.querySelector('#no').onclick = () => back.remove();
      back.querySelector('#skip')?.addEventListener('click', async (e) => { busy(e.target, true, 'Marking…'); if (await markDone(key)) back.remove(); else busy(e.target, false); });
      back.querySelector('#yes').onclick = async (e) => {
        const note = back.querySelector('#stepnote').value.trim() || null;
        busy(e.target, true, 'Saving…');
        if (existing) {
          const { error } = await sb.from('quest_steps').update({ note }).eq('quest_id', q.id).eq('action_key', key).eq('done_on', t);
          busy(e.target, false);
          if (error) return toast(error.message, 'err');
          back.remove(); toast('Saved.', 'ok'); main();
        } else if (await markDone(key, note)) back.remove(); else busy(e.target, false);
      };
    };
    host.querySelectorAll('[data-step]').forEach(b => b.onclick = async () => {
      const key = b.dataset.step;
      if (doneToday.has(key)) {
        b.disabled = true;
        const { error } = await sb.from('quest_steps').delete().eq('quest_id', q.id).eq('action_key', key).eq('done_on', t);
        if (error) { b.disabled = false; return toast(error.message, 'err'); }
        return main();
      }
      if (stones.find(x => x.key === key)?.write) return noteBox(key);
      b.disabled = true;
      if (!await markDone(key)) b.disabled = false;
    });
    host.querySelectorAll('[data-note]').forEach(l => l.onclick = (e) => { e.preventDefault(); noteBox(l.dataset.note, doneToday.get(l.dataset.note)); });
    host.querySelectorAll('[data-goal]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      const { error } = b.dataset.on
        ? await sb.from('goal_logs').delete().eq('goal_id', b.dataset.goal).eq('logged_on', t)
        : await sb.from('goal_logs').insert({ goal_id: b.dataset.goal, logged_on: t });
      if (error) { b.disabled = false; return toast(error.message, 'err'); }
      if (!b.dataset.on) toast('Logged. Today counts on your trail.', 'ok');
      main();
    });
    host.querySelectorAll('[data-archive]').forEach(l => l.onclick = async (e) => {
      e.preventDefault(); await sb.from('goals').update({ active: false }).eq('id', l.dataset.archive); main();
    });
    host.querySelectorAll('[data-check]').forEach(b => b.onclick = async () => {
      const how = b.dataset.check;
      const patch = how === 'yes' ? { reached_on: t, checked_on: t } : { checked_on: t };
      const { error } = await sb.from('quest_milestones').update(patch).eq('id', cur.id);
      if (error) return toast(error.message, 'err');
      if (how === 'yes') {
        const last = ci === ms.length - 1;
        modal(`<div class="center"><div style="font-size:2.4rem">${last ? '⛰' : '🚩'}</div>
          <h2>${last ? 'You reached your goal' : 'Milestone reached'}</h2>
          <p><strong>${esc(cur.title)}</strong></p>
          <p class="muted">${last ? `“${esc(q.intention || theme.label)}” is happening for you. The trail stays as long as you like.`
            : `${next ? `Next up: ${esc(next.title)}. Its stepping stones are ready.` : ''}`}</p>
          <button class="btn" onclick="this.closest('.backdrop').remove()">Keep going</button></div>`);
        main();
      } else if (how === 'adjust') { toast('No rush. Reword it or swap its stones.', 'ok'); editMilestones(q, ms, ci); }
      else { toast('Noted. It will ask again in a week.', 'ok'); main(); }
    });
    host.querySelectorAll('[data-ms], g[data-ms]').forEach(el => {
      const go = () => milestoneModal(q, ms, Number(el.dataset.ms), d);
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    host.querySelectorAll('[data-goal-pill], g[data-goal]').forEach(el => el.addEventListener('click', () => setup({ quest: q, milestones: ms, step: 0 })));

    // Tonight's note.
    const box = $('#tonight-box'), tog = $('#tonight');
    const idea = () => { $('#idea').textContent = helper.prompt(q.categories, Date.now()); };
    tog.onclick = () => { box.hidden = !box.hidden; tog.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) { idea(); $('#helped').focus(); } };
    $('#another').onclick = idea;
    $('#save-note').onclick = async (e) => {
      const helped = $('#helped').value.trim();
      if (!helped) return toast('Write a few words first, or leave it for another day.', 'err');
      busy(e.target, true, 'Saving…');
      const { error } = await sb.from('quest_reflections').upsert({ user_id: uid, noted_on: t, helped }, { onConflict: 'user_id,noted_on' });
      busy(e.target, false);
      if (error) return toast(error.message, 'err');
      toast('Saved. Today counts on your trail.', 'ok'); main();
    };
  }

  /* ------------------------------------------------------------ setup */
  /* Three screens: the goal in the member's words (the theme is read from
     it, in the browser), the milestones, and the stepping stones for the
     first one. With `quest` it edits in place; `step` picks the screen. */
  function setup({ fresh = false, restart = false, quest = null, milestones = [], step = null } = {}) {
    const st = {
      step: step ?? (quest ? 1 : 0),
      text: quest?.intention || '', theme: quest?.value_key || null, picked: !!quest,
      minutes: quest?.minutes || 5,
      ms: milestones.length ? milestones.map(m => ({ id: m.id, title: m.title, steps: m.actions || [], own: m.own_steps || [], reached: !!m.reached_on, on: true }))
        : [],
      ownDraft: '',
    };
    const onlyGoal = !!quest && step === 0 && milestones.length > 0;   // rewording: save after screen 1
    const STEPS = 3;

    const draw = () => {
      const nav = `<div class="steps-nav" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) => `<span class="${i <= st.step ? 'on' : ''}"></span>`).join('')}</div>`;
      const det = detectTheme(st.text);
      const theme = st.theme ? valueOf(st.theme) : null;
      let inner = '';
      if (st.step === 0) inner = `
        <span class="kicker">Step 1 of 3 · your goal</span>
        <h2>What would you like your life to have more of?</h2>
        <p class="muted">Say it the way you would to a friend. This is the destination; everything else on the page serves it.</p>
        <textarea id="goal" rows="2" maxlength="240" placeholder="e.g. Evenings that feel like mine again">${esc(st.text)}</textarea>
        <div class="chips" style="margin-top:8px">${EXAMPLE_GOALS.map(g => `<button class="chip" data-ex="${esc(g.text)}">${esc(g.text)}</button>`).join('')}</div>
        <div class="sounds" id="sounds">${soundsLike(det)}</div>
        <p class="help" style="margin-top:14px">Matching happens in your browser by looking for everyday words. Your words never leave your device and no AI reads them.</p>`;
      if (st.step === 1) inner = `
        <span class="kicker">Step 2 of 3 · milestones</span>
        <h2>What would you notice along the way?</h2>
        <p class="muted">Milestones are things you could point to in real life, not numbers. Pick three to five, in the order
          you would like to reach them, or write your own. You will work on one at a time.</p>
        <div class="ms-list">${st.ms.map((m, i) => `<label class="ms-pick ${m.on ? 'on' : ''} ${m.reached ? 'reached' : ''}">
            <input type="checkbox" data-ms-on="${i}" ${m.on ? 'checked' : ''} ${m.reached ? 'disabled' : ''}>
            <span class="ms-n">${m.reached ? '✓' : i + 1}</span>
            <input class="ms-title" data-ms-title="${i}" value="${esc(m.title)}" maxlength="140" ${m.reached ? 'readonly' : ''} aria-label="Milestone ${i + 1}">
            <span class="ms-tools">${i > 0 && !m.reached ? `<button type="button" data-up="${i}" aria-label="Move up">↑</button>` : ''}${!m.id && !m.reached ? `<button type="button" data-rm="${i}" aria-label="Remove">×</button>` : ''}</span>
          </label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><input id="ms-new" maxlength="140" placeholder="Write a milestone of your own…" style="flex:1;min-width:200px">
          <button class="btn sm ghost" id="ms-add">Add</button></div>`;
      if (st.step === 2) {
        const first = st.ms.find(m => m.on && !m.reached);
        const sug = first ? suggestSteps({ text: st.text, theme: st.theme, milestone: first, minutes: st.minutes, limit: 9 }) : [];
        const chosen = new Set(first?.steps || []);
        inner = `
        <span class="kicker">Step 3 of 3 · stepping stones</span>
        <h2>Small steps toward “${esc(first?.title || 'your first milestone')}”</h2>
        <p class="muted">These are deliberately small. Doing any one of them on a day is that day's step. Keep three or four;
          you can swap them any time.</p>
        <div class="row" style="margin:6px 0 12px"><span class="faint">I usually have</span>${MINUTES.map(m => `<button class="chip ${st.minutes === m ? 'on' : ''}" data-min="${m}">${m} min</button>`).join('')}</div>
        <div class="st-list">${sug.map(s => `<label class="st-pick ${chosen.has(s.action.key) ? 'on' : ''}">
            <input type="checkbox" data-st="${s.action.key}" ${chosen.has(s.action.key) ? 'checked' : ''}>
            <span><span class="what">${esc(s.action.text)}</span><span class="meta">about ${s.action.min} min · ${esc(reasonFor(s, first))}</span></span></label>`).join('')}
          ${(first?.own || []).map((o, i) => `<label class="st-pick on own"><input type="checkbox" checked data-own-rm="${i}"><span><span class="what">${esc(o)}</span><span class="meta">your own step</span></span></label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><input id="own-new" maxlength="120" placeholder="Add a step of your own…" style="flex:1;min-width:200px">
          <button class="btn sm ghost" id="own-add">Add</button></div>`;
      }
      host.innerHTML = `<div class="card pad-lg narrow setup" style="margin:0 auto">${nav}${inner}
        <div class="row" style="justify-content:space-between;margin-top:24px">
          <span class="row">${st.step > 0 && !(quest && step === 1) ? '<button class="btn ghost" id="back">Back</button>' : ''}
            ${quest || restart ? '<button class="btn ghost" id="cancel">Cancel</button>' : ''}</span>
          <button class="btn" id="next">${onlyGoal ? 'Save' : st.step === STEPS - 1 ? (quest ? 'Save' : 'Set out') : 'Next'}</button>
        </div></div>`;

      const $ = (s) => host.querySelector(s);
      // Screen 1
      const goalBox = $('#goal');
      if (goalBox) {
        goalBox.oninput = () => { st.text = goalBox.value; st.picked = false; const dd = detectTheme(st.text); st.theme = dd.theme; $('#sounds').innerHTML = soundsLike(dd); wireTheme(); };
        host.querySelectorAll('[data-ex]').forEach(c => c.onclick = () => { goalBox.value = c.dataset.ex; goalBox.dispatchEvent(new Event('input')); });
        wireTheme();
      }
      function wireTheme() {
        host.querySelectorAll('[data-theme]').forEach(c => c.onclick = () => { st.theme = c.dataset.theme; st.picked = true; $('#sounds').innerHTML = soundsLike(detectTheme(st.text)); wireTheme(); });
      }
      function soundsLike(dd) {
        const chosen = st.theme ? valueOf(st.theme) : null;
        const words = recognizedWords(st.text);
        const chips = `<div class="chips" style="margin-top:8px">${VALUES.map(v => `<button class="chip ${st.theme === v.key ? 'on' : ''}" data-theme="${v.key}">${v.icon} ${esc(v.label)}</button>`).join('')}</div>`;
        if (!st.text.trim()) return '';
        if (!chosen) return `<p style="margin:14px 0 0"><strong>Which of these is closest?</strong> <span class="faint">We did not spot a word we know, so pick the kind of goal this is.</span></p>${chips}`;
        return `<p style="margin:14px 0 0"><strong>Sounds like ${chosen.icon} ${esc(chosen.phrase)}</strong>
          <span class="faint">${words.length && !st.picked ? `because you wrote ${words.slice(0, 3).map(w => `“${esc(w)}”`).join(', ')}. ` : ''}Not quite? Pick the closest:</span></p>${chips}`;
      }
      // Screen 2
      host.querySelectorAll('[data-ms-on]').forEach(c => c.onchange = () => { st.ms[+c.dataset.msOn].on = c.checked; draw(); });
      host.querySelectorAll('[data-ms-title]').forEach(inp => inp.onchange = () => { st.ms[+inp.dataset.msTitle].title = inp.value.trim(); });
      host.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; [st.ms[i - 1], st.ms[i]] = [st.ms[i], st.ms[i - 1]]; draw(); });
      host.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { st.ms.splice(+b.dataset.rm, 1); draw(); });
      $('#ms-add')?.addEventListener('click', () => {
        const v = $('#ms-new').value.trim(); if (!v) return;
        const sug = suggestSteps({ text: st.text, theme: st.theme, milestone: { title: v, steps: [] }, minutes: st.minutes, limit: 4 });
        st.ms.push({ title: v, steps: sug.map(s => s.action.key), own: [], on: true }); draw();
      });
      // Screen 3
      const first = st.ms.find(m => m.on && !m.reached);
      host.querySelectorAll('[data-min]').forEach(c => c.onclick = () => { st.minutes = +c.dataset.min; draw(); });
      host.querySelectorAll('[data-st]').forEach(c => c.onchange = () => {
        const set = new Set(first.steps); c.checked ? set.add(c.dataset.st) : set.delete(c.dataset.st);
        first.steps = [...set].slice(0, 8); c.closest('label').classList.toggle('on', c.checked);
      });
      host.querySelectorAll('[data-own-rm]').forEach(c => c.onchange = () => { first.own.splice(+c.dataset.ownRm, 1); draw(); });
      $('#own-add')?.addEventListener('click', () => { const v = $('#own-new').value.trim(); if (!v || first.own.length >= 8) return; first.own.push(v); draw(); });

      $('#back')?.addEventListener('click', () => { st.step--; draw(); });
      $('#cancel')?.addEventListener('click', () => main());
      $('#next').onclick = async (e) => {
        if (st.step === 0) {
          st.text = ($('#goal').value || '').trim();
          if (st.text.length < 3) return toast('Write your goal first, even a few words.', 'err');
          if (!st.theme) return toast('Pick the kind of goal this is, so the steps can fit it.', 'err');
          if (onlyGoal) return save(e.target);
          if (!st.ms.length) st.ms = suggestMilestones(st.theme, st.text).map((m, i) => ({ ...m, own: [], on: i < 3 }));
        }
        if (st.step === 1) {
          st.ms.forEach((m, i) => { const inp = host.querySelector(`[data-ms-title="${i}"]`); if (inp) m.title = inp.value.trim(); });
          const on = st.ms.filter(m => m.on && m.title);
          if (!on.length) return toast('Pick at least one milestone.', 'err');
          if (on.length > 6) return toast('Six milestones is plenty for one goal.', 'err');
          const first = on.find(m => !m.reached);
          if (first && !first.steps.length) first.steps = suggestSteps({ text: st.text, theme: st.theme, milestone: first, minutes: st.minutes, limit: 4 }).map(s => s.action.key);
        }
        if (st.step === 2) {
          const first = st.ms.find(m => m.on && !m.reached);
          if (first && !first.steps.length && !first.own.length) return toast('Keep at least one stepping stone.', 'err');
          return save(e.target);
        }
        st.step++; draw();
      };
    };

    async function save(btn) {
      busy(btn, true, 'Saving…');
      const row = { value_key: st.theme, intention: st.text.slice(0, 240) || null, categories: CATEGORIES.map(c => c.key),
        minutes: st.minutes, helper: true };
      let qid = quest?.id, error;
      if (quest) ({ error } = await sb.from('quests').update(row).eq('id', quest.id));
      else {
        await sb.from('quests').update({ active: false }).eq('user_id', uid).eq('active', true);
        const ins = await sb.from('quests').insert({ ...row, user_id: uid, scene: 'garden' }).select('id').maybeSingle();
        error = ins.error; qid = ins.data?.id;
        if (!qid && !error) ({ data: { id: qid } = {} } = await sb.from('quests').select('id').eq('user_id', uid).eq('active', true).maybeSingle());
      }
      if (error) { busy(btn, false); return toast(error.message, 'err'); }
      if (!onlyGoal) {
        const keep = st.ms.filter(m => m.on && m.title);
        // Rows the member unticked go; the rest are written in order.
        for (const m of milestones) if (!keep.find(k => k.id === m.id)) await sb.from('quest_milestones').delete().eq('id', m.id);
        // Positions must stay unique while reordering, so park the existing rows first.
        for (const [i, m] of keep.entries()) if (m.id) await sb.from('quest_milestones').update({ position: 100 + i }).eq('id', m.id);
        for (const [i, m] of keep.entries()) {
          const steps = m.steps.length ? m.steps.slice(0, 8)
            : suggestSteps({ text: st.text, theme: st.theme, milestone: m, minutes: st.minutes, limit: 4 }).map(s => s.action.key);
          const body = { title: m.title.slice(0, 140), position: i, actions: steps, own_steps: (m.own || []).slice(0, 8) };
          const r = m.id ? await sb.from('quest_milestones').update(body).eq('id', m.id)
                         : await sb.from('quest_milestones').insert({ ...body, quest_id: qid, user_id: uid });
          if (r.error) { busy(btn, false); return toast(r.error.message, 'err'); }
        }
      }
      busy(btn, false);
      toast(quest ? 'Saved.' : 'Your trail is ready. One small step at a time.', 'ok');
      main();
    }
    draw();
  }

  /* --------------------------------------------------------- editors */
  const editMilestones = (q, ms, focus = null) => setup({ quest: q, milestones: ms, step: 1 });

  function pickStones(q, cur) {
    const sug = suggestSteps({ text: q.intention || '', theme: q.value_key, milestone: { title: cur.title, steps: cur.actions || [] }, minutes: q.minutes, limit: 12 });
    const chosen = new Set(cur.actions || []);
    const own = [...(cur.own_steps || [])];
    const back = modal(`<span class="kicker">Stepping stones</span><h2 style="margin:4px 0 6px">Toward “${esc(cur.title)}”</h2>
      <p class="muted">Keep three or four. Small is the point.</p>
      <div class="st-list" id="pick">${sug.map(s => `<label class="st-pick ${chosen.has(s.action.key) ? 'on' : ''}"><input type="checkbox" data-st="${s.action.key}" ${chosen.has(s.action.key) ? 'checked' : ''}>
        <span><span class="what">${esc(s.action.text)}</span><span class="meta">about ${s.action.min} min · ${esc(reasonFor(s, { steps: cur.actions || [] }))}</span></span></label>`).join('')}
        ${own.map((o, i) => `<label class="st-pick on own"><input type="checkbox" checked data-own="${i}"><span><span class="what">${esc(o)}</span><span class="meta">your own step</span></span></label>`).join('')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" id="no">Cancel</button><button class="btn" id="yes">Save</button></div>`);
    back.querySelectorAll('[data-st]').forEach(c => c.onchange = () => { c.checked ? chosen.add(c.dataset.st) : chosen.delete(c.dataset.st); c.closest('label').classList.toggle('on', c.checked); });
    back.querySelector('#no').onclick = () => back.remove();
    back.querySelector('#yes').onclick = async (e) => {
      const keepOwn = own.filter((_, i) => back.querySelector(`[data-own="${i}"]`).checked);
      if (!chosen.size && !keepOwn.length) return toast('Keep at least one.', 'err');
      busy(e.target, true, 'Saving…');
      const { error } = await sb.from('quest_milestones').update({ actions: [...chosen].slice(0, 8), own_steps: keepOwn }).eq('id', cur.id);
      busy(e.target, false);
      if (error) return toast(error.message, 'err');
      back.remove(); main();
    };
  }

  function addOwnStep(cur) {
    const back = modal(`<h2>A step of your own</h2><p class="muted">Something small you could do on an ordinary day, toward “${esc(cur.title)}”.</p>
      <input id="own" maxlength="120" placeholder="e.g. Put the kettle on before opening my laptop">
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" id="no">Cancel</button><button class="btn" id="yes">Add</button></div>`);
    back.querySelector('#own').focus();
    back.querySelector('#no').onclick = () => back.remove();
    back.querySelector('#yes').onclick = async (e) => {
      const v = back.querySelector('#own').value.trim(); if (!v) return;
      if ((cur.own_steps || []).length >= 8) return toast('Eight of your own is the most for one milestone.', 'err');
      busy(e.target, true, 'Adding…');
      const { error } = await sb.from('quest_milestones').update({ own_steps: [...(cur.own_steps || []), v] }).eq('id', cur.id);
      busy(e.target, false);
      if (error) return toast(error.message, 'err');
      back.remove(); main();
    };
  }

  function pickScene(q) {
    const back = modal(`<h2>What grows along the trail</h2><p class="muted">It only ever grows. A missed day never takes anything away.</p>
      <div class="pick">${SCENES.map(s => `<button data-s="${s.key}" class="${q.scene === s.key ? 'on' : ''}">${esc(s.label)}<small>${esc(s.blurb)}</small></button>`).join('')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" id="no">Close</button></div>`);
    back.querySelector('#no').onclick = () => back.remove();
    back.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
      const { error } = await sb.from('quests').update({ scene: b.dataset.s }).eq('id', q.id);
      if (error) return toast(error.message, 'err');
      back.remove(); main();
    });
  }

  function milestoneModal(q, ms, i, d) {
    const m = ms[i], state = m.reached_on ? 'reached' : i === d.ci ? 'current' : 'ahead';
    const stones = stonesOf(m);
    const back = modal(`<span class="badge ${state === 'current' ? 'live' : state === 'reached' ? 'done' : 'gray'}">${state === 'current' ? 'Working on now' : state === 'reached' ? `Reached ${fmtDate(m.reached_on + 'T12:00')}` : 'Ahead'} · milestone ${i + 1} of ${ms.length}</span>
      <h2 style="margin:12px 0 6px">${esc(m.title)}</h2>
      <p class="muted">${state === 'ahead' ? 'Its stepping stones open when you reach the milestone before it. A peek:' : state === 'reached' ? 'The stepping stones that got you here:' : 'Its stepping stones:'}</p>
      <ul class="muted" style="padding-left:18px">${stones.map(s => `<li>${esc(s.text)}</li>`).join('') || '<li>None picked yet.</li>'}</ul>
      <div class="row" style="justify-content:flex-end;margin-top:14px">${state !== 'reached' ? '<button class="btn ghost" id="edit">Change milestones</button>' : ''}<button class="btn" id="ok">Close</button></div>`);
    back.querySelector('#ok').onclick = () => back.remove();
    back.querySelector('#edit')?.addEventListener('click', () => { back.remove(); editMilestones(q, ms); });
  }

  function notesModal(d) {
    const stepNotes = d.steps.filter(x => x.note).sort((a, b) => b.done_on.localeCompare(a.done_on));
    const back = modal(`<h2>Earlier notes</h2>
      ${d.reflections.length ? d.reflections.map(r => `<div class="refl"><div class="spread"><span class="faint">${fmtDate(r.noted_on + 'T12:00')}</span>
        <button class="btn sm ghost" data-del="${r.id}">Delete</button></div><div style="white-space:pre-wrap">${esc(r.helped)}</div></div>`).join('')
        : '<p class="faint">Nothing yet. Tonight\'s note on the main page is where one starts.</p>'}
      ${stepNotes.length ? `<h3 style="margin-top:22px">Written on your trail</h3>${stepNotes.map(x => `<div class="refl"><div class="faint">${fmtDate(x.done_on + 'T12:00')} · ${esc(action(x.action_key)?.text || x.action_key)}</div><div style="white-space:pre-wrap">${esc(x.note)}</div></div>`).join('')}` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="ok">Close</button></div>`);
    back.querySelector('#ok').onclick = () => back.remove();
    back.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const { error } = await sb.from('quest_reflections').delete().eq('id', b.dataset.del);
      if (error) return toast(error.message, 'err');
      back.remove(); main().then(() => load().then(notesModal));
    });
  }

  function dataModal() {
    const back = modal(`<h2>Your data, your call</h2>
      <ul class="muted" style="padding-left:18px">
        <li>Your goal, milestones, steps and notes can only be read by you. Therapists on Theraglee, other members and the admin screen have no access to them.</li>
        <li>We never sell or share this data, and it is not used for advertising.</li>
        <li>Suggestions are matched in your browser from everyday words. Nothing you write is sent to an AI service or anywhere else.</li>
        <li>Theraglee is a wellness site, not a health care provider, so nothing here is a medical record. See the <a href="privacy.html">privacy policy</a>.</li>
      </ul>
      <div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost" id="dl">Download everything</button>
        <button class="btn danger" id="del-notes">Delete all my notes</button><button class="btn danger" id="del-all">Delete all goals and trail data</button></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="ok">Close</button></div>`);
    back.querySelector('#ok').onclick = () => back.remove();
    back.querySelector('#dl').onclick = async (e) => {
      busy(e.target, true, 'Gathering…');
      const [q, m, s, r, g] = await Promise.all([
        sb.from('quests').select('*').eq('user_id', uid), sb.from('quest_milestones').select('*').eq('user_id', uid),
        sb.from('quest_steps').select('*').eq('user_id', uid), sb.from('quest_reflections').select('*').eq('user_id', uid),
        sb.from('goals').select('*, goal_logs(*)').eq('user_id', uid),
      ]);
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), quests: q.data, milestones: m.data, quest_steps: s.data, reflections: r.data, goals: g.data }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'theraglee-goals-and-trail.json'; link.click(); URL.revokeObjectURL(url);
      busy(e.target, false);
    };
    const confirmThen = (title, text, run) => {
      const b2 = modal(`<h2>${title}</h2><p class="muted">${text}</p>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="no">Keep it</button><button class="btn danger" id="yes">Delete</button></div>`);
      b2.querySelector('#no').onclick = () => b2.remove();
      b2.querySelector('#yes').onclick = async (e) => {
        busy(e.target, true, 'Deleting…');
        const errors = (await run()).map(x => x.error).filter(Boolean);
        busy(e.target, false); b2.remove(); back.remove();
        if (errors.length) return toast(errors[0].message, 'err');
        toast('Deleted.', 'ok'); main();
      };
    };
    back.querySelector('#del-notes').onclick = () => confirmThen('Delete all notes?', 'Every "What helped" note will be removed for good.',
      () => Promise.all([sb.from('quest_reflections').delete().eq('user_id', uid)]));
    back.querySelector('#del-all').onclick = () => confirmThen('Delete all goals and trail data?', 'Your goals, milestones, marked steps, notes and old goal logs will be removed for good.',
      () => Promise.all([
        sb.from('quests').delete().eq('user_id', uid),             // takes milestones and steps with it
        sb.from('quest_milestones').delete().eq('user_id', uid),
        sb.from('quest_steps').delete().eq('user_id', uid),
        sb.from('quest_reflections').delete().eq('user_id', uid),
        sb.from('goals').delete().eq('user_id', uid),
      ]));
  }

  await main();
  return { refresh: main };
}
