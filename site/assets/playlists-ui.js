/* ==========================================================================
   Theraglee — the Playlists tab on the member dashboard (dashboard.html#playlists).
   Three steps on one panel: pick a genre, pick a mood, get the forty songs
   curated for that pair. Every song is on Apple Music and Spotify, and each
   one links to a search for it on both, so nothing about the member's
   listening comes back to Theraglee. The lists live in playlists.js.
   The last genre and mood picked are kept in this browser, so the tab
   reopens where the member left it.
   ========================================================================== */
import { esc, toast } from './app.js';
import { GENRES, MOODS, PLAYLISTS } from './playlists.js';

const REMEMBER = 'tg.playlists';

const STYLE = `
  .pl-steps{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 18px;font-size:.86rem;color:var(--faint)}
  .pl-steps b{font-weight:500;color:var(--ink)}
  .pl-steps button{border:0;background:none;font:inherit;padding:0;cursor:pointer;color:var(--green);text-decoration:underline}
  .pl-pick{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
  .pl-pick button{text-align:left;font:inherit;cursor:pointer;background:var(--paper);border:1px solid var(--hair);
    border-radius:var(--r);padding:18px 20px;display:flex;flex-direction:column;gap:6px;color:var(--ink);
    transition:transform .2s,box-shadow .2s,border-color .2s}
  .pl-pick button:hover,.pl-pick button:focus-visible{transform:translateY(-3px);box-shadow:var(--shadow-2);border-color:var(--green)}
  .pl-pick h3{margin:0;font-size:1.05rem}
  .pl-pick p{margin:0;font-size:.9rem;color:var(--muted)}
  .pl-pick .wants{font-size:.8rem;color:var(--faint)}
  .pl-head{display:flex;gap:16px 24px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin:18px 0 10px}
  .pl-head h2{margin:4px 0 6px}
  .pl-head p{margin:0;max-width:56ch}
  .pl-songs{list-style:none;margin:16px 0 0;padding:0;counter-reset:song;border:1px solid var(--hair);border-radius:var(--r);
    background:var(--paper);overflow:hidden}
  .pl-songs li{display:grid;grid-template-columns:2.2em 1fr auto;gap:12px;align-items:center;padding:11px 16px;
    border-top:1px solid var(--hair)}
  .pl-songs li:first-child{border-top:0}
  .pl-songs li::before{counter-increment:song;content:counter(song);font-size:.8rem;color:var(--faint);text-align:right}
  .pl-songs .t{font-weight:500}
  .pl-songs .a{display:block;font-size:.86rem;color:var(--muted)}
  .pl-songs .links{display:flex;gap:6px}
  .pl-songs .links a{font-size:.78rem;padding:5px 10px;border:1px solid var(--hair);border-radius:var(--r-pill);
    color:var(--ink);text-decoration:none;white-space:nowrap}
  .pl-songs .links a:hover{border-color:var(--green);color:var(--green)}
  @media(max-width:560px){
    .pl-songs li{grid-template-columns:2em 1fr}
    .pl-songs .links{grid-column:2}
  }`;

const q = (title, artist) => encodeURIComponent(`${title} ${artist}`);
const spotify = (t, a) => `https://open.spotify.com/search/${q(t, a)}`;
const apple   = (t, a) => `https://music.apple.com/us/search?term=${q(t, a)}`;

const remembered = () => { try { return JSON.parse(localStorage.getItem(REMEMBER)) || {}; } catch { return {}; } };
const remember = (v) => { try { localStorage.setItem(REMEMBER, JSON.stringify(v)); } catch {} };

export function mountPlaylists(host) {
  if (!document.getElementById('pl-style')) {
    const st = document.createElement('style'); st.id = 'pl-style'; st.textContent = STYLE; document.head.append(st);
  }
  const saved = remembered();
  let genre = GENRES.find(g => g.key === saved.genre) ? saved.genre : null;
  let mood  = MOODS.find(m => m.key === saved.mood)  ? saved.mood  : null;

  const genreOf = () => GENRES.find(g => g.key === genre);
  const moodOf  = () => MOODS.find(m => m.key === mood);

  function steps() {
    const g = genreOf(), m = moodOf();
    return `<div class="pl-steps" aria-label="Your picks">
      <span>1. Genre${g ? `: <b>${esc(g.name)}</b> <button type="button" data-step="genre">change</button>` : ''}</span>
      <span aria-hidden="true">·</span>
      <span>2. Mood${m ? `: <b>${esc(m.name)}</b> <button type="button" data-step="mood">change</button>` : ''}</span>
      <span aria-hidden="true">·</span>
      <span>3. Your 40 songs</span></div>`;
  }

  function render() {
    if (!genre) {
      host.innerHTML = `${steps()}
        <h2 style="margin-top:0">First, pick a genre</h2>
        <p class="muted" style="max-width:56ch;margin-top:-6px">Then a mood, and you get forty songs curated for the
          two together, every one on Apple Music and Spotify.</p>
        <div class="pl-pick" style="margin-top:20px">${GENRES.map(g => `
          <button type="button" data-genre="${g.key}"><h3>${esc(g.name)}</h3><p>${esc(g.blurb)}</p></button>`).join('')}</div>`;
    } else if (!mood) {
      host.innerHTML = `${steps()}
        <h2 style="margin-top:0">Now, how are you feeling?</h2>
        <p class="muted" style="max-width:56ch;margin-top:-6px">Pick where you are right now, not where you think you
          should be. The list is built for that.</p>
        <div class="pl-pick" style="margin-top:20px">${MOODS.map(m => `
          <button type="button" data-mood="${m.key}"><h3>${esc(m.name)}</h3><p>${esc(m.blurb)}</p>
            <span class="wants">${esc(m.wants)}</span></button>`).join('')}</div>`;
    } else {
      const g = genreOf(), m = moodOf(), list = PLAYLISTS[genre][mood];
      host.innerHTML = `${steps()}
        <div class="pl-head">
          <div>
            <span class="badge">${esc(g.name)}</span> <span class="badge gray">${esc(m.name)}</span>
            <h2>${esc(list.title)}</h2>
            <p class="muted">${esc(list.blurb)} ${list.songs.length} songs, all on Apple Music and Spotify.</p>
          </div>
          <div class="row">
            <button class="btn sm" type="button" id="pl-copy">Copy the list</button>
            <button class="btn sm ghost" type="button" data-step="mood">Another mood</button>
          </div>
        </div>
        <ol class="pl-songs">${list.songs.map(([t, a]) => `
          <li><span><span class="t">${esc(t)}</span><span class="a">${esc(a)}</span></span>
            <span class="links">
              <a href="${spotify(t, a)}" target="_blank" rel="noopener">Spotify</a>
              <a href="${apple(t, a)}" target="_blank" rel="noopener">Apple Music</a>
            </span></li>`).join('')}</ol>
        <div class="notice" style="margin-top:20px">Each link opens a search in your own music app, so nothing about
          your listening comes back to Theraglee. To keep the whole list, copy it and paste it into a new playlist.</div>`;

      host.querySelector('#pl-copy').onclick = async (e) => {
        const text = `${list.title} (${g.name}, ${m.name})\n` + list.songs.map(([t, a], i) => `${i + 1}. ${t} — ${a}`).join('\n');
        try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into a new playlist.', 'ok'); }
        catch { toast('Could not copy on this device.', 'err'); }
      };
    }

    host.querySelectorAll('[data-genre]').forEach(b => b.onclick = () => { genre = b.dataset.genre; mood = null; save(); render(); });
    host.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => { mood = b.dataset.mood; save(); render(); });
    host.querySelectorAll('[data-step]').forEach(b => b.onclick = () => {
      if (b.dataset.step === 'genre') { genre = null; mood = null; } else mood = null;
      save(); render();
    });
    if (drawn) host.scrollIntoView?.({ block: 'nearest' });
    drawn = true;
  }
  let drawn = false;
  const save = () => remember({ genre, mood });
  render();
}
