/* =============================================================================
   Theraglee — the Google Analytics tab on the admin screen.
   -----------------------------------------------------------------------------
   Two zones in the Today look. The first connects the site to Google
   Analytics: the measurement id (the tag on the pages), the GA4 property id
   (the reports), and the switch that puts the tag on every page. The three
   live in app_config under the keys in CONFIG_KEYS, written with
   admin_set_config() like the Stripe setup tab's settings. The second zone
   shows what visitors did in a window: people on the site right now, the
   headline numbers against the window before, a line per day, the pages they
   opened, how they arrived and what they used. The numbers come from the
   google-analytics Edge Function, which reads the GA4 Data API with a
   service account (supabase/functions/_shared/analytics.ts says what is
   asked for). docs/google-analytics.md is the guide.
   ============================================================================= */

export const CONFIG_KEYS = ['ga_measurement_id', 'ga_property_id', 'ga_tag_enabled'];
export const WINDOWS = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last year']];
export const MEASUREMENT_ID = /^G-[A-Z0-9]{6,12}$/;
export const PROPERTY_ID = /^(?:properties\/)?\d{6,15}$/;

/* The headline cards: key in the summary, label, how to show it. */
export const HEADLINES = [
  ['activeUsers',            'People',          'count',   'who visited at least once'],
  ['newUsers',               'New people',      'count',   'on their first visit'],
  ['sessions',               'Visits',          'count',   'a visit is one sitting'],
  ['screenPageViews',        'Pages opened',    'count',   'every page, every time'],
  ['averageSessionDuration', 'Time per visit',  'seconds', 'on average'],
  ['engagementRate',         'Stayed a while',  'percent', 'of visits lasted 10 seconds, saw two pages, or did something'],
];

const n = (v) => Math.round(v ?? 0).toLocaleString();
const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;
const secs = (v) => { const s = Math.round(v ?? 0); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const show = (kind, v) => kind === 'seconds' ? secs(v) : kind === 'percent' ? pct(v) : n(v);

/** The change from the window before, in words. Null when there is no
 *  "before" to compare with. */
export function changeLine(now, before) {
  if (!before) return now ? 'nothing in the window before' : null;
  const d = (now - before) / before;
  if (Math.abs(d) < 0.005) return 'the same as the window before';
  return `${d > 0 ? 'up' : 'down'} ${Math.round(Math.abs(d) * 100)}% on the window before`;
}

/** Where the property's reports open in Google Analytics. */
export const gaHome = (propertyId) => {
  const id = String(propertyId || '').replace(/^properties\//, '');
  return id ? `https://analytics.google.com/analytics/web/#/p${id}/reports/intelligenthome` : 'https://analytics.google.com/';
};

/* ----------------------------------------------------------- the line */
/** One series (people per day) as an inline SVG: a 2px line, a soft area
 *  under it, a recessive baseline, and a hover layer that names the day. */
function lineChart(byDate, esc) {
  if (!byDate.length) return '<p class="faint" style="margin:0">No days to draw yet.</p>';
  const W = 640, H = 170, padL = 36, padR = 10, padT = 12, padB = 26;
  const max = Math.max(1, ...byDate.map((d) => d.activeUsers));
  const x = (i) => padL + (byDate.length === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (byDate.length - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const pts = byDate.map((d, i) => [x(i), y(d.activeUsers)]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const area = `${line} L${pts.at(-1)[0].toFixed(1)} ${y(0)} L${pts[0][0].toFixed(1)} ${y(0)} Z`;
  const day = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const ticks = [0, Math.floor((byDate.length - 1) / 2), byDate.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const step = Math.max(1, (W - padL - padR) / Math.max(1, byDate.length - 1));
  return `<svg class="ga-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="People on the site per day">
    <line x1="${padL}" y1="${y(0)}" x2="${W - padR}" y2="${y(0)}" class="ga-axis"/>
    <line x1="${padL}" y1="${y(max)}" x2="${W - padR}" y2="${y(max)}" class="ga-grid"/>
    <text x="${padL - 6}" y="${y(max) + 4}" class="ga-tick" text-anchor="end">${n(max)}</text>
    <text x="${padL - 6}" y="${y(0) + 4}" class="ga-tick" text-anchor="end">0</text>
    ${ticks.map((i) => `<text x="${x(i)}" y="${H - 8}" class="ga-tick" text-anchor="${i === 0 ? 'start' : i === byDate.length - 1 ? 'end' : 'middle'}">${esc(day(byDate[i].date))}</text>`).join('')}
    <path d="${area}" class="ga-area"/>
    <path d="${line}" class="ga-path"/>
    ${byDate.length === 1 ? `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="4" class="ga-dot"/>` : ''}
    ${pts.map(([px, py], i) => `<g class="ga-hit">
      <rect x="${(px - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}" fill="transparent"/>
      <line x1="${px.toFixed(1)}" y1="${padT}" x2="${px.toFixed(1)}" y2="${y(0)}" class="ga-cross"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" class="ga-dot"/>
      <title>${esc(day(byDate[i].date))}: ${n(byDate[i].activeUsers)} people, ${n(byDate[i].sessions)} visits, ${n(byDate[i].pageViews)} pages</title>
    </g>`).join('')}
  </svg>`;
}

/** A list of rows with a bar for each, the longest filling the width. */
function barList(rows, label, value, what, esc) {
  if (!rows.length) return '<p class="faint" style="margin:0">Nothing in the window.</p>';
  const max = Math.max(1, ...rows.map(value));
  return `<div class="ga-bars">${rows.map((r) => `<div class="ga-bar-row" title="${esc(label(r))}: ${n(value(r))} ${what}">
      <span class="ga-bar-label">${esc(label(r))}</span>
      <span class="ga-bar"><span style="width:${Math.max(1, Math.round((100 * value(r)) / max))}%"></span></span>
      <span class="ga-bar-n">${n(value(r))}</span>
    </div>`).join('')}</div>`;
}

/* ------------------------------------------------------------- the tab */
/** Draws the tab into `host`. `sb` is the Supabase client; `callFn` posts to
 *  an Edge Function with the session attached (callStripeFn in app.js). */
export async function mountAnalytics(host, sb, { esc, toast, busy, callFn }) {
  let days = 30;
  const { data } = await sb.from('app_config').select('key,value').like('key', 'ga_%');
  const cfg = Object.fromEntries((data || []).map((r) => [r.key, r.value || '']));

  host.innerHTML = `
    <section class="zone" aria-labelledby="ga-setup-title">
      <div class="zone-head spread">
        <div>
          <h2 id="ga-setup-title">Google Analytics</h2>
          <p class="muted">Connect the site to a GA4 property. The reports below read from it; the switch puts the tag on every page.</p>
        </div>
        <a class="btn sm ghost" id="ga-open" href="${gaHome(cfg.ga_property_id)}" target="_blank" rel="noopener">Open Google Analytics</a>
      </div>
      <div class="grid g2" style="align-items:start">
        <div class="card">
          <span class="kicker">The tag</span>
          <div class="field" style="margin-top:10px"><label for="ga_measurement_id">Measurement ID</label>
            <input id="ga_measurement_id" value="${esc(cfg.ga_measurement_id)}" placeholder="G-XXXXXXXXXX" autocomplete="off" spellcheck="false"></div>
          <p class="faint" style="margin:0">In Google Analytics: Admin → Data streams → your web stream. It starts with <code>G-</code>.</p>
        </div>
        <div class="card">
          <span class="kicker">The reports</span>
          <div class="field" style="margin-top:10px"><label for="ga_property_id">Property ID</label>
            <input id="ga_property_id" value="${esc(cfg.ga_property_id)}" placeholder="123456789" autocomplete="off" spellcheck="false"></div>
          <p class="faint" style="margin:0">Admin → Property details, the number at the top right. The reports need the service account key in Supabase too; <code>docs/google-analytics.md</code> walks through it.</p>
        </div>
      </div>
      <label class="ga-switch">
        <input type="checkbox" id="ga_tag_enabled" ${cfg.ga_tag_enabled === 'true' ? 'checked' : ''}>
        <span><strong>Load the tag on every page</strong><br>
          <span class="muted">Off, the site sends Google nothing and the reports stay empty. On, every page a visitor opens is counted,
            except by administrators and by browsers that send an opt-out signal (Global Privacy Control or Do Not Track).</span></span>
      </label>
      <div class="notice warn" style="margin-top:14px"><strong>Before the switch goes on:</strong> the Privacy Policy says the site runs
        no third-party analytics. Change sections 2, 5 and 6 of <code>site/privacy.html</code> to say Google Analytics is used
        and how to opt out (<code>docs/legal-pages.md</code> lists what has to change), then come back here.</div>
      <div class="row" style="margin-top:18px">
        <button class="btn" id="ga-save">Save settings</button>
        <button class="btn ghost" id="ga-test">Test the connection</button>
        <span class="faint" id="ga-status"></span>
      </div>
    </section>

    <section class="zone" aria-labelledby="ga-reports-title" style="margin-top:28px">
      <div class="zone-head spread">
        <div>
          <h2 id="ga-reports-title">What visitors did</h2>
          <p class="muted">From Google Analytics. Pages opened by administrators and by browsers that opted out are not in these numbers.</p>
        </div>
        <div class="row">
          <span id="ga-now"></span>
          <select id="ga-days" aria-label="Window">${WINDOWS.map(([d, l]) =>
            `<option value="${d}" ${d === days ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
      </div>
      <div id="ga-body"><div class="skeleton" style="height:140px"></div></div>
    </section>`;

  const $ = (id) => host.querySelector('#' + id);
  const status = (t) => { $('ga-status').textContent = t; };

  /* ---- settings */
  $('ga-save').onclick = async (e) => {
    const mid = $('ga_measurement_id').value.trim().toUpperCase();
    const pid = $('ga_property_id').value.trim().replace(/^properties\//, '');
    const on = $('ga_tag_enabled').checked;
    if (mid && !MEASUREMENT_ID.test(mid)) return toast('The measurement ID should look like G-XXXXXXXXXX.', 'err');
    if (pid && !PROPERTY_ID.test(pid)) return toast('The property ID is a number, such as 123456789.', 'err');
    if (on && !mid) return toast('Enter the measurement ID before turning the tag on.', 'err');
    busy(e.target, true, 'Saving…');
    for (const [k, v] of [['ga_measurement_id', mid], ['ga_property_id', pid], ['ga_tag_enabled', on ? 'true' : 'false']]) {
      const { error } = await sb.rpc('admin_set_config', { p_key: k, p_value: v });
      if (error) { busy(e.target, false); return toast(error.message, 'err'); }
      cfg[k] = v;
    }
    busy(e.target, false);
    $('ga_measurement_id').value = mid; $('ga_property_id').value = pid;
    $('ga-open').href = gaHome(pid);
    status('Saved ' + new Date().toLocaleTimeString());
    toast(on ? 'Saved. The tag loads on the next page anyone opens.' : 'Settings saved.', 'ok');
    draw();
  };

  $('ga-test').onclick = async (e) => {
    busy(e.target, true, 'Checking…');
    const out = await callFn('google-analytics', { action: 'test' });
    busy(e.target, false);
    if (out.error) { status(''); return toast(out.message || 'That did not work.', 'err'); }
    status(`Connected: ${out.service_account} can read property ${out.property_id}.`);
    toast('Google Analytics answered.', 'ok');
  };

  $('ga-days').onchange = (e) => { days = Number(e.target.value); draw(); };

  /* ---- reports */
  async function draw() {
    const body = $('ga-body');
    $('ga-now').innerHTML = '';
    if (!PROPERTY_ID.test(cfg.ga_property_id || '')) {
      body.innerHTML = `<div class="notice">Enter the property ID above and save, and the reports appear here.
        Nothing is counted until the tag is on the pages, so the first numbers arrive a day or so after the switch goes on.</div>`;
      return;
    }
    body.innerHTML = '<div class="skeleton" style="height:140px"></div>';
    const s = await callFn('google-analytics', { action: 'summary', days });
    if (s.error) {
      body.innerHTML = `<div class="notice warn">${esc(s.message || 'Could not read Google Analytics.')}</div>`;
      return;
    }
    if (s.now != null) $('ga-now').innerHTML = `<span class="badge live" title="In the last 30 minutes">${n(s.now)} on the site now</span>`;
    const label = WINDOWS.find(([d]) => d === s.days)?.[1].toLowerCase() || `${s.days} days`;

    body.innerHTML = `
      <div class="grid g3">${HEADLINES.map(([k, name, kind, what]) => {
        const change = kind === 'count' ? changeLine(s.current[k], s.previous[k]) : null;
        return `<div class="card usage-card">
          <span class="kicker">${esc(name)}</span>
          <div class="usage-big">${show(kind, s.current[k])}</div>
          <div class="muted">${esc(what)}</div>
          ${change ? `<div class="faint">${esc(change)}</div>` : kind !== 'count'
            ? `<div class="faint">${show(kind, s.previous[k])} the window before</div>` : ''}
        </div>`; }).join('')}
      </div>

      <div class="card" style="margin-top:18px">
        <span class="kicker">People per day, ${esc(label)}</span>
        <div style="margin-top:10px">${lineChart(s.byDate, esc)}</div>
        <p class="faint" style="margin:8px 0 0">Rest on a day to see its numbers. A person who comes back the next day counts on both days.</p>
      </div>

      <div class="ga-split" style="margin-top:18px">
        <div class="card">
          <span class="kicker">Pages opened most</span>
          <div style="margin-top:10px">${barList(s.pages, (r) => r.path, (r) => r.pageViews, 'opens', esc)}</div>
        </div>
        <div class="stack">
          <div class="card">
            <span class="kicker">How people arrived</span>
            <div style="margin-top:10px">${barList(s.channels, (r) => r.channel, (r) => r.sessions, 'visits', esc)}</div>
          </div>
          <div class="card">
            <span class="kicker">On what</span>
            <div style="margin-top:10px">${barList(s.devices, (r) => r.device, (r) => r.activeUsers, 'people', esc)}</div>
          </div>
        </div>
      </div>
      <p class="faint" style="margin:18px 0 0">Google Analytics counts a person by a cookie on their browser, so one member on a phone and a
        laptop is two people here. The window before is the same number of days ending the day this one starts.
        Reports can run a day behind. Property ${esc(s.property_id)}.</p>`;
  }

  await draw();
}
