/* The journal: today's prompt (or a free write), the entry form, and the
   member's earlier entries with search. Drawn into the Journal tab on the
   dashboard (dashboard.html#journal); journal.html now forwards there. */
import { sb, esc, toast, busy, fmtDate } from './app.js';

// The search words, lowercased. Characters that mean something to the
// database's pattern matching (% _ \ " , ( ) *) are treated as spaces.
function words(q){
  return q.toLowerCase().replace(/[%_\\",()*]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8);
}

// Escapes text and wraps each search word in <mark>. Matching runs on the
// raw text, so a word like "amp" never lands inside an escaped "&amp;".
function hl(text, ws){
  text = String(text);
  if (!ws.length) return esc(text);
  const re = new RegExp('(' + ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return text.split(re).map((part, i) => i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)).join('');
}

// Up to 300 characters of the entry, starting near the first match.
function snippet(body, ws){
  body = String(body);
  const lower = body.toLowerCase();
  const at = ws.map(w => lower.indexOf(w)).filter(i => i >= 0).sort((x,y) => x-y)[0] ?? 0;
  const start = at > 120 ? body.lastIndexOf(' ', at - 60) + 1 : 0;
  const cut = body.slice(start, start + 300);
  return (start ? '…' : '') + hl(cut, ws) + (start + 300 < body.length ? '…' : '');
}

function entryHtml(e, ws){
  return `
          <div class="entry">
            <div class="spread" style="gap:10px;align-items:flex-start">
              <h4>${hl(e.title || 'Untitled', ws)}</h4>
              <button class="btn sm ghost" data-del="${esc(e.id)}" aria-label="Delete this entry">Delete</button>
            </div>
            <div class="when">${fmtDate(e.created_at)}</div>
            ${e.prompt_text ? `<div class="faint" style="font-style:italic;margin-top:4px">${hl(e.prompt_text, ws)}</div>` : ''}
            <p>${snippet(e.body, ws)}</p>
          </div>`;
}

/* promptId: a daily_content id to open on (dashboard.html?prompt=…#journal),
   otherwise today's prompt. */
export async function mountJournal(host, a, promptId = null) {
  host.innerHTML = '<div class="skeleton" style="height:220px"></div>';
  const $ = (id) => host.querySelector('#' + id);

  let prompt = null;
  if (promptId) {
    const { data } = await sb.from('daily_content').select('*').eq('id', promptId).maybeSingle();
    prompt = data;
  }
  if (!prompt) {
    const { data } = await sb.rpc('daily_pick', { p_kind: 'journal_prompt' });
    prompt = data?.[0] || null;
  }
  let lastPrompt = prompt;

  async function entries(){
    const { data } = await sb.from('journal_entries').select('*')
      .eq('user_id', a.profile.id).order('created_at', { ascending:false }).limit(50);
    return data || [];
  }

  // Searches every entry the member has written, not just the 50 shown by
  // default. Each word has to appear in the title, the entry or its prompt.
  async function search(q){
    let req = sb.from('journal_entries').select('*').eq('user_id', a.profile.id);
    for (const w of words(q)) req = req.or(['title','body','prompt_text'].map(c => `${c}.ilike."%${w}%"`).join(','));
    const { data, error } = await req.order('created_at', { ascending:false }).limit(100);
    if (error) { toast(error.message,'err'); return []; }
    return data || [];
  }

  function paint(list){
    host.innerHTML = `
    <div class="journal-grid">
      <div class="card">
        ${prompt ? `<span class="kicker" style="margin-bottom:8px">Today’s journal prompt</span>
          <div class="prompt-box" id="j-pbox">${esc(prompt.body)}</div>
          <p class="faint" style="font-size:.88rem;margin:8px 0 0">This prompt will appear at the top of your saved journal entry unless you select “Write freely instead.”</p>
          <div class="row" style="margin:10px 0 18px">
            <button class="btn sm ghost" id="j-newprompt">Give me another prompt</button>
            <button class="btn sm ghost" id="j-freewrite">Write freely instead</button></div>`
          : lastPrompt ? `<div class="row" style="margin:10px 0 18px">
            <button class="btn sm ghost" id="j-useprompt">Back to the prompt</button></div>` : ''}
        <div class="field"><label for="j-title">Title <span class="faint">(optional)</span></label>
          <input id="j-title" type="text" placeholder="A word for today"></div>
        <div class="field"><label for="j-body">Your entry</label>
          <textarea id="j-body" style="min-height:230px" placeholder="Whatever is on your mind…"></textarea></div>
        <div class="row"><button class="btn" id="j-save">Save entry</button>
          <span class="faint" id="j-status"></span></div>
      </div>
      <div class="card">
        <h3 style="font-size:1.2rem;margin-top:0">Earlier entries</h3>
        <div class="field" style="margin-top:14px">
          <label for="j-q">Search your entries</label>
          <input id="j-q" type="search" placeholder="Try a word like “sleep” or “mom”…" autocomplete="off">
        </div>
        <p class="faint" id="j-count" aria-live="polite"></p>
        <div id="j-list"></div>
      </div>
    </div>`;

    const listEl = $('j-list'), count = $('j-count'), q = $('j-q');
    let timer = null, seq = 0;
    async function paintList(){
      const ws = words(q.value);
      if (!ws.length) {
        count.textContent = '';
        listEl.innerHTML = list.length ? list.map(e => entryHtml(e, [])).join('')
          : '<div class="empty">Nothing yet. Your first entry will show up here.</div>';
        return;
      }
      const mine = ++seq;
      count.textContent = 'Searching…';
      const hits = await search(q.value);
      if (mine !== seq) return; // a newer search has started
      count.textContent = hits.length === 100 ? 'Showing the 100 most recent matches.'
        : `${hits.length} ${hits.length === 1 ? 'entry matches' : 'entries match'}.`;
      listEl.innerHTML = hits.length ? hits.map(e => entryHtml(e, ws)).join('')
        : `<div class="empty">No entries match “${esc(q.value.trim())}”. Try a different word, or clear the search to see your recent entries.</div>`;
    }
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(paintList, 250); });

    // Deleting is permanent, so the member confirms first. The database only
    // lets a member delete their own rows.
    listEl.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      if (!confirm('Delete this journal entry? This can’t be undone.')) return;
      busy(b, true, 'Deleting…');
      const { error } = await sb.from('journal_entries').delete()
        .eq('id', b.dataset.del).eq('user_id', a.profile.id);
      if (error) { busy(b, false); return toast(error.message,'err'); }
      list = list.filter(x => String(x.id) !== b.dataset.del);
      toast('Entry deleted.','ok');
      paintList();
    });
    paintList();

    $('j-save').addEventListener('click', async (e) => {
      const body = $('j-body').value.trim();
      if (!body) return toast('Write something first.','err');
      busy(e.target, true, 'Saving…');
      const { error } = await sb.from('journal_entries').insert({
        user_id: a.profile.id,
        prompt_id: prompt?.id ?? null,
        prompt_text: prompt?.body ?? null,
        title: $('j-title').value.trim() || null,
        body,
      });
      busy(e.target, false);
      if (error) return toast(error.message,'err');
      sb.from('activity_log').insert({ user_id:a.profile.id, item_type:'journal', action:'complete',
        tags: prompt?.tags || [] });
      toast('Saved.','ok');
      paint(await entries());
    });

    $('j-newprompt')?.addEventListener('click', async () => {
      const { data } = await sb.rpc('daily_pick', { p_kind:'journal_prompt', p_seed: Math.floor(Math.random()*9999) });
      if (data?.[0]) { prompt = data[0]; lastPrompt = prompt; $('j-pbox').textContent = prompt.body; }
    });
    $('j-freewrite')?.addEventListener('click', () => {
      lastPrompt = prompt; prompt = null; paint(list);
    });
    $('j-useprompt')?.addEventListener('click', () => {
      prompt = lastPrompt; paint(list);
    });
  }

  paint(await entries());
}
