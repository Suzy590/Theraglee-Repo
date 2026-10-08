/* ==========================================================================
   Theraglee — "Download my data" on the account page's Privacy tab.
   Gathers everything a member's account holds and writes it as a readable
   web page (theraglee-my-data.html) that opens in any browser: plain
   headings, dates in words, every answer next to its question. The same
   data is also offered as a JSON file for anyone who wants a copy a
   program can read. docs/site.md ("Your data") is the guide.
   ========================================================================== */
import { sb, esc, tierName } from './app.js';
import { matchSummary } from './match.js';
import { MOODS, FACTORS, WEATHER, WEATHER_FEEL } from './mood-patterns.js';
import { VALUES, CATEGORIES, action } from './quest-paths.js';

const EMAIL_KINDS = { article: 'Article', affirmation: 'Affirmation', quote: 'Quote',
  tip: 'Tip', fun_fact: 'Fun fact', journal_prompt: 'Journal prompt' };

/* Everything the export reads, in one round trip. Titles come along with the
   rows (the quiz a score belongs to, the worksheet an answer belongs to) so
   the page can say them in words instead of ids. */
export async function gatherMyData(a) {
  const uid = a.profile.id;
  const [j, q, w, c, m, g, qu, qm, qs, qr] = await Promise.all([
    sb.from('journal_entries').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('quiz_attempts').select('*, quizzes(title,slug)').eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('worksheet_responses').select('*, worksheets(title,slug,fields)').eq('user_id', uid).order('updated_at', { ascending: false }),
    sb.from('user_challenges').select('*').eq('user_id', uid).order('started_on', { ascending: false }),
    sb.from('mood_logs').select('*').eq('user_id', uid).order('logged_on', { ascending: false }),
    sb.from('goals').select('*, goal_logs(*)').eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('quests').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('quest_milestones').select('*').eq('user_id', uid).order('position'),
    sb.from('quest_steps').select('*').eq('user_id', uid).order('done_on', { ascending: false }),
    sb.from('quest_reflections').select('*').eq('user_id', uid).order('noted_on', { ascending: false }),
  ]);
  // Which days of each challenge were ticked off (one more trip, by run id).
  const ids = (c.data || []).map(x => x.id);
  const cp = ids.length ? await sb.from('user_challenge_progress')
    .select('user_challenge_id, day, completed_on').in('user_challenge_id', ids).order('day') : { data: [] };
  return {
    exported_at: new Date().toISOString(), level: a.level, profile: a.profile,
    journal: j.data || [], quiz_attempts: q.data || [], worksheets: w.data || [],
    challenges: c.data || [], challenge_progress: cp.data || [], mood_logs: m.data || [],
    goals: g.data || [], quests: qu.data || [], quest_milestones: qm.data || [],
    quest_steps: qs.data || [], quest_reflections: qr.data || [],
  };
}

/* ------------------------------------------------------------ helpers */
const dateWords = (d, time = false) => {
  if (!d) return '';
  // A bare date (2026-10-06) is a calendar day, not a moment: read it as local.
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', {
    weekday: time ? undefined : 'long', month: 'long', day: 'numeric', year: 'numeric',
    ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
};
const dateShort = (d) => {
  if (!d) return '';
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const n = (x, one, many) => `${x} ${x === 1 ? one : many || one + 's'}`;
const text = (s) => esc(s).replace(/\n/g, '<br>');
const empty = (what) => `<p class="none">${esc(what)}</p>`;
const section = (title, lead, body) =>
  `<section><h2>${esc(title)}</h2>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}${body}</section>`;
const rows = (pairs) => `<dl>${pairs.filter(([, v]) => v !== '' && v != null)
  .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
const table = (heads, body) => `<div class="scroll"><table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
const yesNo = (b) => (b ? 'Yes' : 'No');
const valueLabel = (key) => VALUES.find(v => v.key === key)?.label || key || '';
const catLabel = (key) => CATEGORIES.find(c => c.key === key)?.label || key;
const stepText = (key, own) => {
  const a = action(key);
  if (a) return a.text;
  // A step the member wrote is own_<milestone>_<n>: look it up in their words.
  const m = /^own_(\d+)_(\d+)$/.exec(key || '');
  if (m && own?.[m[1]]?.[m[2]]) return own[m[1]][m[2]];
  return key;
};

/* ------------------------------------------------------------ sections */
function profileHtml(d) {
  const p = d.profile;
  const STATUS = { active: 'Active', trialing: 'Trial', past_due: 'Payment past due', canceled: 'Canceled',
    unpaid: 'Unpaid', incomplete: 'Not finished', paused: 'Paused' };
  const status = p.subscription_status
    ? `${STATUS[p.subscription_status] || p.subscription_status}${p.current_period_end
        ? `${p.cancel_at_period_end ? ', ends' : ', renews'} ${dateWords(p.current_period_end)}` : ''}`
    : '';
  return section('Your profile', 'The details you gave us when you signed up and in Account → Profile.', rows([
    ['Name', esc(p.full_name)],
    ['Email', esc(p.email)],
    ['Zip code', esc(p.zip)],
    ['Membership', esc(tierName(d.level))],
    ['Billing', esc(status)],
    ['What you came here for', (p.issues || []).map(esc).join(', ')],
    ['Morning email', p.daily_email
      ? `On: ${(p.daily_email_kinds || []).map(k => esc(EMAIL_KINDS[k] || k)).join(', ') || 'an article'}`
      : 'Off'],
    ['Theraglee Match Mode', p.visible_to_therapists
      ? `On. Therapists nearby can see: ${esc(matchSummary(p))}`
      : 'Off. Therapists cannot see you.'],
    ['Member since', dateWords(p.created_at)],
  ]));
}

function journalHtml(d) {
  const body = d.journal.length ? d.journal.map(e => `
    <article class="card">
      <h3>${esc(e.title || 'Untitled entry')}</h3>
      <p class="when">${dateWords(e.created_at, true)}${e.updated_at && e.updated_at !== e.created_at ? `, edited ${dateWords(e.updated_at, true)}` : ''}</p>
      ${e.prompt_text ? `<p class="prompt">Prompt: ${esc(e.prompt_text)}</p>` : ''}
      <p>${text(e.body)}</p>
    </article>`).join('') : empty('No journal entries yet.');
  return section('Journal', d.journal.length ? `${n(d.journal.length, 'entry', 'entries')}, newest first. Only you can read these.` : '', body);
}

function moodHtml(d) {
  const mood = (v) => { const m = MOODS.find(x => x[0] === v); return m ? `${m[1]} ${m[2]}` : (v ?? ''); };
  const weather = (k) => { const w = WEATHER.find(x => x[0] === k); return w ? `${w[1]} ${w[2]}` : (k || ''); };
  const body = d.mood_logs.length ? table(
    ['Day', 'Mood', 'Weather', WEATHER_FEEL[1], ...FACTORS.map(f => f[1])],
    d.mood_logs.map(r => `<tr><td class="nw">${dateShort(r.logged_on)}</td><td>${esc(mood(r.mood))}</td><td>${esc(weather(r.weather))}</td>${
      [WEATHER_FEEL, ...FACTORS].map(f => `<td>${r[f[0]] ?? ''}</td>`).join('')}</tr>`).join(''),
  ) + '<p class="note">Each factor, and how the weather affected you, is how it felt that day, 1 (terrible) to 10 (fantastic). A blank means you did not rate it.</p>'
    : empty('No mood check-ins yet.');
  return section('Mood log', d.mood_logs.length ? `${n(d.mood_logs.length, 'day')} checked in.` : '', body);
}

function quizHtml(d) {
  const body = d.quiz_attempts.length ? table(['Quiz', 'Score', 'Result', 'When'],
    d.quiz_attempts.map(q => `<tr><td>${esc(q.quizzes?.title || 'Quiz')}</td><td>${esc(q.score ?? '')}</td><td>${esc(q.band_label || '')}</td><td>${dateWords(q.created_at, true)}</td></tr>`).join(''))
    : empty('No quizzes taken yet.');
  return section('Quiz results', d.quiz_attempts.length ? `${n(d.quiz_attempts.length, 'quiz', 'quizzes')} taken.` : '', body);
}

function worksheetHtml(d) {
  const answer = (v) => {
    if (v == null || v === '') return '';
    if (Array.isArray(v)) {
      // A table field: one row per line, cells separated by a dot.
      return v.map(row => (Array.isArray(row) ? row : Object.values(row || {})).map(esc).join(' · ')).join('<br>');
    }
    if (typeof v === 'object') return Object.values(v).map(esc).join(', ');
    return text(v);
  };
  const body = d.worksheets.length ? d.worksheets.map(s => {
    const fields = (s.worksheets?.fields || []).filter(f => f.id);
    const answers = s.answers || {};
    const known = new Set(fields.map(f => f.id));
    const pairs = fields.map(f => [f.label || f.id, answer(answers[f.id])]);
    for (const k of Object.keys(answers)) if (!known.has(k)) pairs.push([k, answer(answers[k])]);
    const filled = pairs.filter(([, v]) => v !== '');
    return `<article class="card"><h3>${esc(s.worksheets?.title || 'Worksheet')}</h3>
      <p class="when">Last edited ${dateWords(s.updated_at || s.created_at, true)}</p>
      ${filled.length ? rows(filled) : '<p class="none">Nothing filled in yet.</p>'}</article>`;
  }).join('') : empty('No worksheets started yet.');
  return section('Worksheets', d.worksheets.length ? `${n(d.worksheets.length, 'worksheet')} with saved answers.` : '', body);
}

function challengeHtml(d) {
  const doneBy = new Map();
  for (const r of d.challenge_progress) {
    if (!doneBy.has(r.user_challenge_id)) doneBy.set(r.user_challenge_id, []);
    doneBy.get(r.user_challenge_id).push(r);
  }
  const body = d.challenges.length ? d.challenges.map(c => {
    const done = doneBy.get(c.id) || [];
    return `<article class="card"><h3>${esc(c.title)}</h3>
      ${rows([
        ['Started', dateWords(c.started_on)],
        ['Length', n(c.total_days, 'day')],
        ['Days completed', `${done.length} of ${c.total_days}`],
        ['Status', c.archived ? 'Archived' : 'In progress'],
        ['Days done', done.length ? done.map(r => `Day ${r.day}${r.completed_on ? ` (${dateShort(r.completed_on)})` : ''}`).map(esc).join(', ') : ''],
      ])}</article>`;
  }).join('') : empty('No challenges started yet.');
  return section('Challenges', d.challenges.length ? `${n(d.challenges.length, 'challenge')} started.` : '', body);
}

function goalsHtml(d) {
  const parts = [];
  const quests = d.quests;
  if (quests.length) {
    parts.push(quests.map(q => {
      const ms = d.quest_milestones.filter(m => m.quest_id === q.id);
      const own = {}; for (const m of ms) own[m.position] = m.own_steps || [];
      const steps = d.quest_steps.filter(s => s.quest_id === q.id);
      return `<article class="card"><h3>${esc(q.intention || valueLabel(q.value_key))}</h3>
        <p class="when">Started ${dateWords(q.created_at)}${q.active ? '' : ' (no longer active)'}</p>
        ${rows([
          ['Focus', esc(valueLabel(q.value_key))],
          ['Kinds of steps', (q.categories || []).map(k => esc(catLabel(k))).join(', ')],
          ['Minutes a day', q.minutes],
          ['Milestones', ms.length ? `<ol>${ms.map(m => `<li>${esc(m.title)}${m.reached_on ? ` <span class="pill">reached ${dateWords(m.reached_on)}</span>` : ''}${
            (m.actions || []).length || (m.own_steps || []).length ? `<ul>${[...(m.actions || []).map(k => stepText(k, own)), ...(m.own_steps || [])].map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>` : ''],
          ['Steps marked done', steps.length ? table(['Day', 'Step', 'Note'], steps.map(s =>
            `<tr><td class="nw">${dateShort(s.done_on)}</td><td>${esc(stepText(s.action_key, own))}</td><td>${text(s.note || '')}</td></tr>`).join('')) : ''],
        ])}</article>`;
    }).join(''));
  }
  if (d.quest_reflections.length) {
    parts.push(`<h3 class="sub">What helped</h3>` + d.quest_reflections.map(r =>
      `<article class="card"><p class="when">${dateWords(r.noted_on)}</p><p>${text(r.helped)}</p></article>`).join(''));
  }
  if (d.goals.length) {
    parts.push(`<h3 class="sub">Goals</h3>` + d.goals.map(g => {
      const logs = (g.goal_logs || []).map(l => l.logged_on).sort().reverse();
      return `<article class="card"><h3>${esc(g.title || g.goal || 'Goal')}</h3>
        <p class="when">Set ${dateWords(g.created_at)}${g.active === false ? ' (archived)' : ''}</p>
        ${rows([
          ['Focus', g.value_key ? esc(valueLabel(g.value_key)) : ''],
          ['When and where', esc(g.cue || '')],
          ['Minutes each time', g.minutes],
          ['Aim', g.target_per_week ? `${g.target_per_week} times a week` : ''],
          ['Look back on', g.review_on ? dateWords(g.review_on) : ''],
          ['Days logged', logs.length ? `${logs.length}: ${logs.map(l => esc(dateShort(l))).join(', ')}` : ''],
        ])}</article>`;
    }).join(''));
  }
  return section('Goals & tracking', 'Your goals, milestones, the steps you marked done and your "What helped" notes.',
    parts.length ? parts.join('') : empty('No goals or tracking yet.'));
}

/* ------------------------------------------------------------ the page */
export function myDataHtml(d) {
  const name = d.profile.full_name || 'you';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Theraglee data</title>
<style>
  :root{--cream:#FBF9F2;--paper:#fff;--soft:#F0F7E2;--ink:#16241C;--muted:#5A6760;--faint:#8B978E;--hair:#E7E3D6;--green:#187C1A}
  *{box-sizing:border-box}
  body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.55 "Outfit",system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
  .wrap{max-width:860px;margin:0 auto;padding:32px 16px 60px}
  .zone{background:var(--soft);border-radius:18px;padding:28px 24px;margin-bottom:28px}
  .zone h1{margin:0 0 6px;font-size:2rem;font-weight:500;letter-spacing:-.02em}
  .zone p{margin:0;color:var(--muted)}
  section{margin:0 0 36px}
  h2{font-size:1.4rem;font-weight:500;margin:0 0 4px;letter-spacing:-.01em}
  h3{font-size:1.05rem;font-weight:500;margin:0 0 4px}
  h3.sub{margin:22px 0 10px;color:var(--green);text-transform:uppercase;font-size:.78rem;letter-spacing:.08em}
  .lead{color:var(--muted);margin:0 0 14px}
  .card{background:var(--paper);border:1px solid var(--hair);border-radius:14px;padding:18px 20px;margin-bottom:12px}
  .card p{margin:0 0 8px}
  .when{color:var(--faint);font-size:.85rem}
  .prompt{color:var(--muted);font-style:italic}
  .none{color:var(--faint)}
  .note{color:var(--faint);font-size:.85rem;margin-top:8px}
  .pill{display:inline-block;background:var(--soft);color:var(--green);border-radius:999px;padding:1px 10px;font-size:.78rem;margin-left:6px}
  dl{display:grid;grid-template-columns:minmax(120px,max-content) 1fr;gap:6px 18px;margin:0;background:var(--paper);border:1px solid var(--hair);border-radius:14px;padding:16px 20px}
  .card dl{border:0;padding:0;background:none}
  dt{color:var(--faint);font-size:.85rem;padding-top:2px}
  dd{margin:0}
  dd ol,dd ul{margin:4px 0 0;padding-left:20px}
  .scroll{overflow-x:auto;background:var(--paper);border:1px solid var(--hair);border-radius:14px}
  .card .scroll{border:0}
  table{width:100%;border-collapse:collapse;font-size:.92rem}
  th{text-align:left;font-weight:500;color:var(--faint);font-size:.78rem;padding:12px;border-bottom:1px solid var(--hair);white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid var(--hair);vertical-align:top}
  td.nw{white-space:nowrap}
  tr:last-child td{border-bottom:0}
  footer{color:var(--faint);font-size:.85rem;border-top:1px solid var(--hair);padding-top:16px}
  @media print{body{background:#fff}.zone{background:#fff;border:1px solid var(--hair)}}
</style>
</head>
<body><div class="wrap">
  <div class="zone">
    <h1>Your Theraglee data</h1>
    <p>Everything the account for ${esc(name)} (${esc(d.profile.email)}) held on ${esc(dateWords(d.exported_at, true))}.
      This file is yours to keep. It opens in any web browser and prints cleanly.</p>
  </div>
  ${profileHtml(d)}
  ${journalHtml(d)}
  ${moodHtml(d)}
  ${quizHtml(d)}
  ${worksheetHtml(d)}
  ${challengeHtml(d)}
  ${goalsHtml(d)}
  <footer>Theraglee is a wellness site, not a health care provider, so nothing here is a medical record.
    Your journal, quiz results, worksheets, mood log and tracking are private to your account:
    no therapist and no other member can read them.</footer>
</div></body>
</html>`;
}

/* Saves a file from the browser, the way the page's other downloads do. */
export function saveFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}

/* The readable page, or the raw rows as JSON when `raw` is true. */
export async function downloadMyData(a, { raw = false } = {}) {
  const d = await gatherMyData(a);
  if (raw) return saveFile('theraglee-my-data.json', JSON.stringify(d, null, 2), 'application/json');
  saveFile('theraglee-my-data.html', myDataHtml(d), 'text/html');
}
