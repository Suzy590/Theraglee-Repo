/* Stub of app.js: a tiny in-memory Supabase whose builder chains the same way
   the real client does (.delete().eq().eq(), .upsert().select().maybeSingle()). */
export const DB = { favorites: [], item_progress: [] };
const match = (row, f) => Object.entries(f).every(([k, v]) => row[k] === v);

function run(name, st) {
  if (st.op === 'select') return { data: DB[name].filter(r => match(r, st.filt)), error: null };
  if (st.op === 'insert') { DB[name].push({ ...st.payload }); return { data: null, error: null }; }
  if (st.op === 'delete') {
    DB[name] = DB[name].filter(r => !match(r, st.filt));
    return { data: null, error: null };
  }
  if (st.op === 'upsert') {
    const r = st.payload;
    const status = r.answered <= 0 ? 'not_started'
                 : (r.total > 0 && r.answered >= r.total ? 'completed' : 'started');
    const row = { ...r, status };
    const i = DB[name].findIndex(x => x.user_id === r.user_id
      && x.item_type === r.item_type && x.item_id === r.item_id);
    i >= 0 ? (DB[name][i] = row) : DB[name].push(row);
    return { data: st.single ? row : [row], error: null };
  }
  return { data: null, error: null };
}

function table(name) {
  const st = { op: 'select', filt: {}, single: false };
  const api = {
    select() { return api; },
    eq(k, v) { st.filt[k] = v; return api; },
    insert(r) { st.op = 'insert'; st.payload = r; return api; },
    delete() { st.op = 'delete'; return api; },
    upsert(r) { st.op = 'upsert'; st.payload = r; return api; },
    maybeSingle() { st.single = true; return api; },
    then(res, rej) { try { res(run(name, st)); } catch (e) { rej ? rej(e) : null; } },
  };
  return api;
}
export const sb = { from: table };
export const access = async () => ({ authenticated: true, level: 3, profile: { id: 'u1' } });
export const toast = (m, k) => { (window.__toasts ||= []).push([m, k]); };
export const esc = (s) => String(s ?? '');
