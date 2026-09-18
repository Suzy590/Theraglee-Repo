/* Theraglee Match Mode — the pseudonymous profile a member shares, and the one
   line a therapist reads. Used by the member dashboard, the account page and
   the practice dashboard, so the wording stays the same everywhere.

   A therapist never sees a member's name, exact location or email here. The
   name travels only in a reply the member chooses to send
   (outreach_replies.member_name). */

import { sb, esc, modal, busy, toast } from './app.js';
import { MEMBER_ISSUES } from './lists.js';

export const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

export const SESSION_PREFS = [
  ['in_person',  'In person'],
  ['telehealth', 'Video (telehealth)'],
  ['both',       'Either works for me'],
];

const SESSION_LINE = {
  in_person:  'seeking in-person sessions',
  telehealth: 'seeking video sessions',
  both:       'open to in-person or video',
};

export const sessionLabel = (k) => SESSION_LINE[k] || '';
const rangeLabel = (r) => r ? String(r).replace('-', '–') : '';

/* The general area a therapist sees: the first three digits of the zip code. */
export const areaOf = (zip) => (/^\d{5}/.test(zip || '') ? zip.slice(0, 3) + 'xx' : '');

/* True once the member has answered everything the window asks for. */
export const matchComplete = (p) =>
  Boolean(p?.match_age_range && p?.match_delivery && (p?.issues || []).length);

/* "35–44 · seeks help with anxiety and burnout · seeking video sessions · in the 902xx area"
   Accepts a member's own profile (match_* fields plus zip) or a member_discovery row. */
export function matchSummary(m, { withArea = true } = {}) {
  const range  = m.match_age_range ?? m.age_range;
  const topics = (m.issues || []).map(t => t.toLowerCase());
  const area   = m.area ?? areaOf(m.zip);
  const parts = [
    range ? rangeLabel(range) : 'Theraglee member',
    topics.length ? 'seeks help with ' + listWords(topics) : 'topics not chosen yet',
    sessionLabel(m.match_delivery ?? m.delivery),
    withArea && area ? 'in the ' + area + ' area' : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function listWords(words) {
  if (words.length <= 1) return words.join('');
  if (words.length === 2) return words.join(' and ');
  return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
}

/* The short explanation under every Match Mode switch. */
export const MATCH_BLURB = `Let therapists reach out to you. Verified therapists see a pseudonymous
  profile, never your name: your age range, the broad topics you want to work on, whether you
  prefer in-person, video, or either, and your general location so they know you're nearby.
  They message your Theraglee inbox. Your real name goes to a therapist only if you choose to
  reply to them, and you can block any therapist with one tap.`;

/* Ask for the details, save them, and switch Match Mode on.
   Resolves with the saved fields, or null if the member closed the window. */
export function matchDetailsModal(p, { editing = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const back = modal(`
      <h2 style="margin-top:0">${editing ? 'What therapists see' : 'Your pseudonymous profile'}</h2>
      <p class="muted" style="font-size:.93rem;margin-top:-6px">This is the whole of what a
        therapist sees when <strong>Theraglee Match Mode</strong> is on. No name, no exact
        location, no email, nothing you have written. Your name stays private until you choose
        to reply to a therapist.</p>

      <div class="grid g2" style="gap:12px">
        <div class="field"><label for="mm-age">Age range</label>
          <select id="mm-age">
            <option value="">Choose…</option>
            ${AGE_RANGES.map(r => `<option value="${r}" ${p.match_age_range===r?'selected':''}>${esc(rangeLabel(r))}</option>`).join('')}
          </select></div>
        <div class="field"><label for="mm-delivery">How would you like to meet?</label>
          <select id="mm-delivery">
            <option value="">Choose…</option>
            ${SESSION_PREFS.map(([k,l]) => `<option value="${k}" ${p.match_delivery===k?'selected':''}>${l}</option>`).join('')}
          </select></div>
      </div>

      <div class="field"><label>What would you like to work on?</label>
        <div class="chips" id="mm-issues">${MEMBER_ISSUES.map(i =>
          `<button type="button" class="chip ${(p.issues||[]).includes(i)?'on':''}" data-v="${esc(i)}">${esc(i)}</button>`).join('')}</div>
        <div class="help">Pick one or more broad topics. These are the same topics that shape your daily content.</div></div>

      <div class="field"><label for="mm-zip">Zip code</label>
        <input id="mm-zip" type="text" inputmode="numeric" maxlength="10" value="${esc(p.zip||'')}" placeholder="5 digits">
        <div class="help">Therapists see only the first three digits, as a general area, so they know
          you're nearby. Your exact zip code stays private.</div></div>

      <div class="notice" id="mm-preview" style="margin-bottom:16px"></div>

      <div class="row" style="justify-content:flex-end">
        <button class="btn ghost" id="mm-no" type="button">${editing ? 'Cancel' : 'Not now'}</button>
        <button class="btn" id="mm-yes" type="button">${editing ? 'Save' : 'Turn Match Mode on'}</button></div>`);

    const $ = (s) => back.querySelector(s);
    const read = () => ({
      match_age_range: $('#mm-age').value || null,
      issues:          [...back.querySelectorAll('#mm-issues .chip.on')].map(c => c.dataset.v),
      match_delivery:  $('#mm-delivery').value || null,
      zip:             $('#mm-zip').value.trim() || null,
    });
    const preview = () => {
      $('#mm-preview').innerHTML = `<strong>Therapists will read:</strong> ${esc(matchSummary(read()))}`;
    };
    preview();
    back.querySelectorAll('#mm-issues .chip').forEach(c =>
      c.addEventListener('click', () => { c.classList.toggle('on'); preview(); }));
    back.querySelectorAll('select, input').forEach(el => el.addEventListener('input', preview));

    // Closing the window by clicking outside it or pressing Escape counts as "not now".
    const watch = new MutationObserver(() => { if (!document.body.contains(back)) { watch.disconnect(); done(null); } });
    watch.observe(document.body, { childList: true });

    $('#mm-no').onclick = () => { back.remove(); done(null); };
    $('#mm-yes').onclick = async (e) => {
      const v = read();
      if (!v.match_age_range)  return toast('Please choose your age range. Theraglee is for adults 18 and over.', 'err');
      if (!v.issues.length)    return toast('Pick at least one topic so therapists know how to help.', 'err');
      if (!v.match_delivery)   return toast('Let therapists know whether you prefer in-person, video, or either.', 'err');
      if (v.zip && !/^\d{5}(-\d{4})?$/.test(v.zip)) return toast('That zip code does not look right.', 'err');
      busy(e.target, true, 'Saving…');
      const patch = { ...v, visible_to_therapists: true, onboarded: true };
      const { error } = await sb.from('profiles').update(patch).eq('id', p.id);
      busy(e.target, false);
      if (error) return toast(error.message, 'err');
      Object.assign(p, patch);
      back.remove();
      done(patch);
    };
  });
}
