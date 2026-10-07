/* Theraglee — the member's inbox, shown on the Messages tab of the member
   dashboard and the Inbox tab of the account page. Two kinds of conversation
   live here, one thread each:

   - A therapist the member wrote to from their profile ("Send a message" on
     therapist.html). The opening message is a therapist_messages row; the
     therapist's answers and the member's write-backs are
     therapist_message_replies rows. Nothing goes by email in either direction.
   - A therapist who reached out through Theraglee Match Mode
     (therapist_outreach), with the member's replies (outreach_replies). A
     reply carries the member's real name to that one therapist
     (outreach_replies.member_name).

   Either kind of thread has a Block this therapist button, one tap, and an
   Unblock button once blocked (member_blocks). A blocked therapist can no
   longer see the member in Match Mode or write to them anywhere, and the
   thread keeps what was already said.

   Each conversation is one collapsed .thread (a <details>): closed, it is a
   header with the therapist's name, a status pill, the date and first line
   of the last turn, and a "New" pill while a turn in it is unread. Opening
   one closes any other, so one conversation is open at a time.

   A therapist's turn is unread until the member opens its thread, which
   stamps therapist_outreach.read_at or therapist_message_replies.read_at.
   Until then the Messages tab on the dashboard and the Inbox tab on the
   account page carry a count, drawn from unreadCount(); each time the inbox
   marks a thread read it fires `theraglee:inbox-read` on `document` with
   `detail.remaining`, the unread count that is left, so the page can take
   the count down. */

import { sb, esc, busy, toast, fmtDate } from './app.js';

// How many turns from therapists the member has not opened yet.
export async function unreadCount(a){
  const [{ count: outreach }, { count: answers }] = await Promise.all([
    sb.from('therapist_outreach')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', a.profile.id).is('read_at', null),
    sb.from('therapist_message_replies')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', a.profile.id).eq('sender', 'therapist').is('read_at', null),
  ]);
  return (outreach || 0) + (answers || 0);
}

// The thread left open when the inbox last drew, so sending a reply (which
// redraws) keeps the member's place. Null when none is open.
let openKey = null;

// Draws the inbox into `host`. `where` finishes the sentence saying where the
// member turns Match Mode on, so each page can point at its own switch.
// `heading: false` leaves out the title, for a page that already has one
// above the inbox (the dashboard's Messages tab).
export async function mountInbox(host, a, { where = 'on your dashboard', heading = true } = {}){
  const again = () => mountInbox(host, a, { where, heading });
  const me = a.profile.id;
  const [{ data: sent }, { data: replies }, { data: blocks }, { data: asked }, { data: turns }] = await Promise.all([
    sb.from('therapist_outreach')
      .select('*, therapist_profiles(first_name,last_name,credentials,slug)')
      .eq('member_id', me).order('created_at', { ascending:true }),
    sb.from('outreach_replies').select('*')
      .eq('member_id', me).order('created_at', { ascending:true }),
    sb.from('member_blocks').select('therapist_id').eq('member_id', me),
    sb.from('therapist_messages')
      .select('id,therapist_id,sender_name,message,created_at, therapist_profiles(first_name,last_name,credentials,slug)')
      .eq('sender_user_id', me).order('created_at', { ascending:true }),
    sb.from('therapist_message_replies').select('*')
      .eq('member_id', me).order('created_at', { ascending:true }),
  ]);
  const blocked = new Set((blocks || []).map(b => b.therapist_id));
  // The turns that are new this visit: shown as such, then marked read.
  const freshOutreach = (sent || []).filter(m => !m.read_at).map(m => m.id);
  const freshAnswers  = (turns || []).filter(r => r.sender === 'therapist' && !r.read_at).map(r => r.id);
  const fresh = new Set([...freshOutreach, ...freshAnswers]);

  // One thread per conversation, oldest turn first. A Match Mode thread is
  // keyed by the therapist; a conversation the member started is keyed by
  // its opening message, since the same therapist could be written to again.
  const threads = new Map();
  for (const m of sent || []) {
    const key = m.therapist_id;
    const t = threads.get(key) || { kind: 'match', therapist: m.therapist_profiles || {}, tid: m.therapist_id, items: [], last: m };
    t.items.push({ from: 'therapist', at: m.created_at, text: m.message, id: m.id, fresh: fresh.has(m.id) });
    t.last = m; threads.set(key, t);
  }
  for (const r of replies || []) {
    const t = threads.get(r.therapist_id);
    if (t) t.items.push({ from: 'you', at: r.created_at, text: r.message, name: r.member_name });
  }
  for (const m of asked || []) {
    const key = 'msg:' + m.id;
    const t = { kind: 'asked', therapist: m.therapist_profiles || {}, tid: m.therapist_id, msg: m, items: [] };
    t.items.push({ from: 'you', at: m.created_at, text: m.message });
    threads.set(key, t);
  }
  for (const r of turns || []) {
    const t = threads.get('msg:' + r.message_id);
    if (t) t.items.push({ from: r.sender === 'therapist' ? 'therapist' : 'you', at: r.created_at,
                          text: r.message, id: r.id, fresh: fresh.has(r.id) });
  }
  const list = [...threads.entries()].map(([id, t]) => {
    t.items.sort((x, y) => new Date(x.at) - new Date(y.at));
    return [id, t];
  }).sort((x, y) => new Date(y[1].items.at(-1).at) - new Date(x[1].items.at(-1).at));
  const lastName = (replies || []).at(-1)?.member_name || '';

  const turn = (i) => `
    <div style="padding:12px 14px;border-radius:var(--r-sm);background:${i.from==='you'?'var(--soft)':'var(--sand)'}">
      <div class="spread"><span class="faint">${i.from==='you' ? (i.name ? 'You, as ' + esc(i.name) : 'You') : 'Therapist'}${
          i.fresh ? ' <span class="badge" style="margin-left:6px">New</span>' : ''}</span>
        <span class="faint">${fmtDate(i.at)}</span></div>
      <p class="muted" style="margin:6px 0 0;white-space:pre-wrap">${esc(i.text)}</p></div>`;
  const whoIs = (th) => `${esc(th.first_name||'')} ${esc(th.last_name||'')}${th.credentials?', '+esc(th.credentials):''}`;

  // The collapsed shell of a conversation: a <details> whose <summary> is
  // the closed view and whose body is `inner`. `pill` is the status pill.
  const shell = (key, t, pill, inner) => {
    const newest = t.items.at(-1);
    const unread = t.items.filter(i => i.fresh).length;
    return `<details class="thread${unread ? ' fresh' : ''}" data-thread="${esc(key)}"${openKey === key ? ' open' : ''}>
      <summary>
        <span class="thread-who">${whoIs(t.therapist)} ${pill}${
          unread ? `<span class="badge" data-new>${unread === 1 ? 'New message' : unread + ' new messages'}</span>` : ''}</span>
        <span class="thread-when">${fmtDate(newest.at)}</span>
        <p class="thread-peek">${newest.from === 'you' ? 'You: ' : ''}${esc(newest.text)}</p>
      </summary>
      <div class="thread-body">${inner}</div>
    </details>`;
  };

  // A conversation the member started from a therapist's profile.
  const askedCard = (key, t) => {
    const th = t.therapist;
    const answered = t.items.some(i => i.from === 'therapist');
    const theirTurn = t.items.at(-1).from === 'you';
    const isBlocked = blocked.has(t.tid);
    return shell(key, t,
      isBlocked ? '<span class="badge lock">Blocked</span>'
        : theirTurn ? '<span class="badge gray">Waiting for their reply</span>' : '<span class="badge">They replied</span>', `
      <p class="faint">${isBlocked
        ? 'You blocked this therapist. They cannot write to you until you unblock them.'
        : 'You wrote to them from their profile. Their replies come here, not to your email.'}</p>
      <div class="stack" style="margin-top:12px">${t.items.map(turn).join('')}</div>
      <div class="row" style="margin-top:12px">
        ${th.slug?`<a class="btn sm ghost" href="therapist.html?slug=${esc(th.slug)}">View their profile</a>`:''}
        ${isBlocked
          ? `<button class="btn sm ghost" data-unblock="${esc(t.tid)}">Unblock</button>`
          : `<button class="btn sm" data-writeback="${esc(key)}">${answered ? 'Write back' : 'Add to your message'}</button>
             <button class="btn sm ghost" data-block="${esc(t.tid)}">Block this therapist</button>`}
      </div>
      <form class="writeback" data-form="${esc(key)}" hidden style="margin-top:16px">
        <div class="field"><label for="wb-${esc(t.msg.id)}">Your message *</label>
          <textarea id="wb-${esc(t.msg.id)}" required placeholder="Hello — thank you for getting back to me…"></textarea>
          <div class="help">Goes to ${esc(th.first_name||'the therapist')}'s Theraglee inbox.</div></div>
        <div class="row" style="justify-content:flex-end">
          <button type="button" class="btn ghost" data-cancel="${esc(key)}">Cancel</button>
          <button type="submit" class="btn">Send</button></div>
      </form>`);
  };

  // A therapist who reached out through Match Mode.
  const matchCard = (tid, t) => {
    const th = t.therapist;
    const replied = t.items.some(i => i.from === 'you');
    const isBlocked = blocked.has(tid);
    return shell(tid, t,
      isBlocked ? '<span class="badge lock">Blocked</span>'
        : replied ? '<span class="badge">You replied</span>' : '<span class="badge gray">Waiting for you</span>', `
      <p class="faint">They reached out through Theraglee Match Mode.</p>
      <div class="stack" style="margin-top:12px">${t.items.map(turn).join('')}</div>
      <div class="row" style="margin-top:12px">
        ${th.slug?`<a class="btn sm ghost" href="therapist.html?slug=${esc(th.slug)}">View their profile</a>`:''}
        ${isBlocked
          ? `<button class="btn sm ghost" data-unblock="${esc(tid)}">Unblock</button>`
          : `<button class="btn sm" data-reply="${esc(tid)}">${replied ? 'Reply again' : 'Reply with my name'}</button>
             <button class="btn sm ghost" data-block="${esc(tid)}">Block this therapist</button>`}
      </div>
      <form class="reply" data-form="${esc(tid)}" hidden style="margin-top:16px">
        <div class="notice" style="margin-bottom:12px">${a.profile.match_pseudonym
          ? `Until now this therapist has known you as <strong>${esc(a.profile.match_pseudonym)}</strong>. `
          : ''}Your reply goes to this therapist with your
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
      </form>`);
  };

  host.innerHTML = `
    ${heading ? '<h2 style="margin-top:0">Messages</h2>' : ''}
    <p class="muted">Every conversation with a therapist lives here, not in your email. When you write
      to a therapist from their profile, their answer comes to this inbox. Therapists can also reach
      you here, but only if you allowed it by turning on <strong>Theraglee Match
      Mode</strong> ${where}: they see your pseudonymous profile, not your name, and if you reply,
      your reply carries your real name to that one therapist, so they know who they will be
      booking with. Block any therapist with one tap, on any conversation, and they can no
      longer see or message you; unblock from the same place.</p>
    ${list.length
      ? list.map(([key, t]) => t.kind === 'asked' ? askedCard(key, t) : matchCard(key, t)).join('')
      : '<div class="empty" style="margin-top:18px">No messages.</div>'}`;

  // Opening a thread is reading it: its new turns are stamped read, its
  // "New" pill goes, and the page hears how many unread are left so the
  // count on its tab can come down. The "New" tags on the turns themselves
  // stay until the next draw, so the member can see which ones were new.
  let remaining = fresh.size;
  const readThread = async (key) => {
    const t = threads.get(key);
    const mine = (t?.items || []).filter(i => i.fresh);
    if (!mine.length) return;
    mine.forEach(i => { i.fresh = false; });
    const now = new Date().toISOString();
    const { error } = t.kind === 'match'
      ? await sb.from('therapist_outreach').update({ read_at: now })
          .eq('member_id', me).eq('therapist_id', t.tid).is('read_at', null)
      : await sb.from('therapist_message_replies').update({ read_at: now })
          .eq('member_id', me).eq('message_id', t.msg.id).eq('sender', 'therapist').is('read_at', null);
    if (error) return;
    const el = host.querySelector(`[data-thread="${CSS.escape(key)}"]`);
    el?.classList.remove('fresh');
    el?.querySelector('[data-new]')?.remove();
    remaining = Math.max(0, remaining - mine.length);
    document.dispatchEvent(new CustomEvent('theraglee:inbox-read', { detail: { remaining } }));
  };
  // One thread open at a time: opening one closes the others.
  host.querySelectorAll('details.thread').forEach(d => d.addEventListener('toggle', () => {
    if (!d.open) { if (openKey === d.dataset.thread) openKey = null; return; }
    openKey = d.dataset.thread;
    host.querySelectorAll('details.thread[open]').forEach(o => { if (o !== d) o.open = false; });
    readThread(d.dataset.thread);
  }));
  // The thread that was open before a redraw is still open, and read.
  host.querySelectorAll('details.thread[open]').forEach(d => readThread(d.dataset.thread));

  const show = (key, opener) => {
    const f = host.querySelector(`[data-form="${key}"]`);
    f.hidden = false; opener.hidden = true;
    (f.querySelector('input') || f.querySelector('textarea')).focus();
  };
  host.querySelectorAll('[data-reply]').forEach(b => b.onclick = () => show(b.dataset.reply, b));
  host.querySelectorAll('[data-writeback]').forEach(b => b.onclick = () => show(b.dataset.writeback, b));
  // One tap blocks: the therapist stops seeing this member and can no longer
  // write to them, in Match Mode or on a conversation the member started.
  // The same therapist can be on more than one thread, so a block that is
  // already there (the primary key says so) counts as done.
  host.querySelectorAll('[data-block]').forEach(b => b.onclick = async () => {
    busy(b, true, 'Blocking…');
    const { error } = await sb.from('member_blocks')
      .insert({ member_id: me, therapist_id: b.dataset.block });
    busy(b, false);
    if (error && error.code !== '23505') return toast(error.message, 'err');
    toast('Blocked. This therapist can no longer see or message you.', 'ok'); again();
  });
  host.querySelectorAll('[data-unblock]').forEach(b => b.onclick = async () => {
    busy(b, true, 'Unblocking…');
    const { error } = await sb.from('member_blocks').delete()
      .eq('member_id', me).eq('therapist_id', b.dataset.unblock);
    busy(b, false);
    if (error) return toast(error.message, 'err');
    toast('Unblocked.', 'ok'); again();
  });
  host.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => {
    const key = b.dataset.cancel;
    host.querySelector(`[data-form="${key}"]`).hidden = true;
    const opener = host.querySelector(`[data-reply="${key}"]`) || host.querySelector(`[data-writeback="${key}"]`);
    if (opener) opener.hidden = false;
  });
  // A reply to a Match Mode therapist: carries the member's real name.
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
      outreach_id: t.last.id, therapist_id: tid, member_id: me,
      member_name: name, message: msg });
    busy(btn, false);
    if (error) return toast(error.message,'err');
    toast('Reply sent with your name.','ok'); again();
  }));
  // A write-back on a conversation the member started from a profile.
  host.querySelectorAll('form.writeback').forEach(f => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = f.dataset.form, t = threads.get(key);
    const msg = f.querySelector('textarea').value.trim();
    if (msg.length < 2) return toast('Please write a message.','err');
    const btn = f.querySelector('[type=submit]');
    busy(btn, true, 'Sending…');
    const { error } = await sb.from('therapist_message_replies').insert({
      message_id: t.msg.id, therapist_id: t.tid, member_id: me, sender: 'member', message: msg });
    busy(btn, false);
    if (error) return toast(error.message,'err');
    toast(`Sent to ${t.therapist.first_name || 'the therapist'}'s Theraglee inbox.`,'ok'); again();
  }));
}
