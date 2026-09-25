/* Theraglee — the member's inbox: messages from therapists who reached out
   through Theraglee Match Mode, and the member's replies, one thread per
   therapist. Shown on the Messages tab of the member dashboard and the Inbox
   tab of the account page.

   A reply carries the member's real name to that one therapist
   (outreach_replies.member_name). One tap blocks a therapist (member_blocks). */

import { sb, esc, busy, toast, fmtDate } from './app.js';

// Draws the inbox into `host`. `where` finishes the sentence saying where the
// member turns Match Mode on, so each page can point at its own switch.
export async function mountInbox(host, a, { where = 'on your dashboard' } = {}){
  const again = () => mountInbox(host, a, { where });
  const [{ data: sent }, { data: replies }, { data: blocks }] = await Promise.all([
    sb.from('therapist_outreach')
      .select('*, therapist_profiles(first_name,last_name,credentials,slug)')
      .eq('member_id', a.profile.id).order('created_at', { ascending:true }),
    sb.from('outreach_replies').select('*')
      .eq('member_id', a.profile.id).order('created_at', { ascending:true }),
    sb.from('member_blocks').select('therapist_id').eq('member_id', a.profile.id),
  ]);
  const blocked = new Set((blocks || []).map(b => b.therapist_id));

  // One thread per therapist: their messages and your replies, oldest first.
  const threads = new Map();
  for (const m of sent || []) {
    const t = threads.get(m.therapist_id) || { therapist: m.therapist_profiles || {}, items: [], last: m };
    t.items.push({ from: 'therapist', at: m.created_at, text: m.message, id: m.id });
    t.last = m; threads.set(m.therapist_id, t);
  }
  for (const r of replies || []) {
    const t = threads.get(r.therapist_id);
    if (t) t.items.push({ from: 'you', at: r.created_at, text: r.message, name: r.member_name });
  }
  const list = [...threads.entries()].map(([id, t]) => {
    t.items.sort((x, y) => new Date(x.at) - new Date(y.at));
    return [id, t];
  }).sort((x, y) => new Date(y[1].items.at(-1).at) - new Date(x[1].items.at(-1).at));
  const lastName = (replies || []).at(-1)?.member_name || '';

  host.innerHTML = `
    <h2 style="margin-top:0">Messages from therapists</h2>
    <p class="muted">Only therapists you allowed to reach you by turning on <strong>Theraglee Match
      Mode</strong> ${where}. They see your pseudonymous profile, not your name. If you
      reply, your reply carries your real name to that one therapist, so they know who they will
      be booking with. Block any therapist with one tap and they can no longer see or message
      you.</p>
    ${list.length ? list.map(([tid, t]) => {
      const th = t.therapist;
      const replied = t.items.some(i => i.from === 'you');
      const isBlocked = blocked.has(tid);
      return `<div class="card" style="margin-top:14px" data-thread="${esc(tid)}">
        <div class="spread">
          <strong>${esc(th.first_name||'')} ${esc(th.last_name||'')}${th.credentials?', '+esc(th.credentials):''}</strong>
          ${isBlocked ? '<span class="badge lock">Blocked</span>'
            : replied ? '<span class="badge">You replied</span>' : '<span class="badge gray">Waiting for you</span>'}</div>
        <div class="stack" style="margin-top:12px">${t.items.map(i => `
          <div style="padding:12px 14px;border-radius:var(--r-sm);background:${i.from==='you'?'var(--soft)':'var(--sand)'}">
            <div class="spread"><span class="faint">${i.from==='you' ? 'You, as ' + esc(i.name) : 'Therapist'}</span>
              <span class="faint">${fmtDate(i.at)}</span></div>
            <p class="muted" style="margin:6px 0 0;white-space:pre-wrap">${esc(i.text)}</p></div>`).join('')}</div>
        <div class="row" style="margin-top:12px">
          ${th.slug?`<a class="btn sm ghost" href="therapist.html?slug=${esc(th.slug)}">View their profile</a>`:''}
          ${isBlocked
            ? `<button class="btn sm ghost" data-unblock="${esc(tid)}">Unblock</button>`
            : `<button class="btn sm" data-reply="${esc(tid)}">${replied ? 'Reply again' : 'Reply with my name'}</button>
               <button class="btn sm ghost" data-block="${esc(tid)}">Block this therapist</button>`}
        </div>
        <form class="reply" data-form="${esc(tid)}" hidden style="margin-top:16px">
          <div class="notice" style="margin-bottom:12px">Your reply goes to this therapist with your
            <strong>real name</strong>, so they know who they are arranging an appointment with. They
            get an email that you wrote back. Nothing else about you changes: they still cannot see
            your email address or anything you have written.</div>
          <div class="field"><label for="rn-${esc(tid)}">Your real name *</label>
            <input id="rn-${esc(tid)}" type="text" autocomplete="name" placeholder="First and last name"
                   value="${esc(lastName)}" required></div>
          <div class="field"><label for="rm-${esc(tid)}">Your message *</label>
            <textarea id="rm-${esc(tid)}" placeholder="Hello — yes, I would like to hear more about…" required></textarea></div>
          <div class="row" style="justify-content:flex-end">
            <button type="button" class="btn ghost" data-cancel="${esc(tid)}">Cancel</button>
            <button type="submit" class="btn">Send my reply</button></div>
        </form>
      </div>`;
    }).join('') : '<div class="empty" style="margin-top:18px">No messages.</div>'}`;

  host.querySelectorAll('[data-reply]').forEach(b => b.onclick = () => {
    const f = host.querySelector(`[data-form="${b.dataset.reply}"]`);
    f.hidden = false; b.hidden = true; f.querySelector('input').focus();
  });
  // One tap blocks: the therapist stops seeing this member and can no longer write to them.
  host.querySelectorAll('[data-block]').forEach(b => b.onclick = async () => {
    busy(b, true, 'Blocking…');
    const { error } = await sb.from('member_blocks')
      .insert({ member_id: a.profile.id, therapist_id: b.dataset.block });
    busy(b, false);
    if (error) return toast(error.message, 'err');
    toast('Blocked. This therapist can no longer see or message you.', 'ok'); again();
  });
  host.querySelectorAll('[data-unblock]').forEach(b => b.onclick = async () => {
    busy(b, true, 'Unblocking…');
    const { error } = await sb.from('member_blocks').delete()
      .eq('member_id', a.profile.id).eq('therapist_id', b.dataset.unblock);
    busy(b, false);
    if (error) return toast(error.message, 'err');
    toast('Unblocked.', 'ok'); again();
  });
  host.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => {
    host.querySelector(`[data-form="${b.dataset.cancel}"]`).hidden = true;
    host.querySelector(`[data-reply="${b.dataset.cancel}"]`).hidden = false;
  });
  host.querySelectorAll('form.reply').forEach(f => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tid = f.dataset.form, t = threads.get(tid);
    const name = f.querySelector('input').value.trim();
    const msg  = f.querySelector('textarea').value.trim();
    if (name.length < 2 || !name.includes(' ')) return toast('Please give your real first and last name.','err');
    if (msg.length < 2) return toast('Please write a message.','err');
    const btn = f.querySelector('[type=submit]');
    busy(btn, true, 'Sending…');
    const { error } = await sb.from('outreach_replies').insert({
      outreach_id: t.last.id, therapist_id: tid, member_id: a.profile.id,
      member_name: name, message: msg });
    busy(btn, false);
    if (error) return toast(error.message,'err');
    toast('Reply sent with your name.','ok'); again();
  }));
}
