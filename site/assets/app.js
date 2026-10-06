/* ==========================================================================
   Theraglee — shared front-end runtime
   ========================================================================== */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { mountShowcase } from './showcase.js';

export const SUPABASE_URL = 'https://oekqzuguruyqkafsqhos.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_eyxjcu2EnB7PrQywDJu9Ug_XRK-PZk0';
export const FN = SUPABASE_URL + '/functions/v1';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Supabase answers one request with at most 1,000 rows, however many the table
// holds. selectAll runs the same query a page at a time and joins the pages, so
// a table that has grown past that (the clinician library) comes back whole.
// `build` returns a fresh query each time it is called, with its own order;
// the order must be stable (a title, then a unique column) or rows can slip
// between pages. Resolves like a single query: { data, error }.
export async function selectAll(build, page = 1000) {
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < page) return { data: rows, error: null };
  }
}

/* ---------------------------------------------------------------- tiers */
export const TIERS = [
  { level: 0, key: 'visitor', name: 'Visitor',  blurb: 'Browsing without an account' },
  { level: 1, key: 'free',    name: 'Free',     blurb: 'Registered, free forever' },
  { level: 2, key: 'basic',   name: 'Basic',    blurb: 'Quizzes, worksheets, longer challenges' },
  { level: 3, key: 'premium', name: 'Premium',  blurb: 'Everything, plus tracking and tools' },
];
export const tierName = (l) => (TIERS[Math.max(0, Math.min(3, l ?? 0))] || TIERS[0]).name;

/* ------------------------------------------------------- two front doors */
// Members and therapists are separate memberships with separate sign-in and
// sign-up pages and separate dashboards. Everything that sends someone to a
// door or a home goes through these, so the two never get mixed up.
export const DOORS = {
  member:    { signin: 'login.html',           signup: 'signup.html',
               home: 'dashboard.html',          name: 'member' },
  therapist: { signin: 'therapist-login.html', signup: 'therapist-signup.html',
               home: 'therapist-dashboard.html', name: 'therapist' },
};
/** Which door an account belongs to. Admins use the member door and can open both dashboards. */
export const audienceOf = (profile) => profile?.role === 'therapist' ? 'therapist' : 'member';
/** The dashboard this account lands on after signing in. */
export const homeFor = (profile) => DOORS[audienceOf(profile)].home;
/** The sign-in page for an account (or for a page's audience). */
export const loginFor = (profileOrAudience) => DOORS[
  typeof profileOrAudience === 'string' ? profileOrAudience : audienceOf(profileOrAudience)].signin;

/* ---------------------------------------------------------------- utils */
export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const qs = (k, d = null) => new URLSearchParams(location.search).get(k) ?? d;

/* ------------------------------------------------------- catalog counts */
// How many items of each kind the library holds, e.g. { quiz: 62, worksheet: 16 },
// read from content_catalog so the numbers in marketing copy can never go stale.
// One request per page, shared by every caller on it. Resolves to {} if the
// catalog can't be reached; callers then leave the number out rather than show
// a wrong one.
let _counts;
export function contentCounts() {
  return _counts ??= (async () => {
    const { data, error } = await sb.from('content_catalog').select('kind');
    if (error || !data) return {};
    const c = {};
    for (const r of data) c[r.kind] = (c[r.kind] || 0) + 1;
    return c;
  })();
}
// "16 interactive worksheets" when the count is known, otherwise the fallback
// (the plural itself unless given), so a missing count never shows a wrong number.
export const counted = (n, plural, fallback = plural) =>
  Number.isInteger(n) ? `${n} ${plural}` : fallback;
// "Interactive worksheets (16)" when known, otherwise just the label.
export const suffixCount = (label, n) => Number.isInteger(n) ? `${label} (${n})` : label;
// Fill every [data-count="kind"] element in static markup. Its text is the
// number-free default, which gains the count in front:
// "Interactive worksheets" -> "16 interactive worksheets".
export async function applyCounts(root = document) {
  const c = await contentCounts();
  for (const el of root.querySelectorAll('[data-count]')) {
    const n = c[el.dataset.count];
    if (!Number.isInteger(n)) continue;
    const t = el.textContent.trim();
    el.textContent = `${n} ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
  }
}

export function toast(msg, kind = '') {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3600);
  setTimeout(() => el.remove(), 4000);
}

export function modal(html, { onOpen } = {}) {
  const back = document.createElement('div');
  back.className = 'backdrop';
  back.innerHTML = `<div class="modal">${html}</div>`;
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  document.addEventListener('keydown', function esckey(e) {
    if (e.key === 'Escape') { back.remove(); document.removeEventListener('keydown', esckey); }
  });
  document.body.appendChild(back);
  onOpen?.(back);
  return back;
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${label || 'Working…'}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/* ------------------------------------------------------------- access */
let _access = null;
export async function access(force = false) {
  if (_access && !force) return _access;
  const { data, error } = await sb.rpc('my_access');
  if (error) { console.error(error); _access = { level: 0, authenticated: false }; }
  else _access = data || { level: 0, authenticated: false };
  return _access;
}
export const clearAccess = () => { _access = null; };

/** Redirect to sign-in if not logged in. Returns the access object otherwise.
 *  Pass `audience: 'therapist'` on therapist pages so the sign-in page they
 *  are sent to is the therapist one. */
export async function requireAuth({ audience = 'member' } = {}) {
  const a = await access();
  if (!a.authenticated) {
    location.href = loginFor(audience) + '?next=' +
      encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash);
    return null;
  }
  return a;
}

/** Where a locked item should send someone: Free tier needs an account, not money. */
export function unlockHref(needed, authenticated) {
  return (needed <= 1 && !authenticated) ? DOORS.member.signup : 'pricing.html';
}

/** The line at the top of a page the dashboard's Fun tab opens (Pip, trivia,
 *  mandalas): the way back to the dashboard and to that tab, in the style of
 *  the tool pages' "← All tools · Anxiety tools" crumb. A page inside one of
 *  them (a quiz in play, a single mandala) passes its own links as `more`,
 *  `[label, href]` pairs that follow on the same line. A visitor has no
 *  dashboard, so they see only those. */
export function funCrumb(a, more = []) {
  const links = [...(a?.authenticated ? [['Your dashboard', 'dashboard.html'], ['Fun', 'dashboard.html#fun']] : []), ...more]
    .map(([label, href]) => `<a class="faint" href="${href}">${esc(label)}</a>`);
  if (!links.length) return '';
  return `<p class="faint no-print" style="margin:0 0 14px">&larr; ${links.join(' · ')}</p>`;
}

/** Renders an inline upgrade prompt into `host` when the tier is too low. */
export async function lockNotice(host, needed, what = 'This') {
  const a = await access();
  const free = needed <= 1 && !a.authenticated;
  host.innerHTML = `
    <div class="card pad-lg center">
      <span class="badge lock">${esc(tierName(needed))} membership</span>
      <h2 style="margin-top:14px">${esc(what)} is part of ${esc(tierName(needed))}</h2>
      <p class="muted">${free
        ? 'Registering is free and never asks for a card.'
        : 'Upgrade any time, and cancel just as easily.'}</p>
      <a class="btn lg" href="${unlockHref(needed, a.authenticated)}">${free
        ? 'Create a free account' : 'See membership options'}</a>
    </div>`;
}

/* --------------------------------------------------------- activity log */
export async function logActivity(item_type, item_id, action = 'view', tags = []) {
  const a = await access();
  if (!a.authenticated) return;
  sb.from('activity_log').insert({ user_id: a.profile.id, item_type, item_id, action, tags })
    .then(({ error }) => error && console.debug('activity', error.message));
}

/* ------------------------------------------------------------- billing */
/** POSTs to a Stripe Edge Function with the member's session attached.
 *  Resolves to the function's JSON, or `{ error, message }` when unreachable. */
export async function callStripeFn(name, body = {}) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${FN}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ return_url: location.origin, ...body }),
    });
    return await res.json();
  } catch {
    return { error: 'unreachable', message: 'Could not reach the billing service.' };
  }
}

/** Sends the browser to a Stripe-hosted page; shows the message otherwise. */
async function goStripe(name, body, btn, label, fallback) {
  busy(btn, true, label);
  const out = await callStripeFn(name, body);
  if (out.url) { location.href = out.url; return out; }
  busy(btn, false);
  toast(out.message || fallback, 'err');
  return out;
}

export async function startCheckout(plan, interval, btn) {
  const a = await access();
  if (!a.authenticated) {
    location.href = `${DOORS.member.signin}?next=${encodeURIComponent('pricing.html')}&plan=${plan}`;
    return;
  }
  // A member who already subscribes is sent to the billing portal to switch
  // plan, so nobody ends up paying for two memberships at once.
  await goStripe('stripe-checkout', { plan, interval }, btn, 'Opening checkout…', 'Could not start checkout.');
}

/** "Have a discount code?" for someone who already pays through Stripe.
 *  New subscribers enter codes on the Stripe Checkout page instead. Put the
 *  markup on the page, then call wireDiscountCode() once it is in the DOM. */
export const discountCodeBox = () => `
  <form class="card" id="dcode" style="margin-top:16px;padding:18px">
    <label for="dcode-in" style="margin:0 0 8px;display:block"><strong>Have a discount code?</strong></label>
    <div class="row" style="flex-wrap:nowrap">
      <input id="dcode-in" autocomplete="off" maxlength="30" placeholder="Enter your code"
        style="text-transform:uppercase">
      <button class="btn ghost" type="submit">Apply</button>
    </div>
  </form>`;

export function wireDiscountCode(onDone = () => location.reload()) {
  const form = document.getElementById('dcode');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    busy(btn, true, 'Applying…');
    const out = await callStripeFn('stripe-redeem', { code: form.querySelector('input').value });
    busy(btn, false);
    if (out.error) return toast(out.message || 'That code did not work.', 'err');
    toast('Discount applied. It shows on your next bill.', 'ok');
    onDone();
  });
}

export async function openPortal(btn) {
  await goStripe('stripe-portal', {}, btn, 'Opening…', 'Billing portal unavailable.');
}

/** Therapist: Stripe Identity (government ID + selfie) before a listing goes live. */
export async function startIdentity(btn) {
  return goStripe('stripe-identity', { action: 'start' }, btn, 'Opening ID check…', 'Could not start the ID check.');
}

/** Therapist: Stripe Connect payouts. `action` is onboard | dashboard. */
export async function connectAction(action, btn) {
  const label = action === 'dashboard' ? 'Opening payouts…' : 'Opening setup…';
  return goStripe('stripe-connect', { action }, btn, label, 'Could not open the payouts setup.');
}

/** Visitor or member: pay a therapist for a session. */
export async function startSessionPayment(therapistId, btn) {
  return goStripe('stripe-session-checkout', { therapist_id: therapistId }, btn, 'Opening payment…', 'Could not start the payment.');
}

/* ---------------------------------------------------------------- chrome */
// Discover, the library, challenges, the journal, articles, the therapist
// directory and the membership plans are reached from the member dashboard,
// the landing page's feature showcase and the pages themselves, not from the header.
const NAV = [
  ['Dashboard',  'dashboard.html'],   // signed-in members only; opens on its Today tab
  ['For Therapists', 'for-therapists.html'],
];
// A signed-in therapist gets the practice, not the member library.
const THERAPIST_NAV = [
  ['Dashboard',       'therapist-dashboard.html'],
  ['Stats',           'therapist-dashboard.html#referrals'],
  ['Messages',        'therapist-dashboard.html#messages'],
  ['Library',         'therapist-dashboard.html#library'],
  ['My profile',      'therapist-dashboard.html#profile'],
  ['Directory',       'therapists.html'],
];

// The dashboard's own tab row, repeated on the pages its Tools tab (and its
// other tabs) lead to, so a member can always get back to any part of the
// dashboard. Keep it in step with the tab buttons in dashboard.html. A tab
// whose second value ends in .html is a page of its own rather than a panel.
const DASH_TABS = [
  ['Today',           'today'],
  ['Journal',         'journal'],
  ['Playlists',       'playlists'],
  ['Mental Health Goals', 'goals'],
  ['Explore Library', 'explore'],
  ['Tools',           'tools'],
  ['Fun',             'fun'],
  ['Messages',        'messages'],
  ['Nearby help',     'nearby'],
  ['Therapist directory', 'therapists.html'],
];
// The member pages that show that row, and the tab each one sits under.
const DASH_PAGES = {
  'discover.html': 'explore', 'explore.html': 'tools', 'challenges.html': 'tools',
  'checklist.html': 'tools', 'quiz.html': 'tools', 'worksheet.html': 'tools',
  'therapists.html': 'therapists.html', 'therapist.html': 'therapists.html',
  'pet.html': 'fun', 'trivia.html': 'fun', 'mandalas.html': 'fun',
  'articles.html': 'explore', 'article.html': 'explore',
};

function dashTabs(here) {
  const nav = document.createElement('nav');
  nav.className = 'dash-tabs';
  nav.setAttribute('aria-label', 'Dashboard');
  nav.innerHTML = `<div class="wrap"><div class="dash-tabs-row">${DASH_TABS.map(([label, tab]) =>
    `<a href="${tab.endsWith('.html') ? tab : `dashboard.html#${tab}`}"${DASH_PAGES[here] === tab ? ' class="on"' : ''}>${label}</a>`).join('')}</div></div>`;
  return nav;
}

/* The feature showcase (assets/showcase.js) stands to the right of the page:
   a column of cards in the right third, the page's content in the left two
   thirds. Where it goes:
     - A page with a `.showcase-slot` gets the column inside the first one. The
       dashboard has one in every tab, under the tab's white intro card, and
       moves the column into whichever tab is open; the article and therapist
       pages have one under their search box.
     - Any other page gets it beside everything in <main>: the page's content
       is gathered into a `.beside` box, and that box and the column share a
       `.beside-showcase` grid (styles.css). A page that is one `.section`
       already has its padding on <main>; one built from several full-width
       sections gets `of-sections`, which drops the column down to the first.
   Under 900px the stylesheet stacks the two, with the strip running sideways
   above the content. */
function placeShowcase(a) {
  const slot = document.querySelector('.showcase-slot');
  if (slot) return mountShowcase(a, slot, { inside: true, aside: true });
  const main = document.querySelector('main');
  if (!main) return mountShowcase(a, $('.topbar'));
  const grid = document.createElement('div');
  grid.className = 'wrap beside-showcase' + (main.classList.contains('section') ? '' : ' of-sections');
  const beside = document.createElement('div');
  beside.className = 'beside';
  beside.append(...main.childNodes);
  grid.append(beside);
  main.append(grid);
  return mountShowcase(a, grid, { inside: true, aside: true });
}

export async function chrome({ active = '', showcase = true } = {}) {
  const a = await access();
  const here = location.pathname.split('/').pop() || 'index.html';
  const therapist = a.authenticated && a.profile?.role === 'therapist';
  const admin = a.authenticated && a.profile?.role === 'admin';

  // A visitor has no dashboard yet, so the header does not offer one.
  const memberNav = a.authenticated ? NAV : NAV.filter(([, href]) => href !== 'dashboard.html');
  const links = (therapist ? THERAPIST_NAV : memberNav).map(([label, href]) => {
    const page = href.split('#')[0];
    const on = therapist ? (href.includes('#') ? here + location.hash === href : here === page)
                         : (active === href || here === href);
    // "For Therapists" is a solid button, like the sign-in button beside it.
    const cls = [href === 'for-therapists.html' ? 'btn sm' : '', on ? 'active' : ''].filter(Boolean).join(' ');
    return `<a href="${href}" class="${cls}">${label}</a>`;
  }).join('');

  const right = a.authenticated
    ? `${admin ? `<a href="therapist-dashboard.html" class="${here === 'therapist-dashboard.html' ? 'active' : ''}">Practice</a>
                  <a href="admin.html" class="${here === 'admin.html' ? 'active' : ''}">Admin</a>` : ''}
       <a href="account.html" class="${here === 'account.html' ? 'active' : ''}">Account</a>
       <a class="btn sm ghost" href="#" id="signout">Sign out</a>`
    : `<a class="btn sm" href="${DOORS.member.signin}">Sign in</a>`;

  // On the landing page a signed-in member or therapist is greeted by name in
  // the top right corner, so it is plain they are still signed in.
  const who = (a.profile?.full_name || '').trim().split(/\s+/)[0] || (a.profile?.email || '').split('@')[0];
  const hello = a.authenticated && here === 'index.html' && who
    ? `<span class="hello" title="You're signed in">Hello, ${esc(who)}</span>` : '';

  const header = document.createElement('div');
  header.innerHTML = `
    <div class="crisis">In crisis? Call or text <a href="tel:988">988</a> (US Suicide &amp; Crisis Lifeline),
      or text HOME to <a href="sms:741741">741741</a>. If you are in danger, call 911.</div>
    <header class="topbar"><div class="wrap"><nav class="nav">
      <a class="brand" href="index.html">
        <img src="assets/logo.png" alt="Theraglee"></a>
      <button class="burger" id="burger" aria-label="Menu" aria-expanded="false">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round"/></svg></button>
      <div class="links" id="navlinks">${links}${right}</div>${hello}
    </nav></div></header>`;
  document.body.prepend(...header.childNodes);

  // The feature showcase stands beside the content on every page a member or
  // visitor sees. The therapist pages (practice dashboard, sign-in, sign-up)
  // are the other front door, so they go without. A page that places the
  // strip itself (the landing page puts it in the explore section), wants
  // the whole width for itself (a therapist's profile), or is a legal page
  // (the Terms of Service and the Privacy Policy) passes `showcase: false`.
  const therapistPages = [DOORS.therapist.home, DOORS.therapist.signin, DOORS.therapist.signup];
  if (showcase && !therapistPages.includes(here)) placeShowcase(a);

  // A signed-in member keeps the dashboard's tabs on every page they lead to.
  const main = document.querySelector('main');
  if (a.authenticated && !therapist && DASH_PAGES[here] && main) {
    main.before(dashTabs(here));
    // On a phone the row scrolls sideways; bring the current tab into view.
    const row = $('.dash-tabs-row'), on = row.querySelector('.on');
    if (on) row.scrollLeft = on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }

  $('#burger')?.addEventListener('click', (e) => {
    const l = $('#navlinks'); l.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', l.classList.contains('open'));
  });
  $('#signout')?.addEventListener('click', async (e) => {
    e.preventDefault(); await sb.auth.signOut(); clearAccess(); location.href = 'index.html';
  });

  const bar = $('.topbar');
  const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  if (a.authenticated) idleLogoff({ login: loginFor(a.profile) });

  footer();
  return a;
}

/* --------------------------------------------------------- auto logoff */
/** Signs a signed-in user out after a period of inactivity, so a session left
    open on a shared or unattended screen does not stay open. Only this
    device's session ends (`scope: 'local'`): an idle tab on a laptop must not
    sign the member's phone out as well. The Sign out link stays global. */
export function idleLogoff({ minutes = 15, warnSeconds = 60, login = DOORS.member.signin } = {}) {
  let timer, warnTimer, warned = false;

  const signOut = async (why) => {
    try { await sb.auth.signOut({ scope: 'local' }); } catch {}
    clearAccess();
    location.href = login + '?next=' +
      encodeURIComponent(location.pathname.split('/').pop() + location.hash) + '&timeout=1';
  };

  const showWarning = () => {
    if (warned) return;
    warned = true;
    const box = document.createElement('div');
    box.id = 'idle-warning';
    box.className = 'backdrop';
    box.innerHTML = `<div class="modal center">
      <h2>Still there?</h2>
      <p class="muted">You will be signed out shortly to keep this screen private.</p>
      <button class="btn" id="stay">Keep me signed in</button></div>`;
    document.body.appendChild(box);
    box.querySelector('#stay').onclick = () => { box.remove(); warned = false; reset(); };
  };

  const reset = () => {
    clearTimeout(timer); clearTimeout(warnTimer);
    if (warned) return;
    warnTimer = setTimeout(showWarning, Math.max(0, minutes * 60000 - warnSeconds * 1000));
    timer = setTimeout(() => signOut('idle'), minutes * 60000);
  };

  ['mousedown','keydown','touchstart','scroll','focus'].forEach(ev =>
    addEventListener(ev, () => { if (!warned) reset(); }, { passive: true }));
  reset();
}

function footer() {
  const f = document.createElement('footer');
  f.className = 'site';
  f.innerHTML = `<div class="wrap">
    <div class="cols">
      <div>
        <img src="assets/logo.png" alt="Theraglee" style="height:30px;margin-bottom:12px">
        <p class="muted" style="max-width:34ch;font-size:.92rem">
          Small, steady tools for your mental health — and a directory of licensed
          therapists when you want more support.</p>
      </div>
      <div><h4>Explore</h4>
        <a href="explore.html">Explore Library</a><a href="discover.html">Self-discovery tools</a>
        <a href="challenges.html">Challenges</a>
        <a href="dashboard.html#journal">Journal</a><a href="articles.html">Articles</a>
        <a href="therapists.html">Find a therapist</a>
        <a href="match-mode.html">Theraglee Match Mode</a></div>
      <div><h4>Membership</h4>
        <a href="pricing.html">Membership plans</a><a href="${DOORS.member.signup}">Join free</a>
        <a href="${DOORS.member.signin}">Member sign in</a>
        <a href="account.html">Your account</a></div>
      <div><h4>Therapists</h4>
        <a href="for-therapists.html">Therapist membership</a>
        <a href="for-therapists/match-mode">Theraglee Match Mode for therapists</a>
        <a href="for-therapists/compare">Compare the directories</a>
        <a href="privacy-promise.html">Our privacy promise</a>
        <a href="${DOORS.therapist.signin}">Therapist sign in</a>
        <a href="therapist-dashboard.html">Practice dashboard</a></div>
      <div><h4>Legal</h4>
        <a href="terms.html">Terms of Service</a>
        <a href="privacy.html">Privacy Policy</a>
        <a href="privacy.html#consumer-health-data">Consumer health data privacy</a></div>
    </div>
    <div class="legal">
      <strong>Theraglee does not provide medical advice, diagnosis, or treatment.</strong>
      Everything here is educational and supportive only, and is not a substitute for care from a
      licensed professional. Quizzes and self-assessments cannot diagnose any condition.
      If you are in crisis, call or text 988 in the US, or call 911 if you are in immediate danger.
      <br><br>© ${new Date().getFullYear()} Theraglee.
      <a href="privacy.html" style="display:inline">Privacy</a> ·
      <a href="terms.html" style="display:inline">Terms</a> ·
      <a href="privacy.html#consumer-health-data" style="display:inline">Consumer health data privacy</a>
    </div></div>`;
  document.body.appendChild(f);
}

/* ------------------------------------------------------- content helpers */
/** A tile for a catalog row, locked or unlocked depending on the viewer. */
export function catalogTile(row, level, hrefFor, authenticated = level > 0) {
  const locked = row.min_level > level;
  const href = locked ? unlockHref(row.min_level, authenticated) : hrefFor(row);
  return `<a class="tile ${locked ? 'locked' : ''}" href="${href}">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <h3>${esc(row.title)}</h3>
      ${locked ? `<span class="badge lock">${esc(tierName(row.min_level))}</span>` : ''}
    </div>
    ${row.description ? `<p class="meta" style="color:var(--muted)">${esc(String(row.description).slice(0, 130))}</p>` : ''}
    ${row.category ? `<span class="meta">${esc(row.category)}</span>` : ''}
  </a>`;
}
