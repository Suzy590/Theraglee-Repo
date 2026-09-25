/* ==========================================================================
   Theraglee — the Mood tab on the member dashboard.
   One tap for the day's mood, then a one-tap 1 to 10 rating for each factor
   that may be shaping it, and the weather. Every tap saves on its own. Once
   there are seven days of entries (in a row or not), "Your mood patterns"
   says which factors move with the mood. The factors and the analysis live in
   mood-patterns.js; docs/mood.md is the guide.
   ========================================================================== */
import { sb, esc, toast } from './app.js';
import { MOODS, FACTORS, WEATHER, MIN_DAYS, analyze, strength } from './mood-patterns.js';

const COLS = ['logged_on', 'mood', 'weather', ...FACTORS.map(f => f[0])].join(',');

/* The same "today" the Goals & tracking page uses, so both read the same row. */
const todayKey = () => new Date().toISOString().slice(0, 10);

export async function mountMood(host, profile) {
  const uid = profile.id;
  const today = todayKey();
  const { data, error } = await sb.from('mood_logs').select(COLS)
    .eq('user_id', uid).order('logged_on', { ascending: false }).limit(365);
  if (error) { host.innerHTML = `<div class="empty">Your mood log could not be loaded. ${esc(error.message)}</div>`; return; }
  const rows = data || [];
  let now = rows.find(r => r.logged_on === today) || null;

  host.innerHTML = `
    <div class="card" id="mood-card">
      <h3>How are you today?</h3>
      <p class="faint" style="margin-top:-4px">One tap for your day overall.</p>
      <div class="mood" data-mood>${MOODS.map(([m, e, l]) =>
        `<button type="button" data-m="${m}" title="${l}" aria-label="${l}">${e}</button>`).join('')}</div>
      <div data-mood-after class="faint" style="margin-top:12px"></div>
    </div>

    <div class="card" id="mood-factors" style="margin-top:26px" hidden>
      <h3>What might be shaping it?</h3>
      <p class="faint" style="margin-top:-4px">How does each of these feel <strong>today</strong>?
        1 is terrible, 10 is fantastic. One tap each. It saves as you go, and you can skip any.</p>
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
      <p data-factors-after class="faint" style="margin:16px 0 0"></p>
    </div>

    <div class="card" id="mood-patterns" style="margin-top:26px"></div>`;

  const $ = (s) => host.querySelector(s);

  function paintToday() {
    host.querySelectorAll('[data-mood] button').forEach(b =>
      b.classList.toggle('on', Number(b.dataset.m) === now?.mood));
    $('[data-mood-after]').textContent = now
      ? 'Saved for today. Tap another face to change it.' : '';
    $('#mood-factors').hidden = !now;
    if (!now) return;
    for (const [key] of FACTORS) {
      host.querySelectorAll(`[data-factor="${key}"] button`).forEach(b =>
        b.classList.toggle('on', Number(b.dataset.v) === now[key]));
    }
    host.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', b.dataset.w === now.weather));
    const done = FACTORS.filter(([k]) => now[k] != null).length + (now.weather ? 1 : 0);
    const all = FACTORS.length + 1;
    $('[data-factors-after]').textContent = done === all
      ? 'All done for today. Thank you for checking in.'
      : `${done} of ${all} rated today.`;
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

  host.querySelectorAll('[data-mood] button').forEach(b => b.addEventListener('click', async () => {
    const mood = Number(b.dataset.m);
    const { error } = await sb.from('mood_logs')
      .upsert({ user_id: uid, logged_on: today, mood }, { onConflict: 'user_id,logged_on' });
    if (error) return toast(error.message, 'err');
    const first = !now;
    keep({ mood });
    if (first) $('#mood-factors').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  async function saveField(patch) {
    const { error } = await sb.from('mood_logs').update(patch)
      .eq('user_id', uid).eq('logged_on', today);
    if (error) return toast(error.message, 'err');
    keep(patch);
  }
  host.querySelectorAll('[data-factor]').forEach(row => row.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => saveField({ [row.dataset.factor]: Number(b.dataset.v) }))));
  host.querySelectorAll('[data-w]').forEach(b =>
    b.addEventListener('click', () => saveField({ weather: b.dataset.w })));

  paintToday(); paintPatterns();
}
