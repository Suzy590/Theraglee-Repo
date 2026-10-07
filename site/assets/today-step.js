/* The Today tab's prompt for the Mental Health Goals trail: today's stepping
   stones for the milestone the member is working on, with pebbles that count
   right here, so nobody has to remember to open the Goals tab to be asked.

   It reads the same rows the Goals tab reads (assets/goals-ui.js) and writes a
   quest_steps row the same way, so the two always agree. Premium only, like
   the trail itself; for everyone else the zone stays hidden.

   mountTodayStep(host, ctx) draws into host (the zone's inner div) and shows or
   hides the zone around it. It returns { refresh } so the dashboard can redraw
   the card each time the Today tab opens. A tap here fires a 'trail-step'
   event on host so the Goals tab can be drawn fresh next time it opens. */
import { action, valueOf, VALUES } from './quest-paths.js';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
const ownKey = (ms, i) => `own_${String(ms.id).replace(/-/g, '').slice(0, 8)}_${i}`;
const STEPS_PER_MILESTONE = 7;      // the same count the Goals tab uses for the weekly question

export async function mountTodayStep(host, { sb, uid, level, esc, toast }) {
  const zone = host.closest('section') || host;
  if (level < 3) { zone.hidden = true; return { refresh: async () => {} }; }

  async function load() {
    const q = await sb.from('quests').select('*').eq('user_id', uid).eq('active', true).maybeSingle();
    const quest = q.data;
    if (!quest) return { quest: null };
    const [m, s] = await Promise.all([
      sb.from('quest_milestones').select('*').eq('quest_id', quest.id).order('position', { ascending: true }),
      sb.from('quest_steps').select('milestone_id,action_key,done_on').eq('quest_id', quest.id),
    ]);
    const milestones = m.data || [], steps = s.data || [];
    const ci = milestones.findIndex(x => !x.reached_on);
    const cur = ci < 0 ? null : milestones[ci];
    const stepDays = cur ? new Set(steps.filter(x => x.milestone_id === cur.id).map(x => x.done_on)) : new Set();
    const startedOn = cur ? (ci ? milestones[ci - 1].reached_on : (quest.created_at || '').slice(0, 10)) : null;
    return { quest, milestones, steps, ci, cur, stepDays, startedOn };
  }

  const stonesOf = (ms) => [
    ...(ms.actions || []).map(k => action(k)).filter(Boolean).map(a => ({ key: a.key, text: a.text, min: a.min, write: !!a.write })),
    ...(ms.own_steps || []).map((t, i) => ({ key: ownKey(ms, i), text: t, min: null, write: false })),
  ];

  async function draw() {
    const d = await load();
    zone.hidden = false;
    const t = today();

    // A Premium member with no goal yet: one line, and the way in.
    if (!d.quest || !d.milestones?.length) {
      host.innerHTML = `<div class="card trail-today">
        <p style="margin:0">No goal on your trail yet. Pick one, and your stepping stones for the day will wait for you here every morning.</p>
        <div class="row" style="margin-top:12px"><a class="btn sm" href="dashboard.html#goals">Set a goal</a></div></div>`;
      return;
    }

    const { quest: q, milestones: ms, cur, stepDays, startedOn } = d;
    const theme = valueOf(q.value_key) || VALUES[0];
    const goal = q.intention || theme.label;

    // Every milestone reached: the goal is in hand, and nothing is asked today.
    if (!cur) {
      host.innerHTML = `<div class="card trail-today">
        <div class="today-status done" role="status"><b aria-hidden="true">✓</b>
          <div><strong>You reached every camp on this trail.</strong>
            <span>“${esc(goal)}” is yours. On the Goals tab, look back at where you set out from, then keep this trail going or set out for a new one.</span></div></div>
        <div class="row" style="margin-top:12px"><a class="btn sm" href="dashboard.html#goals">Open your trail</a></div></div>`;
      return;
    }

    const doneToday = new Set(d.steps.filter(x => x.done_on === t && x.milestone_id === cur.id).map(x => x.action_key));
    const steppedToday = stepDays.has(t);
    const stones = stonesOf(cur);
    const sinceStart = startedOn ? daysBetween(startedOn, t) : 0;
    const sinceCheck = cur.checked_on ? daysBetween(cur.checked_on, t) : 99;
    const checkDue = sinceCheck >= 7 && (stepDays.size >= STEPS_PER_MILESTONE || sinceStart >= 7);

    host.innerHTML = `<div class="card trail-today">
      <div class="today-status ${steppedToday ? 'done' : 'open'}" role="status">
        <b aria-hidden="true">${steppedToday ? '✓' : '1'}</b>
        <div><strong>${steppedToday ? 'Today is done.' : 'Today still needs one step.'}</strong>
          <span>${steppedToday
            ? 'One stepping stone was all today needed, and you took it. Anything more below is a bonus.'
            : 'Do any one of the stones below and tap its pebble. That counts the whole day; the rest are optional.'}</span></div>
      </div>
      <p class="trail-today-ctx"><span>Toward <b>${esc(goal)}</b></span><span>Working on <b>${esc(cur.title)}</b></span></p>
      ${stones.length ? stones.map(st => `<div class="stone ${doneToday.has(st.key) ? 'done' : ''}">
          <button class="pebble ${doneToday.has(st.key) ? 'on' : ''}" data-step="${esc(st.key)}" aria-pressed="${doneToday.has(st.key)}"
            aria-label="${doneToday.has(st.key) ? 'Done today. Tap to undo' : 'Mark done today'}">${doneToday.has(st.key) ? '✓' : ''}</button>
          <div class="txt"><div class="what">${esc(st.text)}</div>
            <div class="meta">${st.min ? `about ${st.min} min` : 'your own step'}${st.write ? ' · a note can go with this one on your trail' : ''}</div></div></div>`).join('')
        : '<p class="muted">No stepping stones picked for this milestone yet. Choose a few on your trail.</p>'}
      ${checkDue ? `<p class="trail-today-ask">Your trail has a question for you today: is “${esc(cur.title)}” happening for you now? Answer it on the Mental Health Goals tab.</p>` : ''}
      <div class="row" style="margin-top:12px;gap:14px;align-items:center">
        <a class="btn sm ghost" href="dashboard.html#goals">Open your trail</a>
        <span class="faint">The trail map, your notes and the camps ahead are all there.</span>
      </div></div>`;

    host.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', async () => {
      const key = b.dataset.step;
      b.disabled = true;
      const was = doneToday.has(key);
      const { error } = was
        ? await sb.from('quest_steps').delete().eq('quest_id', q.id).eq('action_key', key).eq('done_on', t)
        : await sb.from('quest_steps').insert({ quest_id: q.id, user_id: uid, milestone_id: cur.id, action_key: key, done_on: t });
      if (error) { b.disabled = false; return toast('Could not save that. Try again.', 'err'); }
      if (!was && !steppedToday) toast('Today is done. A new flower is on your trail.', 'ok');
      host.dispatchEvent(new CustomEvent('trail-step', { bubbles: true }));
      await draw();
    }));
  }

  await draw();
  return { refresh: draw };
}
