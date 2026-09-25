/* Theraglee Match Mode — the pseudonymous profile a member shares, and the one
   line a therapist reads. Used by the member dashboard, the account page and
   the practice dashboard, so the wording stays the same everywhere.

   A therapist never sees a member's name, exact location or email here, only
   the pseudonym the member picks. The real name travels only in a reply the
   member chooses to send (outreach_replies.member_name). */

import { sb, esc, modal, busy, toast } from './app.js';

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

/* The broad topics a member picks for Match Mode (profiles.match_topics). The
   database accepts only these; see 20260925060000_match_mode_pseudonym_topics.sql. */
export const MATCH_TOPICS = ['Anxiety', 'Panic', 'Depression', 'Stress', 'Life transition',
  'Grief/loss', 'Relationship issues', 'Family issues', 'Trauma', 'Personal growth', 'Other'];

/* A pseudonym is 2 to 30 letters, digits, spaces and . ' _ - (the database checks the same). */
export const PSEUDONYM_RE = /^[A-Za-z0-9][A-Za-z0-9 .'_-]{1,29}$/;

/* A suggested pseudonym, like "Quiet Harbor 27". Never anything about the member. */
const P_WORDS = ['Quiet', 'Gentle', 'Bright', 'Steady', 'Calm', 'Hopeful', 'Kind', 'Brave', 'Clear', 'Warm',
  'Golden', 'Silver', 'Morning', 'Evening', 'Sunny', 'Misty'];
const P_NOUNS = ['Harbor', 'Meadow', 'River', 'Willow', 'Heron', 'Maple', 'Cedar', 'Sparrow', 'Brook', 'Fern',
  'Pine', 'Lark', 'Aspen', 'Juniper', 'Wren', 'Birch'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const suggestPseudonym = () =>
  `${pick(P_WORDS)} ${pick(P_NOUNS)} ${10 + Math.floor(Math.random() * 90)}`;

export const sessionLabel = (k) => SESSION_LINE[k] || '';
const rangeLabel = (r) => r ? String(r).replace('-', '–') : '';

/* The only location a therapist sees: the first three digits of the zip code. */
export const areaOf = (zip) => (/^\d{5}/.test(zip || '') ? zip.slice(0, 3) + 'xx' : '');

/* True once the member has answered everything the window asks for. */
export const matchComplete = (p) =>
  Boolean(p?.match_pseudonym && p?.match_age_range && p?.match_delivery
    && (p?.match_topics || []).length && areaOf(p?.zip));

/* "Quiet Harbor 27 · 35–44 · seeks help with anxiety and stress · seeking video sessions · in the 902xx area"
   Accepts a member's own profile (match_* fields plus zip) or a member_discovery row.
   A member who switched Match Mode on before match_topics existed still shows issues. */
export function matchSummary(m, { withArea = true } = {}) {
  const range  = m.match_age_range ?? m.age_range;
  const own    = m.match_topics?.length ? m.match_topics : m.issues;
  const topics = (own || []).map(t => t === 'Other' ? 'something else' : t.toLowerCase());
  const area   = m.area ?? areaOf(m.zip);
  const parts = [
    m.match_pseudonym ?? m.pseudonym ?? '',
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
  profile that includes: your pseudonym, your age range, the broad topic(s) you would like to work on
  with a therapist, whether you prefer in-person, video, or either, and the first three digits of your
  zip code so they know you're nearby. If you indicate you are open to video sessions, you may have
  therapists anywhere in your state reach out to you. Therapists will reach out to you by messaging
  your Theraglee inbox. Your real name goes to a therapist only if you choose to reply to them, and
  you can block any therapist with one tap. Toggling OFF Theraglee Match Mode makes you invisible to
  therapists.`;

/* Ask for the details, save them, and switch Match Mode on.
   Resolves with the saved fields, or null if the member closed the window. */
export function matchDetailsModal(p, { editing = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const chips = (id, list, on, single) => `<div class="chips" id="${id}" ${single ? 'data-single' : ''}>${
      list.map(([v, l]) => `<button type="button" class="chip ${on(v) ? 'on' : ''}" data-v="${esc(v)}"
        aria-pressed="${on(v)}">${esc(l)}</button>`).join('')}</div>`;

    const back = modal(`
      <h2 style="margin-top:0">${editing ? 'What therapists see' : 'Your pseudonymous profile'}</h2>
      <p class="muted" style="font-size:.93rem;margin-top:-6px">This is the whole of what a
        therapist sees when <strong>Theraglee Match Mode</strong> is on. No real name, no exact
        location, no email, nothing you have written. Your real name stays private until you
        choose to reply to a therapist.</p>

      <div class="field"><label for="mm-name">Your pseudonym</label>
        <div class="row" style="flex-wrap:nowrap">
          <input id="mm-name" type="text" maxlength="30" autocomplete="off" style="flex:1"
            value="${esc(p.match_pseudonym || suggestPseudonym())}">
          <button type="button" class="btn sm ghost" id="mm-suggest">Suggest another</button></div>
        <div class="help">Your pseudonym will be shared with therapists who could reach out to
          you. It is how they know you until you reply. Keep this one or type your own, but
          please don't use your real name.</div></div>

      <div class="field"><label>Your age range</label>
        ${chips('mm-age', AGE_RANGES.map(r => [r, rangeLabel(r)]), r => p.match_age_range === r, true)}</div>

      <div class="field"><label>What would you like to work on in therapy?</label>
        ${chips('mm-issues', MATCH_TOPICS.map(t => [t, t]), t => (p.match_topics || []).includes(t))}
        <div class="help">Pick one or more.</div></div>

      <div class="field"><label>How would you like to meet?</label>
        ${chips('mm-delivery', SESSION_PREFS, k => p.match_delivery === k, true)}
        <div class="help">If you are open to video, therapists anywhere in your state may
          reach out to you.</div></div>

      <div class="field"><label for="mm-zip">Zip code</label>
        <input id="mm-zip" type="text" inputmode="numeric" maxlength="10" value="${esc(p.zip||'')}" placeholder="5 digits">
        <div class="help">Therapists see only the first three digits of your zip code, so they know
          you're nearby. Your full zip code stays private.</div></div>

      <div class="notice" id="mm-preview" style="margin-bottom:16px"></div>

      <div class="row" style="justify-content:flex-end">
        <button class="btn ghost" id="mm-no" type="button">${editing ? 'Cancel' : 'Not now'}</button>
        <button class="btn" id="mm-yes" type="button">${editing ? 'Save' : 'Turn Match Mode on'}</button></div>`);

    const $ = (s) => back.querySelector(s);
    const one = (id) => $(`#${id} .chip.on`)?.dataset.v || null;
    const read = () => ({
      match_pseudonym: $('#mm-name').value.trim().replace(/\s+/g, ' ') || null,
      match_age_range: one('mm-age'),
      match_topics:    [...back.querySelectorAll('#mm-issues .chip.on')].map(c => c.dataset.v),
      match_delivery:  one('mm-delivery'),
      zip:             $('#mm-zip').value.trim() || null,
    });
    const preview = () => {
      $('#mm-preview').innerHTML = `<strong>Therapists will read:</strong> ${esc(matchSummary(read()))}`;
    };
    preview();
    // Age range and how to meet take one answer; topics take any number.
    back.querySelectorAll('.chips .chip').forEach(c => c.addEventListener('click', () => {
      const group = c.parentElement;
      if (group.hasAttribute('data-single')) group.querySelectorAll('.chip').forEach(x => {
        if (x !== c) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }
      });
      c.classList.toggle('on', group.hasAttribute('data-single') || !c.classList.contains('on'));
      c.setAttribute('aria-pressed', String(c.classList.contains('on')));
      preview();
    }));
    $('#mm-suggest').onclick = () => { $('#mm-name').value = suggestPseudonym(); preview(); };
    back.querySelectorAll('input').forEach(el => el.addEventListener('input', preview));

    // Closing the window by clicking outside it or pressing Escape counts as "not now".
    const watch = new MutationObserver(() => { if (!document.body.contains(back)) { watch.disconnect(); done(null); } });
    watch.observe(document.body, { childList: true });

    $('#mm-no').onclick = () => { back.remove(); done(null); };
    $('#mm-yes').onclick = async (e) => {
      const v = read();
      if (!v.match_pseudonym || !PSEUDONYM_RE.test(v.match_pseudonym))
        return toast('Please choose a pseudonym of 2 to 30 letters or numbers.', 'err');
      if (!v.match_age_range)  return toast('Please choose your age range. Theraglee is for adults 18 and over.', 'err');
      if (!v.match_topics.length) return toast('Pick at least one topic so therapists know how to help.', 'err');
      if (!v.match_delivery)   return toast('Let therapists know whether you prefer in-person, video, or either.', 'err');
      if (!v.zip || !/^\d{5}(-\d{4})?$/.test(v.zip)) return toast('Please enter your 5-digit zip code.', 'err');
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
