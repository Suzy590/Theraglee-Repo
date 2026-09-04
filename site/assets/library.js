/* =============================================================================
   Theraglee — member library: favourites, save for later, and progress.
   -----------------------------------------------------------------------------
   Every activity page (worksheet, quiz, checklist, challenge, article, journal)
   uses this module so the three member-facing behaviours behave identically
   everywhere and the dashboard has one place to read from.

     favourite       marks an activity with the Theraglee "ee" smile
     save for later  a separate list, for "not now, but don't lose it"
     progress        started (>=1 answer) / completed (all answers)

   Storage
     favorites      (user_id, item_type, item_id, list)  list = favorite | later
     item_progress  (user_id, item_type, item_id, answered, total) -> status
                    `status` is a generated column, so it can never disagree
                    with the counts.

   item_type always matches `content_catalog.kind`: quiz, worksheet, checklist,
   challenge, article, mandala.
   ============================================================================= */

import { sb, access, toast } from './app.js';

/* The favourite mark: the "ee" from the Theraglee wordmark with its smile,
   traced from the logo so the curves are the real letterforms. */
export const FAV_ICON =
  '<svg class="ee" viewBox="0 0 108.00 102.86" fill="currentColor" fill-rule="evenodd" aria-hidden="true">'
  + '<g transform="translate(-306.00 -75.12)"><path d="M330.38 127.01C323.22 125.73 317.05 120.70 314.51 114.05C314.23 113.33 314.00 112.53 314.00 112.29C314.00 112.05 313.77 111.41 313.50 110.88C313.05 110.00 313.00 109.40 313.00 105.12C313.00 100.85 313.05 100.25 313.50 99.38C313.77 98.84 314.00 98.21 314.00 97.98C314.00 97.15 315.30 94.14 316.35 92.53C319.98 86.97 325.48 83.68 332.36 82.98C340.65 82.12 348.41 84.92 352.71 90.32C355.31 93.60 356.78 97.10 357.37 101.45C357.89 105.30 357.87 106.38 357.25 107.00C356.76 107.49 356.42 107.50 340.02 107.50C320.80 107.50 322.47 107.24 323.63 110.01C324.88 112.99 326.54 114.88 328.97 116.11C331.51 117.40 335.53 117.86 338.55 117.22C341.49 116.59 345.16 114.02 345.99 112.02C346.16 111.61 346.53 111.19 346.81 111.11C347.20 110.98 352.70 110.92 356.29 110.99C356.98 111.01 357.01 111.67 356.39 113.31C354.98 117.01 353.74 119.00 351.36 121.38C348.92 123.82 344.56 126.09 340.77 126.89C339.03 127.26 332.21 127.34 330.38 127.01ZM379.52 126.99C378.14 126.70 375.41 125.80 374.53 125.35C374.17 125.16 373.79 125.00 373.69 125.00C373.32 125.00 370.71 123.20 369.44 122.07C365.80 118.84 363.80 115.12 362.73 109.63C362.12 106.47 362.12 104.03 362.73 100.59C364.29 91.82 369.69 85.87 378.18 83.58C380.34 83.00 381.09 82.92 384.62 82.92C388.20 82.91 388.89 82.99 391.12 83.59C396.86 85.14 400.99 88.16 403.81 92.88C404.74 94.44 406.00 97.50 406.00 98.23C406.00 98.46 406.23 99.09 406.50 99.62C406.93 100.46 407.00 101.10 407.00 103.90L407.00 107.19L406.22 107.34C405.79 107.43 398.08 107.50 389.09 107.50C375.40 107.50 372.71 107.56 372.60 107.85C372.36 108.47 373.27 110.97 374.29 112.50C376.51 115.83 379.96 117.49 384.62 117.49C389.34 117.49 392.98 115.71 395.13 112.35C395.61 111.61 396.14 111.00 396.31 110.99C400.67 110.91 405.49 110.97 405.71 111.10C406.14 111.36 406.06 112.21 405.46 114.01C404.92 115.62 404.74 115.99 403.53 117.88C400.88 122.01 397.10 124.80 391.88 126.44C390.09 127.00 389.37 127.08 385.25 127.15C382.71 127.19 380.13 127.12 379.52 126.99ZM345.99 99.14C346.46 98.57 346.10 97.89 344.44 96.25C341.94 93.77 339.25 92.75 335.23 92.75C331.58 92.75 328.78 93.77 326.47 95.93C324.82 97.47 324.10 98.64 324.51 99.13C324.96 99.68 345.54 99.68 345.99 99.14ZM395.49 99.14C395.73 98.85 395.64 98.56 395.02 97.66C392.81 94.45 389.22 92.75 384.62 92.75C380.62 92.75 377.83 93.83 375.44 96.32C373.91 97.90 373.44 98.90 374.03 99.27C374.22 99.39 379.06 99.49 384.78 99.50C393.57 99.50 395.24 99.44 395.49 99.14Z"/><path transform="translate(-0.53 0)" d="M355.88 169.97C348.62 169.21 340.79 165.77 335.31 160.95C332.34 158.33 330.30 155.84 327.31 151.18C326.37 149.71 324.13 144.03 323.88 142.50C323.78 141.88 323.54 140.76 323.35 140.01C323.16 139.26 323.00 137.68 323.00 136.49C323.00 134.52 323.05 134.29 323.62 133.75C324.39 133.03 325.60 132.98 326.24 133.65C326.49 133.91 327.00 134.91 327.37 135.88C329.34 141.04 330.38 143.05 333.32 147.33C334.69 149.32 338.81 153.18 341.49 154.96C347.52 159.00 353.50 160.85 360.50 160.84C373.15 160.84 384.55 153.90 390.69 142.48C391.60 140.79 391.96 139.96 393.57 135.75C394.15 134.25 394.83 133.34 395.53 133.12C396.09 132.94 397.40 133.60 397.74 134.24C398.05 134.81 398.06 137.72 397.77 139.12C397.65 139.68 397.38 140.97 397.17 142.00C396.96 143.03 396.49 144.66 396.13 145.62C395.76 146.59 395.30 147.78 395.12 148.28C393.38 152.90 386.92 160.53 382.08 163.69C374.14 168.88 365.40 170.98 355.88 169.97Z"/></g>'
  + '</svg>';

const key = (kind, id) => kind + ':' + id;

let _lib = null;

/** The signed-in member's favourites, saved items and progress. Cached. */
export async function library(force = false) {
  if (_lib && !force) return _lib;
  const a = await access();
  if (!a.authenticated) {
    _lib = { authenticated: false, favorite: new Set(), later: new Set(), progress: new Map() };
    return _lib;
  }
  const [lists, prog] = await Promise.all([
    sb.from('favorites').select('item_type,item_id,list').eq('user_id', a.profile.id),
    sb.from('item_progress').select('item_type,item_id,answered,total,status')
      .eq('user_id', a.profile.id),
  ]);
  const favorite = new Set(), later = new Set();
  for (const r of lists.data || []) {
    (r.list === 'later' ? later : favorite).add(key(r.item_type, r.item_id));
  }
  const progress = new Map();
  for (const r of prog.data || []) progress.set(key(r.item_type, r.item_id), r);
  _lib = { authenticated: true, userId: a.profile.id, favorite, later, progress };
  return _lib;
}

export const isFavorite = (lib, kind, id) => lib.favorite.has(key(kind, id));
export const isLater    = (lib, kind, id) => lib.later.has(key(kind, id));
export const progressOf = (lib, kind, id) => lib.progress.get(key(kind, id)) || null;

/* ------------------------------------------------------------------ lists -- */

/** Add or remove an activity from a list. Returns the new on/off state. */
export async function toggleList(kind, id, list = 'favorite') {
  const lib = await library();
  if (!lib.authenticated) {
    toast('Sign in free to keep favourites.', 'err');
    return null;
  }
  const set = list === 'later' ? lib.later : lib.favorite;
  const k = key(kind, id), on = set.has(k);

  // Update the cache first so the icon responds immediately.
  on ? set.delete(k) : set.add(k);

  const q = on
    ? sb.from('favorites').delete()
        .eq('user_id', lib.userId).eq('item_type', kind).eq('item_id', id).eq('list', list)
    : sb.from('favorites').insert(
        { user_id: lib.userId, item_type: kind, item_id: id, list });

  const { error } = await q;
  if (error) {
    on ? set.add(k) : set.delete(k);          // roll the cache back
    toast(error.message, 'err');
    return on;
  }
  if (list === 'later') toast(on ? 'Removed from Saved for later.' : 'Saved for later.', 'ok');
  return !on;
}

/* --------------------------------------------------------------- progress -- */

/** Record how far through an activity the member is. Safe to call on every save. */
export async function setProgress(kind, id, answered, total) {
  const lib = await library();
  if (!lib.authenticated) return null;
  const row = { user_id: lib.userId, item_type: kind, item_id: id,
                answered: Math.max(0, answered | 0), total: Math.max(0, total | 0) };
  const { data, error } = await sb.from('item_progress')
    .upsert(row, { onConflict: 'user_id,item_type,item_id' })
    .select('item_type,item_id,answered,total,status').maybeSingle();
  if (error) { console.debug('progress', error.message); return null; }
  if (data) lib.progress.set(key(kind, id), data);
  return data;
}

/** Count answers in a worksheet-style answers object. */
export function countAnswers(answers, fields) {
  const total = fields.length;
  let answered = 0;
  for (const f of fields) {
    const v = answers?.[f.id];
    if (v == null) continue;
    if (Array.isArray(v)) {                    // table field: any filled cell counts
      if (v.some(row => Array.isArray(row) && row.some(c => String(c || '').trim()))) answered++;
    } else if (String(v).trim()) answered++;
  }
  return { answered, total };
}

/* --------------------------------------------------------------- controls -- */

/** The favourite toggle. `size` is the icon height in px. */
export function favButton(kind, id, on, { size = 22, label = true } = {}) {
  return `<button type="button" class="ee-btn${on ? ' on' : ''}" data-fav="${kind}:${id}"
    style="--ee:${size}px" aria-pressed="${on ? 'true' : 'false'}"
    aria-label="${on ? 'Remove from favourites' : 'Add to favourites'}"
    title="${on ? 'In your favourites' : 'Add to favourites'}">${FAV_ICON}${
      label ? `<span class="ee-lbl">${on ? 'Favourited' : 'Favourite'}</span>` : ''}</button>`;
}

/** The save-for-later toggle. */
export function laterButton(kind, id, on) {
  return `<button type="button" class="btn ghost sm later-btn${on ? ' on' : ''}"
    data-later="${kind}:${id}" aria-pressed="${on ? 'true' : 'false'}">${
      on ? 'Saved for later' : 'Save for later'}</button>`;
}

/** A small Started / Completed pill, or '' when untouched. */
export function statusBadge(p) {
  if (!p || p.status === 'not_started') return '';
  if (p.status === 'completed') return '<span class="badge done">Completed</span>';
  const of = p.total ? ` ${p.answered}/${p.total}` : '';
  return `<span class="badge grey">In progress${of}</span>`;
}

/**
 * Wire every [data-fav] and [data-later] control inside `root`.
 * Click handling is delegated, so re-rendering the list does not need re-binding.
 */
export function bindLibrary(root = document, onChange = null) {
  root.addEventListener('click', async (e) => {
    const fav = e.target.closest('[data-fav]');
    const later = e.target.closest('[data-later]');
    const el = fav || later;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    const [kind, id] = el.dataset[fav ? 'fav' : 'later'].split(':');
    el.disabled = true;
    const on = await toggleList(kind, id, fav ? 'favorite' : 'later');
    el.disabled = false;
    if (on === null) return;                   // signed out

    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (fav) {
      el.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
      el.setAttribute('title', on ? 'In your favourites' : 'Add to favourites');
      const lbl = el.querySelector('.ee-lbl');
      if (lbl) lbl.textContent = on ? 'Favourited' : 'Favourite';
      if (on) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    } else {
      el.textContent = on ? 'Saved for later' : 'Save for later';
    }
    if (onChange) onChange(kind, id, fav ? 'favorite' : 'later', on);
  });
}
