/* ==========================================================================
   Assign Remind — professional side.

   Deliberately free of Theraglee vocabulary: every label for the people served
   comes from the workspace's `vocabulary`, so the same module serves teachers
   and trainers when this moves to assignremind.com.
   ========================================================================== */
import { sb, esc, toast, busy, modal, fmtDate, FN } from './app.js';

const STATE_LABEL = {
  sent: 'Sent', received: 'Received', started: 'In progress',
  completed: 'Completed', cancelled: 'Canceled',
};

let ws = null;       // the workspace row
let voc = { person:'client', people:'clients', task:'assignment', tasks:'assignments' };
let view = 'overview';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export async function renderAssignRemind(host, { siteOrigin }) {
  host.innerHTML = '<div class="skeleton" style="height:160px"></div>';

  // Assign Remind is the only part of the product that touches patient
  // information, and Theraglee's plans carry no BAA. It is held in preview here
  // until it moves to its own HIPAA-covered platform, and the database refuses
  // real records in the meantime.
  const { data: accepting } = await sb.rpc('ar_accepting_data');
  if (accepting === false) {
    host.innerHTML = `
      <div class="spread">
        <div>
          <h2 style="margin:0">Assign Remind</h2>
          <p class="muted" style="margin:4px 0 0">Set homework between sessions, and let the
            reminders do the chasing.</p>
        </div>
        <span class="badge gray">Opening shortly</span>
      </div>

      <div class="card pad-lg" style="margin-top:22px">
        <h3>Moving to its own secure platform</h3>
        <p class="muted">Everything here is built and tested — assignments, the reminder ladder,
          the client portal, completion tracking and the printable history. It is not open for
          real client records yet, and that is deliberate.</p>
        <p class="muted">Assign Remind handles your clients' health information, which means it
          needs infrastructure covered by a signed business associate agreement. Theraglee's
          wellness side does not. Rather than hold your homework tool on a platform that has not
          signed one, it is being stood up separately at
          <strong>assignremind.com</strong>, and your membership will include it.</p>
        <p class="muted" style="margin-bottom:0">You will be told the moment it opens. Nothing you
          would have entered here is lost, because nothing can be entered yet.</p>
      </div>

      <div class="notice" style="margin-top:16px">
        <strong>Why the wait is the right call.</strong> Entering a real client's name and their
        homework into a system with no BAA behind it would be a problem for your practice as much
        as for us. Better a short wait than that.
      </div>`;
    return;
  }

  const { data: workspace, error } = await sb.rpc('ar_my_workspace');
  if (error) {
    host.innerHTML = `<div class="notice err">${esc(error.message)}</div>`;
    return;
  }
  ws = workspace;
  voc = ws?.vocabulary || voc;

  const { data: dash } = await sb.rpc('ar_dashboard');
  const d = dash || {};

  // Are reminders actually going out? Surface it rather than let them wonder.
  const { data: stuck } = await sb.from('ar_reminders')
    .select('channel, error').eq('status', 'failed').limit(50);
  const blocked = new Set((stuck || [])
    .filter(r => /not_configured/.test(r.error || ''))
    .map(r => r.channel));
  const clients = d.clients || [];
  const recent = d.recent || [];
  const t = d.totals || {};

  const nav = `
    <div class="chips" style="margin-bottom:22px">
      ${[['overview','Overview'],['new',`New ${voc.task}`],['people',cap(voc.people)]]
        .map(([k,l])=>`<button class="chip ${view===k?'on':''}" data-v="${k}">${esc(l)}</button>`).join('')}
    </div>`;

  const header = `
    <div class="spread">
      <div>
        <h2 style="margin:0">Assign Remind</h2>
        <p class="muted" style="margin:4px 0 0">Set homework between sessions, and let the
          reminders do the chasing.</p>
      </div>
    </div>
    ${nav}`;

  const body =
    view === 'new'    ? newForm(clients)
  : view === 'people' ? peopleView(clients, siteOrigin)
  :                     overview(t, clients, recent);

  const warn = blocked.size ? `
    <div class="notice warn" style="margin-bottom:20px">
      <strong>Reminders are not going out yet.</strong>
      ${blocked.has('email') ? 'Email' : ''}${blocked.size > 1 ? ' and ' : ''}${blocked.has('sms') ? 'text' : ''}
      sending is not connected, so nothing has been delivered automatically.
      Everything is still recorded here, and you can copy each ${esc(voc.person)}'s link and
      send it yourself in the meantime.
    </div>` : '';

  host.innerHTML = header + warn + body;

  host.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
    view = b.dataset.v; renderAssignRemind(host, { siteOrigin });
  });

  if (view === 'new')    wireNewForm(host, clients, siteOrigin);
  if (view === 'people') wirePeople(host, clients, siteOrigin);
  if (view === 'overview') wireOverview(host, recent, siteOrigin);
}

/* ---------------------------------------------------------------- overview */
function overview(t, clients, recent) {
  const overdue = recent.filter(r => r.overdue);
  const stat = (n, l) => `<div class="stat"><div class="n">${n ?? 0}</div><div class="l">${l}</div></div>`;

  return `
    <div class="stats">
      ${stat(t.clients, cap(voc.people))}
      ${stat(t.active, 'Open')}
      ${stat(t.overdue, 'Overdue')}
      ${stat(t.completed, 'Completed')}
      ${stat(t.completion_rate != null ? t.completion_rate + '%' : '—', 'Completion rate')}
    </div>

    ${overdue.length ? `
      <h3 style="margin-top:32px">Overdue</h3>
      ${overdue.map(rowHtml).join('')}` : ''}

    <h3 style="margin-top:32px">Recent ${esc(voc.tasks)}</h3>
    ${recent.length ? recent.map(rowHtml).join('')
      : `<div class="empty">Nothing set yet. Start with
         <a href="#" data-v="new">a new ${esc(voc.task)}</a>.</div>`}`;
}

function rowHtml(r) {
  return `<div class="card" style="margin-bottom:10px;padding:16px 18px" data-open="${r.id}">
    <div class="spread">
      <div style="min-width:0">
        <strong>${esc(r.title)}</strong>
        <p class="faint" style="margin:3px 0 0">
          ${esc(r.client_name)}
          ${r.due_on ? ` · due ${fmtDate(r.due_on)}` : ' · no due date'}
          ${r.submissions ? ` · ${r.submissions} repl${r.submissions===1?'y':'ies'}` : ''}
        </p>
      </div>
      <span class="badge ${r.state==='completed'?'':(r.overdue?'lock':'gray')}">
        ${r.overdue && r.state!=='completed' ? 'Overdue' : STATE_LABEL[r.state] || r.state}</span>
    </div>
  </div>`;
}

function wireOverview(host, recent, siteOrigin) {
  host.querySelectorAll('[data-open]').forEach(el => el.onclick = () =>
    openAssignment(el.dataset.open, host, siteOrigin));
}

/* ------------------------------------------------------------ assignment */
async function openAssignment(id, host, siteOrigin) {
  const { data: rows } = await sb.from('ar_assignments')
    .select(`id, title, description, due_on, state, created_at, completed_at,
             client:ar_clients ( display_name, access_token ),
             submissions:ar_submissions ( body, rating, created_at ),
             attachments:ar_attachments ( id, filename, side, storage_path )`)
    .eq('id', id).limit(1);
  const a = rows?.[0];
  if (!a) return toast('Could not open that.', 'err');

  const subs = (a.submissions || []).sort((x,y)=> new Date(y.created_at)-new Date(x.created_at));
  const back = modal(`
    <span class="badge gray">${STATE_LABEL[a.state] || a.state}</span>
    <h2 style="margin-top:12px">${esc(a.title)}</h2>
    <p class="faint">${esc(a.client?.display_name || '')}${a.due_on?` · due ${fmtDate(a.due_on)}`:''}</p>
    ${a.description?`<p class="muted" style="white-space:pre-wrap">${esc(a.description)}</p>`:''}

    ${(a.attachments||[]).length?`<h3 style="margin-top:20px">Files</h3>
      <ul style="padding-left:18px;color:var(--ink-2)">${a.attachments.map(f=>
        `<li>${esc(f.filename)} <span class="faint">(${f.side})</span></li>`).join('')}</ul>`:''}

    <h3 style="margin-top:20px">Replies</h3>
    ${subs.length ? subs.map(s=>`
      <div class="card" style="padding:14px 16px;margin-bottom:8px">
        <div class="spread"><span class="faint">${fmtDate(s.created_at)}</span>
          ${s.rating?`<span class="badge">${'●'.repeat(s.rating)}${'○'.repeat(5-s.rating)}</span>`:''}</div>
        ${s.body?`<p style="margin:8px 0 0;white-space:pre-wrap">${esc(s.body)}</p>`:''}
      </div>`).join('')
      : '<p class="faint">Nothing back yet.</p>'}

    <div class="row" style="margin-top:20px;justify-content:flex-end">
      ${a.state!=='cancelled' && a.state!=='completed'
        ? `<button class="btn ghost danger" id="cancel-a">Cancel ${esc(voc.task)}</button>` : ''}
      <button class="btn ghost" id="copy-link">Copy their link</button>
      <button class="btn" id="close">Close</button>
    </div>`);

  back.querySelector('#close').onclick = () => back.remove();
  back.querySelector('#copy-link').onclick = async () => {
    await navigator.clipboard.writeText(`${siteOrigin}/my-assignments.html#t=${a.client.access_token}`);
    toast('Link copied.','ok');
  };
  back.querySelector('#cancel-a')?.addEventListener('click', async (e) => {
    busy(e.target, true, 'Canceling…');
    const { error } = await sb.from('ar_assignments')
      .update({ state:'cancelled', cancelled_at: new Date().toISOString() }).eq('id', a.id);
    busy(e.target, false);
    if (error) return toast(error.message,'err');
    back.remove(); toast('Canceled — reminders stopped.','ok');
    renderAssignRemind(host, { siteOrigin });
  });
}

/* -------------------------------------------------------------- new form */
function newForm(clients) {
  return `
    <form id="ar-new" style="max-width:640px">
      <div class="field">
        <label for="ar-client">Who is this for? *</label>
        <select id="ar-client" required>
          <option value="">Choose…</option>
          ${clients.map(c=>`<option value="${c.id}">${esc(c.display_name)}</option>`).join('')}
          <option value="__new">+ Add someone new</option>
        </select>
      </div>

      <div class="field"><label for="ar-title">What is the ${esc(voc.task)}? *</label>
        <input id="ar-title" required placeholder="e.g. Thought record, three times this week"></div>

      <div class="field"><label for="ar-desc">Details</label>
        <textarea id="ar-desc" placeholder="What exactly to do, and anything worth remembering about how to do it."></textarea></div>

      <div class="grid g2">
        <div class="field"><label for="ar-due">Due date <span class="faint">(optional)</span></label>
          <input id="ar-due" type="date"></div>
        <div class="field"><label for="ar-res">Attach from the library <span class="faint">(optional)</span></label>
          <select id="ar-res"><option value="">None</option></select></div>
      </div>

      <div class="field"><label for="ar-file">Attach a document <span class="faint">(optional)</span></label>
        <input id="ar-file" type="file">
        <div class="help">Up to 25 MB. PDF, Word, images.</div></div>

      <div class="notice" style="margin:18px 0" id="ar-remind-note"></div>

      <button class="btn lg" id="ar-send" type="submit">Send it</button>
    </form>`;
}

async function wireNewForm(host, clients, siteOrigin) {
  // fill the library picker
  const { data: res } = await sb.from('therapist_resources').select('id,title,kind').order('title');
  const sel = host.querySelector('#ar-res');
  (res||[]).forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = `${r.title} (${r.kind.toUpperCase()})`;
    sel.appendChild(o);
  });

  const clientSel = host.querySelector('#ar-client');
  const note = host.querySelector('#ar-remind-note');

  const describeReminders = () => {
    const c = clients.find(x => x.id === clientSel.value);
    if (!c) { note.textContent = `Pick someone to see how they will be reminded.`; return; }
    const ch = [c.prefers_email && c.email ? 'email' : null,
                c.prefers_sms && c.phone ? 'text' : null].filter(Boolean);
    note.innerHTML = ch.length
      ? `<strong>${esc(c.display_name)}</strong> will get this by ${ch.join(' and ')},
         then a reminder the day before it is due, on the day, and a gentle nudge two days
         after if it is still open.`
      : `<strong>${esc(c.display_name)}</strong> has no reminder channel switched on —
         they will only see it if you send them their link.`;
  };
  clientSel.onchange = async () => {
    if (clientSel.value === '__new') {
      clientSel.value = '';
      await addClient(host, siteOrigin);
      return;
    }
    describeReminders();
  };
  describeReminders();

  host.querySelector('#ar-new').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = host.querySelector('#ar-send');
    const client_id = clientSel.value;
    const title = host.querySelector('#ar-title').value.trim();
    if (!client_id) return toast(`Choose who this is for.`,'err');
    if (!title) return toast('Give it a title.','err');

    busy(btn, true, 'Sending…');
    const { data: created, error } = await sb.from('ar_assignments').insert({
      workspace_id: ws.id,
      client_id,
      title,
      description: host.querySelector('#ar-desc').value.trim() || null,
      due_on: host.querySelector('#ar-due').value || null,
      resource_id: host.querySelector('#ar-res').value || null,
    }).select().single();

    if (error) { busy(btn, false); return toast(error.message,'err'); }

    // optional document
    const file = host.querySelector('#ar-file').files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast('That file is over 25 MB — the rest was saved.','err');
      } else {
        const path = `${ws.id}/${created.id}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]/g,'_')}`;
        const { error: upErr } = await sb.storage.from('assignremind').upload(path, file);
        if (upErr) toast(`Saved, but the file did not upload: ${upErr.message}`,'err');
        else await sb.from('ar_attachments').insert({
          assignment_id: created.id, side: 'professional', storage_path: path,
          filename: file.name, mime_type: file.type, size_bytes: file.size });
      }
    }

    const { data: n } = await sb.rpc('ar_schedule_reminders', { p_assignment: created.id });
    busy(btn, false);
    toast(n ? `Sent — ${n} reminder${n===1?'':'s'} scheduled.` : 'Saved.', 'ok');
    view = 'overview';
    renderAssignRemind(host, { siteOrigin });
  });
}

/* ---------------------------------------------------------------- people */
function peopleView(clients, siteOrigin) {
  return `
    <div class="spread" style="margin-bottom:16px">
      <p class="muted" style="margin:0;max-width:56ch">Each ${esc(voc.person)} gets their own
        private link. No password, no account — they open it and see everything you have set
        them.</p>
      <button class="btn" id="ar-add">Add a ${esc(voc.person)}</button>
    </div>
    ${clients.length ? `<div class="grid g2">${clients.map(c=>`
      <div class="card">
        <div class="spread">
          <strong>${esc(c.display_name)}</strong>
          ${c.overdue ? `<span class="badge lock">${c.overdue} overdue</span>`
            : c.active ? `<span class="badge gray">${c.active} open</span>`
            : '<span class="badge">up to date</span>'}
        </div>
        <p class="faint" style="margin:6px 0">
          ${c.email ? esc(c.email) : ''}${c.email && c.phone ? ' · ' : ''}${c.phone ? esc(c.phone) : ''}
          ${!c.email && !c.phone ? 'no contact details' : ''}</p>
        <p class="faint" style="margin:0">
          Reminders: ${[c.prefers_email && c.email ? 'email':null,
                        c.prefers_sms && c.phone ? 'text':null].filter(Boolean).join(' + ') || 'none'}
          · ${c.completed} completed${c.streak ? ` · ${c.streak} in the last 30 days` : ''}</p>
        ${!c.consent_email_unencrypted && !c.consent_sms_unencrypted
          ? `<p class="faint" style="margin:6px 0 0;color:var(--warn)">No consent on record —
             nothing will be sent to them. Share their link directly instead.</p>` : ''}
        <div class="row" style="margin-top:14px">
          <button class="btn sm ghost" data-copy="${esc(c.access_token)}">Copy their link</button>
          <button class="btn sm ghost" data-edit="${c.id}">Edit</button>
          <button class="btn sm ghost" data-print="${c.id}">History</button>
        </div>
      </div>`).join('')}</div>`
      : `<div class="empty">No ${esc(voc.people)} yet.</div>`}`;
}

function wirePeople(host, clients, siteOrigin) {
  host.querySelector('#ar-add').onclick = () => addClient(host, siteOrigin);
  host.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
    await navigator.clipboard.writeText(`${siteOrigin}/my-assignments.html#t=${b.dataset.copy}`);
    toast('Link copied — send it however you like.','ok');
  });
  host.querySelectorAll('[data-edit]').forEach(b => b.onclick = () =>
    addClient(host, siteOrigin, clients.find(c => c.id === b.dataset.edit)));
  host.querySelectorAll('[data-print]').forEach(b => b.onclick = () =>
    printHistory(b.dataset.print, clients.find(c => c.id === b.dataset.print)));
}

/* ---------------------------------------------------------------- export */
/** A printable history for records or supervision. Print dialog saves it as PDF. */
async function printHistory(clientId, client) {
  const { data: rows, error } = await sb.from('ar_assignments')
    .select(`title, description, due_on, state, created_at, completed_at,
             submissions:ar_submissions ( body, rating, created_at )`)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) return toast(error.message, 'err');

  const done = (rows||[]).filter(r => r.state === 'completed').length;
  const counted = (rows||[]).filter(r => r.state !== 'cancelled').length;
  const rate = counted ? Math.round(done / counted * 100) : null;

  const win = window.open('', '_blank');
  if (!win) return toast('Allow pop-ups to print the history.', 'err');

  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
    <title>${esc(client?.display_name || 'Client')} — ${esc(voc.task)} history</title>
    <style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#16241C;max-width:720px;
        margin:40px auto;padding:0 24px;line-height:1.55}
      h1{font-size:1.5rem;font-weight:600;margin:0 0 2px}
      .meta{color:#5A6760;font-size:.9rem;margin-bottom:24px}
      .sum{display:flex;gap:28px;border:1px solid #E5E1D3;border-radius:12px;padding:16px 20px;
        margin-bottom:28px}
      .sum b{display:block;font-size:1.5rem;font-weight:400;color:#187C1A}
      .sum span{font-size:.82rem;color:#5A6760}
      .item{border-top:1px solid #E5E1D3;padding:16px 0;break-inside:avoid}
      .item h3{margin:0 0 3px;font-size:1.02rem;font-weight:600}
      .when{color:#5A6760;font-size:.85rem}
      .desc{margin:8px 0 0;white-space:pre-wrap;color:#2C3A32}
      .rep{border-left:3px solid #C9DFA6;padding:2px 0 2px 12px;margin-top:10px;font-size:.92rem}
      .rep .d{color:#8B978E;font-size:.8rem}
      footer{margin-top:36px;color:#8B978E;font-size:.78rem;border-top:1px solid #E5E1D3;padding-top:14px}
      @media print{body{margin:0}}
    </style></head><body>
    <h1>${esc(client?.display_name || 'Client')}</h1>
    <p class="meta">${esc(voc.task)} history · ${esc(ws?.name || '')} ·
      generated ${new Date().toLocaleDateString()}</p>
    <div class="sum">
      <div><b>${counted}</b><span>set</span></div>
      <div><b>${done}</b><span>completed</span></div>
      <div><b>${rate != null ? rate + '%' : '—'}</b><span>completion</span></div>
    </div>
    ${(rows||[]).map(r => `
      <div class="item">
        <h3>${esc(r.title)}</h3>
        <div class="when">
          Set ${new Date(r.created_at).toLocaleDateString()}${
          r.due_on ? ` · due ${new Date(r.due_on + 'T00:00:00').toLocaleDateString()}` : ''} ·
          ${STATE_LABEL[r.state] || r.state}${
          r.completed_at ? ` ${new Date(r.completed_at).toLocaleDateString()}` : ''}
        </div>
        ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ''}
        ${(r.submissions||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
          .map(s => `<div class="rep"><div class="d">${
            new Date(s.created_at).toLocaleDateString()}${
            s.rating ? ` · rated ${s.rating}/5` : ''}</div>${
            s.body ? esc(s.body) : ''}</div>`).join('')}
      </div>`).join('') || '<p>Nothing set yet.</p>'}
    <footer>Produced by Assign Remind. Contains client-identifiable information —
      store and share it accordingly.</footer>
    </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

async function addClient(host, siteOrigin, existing) {
  const c = existing || {};
  const back = modal(`
    <h2>${existing ? 'Edit' : 'Add a'} ${esc(voc.person)}</h2>
    <p class="muted" style="font-size:.92rem">Enter only what they agreed to share, and record
      what they agreed to.</p>

    <div class="field"><label for="c-name">Name *</label>
      <input id="c-name" value="${esc(c.display_name||'')}" required></div>
    <div class="field"><label for="c-email">Email</label>
      <input id="c-email" type="email" value="${esc(c.email||'')}"></div>
    <div class="field"><label for="c-phone">Mobile number</label>
      <input id="c-phone" type="tel" value="${esc(c.phone||'')}" placeholder="+1 555 010 0100">
      <div class="help">Include the country code for texts to work.</div></div>

    <hr class="hr">
    <h3 style="font-size:1rem">Consent to be contacted</h3>
    <div class="notice warn" style="margin:12px 0;font-size:.88rem">
      Email and text are not secure channels. You may only send to them where they have been
      told that and have agreed — and that agreement has to be on record. Nothing is sent on a
      channel you have not ticked here.
    </div>

    <label class="switch" style="display:flex;gap:12px;align-items:flex-start;padding:14px;
      border:1px solid var(--hair);border-radius:var(--r-sm);margin-bottom:10px">
      <input type="checkbox" id="k-email" ${c.consent_email_unencrypted?'checked':''}
        style="width:19px;height:19px;accent-color:var(--green);margin-top:2px">
      <span><strong>They agreed to unencrypted email</strong><br>
        <span class="muted" style="font-size:.88rem">I explained the risk and they agreed.</span></span>
    </label>

    <label class="switch" style="display:flex;gap:12px;align-items:flex-start;padding:14px;
      border:1px solid var(--hair);border-radius:var(--r-sm);margin-bottom:10px">
      <input type="checkbox" id="k-sms" ${c.consent_sms_unencrypted?'checked':''}
        style="width:19px;height:19px;accent-color:var(--green);margin-top:2px">
      <span><strong>They agreed to unencrypted text messages</strong><br>
        <span class="muted" style="font-size:.88rem">I explained the risk and they agreed.</span></span>
    </label>

    <label class="switch" style="display:flex;gap:12px;align-items:flex-start;padding:14px;
      border:1px solid var(--hair);border-radius:var(--r-sm);margin-bottom:14px">
      <input type="checkbox" id="k-detail" ${c.notify_include_detail?'checked':''}
        style="width:19px;height:19px;accent-color:var(--green);margin-top:2px">
      <span><strong>Include the detail in those messages</strong><br>
        <span class="muted" style="font-size:.88rem">Off by default. Left off, a reminder says
          only that something is waiting and links here — no practice name, no title.</span></span>
    </label>

    <div class="grid g2">
      <div class="field"><label for="k-method">How was it recorded?</label>
        <select id="k-method">
          <option value="verbal_in_session" ${c.consent_method==='verbal_in_session'?'selected':''}>Verbally, in session</option>
          <option value="written" ${c.consent_method==='written'?'selected':''}>In writing</option>
          <option value="portal" ${c.consent_method==='portal'?'selected':''}>They set it themselves</option>
        </select></div>
      <div class="field"><label for="k-note">Note <span class="faint">(optional)</span></label>
        <input id="k-note" value="${esc(c.consent_note||'')}" placeholder="e.g. discussed 4 Sept"></div>
    </div>
    ${c.consent_recorded_at ? `<p class="faint">Last recorded ${fmtDate(c.consent_recorded_at)}</p>` : ''}

    <div class="field"><label>How do they want reminding?</label>
      <div class="chips">
        <button type="button" class="chip ${c.prefers_email!==false?'on':''}" id="p-email">Email</button>
        <button type="button" class="chip ${c.prefers_sms?'on':''}" id="p-sms">Text</button>
      </div></div>

    <div class="row" style="justify-content:flex-end;margin-top:18px">
      ${existing?`<button class="btn ghost danger" id="c-revoke">Revoke link</button>`:''}
      <button class="btn ghost" id="c-cancel">Cancel</button>
      <button class="btn" id="c-save">Save</button></div>`);

  back.querySelector('#p-email').onclick = (e) => e.target.classList.toggle('on');
  back.querySelector('#p-sms').onclick   = (e) => e.target.classList.toggle('on');
  back.querySelector('#c-cancel').onclick = () => back.remove();

  back.querySelector('#c-revoke')?.addEventListener('click', async (e) => {
    if (!confirm('Revoke their link? They will not be able to open it until you issue a new one.')) return;
    busy(e.target, true, '…');
    await sb.from('ar_clients').update({ token_revoked: true }).eq('id', c.id);
    busy(e.target, false); back.remove();
    toast('Link revoked.','ok');
    renderAssignRemind(host, { siteOrigin });
  });

  back.querySelector('#c-save').onclick = async (e) => {
    const name  = back.querySelector('#c-name').value.trim();
    const email = back.querySelector('#c-email').value.trim();
    const phone = back.querySelector('#c-phone').value.trim();
    if (!name) return toast('A name is needed.','err');
    if (!email && !phone) return toast('Add an email or a mobile number.','err');

    const kEmail  = back.querySelector('#k-email').checked && !!email;
    const kSms    = back.querySelector('#k-sms').checked && !!phone;
    const kDetail = back.querySelector('#k-detail').checked;

    const payload = {
      workspace_id: ws.id, display_name: name,
      email: email || null, phone: phone || null,
      prefers_email: back.querySelector('#p-email').classList.contains('on') && !!email,
      prefers_sms:   back.querySelector('#p-sms').classList.contains('on') && !!phone,
    };

    busy(e.target, true, 'Saving…');
    const { data: saved, error } = existing
      ? await sb.from('ar_clients').update(payload).eq('id', c.id).select().single()
      : await sb.from('ar_clients').insert(payload).select().single();
    if (error) { busy(e.target, false); return toast(error.message,'err'); }

    await sb.rpc('ar_record_consent', {
      p_client: saved.id, p_email: kEmail, p_sms: kSms, p_detail: kDetail,
      p_method: back.querySelector('#k-method').value,
      p_note: back.querySelector('#k-note').value.trim() || null,
    });

    busy(e.target, false);
    back.remove();
    toast(kEmail || kSms ? 'Saved.' : 'Saved — no reminder channel consented, so nothing will send.','ok');
    view = 'people';
    renderAssignRemind(host, { siteOrigin });
  };
}

/* ---------------------------------------------------------------- export */
/** A printable history for records or supervision. Print dialog saves it as PDF. */
async function printHistory(clientId, client) {
  const { data: rows, error } = await sb.from('ar_assignments')
    .select(`title, description, due_on, state, created_at, completed_at,
             submissions:ar_submissions ( body, rating, created_at )`)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) return toast(error.message, 'err');

  const done = (rows||[]).filter(r => r.state === 'completed').length;
  const counted = (rows||[]).filter(r => r.state !== 'cancelled').length;
  const rate = counted ? Math.round(done / counted * 100) : null;

  const win = window.open('', '_blank');
  if (!win) return toast('Allow pop-ups to print the history.', 'err');

  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
    <title>${esc(client?.display_name || 'Client')} — ${esc(voc.task)} history</title>
    <style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#16241C;max-width:720px;
        margin:40px auto;padding:0 24px;line-height:1.55}
      h1{font-size:1.5rem;font-weight:600;margin:0 0 2px}
      .meta{color:#5A6760;font-size:.9rem;margin-bottom:24px}
      .sum{display:flex;gap:28px;border:1px solid #E5E1D3;border-radius:12px;padding:16px 20px;
        margin-bottom:28px}
      .sum b{display:block;font-size:1.5rem;font-weight:400;color:#187C1A}
      .sum span{font-size:.82rem;color:#5A6760}
      .item{border-top:1px solid #E5E1D3;padding:16px 0;break-inside:avoid}
      .item h3{margin:0 0 3px;font-size:1.02rem;font-weight:600}
      .when{color:#5A6760;font-size:.85rem}
      .desc{margin:8px 0 0;white-space:pre-wrap;color:#2C3A32}
      .rep{border-left:3px solid #C9DFA6;padding:2px 0 2px 12px;margin-top:10px;font-size:.92rem}
      .rep .d{color:#8B978E;font-size:.8rem}
      footer{margin-top:36px;color:#8B978E;font-size:.78rem;border-top:1px solid #E5E1D3;padding-top:14px}
      @media print{body{margin:0}}
    </style></head><body>
    <h1>${esc(client?.display_name || 'Client')}</h1>
    <p class="meta">${esc(voc.task)} history · ${esc(ws?.name || '')} ·
      generated ${new Date().toLocaleDateString()}</p>
    <div class="sum">
      <div><b>${counted}</b><span>set</span></div>
      <div><b>${done}</b><span>completed</span></div>
      <div><b>${rate != null ? rate + '%' : '—'}</b><span>completion</span></div>
    </div>
    ${(rows||[]).map(r => `
      <div class="item">
        <h3>${esc(r.title)}</h3>
        <div class="when">
          Set ${new Date(r.created_at).toLocaleDateString()}${
          r.due_on ? ` · due ${new Date(r.due_on + 'T00:00:00').toLocaleDateString()}` : ''} ·
          ${STATE_LABEL[r.state] || r.state}${
          r.completed_at ? ` ${new Date(r.completed_at).toLocaleDateString()}` : ''}
        </div>
        ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ''}
        ${(r.submissions||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
          .map(s => `<div class="rep"><div class="d">${
            new Date(s.created_at).toLocaleDateString()}${
            s.rating ? ` · rated ${s.rating}/5` : ''}</div>${
            s.body ? esc(s.body) : ''}</div>`).join('')}
      </div>`).join('') || '<p>Nothing set yet.</p>'}
    <footer>Produced by Assign Remind. Contains client-identifiable information —
      store and share it accordingly.</footer>
    </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

async function addClient(host, siteOrigin, existing) {
  const c = existing || {};
  const back = modal(`
    <h2>${existing ? 'Edit' : 'Add a'} ${esc(voc.person)}</h2>
    <p class="muted" style="font-size:.92rem">They choose how they hear from you. Enter only
      what they agreed to.</p>
    <div class="field"><label for="c-name">Name *</label>
      <input id="c-name" value="${esc(c.display_name||'')}" required></div>
    <div class="field"><label for="c-email">Email</label>
      <input id="c-email" type="email" value="${esc(c.email||'')}"></div>
    <div class="field"><label for="c-phone">Mobile number</label>
      <input id="c-phone" type="tel" value="${esc(c.phone||'')}" placeholder="+1 555 010 0100">
      <div class="help">Include the country code for texts to work.</div></div>
    <div class="field"><label>How do they want reminding?</label>
      <div class="chips">
        <button type="button" class="chip ${c.prefers_email!==false?'on':''}" id="p-email">Email</button>
        <button type="button" class="chip ${c.prefers_sms?'on':''}" id="p-sms">Text</button>
      </div></div>
    <div class="row" style="justify-content:flex-end;margin-top:18px">
      ${existing?`<button class="btn ghost danger" id="c-revoke">Revoke link</button>`:''}
      <button class="btn ghost" id="c-cancel">Cancel</button>
      <button class="btn" id="c-save">Save</button></div>`);

  back.querySelector('#p-email').onclick = (e) => e.target.classList.toggle('on');
  back.querySelector('#p-sms').onclick   = (e) => e.target.classList.toggle('on');
  back.querySelector('#c-cancel').onclick = () => back.remove();

  back.querySelector('#c-revoke')?.addEventListener('click', async (e) => {
    if (!confirm('Revoke their link? They will not be able to open it until you issue a new one.')) return;
    busy(e.target, true, '…');
    await sb.from('ar_clients').update({ token_revoked: true }).eq('id', c.id);
    busy(e.target, false); back.remove();
    toast('Link revoked.','ok');
    renderAssignRemind(host, { siteOrigin });
  });

  back.querySelector('#c-save').onclick = async (e) => {
    const name  = back.querySelector('#c-name').value.trim();
    const email = back.querySelector('#c-email').value.trim();
    const phone = back.querySelector('#c-phone').value.trim();
    if (!name) return toast('A name is needed.','err');
    if (!email && !phone) return toast('Add an email or a mobile number.','err');

    const payload = {
      workspace_id: ws.id, display_name: name,
      email: email || null, phone: phone || null,
      prefers_email: back.querySelector('#p-email').classList.contains('on') && !!email,
      prefers_sms:   back.querySelector('#p-sms').classList.contains('on') && !!phone,
    };

    busy(e.target, true, 'Saving…');
    const { error } = existing
      ? await sb.from('ar_clients').update(payload).eq('id', c.id)
      : await sb.from('ar_clients').insert(payload);
    busy(e.target, false);
    if (error) return toast(error.message,'err');
    back.remove(); toast('Saved.','ok');
    view = 'people';
    renderAssignRemind(host, { siteOrigin });
  };
}
