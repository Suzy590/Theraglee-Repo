/* ==========================================================================
   Theraglee — the Mood tab on the member dashboard.
   One tap for the day's mood (saved straight away), then a one-tap 1 to 10
   rating for each factor that may be shaping it, and the weather. Those are
   sent together with Submit, which works only once all of them are answered.
   A submitted day is final until the next day; the database enforces this
   (20260925130000_mood_submit_once_a_day.sql). Once
   there are seven days of entries (in a row or not), "Your mood patterns"
   says which factors move with the mood. The factors and the analysis live in
   mood-patterns.js; docs/mood.md is the guide.
   ========================================================================== */
import { sb, esc, toast } from './app.js';
import { MOODS, FACTORS, WEATHER, MIN_DAYS, analyze, strength } from './mood-patterns.js';

const COLS = ['logged_on', 'mood', 'weather', 'submitted_at', ...FACTORS.map(f => f[0])].join(',');
/* Everything Submit needs: the nine factors and the weather. */
const NEEDED = [...FACTORS.map(f => f[0]), 'weather'];

/* The member's own calendar day, so "tomorrow" starts at their midnight. */
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* Pages whose Mood tab already redraws itself when the day changes. */
const watched = new WeakSet();

export async function mountMood(host, profile) {
  const uid = profile.id;
  const today = todayKey();
  // A page left open past midnight starts the new day fresh the next time
  // it is looked at, instead of showing yesterday's check-in.
  if (!watched.has(host)) {
    watched.add(host);
    let day = today;
    const fresh = () => {
      if (document.visibilityState !== 'visible' || !host.isConnected || todayKey() === day) return;
      day = todayKey();
      mountMood(host, profile);
    };
    document.addEventListener('visibilitychange', fresh);
    addEventListener('focus', fresh);
  }
  const { data, error } = await sb.from('mood_logs').select(COLS)
    .eq('user_id', uid).order('logged_on', { ascending: false }).limit(365);
  if (error) { host.innerHTML = `<div class="empty">Your mood log could not be loaded. ${esc(error.message)}</div>`; return; }
  const rows = data || [];
  let now = rows.find(r => r.logged_on === today) || null;
  // Answers picked but not yet submitted. Always starts empty: only Submit
  // saves them, and a submitted day is shown cleared.
  const draft = {};
  const submitted = () => Boolean(now?.submitted_at);

  host.innerHTML = `
    <div class="card" id="mood-card">
      <h3>How are you today?</h3>
      <p class="faint" style="margin-top:-4px">One tap for your day overall.</p>
      <div class="mood" data-mood>${MOODS.map(([m, e, l]) =>
        `<button type="button" data-m="${m}" title="${l}" aria-label="${l}">${e}</button>`).join('')}</div>
      <div data-mood-after class="faint" style="margin-top:12px"></div>
    </div>

    <div class="card" id="mood-factors" style="margin-top:26px">
      <h3>What might be shaping it?</h3>
      <p class="faint" style="margin-top:-4px">How does each of these feel <strong>today</strong>?
        1 is terrible, 10 is fantastic. One tap each, then press Submit at the bottom.</p>
      <div class="factor-list">${FACTORS.map(([key, label, hint]) => `
        <div class="factor" data-factor="${key}">
          <div class="factor-head"><strong>${esc(label)}</strong><span class="faint">${esc(hint)}</span></div>
          <div class="scale" role="group" aria-label="${esc(label)}, 1 to 10">${
            Array.from({ length: 10 }, (_, i) =>
              `<button type="button" data-v="${i + 1}" aria-label="${i + 1}">${i + 1}</button>`).join('')}</div>
          <div class="scale-ends faint"><span>Terrible</span><span>Fantastic</span></div>
        </div>`).join('')}
        <div class="factor">
          <div class="factor-head"><strong>Weather</strong><span class="faint">What was it like outside today?</span></div>
          <div class="weather" role="group" aria-label="Weather">${WEATHER.map(([k, e, l]) =>
            `<button type="button" data-w="${k}" title="${l}" aria-label="${l}">${e}<span>${l}</span></button>`).join('')}</div>
        </div>
      </div>
      <div class="submit-row">
        <button type="button" class="btn" data-submit disabled>Submit</button>
        <p data-factors-after class="faint" style="margin:0"></p>
      </div>
    </div>

    <div class="card" id="mood-patterns" style="margin-top:26px"></div>`;

  const $ = (s) => host.querySelector(s);

  function paintToday() {
    const locked = submitted();
    // Once submitted the day is done: the answers clear and stay locked
    // until tomorrow's blank check-in.
    host.querySelectorAll('[data-mood] button').forEach(b => {
      b.classList.toggle('on', !locked && Number(b.dataset.m) === now?.mood);
      b.disabled = locked;
    });
    $('[data-mood-after]').textContent = locked
      ? 'Submitted for today. You can check in again tomorrow.'
      : now ? 'Saved for today. Tap another face to change it.' : '';
    // The questions always show, so the whole check-in is visible from the
    // start; Submit waits for the face at the top as well as every answer.
    $('.factor-list').style.display = locked ? 'none' : '';
    if (locked) for (const k of NEEDED) delete draft[k];
    for (const [key] of FACTORS) {
      host.querySelectorAll(`[data-factor="${key}"] button`).forEach(b => {
        b.classList.toggle('on', Number(b.dataset.v) === draft[key]);
        b.disabled = locked;
      });
    }
    host.querySelectorAll('[data-w]').forEach(b => {
      b.classList.toggle('on', b.dataset.w === draft.weather);
      b.disabled = locked;
    });
    const done = NEEDED.filter(k => draft[k] != null).length;
    const btn = $('[data-submit]');
    btn.disabled = locked || !now || done < NEEDED.length;
    btn.style.display = locked ? 'none' : '';
    $('[data-factors-after]').textContent = locked
      ? 'All done for today. Thank you for checking in. You can check in again tomorrow.'
      : done < NEEDED.length
        ? `${done} of ${NEEDED.length} answered. Answer them all to submit.`
        : !now
          ? 'All answered. Tap a face at the top for your day overall, then press Submit.'
          : 'All answered. Press Submit to save today\'s check-in.';
  }

  function paintPatterns() {
    const res = analyze(rows);
    const disclaimer = `<p class="mood-note">This is for your information only. It does not diagnose or
      treat any mental health condition, and it is not a substitute for care from a qualified professional.
      A link between two things does not mean one causes the other.</p>`;
    if (!res.ready) {
      const left = MIN_DAYS - res.days;
      $('#mood-patterns').innerHTML = `
        <h3>Your mood patterns</h3>
        <p class="muted" style="margin-top:-4px">You need at least ${MIN_DAYS} days of check-ins before
          your patterns can be analyzed. The days do not have to be in a row.</p>
        <div class="bar" style="margin:14px 0 8px"><i style="width:${Math.round(res.days / MIN_DAYS * 100)}%"></i></div>
        <p class="faint" style="margin:0">${res.days} of ${MIN_DAYS} days logged.
          ${left === 1 ? 'One more day to go.' : `${left} more days to go.`}</p>
        ${disclaimer}`;
      return;
    }
    const rated = res.factors.filter(f => f.r !== null)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const waiting = res.factors.filter(f => f.r === null);
    $('#mood-patterns').innerHTML = `
      <h3>Your mood patterns</h3>
      <p class="faint" style="margin-top:-4px">Based on ${res.days} days of check-ins.
        ${res.days < 14 ? 'With this few days, treat these as early hints.' : ''}</p>
      <ul class="mood-findings">${res.statements.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      ${rated.length ? `
        <h4 style="margin:22px 0 10px">How closely each factor moves with your mood</h4>
        <div class="links">${rated.map(f => `
          <div class="link-row">
            <span>${esc(f.label)}</span>
            <div class="bar ${f.r < 0 ? 'neg' : ''}"><i style="width:${Math.round(Math.abs(f.r) * 100)}%"></i></div>
            <span class="faint">${strength(f.r) === 'little' ? 'little or no link' : strength(f.r) + (f.r < 0 ? ', opposite' : '')}</span>
          </div>`).join('')}</div>` : ''}
      ${waiting.length ? `<p class="faint" style="margin:14px 0 0">Not enough varied ratings yet for:
        ${waiting.map(f => esc(f.label)).join(', ')}. Each one needs ${MIN_DAYS} days rated, and not all the same number.</p>` : ''}
      ${disclaimer}`;
  }

  // Keeps the local copy of today's row in step with what was saved.
  function keep(saved) {
    now = { ...(now || { logged_on: today }), ...saved };
    const i = rows.findIndex(r => r.logged_on === today);
    if (i >= 0) rows[i] = now; else rows.unshift(now);
    paintToday(); paintPatterns();
  }

  // The day turned over while the page sat open: start the new day instead
  // of saving to yesterday.
  const dayChanged = () => {
    if (todayKey() === today) return false;
    toast('A new day has started, so your check-in has reset.', 'ok');
    mountMood(host, profile);
    return true;
  };

  host.querySelectorAll('[data-mood] button').forEach(b => b.addEventListener('click', async () => {
    if (submitted() || dayChanged()) return;
    const mood = Number(b.dataset.m);
    const { error } = await sb.from('mood_logs')
      .upsert({ user_id: uid, logged_on: today, mood }, { onConflict: 'user_id,logged_on' });
    if (error) return toast(error.message, 'err');
    keep({ mood });
  }));

  // Picking a rating only marks it; nothing is saved until Submit.
  host.querySelectorAll('[data-factor]').forEach(row => row.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => {
      if (submitted()) return;
      draft[row.dataset.factor] = Number(b.dataset.v); paintToday();
    })));
  host.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
    if (submitted()) return;
    draft.weather = b.dataset.w; paintToday();
  }));

  $('[data-submit]').addEventListener('click', async (e) => {
    if (!now || submitted() || NEEDED.some(k => draft[k] == null) || dayChanged()) return;
    e.target.disabled = true;
    const patch = { ...draft, submitted_at: new Date().toISOString() };
    const { error } = await sb.from('mood_logs').update(patch)
      .eq('user_id', uid).eq('logged_on', today);
    if (error) { paintToday(); return toast(error.message, 'err'); }
    keep(patch);
    $('#mood-factors').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  paintToday(); paintPatterns();
}
