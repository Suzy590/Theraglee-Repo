/* Theraglee Match Mode — the details a member shares, and the one line a
   therapist reads. Used by the member dashboard, the account page and the
   practice dashboard, so the wording stays the same everywhere.

   A therapist never sees a member's name here. The name travels only in a
   reply the member chooses to send (outreach_replies.member_name). */

import { sb, esc, modal, busy, toast } from './app.js';
import { MEMBER_ISSUES } from './lists.js';

export const GENDERS = [
  ['female',     'Female'],
  ['male',       'Male'],
  ['non_binary', 'Non-binary'],
  ['prefer_not', 'Prefer not to say'],
];

export const SESSION_PREFS = [
  ['in_person',  'In person'],
  ['telehealth', 'Telehealth (video or phone)'],
  ['both',       'Either works for me'],
];

const SESSION_LINE = {
  in_person:  'seeking in-person sessions',
  telehealth: 'seeking telehealth sessions',
  both:       'open to in-person or telehealth',
};

export const genderLabel  = (k) => GENDERS.find(g => g[0] === k)?.[1] || '';
export const sessionLabel = (k) => SESSION_LINE[k] || '';

/* True once the member has answered everything the modal asks for. */
export const matchComplete = (p) =>
  Boolean(p?.match_gender && p?.match_age && p?.match_delivery && (p?.issues || []).length);

/* "Male, 39 · seeks help with anxiety and sleep problems · seeking in-person sessions · near 90210" */
export function matchSummary(m, { withZip = true } = {}) {
  const gender = m.match_gender ?? m.gender;
  const age    = m.match_age ?? m.age;
  const who = [
    gender && gender !== 'prefer_not' ? genderLabel(gender) : '',
    age ? String(age) : '',
  ].filter(Boolean).join(', ');
  const topics = (m.issues || []).map(t => t.toLowerCase());
  const parts = [
    who || 'Theraglee member',
    topics.length ? 'seeks help with ' + listWords(topics) : 'topics not chosen yet',
    sessionLabel(m.match_delivery ?? m.delivery),
    withZip ? (m.zip ? 'near ' + m.zip : '') : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function listWords(words) {
  if (words.length <= 1) return words.join('');
  if (words.length === 2) return words.join(' and ');
  return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
}

/* The short explanation under every Match Mode switch. */
export const MATCH_BLURB = `Let therapists reach out to you. Verified therapists see a short
  line about you, never your name: your gender, age, the topics you want help with, whether you
  want in-person or telehealth sessions, and your zip code. They message your Theraglee inbox.
  Your real name goes to a therapist only if you choose to reply to them.`;

/* Ask for the details, save them, and switch Match Mode on.
   Resolves with the saved fields, or null if the member closed the window. */
export function matchDetailsModal(p, { editing = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const back = modal(`
      <h2 style="margin-top:0">${editing ? 'What therapists see' : 'A little about you'}</h2>
      <p class="muted" style="font-size:.93rem;margin-top:-6px">This is the whole of what a
        therapist sees when <strong>Theraglee Match Mode</strong> is on. No name, no email,
        nothing you have written.</p>

      <div class="grid g2" style="gap:12px">
        <div class="field"><label for="mm-gender">Gender</label>
          <select id="mm-gender">
            <option value="">Choose…</option>
            ${GENDERS.map(([k,l]) => `<option value="${k}" ${p.match_gender===k?'selected':''}>${l}</option>`).join('')}
          </select></div>
        <div class="field"><label for="mm-age">Age</label>
          <input id="mm-age" type="number" inputmode="numeric" min="18" max="120"
                 value="${p.match_age ? esc(p.match_age) : ''}" placeholder="e.g. 39"></div>
      </div>

      <div class="field"><label>What would you like help with?</label>
        <div class="chips" id="mm-issues">${MEMBER_ISSUES.map(i =>
          `<button type="button" class="chip ${(p.issues||[]).includes(i)?'on':''}" data-v="${esc(i)}">${esc(i)}</button>`).join('')}</div>
        <div class="help">Pick one or more. These are the same topics that shape your daily content.</div></div>

      <div class="field"><label for="mm-delivery">How would you like to meet?</label>
        <select id="mm-delivery">
          <option value="">Choose…</option>
          ${SESSION_PREFS.map(([k,l]) => `<option value="${k}" ${p.match_delivery===k?'selected':''}>${l}</option>`).join('')}
        </select></div>

      <div class="field"><label for="mm-zip">Zip code</label>
        <input id="mm-zip" type="text" inputmode="numeric" maxlength="10" value="${esc(p.zip||'')}" placeholder="5 digits">
        <div class="help">So therapists near you can find you. The zip code is the only location they see.</div></div>

      <div class="notice" id="mm-preview" style="margin-bottom:16px"></div>

      <div class="row" style="justify-content:flex-end">
        <button class="btn ghost" id="mm-no" type="button">${editing ? 'Cancel' : 'Not now'}</button>
        <button class="btn" id="mm-yes" type="button">${editing ? 'Save' : 'Turn Match Mode on'}</button></div>`);

    const $ = (s) => back.querySelector(s);
    const read = () => ({
      match_gender:   $('#mm-gender').value || null,
      match_age:      Number($('#mm-age').value) || null,
      issues:         [...back.querySelectorAll('#mm-issues .chip.on')].map(c => c.dataset.v),
      match_delivery: $('#mm-delivery').value || null,
      zip:            $('#mm-zip').value.trim() || null,
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
      if (!v.match_gender)            return toast('Please choose a gender, or "Prefer not to say".', 'err');
      if (!v.match_age || v.match_age < 18 || v.match_age > 120)
                                      return toast('Please enter your age. Theraglee is for adults 18 and over.', 'err');
      if (!v.issues.length)           return toast('Pick at least one topic so therapists know how to help.', 'err');
      if (!v.match_delivery)          return toast('Let therapists know whether you want in-person or telehealth sessions.', 'err');
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
