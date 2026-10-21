/* =============================================================================
   Theraglee — "What members are using" on the admin Content tab.
   -----------------------------------------------------------------------------
   One card per feature of the site, with how many times it was used in the
   chosen window and by how many members, the all-time figures under that,
   and a second count where one helps (a page opened, a challenge started).
   The numbers come from admin_feature_usage() in the database
   (supabase/migrations/20261021190000_admin_feature_usage.sql), which says
   what counts as a use for each feature; the words here match it.

   Every feature on the showcase strip (site/assets/showcase.js) is covered:
   tests/admin-usage/check.mjs holds the two lists to each other.
   ============================================================================= */

/* key, name, what one use is, what the second number is, and the showcase
   cards the feature answers for. Keys match the `f` values in the migration. */
export const FEATURES = [
  ['journal',     'Journal',                    'entries written',              null,                          ['Personal Journal', 'Daily Journal Prompt']],
  ['mood',        'Mood tracker',               'check-ins',                    null,                          ['Mood Tracker']],
  ['discover',    'Self-discovery tools',       'tools finished',               'tool opens',                ['Self-Discovery Tools']],
  ['quizzes',     'Quizzes',                    'quizzes finished',             'quiz opens',              ['Mental Health Quizzes']],
  ['worksheets',  'Worksheets',                 'worksheets saved',             'worksheet opens',           ['Mental Health Worksheets']],
  ['checklists',  'Checklists',                 'days checked',                 'checklist opens',           ['Mental Health Checklists']],
  ['challenges',  'Challenges',                 'days checked off',             'challenges started',          ['Mental Health Challenges']],
  ['articles',    'Articles',                   'article reads',                'articles favorited',          ['Articles']],
  ['mandalas',    'Mandalas',                   'colorings saved',              'mandala opens',             ['Mandalas']],
  ['trivia',      'Trivia',                     'sets played',                  'set opens',                 ['Mental Health Trivia']],
  ['pet',         'Desktop pet',                'downloads',                    'pet page opens',              ['Desktop Pet']],
  ['goals',       'Mental Health Goals',        'steps checked off',            'goals set',                   ['Mental Health Goals']],
  ['playlists',   'Playlists',                  'playlist opens',               'tab opens',                   ['Music Playlists by Genre and Mood']],
  ['nearby',      'Local resource map',         'places searched',              'tab opens',                   ['Mental Health Local Resource Map']],
  ['today',       'Today tab (daily content)',  'tab opens',                    'daily emails sent',           ['Daily Quote', 'Daily Mental Health Tip', 'Daily Mental Health Did You Know', 'Daily Affirmation']],
  ['favorites',   'Favorites and save for later', 'items marked',               null,                          []],
  ['therapists',  'Therapist directory',        'profile views',                'messages sent to therapists', ['Find a Therapist']],
  ['match',       'Theraglee Match Mode',       'messages exchanged',           'members have it on now',      ['Theraglee Match Mode']],
  ['calls',       'Tracking numbers',           'calls answered',               null,                          []],
  ['toolmail',    'Sunday tool email',          'sign-ups',                     'emails sent',                 []],
];

/* Features whose use is written to activity_log from the browser, so their
   numbers start on the day that logging shipped rather than on day one. */
const LOGGED_SINCE = { pet: true, playlists: true, nearby: true, today: true };

export const WINDOWS = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last year']];

const n = (v) => (v ?? 0).toLocaleString();

/** Draws the panel into `host`. `sb` is the Supabase client; `esc` and
 *  `fmtDate` come from app.js. */
export async function mountUsage(host, sb, { esc, fmtDate }) {
  let days = 30, order = 'listed';
  const shell = () => {
    host.innerHTML = `<section class="zone" aria-labelledby="usage-title">
      <div class="zone-head spread">
        <div>
          <h2 id="usage-title">What members are using</h2>
          <p class="muted">How often each feature of the site is used, and by how many members.</p>
        </div>
        <div class="row">
          <select id="usage-days" aria-label="Window">${WINDOWS.map(([d, l]) =>
            `<option value="${d}" ${d === days ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <select id="usage-order" aria-label="Order">
            <option value="listed" ${order === 'listed' ? 'selected' : ''}>In order</option>
            <option value="used" ${order === 'used' ? 'selected' : ''}>Most used first</option>
          </select>
        </div>
      </div>
      <div id="usage-body"><div class="skeleton" style="height:120px"></div></div>
    </section>`;
    host.querySelector('#usage-days').onchange = (e) => { days = Number(e.target.value); draw(); };
    host.querySelector('#usage-order').onchange = (e) => { order = e.target.value; draw(); };
  };

  async function draw() {
    const body = host.querySelector('#usage-body');
    body.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    const { data, error } = await sb.rpc('admin_feature_usage', { p_days: days });
    if (error) { body.innerHTML = `<div class="notice warn">Could not count: ${esc(error.message)}</div>`; return; }
    const stats = data || {};
    const f = stats.features || {};
    const total = stats.members_total || 0;
    const pct = (m) => total ? Math.round(100 * m / total) : 0;

    let rows = FEATURES.map(([key, name, what, also]) => ({ key, name, what, also, ...(f[key] || {}) }));
    if (order === 'used') rows.sort((a, b) => (b.recent || 0) - (a.recent || 0) || (b.total || 0) - (a.total || 0));

    const card = (r) => {
      const alsoLine = !r.also ? ''
        : r.key === 'match' ? `<div class="faint">${n(stats.match_on)} ${esc(r.also)}</div>`
        : `<div class="faint">${n(r.also_recent)} ${esc(r.also)} in the window · ${n(r.also_total)} all time</div>`;
      const share = r.key === 'calls' || r.key === 'toolmail' ? ''
        : `<div class="usage-bar" title="${pct(r.recent_members)}% of members used it in the window">
             <span style="width:${pct(r.recent_members)}%"></span></div>`;
      return `<div class="card usage-card">
        <span class="kicker">${esc(r.name)}</span>
        <div class="usage-big">${n(r.recent)}</div>
        <div class="muted">${esc(r.what)} in the window${r.members == null || r.key === 'calls' || r.key === 'toolmail'
          ? '' : `, by ${n(r.recent_members)} member${r.recent_members === 1 ? '' : 's'}`}</div>
        ${share}
        <div class="faint">${n(r.total)} all time${r.members ? ` by ${n(r.members)} member${r.members === 1 ? '' : 's'}` : ''}
          · ${r.last_at ? 'last ' + esc(fmtDate(r.last_at)) : 'not used yet'}</div>
        ${alsoLine}
        ${LOGGED_SINCE[r.key] ? '<div class="faint">Counted from the day this logging shipped.</div>' : ''}
      </div>`;
    };

    body.innerHTML = `
      <div class="row" style="gap:18px;margin-bottom:18px">
        <span><strong>${n(total)}</strong> <span class="muted">members</span></span>
        <span><strong>${n(stats.members_new)}</strong> <span class="muted">joined in the window</span></span>
        <span><strong>${n(stats.members_active)}</strong> <span class="muted">used something in the window
          (${pct(stats.members_active)}%)</span></span>
      </div>
      <div class="grid g3">${rows.map(card).join('')}</div>
      <p class="faint" style="margin:18px 0 0">The big number counts times, not different items: 16 profile views
        can be one profile opened 16 times. A member counts once per feature however often they used it.
        Administrator accounts are left out of every count. Therapist profile views include visitors without an account.</p>`;
  }

  shell();
  await draw();
}
