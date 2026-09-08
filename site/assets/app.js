/* ==========================================================================
   Theraglee — shared front-end runtime
   ========================================================================== */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

export const SUPABASE_URL = 'https://oekqzuguruyqkafsqhos.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_eyxjcu2EnB7PrQywDJu9Ug_XRK-PZk0';
export const FN = SUPABASE_URL + '/functions/v1';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/* ---------------------------------------------------------------- tiers */
export const TIERS = [
  { level: 0, key: 'visitor', name: 'Visitor',  blurb: 'Browsing without an account' },
  { level: 1, key: 'free',    name: 'Free',     blurb: 'Registered, free forever' },
  { level: 2, key: 'basic',   name: 'Basic',    blurb: 'Quizzes, worksheets, longer challenges' },
  { level: 3, key: 'premium', name: 'Premium',  blurb: 'Everything, plus tracking and tools' },
];
export const tierName = (l) => (TIERS[Math.max(0, Math.min(3, l ?? 0))] || TIERS[0]).name;

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

/** Redirect to sign-in if not logged in. Returns the access object otherwise. */
export async function requireAuth() {
  const a = await access();
  if (!a.authenticated) {
    location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    return null;
  }
  return a;
}

/** Where a locked item should send someone: Free tier needs an account, not money. */
export function unlockHref(needed, authenticated) {
  return (needed <= 1 && !authenticated) ? 'login.html?mode=signup' : 'pricing.html';
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
    location.href = `login.html?next=${encodeURIComponent('pricing.html')}&plan=${plan}`;
    return;
  }
  // A member who already subscribes is sent to the billing portal to switch
  // plan, so nobody ends up paying for two memberships at once.
  await goStripe('stripe-checkout', { plan, interval }, btn, 'Opening checkout…', 'Could not start checkout.');
}

export async function openPortal(btn) {
  await goStripe('stripe-portal', {}, btn, 'Opening…', 'Billing portal unavailable.');
}

/** Therapist: Stripe Identity (government ID + selfie) before publishing. */
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
const NAV = [
  ['Today',      'dashboard.html'],
  ['Explore',    'explore.html'],
  ['Discover',   'discover.html'],
  ['Challenges', 'challenges.html'],
  ['Journal',    'journal.html'],
  ['Articles',   'articles.html'],
  ['Therapists', 'therapists.html'],
];

export async function chrome({ active = '' } = {}) {
  const a = await access();
  const here = location.pathname.split('/').pop() || 'index.html';

  const links = NAV.map(([label, href]) =>
    `<a href="${href}" class="${(active === href || here === href) ? 'active' : ''}">${label}</a>`).join('');

  const right = a.authenticated
    ? `<a href="account.html" class="${here === 'account.html' ? 'active' : ''}">Account</a>
       <a class="btn sm ghost" href="#" id="signout">Sign out</a>`
    : `<a href="pricing.html" class="${here === 'pricing.html' ? 'active' : ''}">Membership</a>
       <a href="login.html">Sign in</a>
       <a class="btn sm" href="login.html?mode=signup">Join free</a>`;

  const header = document.createElement('div');
  header.innerHTML = `
    <div class="crisis">In crisis? Call or text <a href="tel:988">988</a> (US Suicide &amp; Crisis Lifeline),
      or text HOME to <a href="sms:741741">741741</a>. If you are in danger, call 911.</div>
    <header class="topbar"><div class="wrap"><nav class="nav">
      <a class="brand" href="${a.authenticated ? 'dashboard.html' : 'index.html'}">
        <img src="assets/logo.png" alt="Theraglee"></a>
      <button class="burger" id="burger" aria-label="Menu" aria-expanded="false">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round"/></svg></button>
      <div class="links" id="navlinks">${links}${right}</div>
    </nav></div></header>`;
  document.body.prepend(...header.childNodes);

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

  if (a.authenticated) idleLogoff();

  footer();
  return a;
}

/* --------------------------------------------------------- auto logoff */
/** Signs a signed-in user out after a period of inactivity, so a session left
    open on a shared or unattended screen does not stay open. */
export function idleLogoff({ minutes = 15, warnSeconds = 60 } = {}) {
  let timer, warnTimer, warned = false;

  const signOut = async (why) => {
    try { await sb.auth.signOut(); } catch {}
    clearAccess();
    location.href = 'login.html?next=' +
      encodeURIComponent(location.pathname.split('/').pop()) + '&timeout=1';
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
        <a href="explore.html">Library</a><a href="discover.html">Free discovery tools</a>
        <a href="challenges.html">Challenges</a>
        <a href="journal.html">Journal</a><a href="articles.html">Articles</a></div>
      <div><h4>Membership</h4>
        <a href="pricing.html">Membership plans</a><a href="login.html?mode=signup">Join free</a>
        <a href="account.html">Your account</a></div>
      <div><h4>Therapists</h4>
        <a href="therapists.html">Find a therapist</a><a href="for-therapists.html">List your practice</a>
        <a href="therapist-dashboard.html">Practice dashboard</a></div>
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
