#!/usr/bin/env node
// Makes the dashboard playlists real on Spotify: one public playlist in
// Theraglee's Spotify account for every genre-and-mood list in
// site/assets/playlists.js, and writes each playlist's id back into that
// file so the Playlists tab shows Spotify's player. docs/playlists.md is
// the guide. Three commands, run from the repo root:
//
//   SPOTIFY_CLIENT_ID=... node tools/spotify_playlists.mjs auth
//       Prints a link. Open it while signed in to Theraglee's Spotify
//       account and press Agree. The browser lands on a page that will not
//       load (http://127.0.0.1:8888/callback?code=...); copy that address.
//
//   node tools/spotify_playlists.mjs token "<the address you copied>"
//       Turns the code in that address into a sign-in that is kept in
//       ~/.theraglee-spotify.json (never in the repo) and renews itself.
//
//   node tools/spotify_playlists.mjs build [pop/low rock/angry ...]
//       Finds every song, makes the playlists that do not exist yet (all of
//       them, or just the pairs named), adds the songs, and writes the ids
//       into site/assets/playlists.js. Says which songs it could not find.
//       Run it again any time: a list that already has an id is left alone.
//
//   node tools/spotify_playlists.mjs verify
//       Reads each playlist back and reports how many songs it holds.
//
// The sign-in uses Spotify's PKCE flow, so it needs only the app's Client
// ID, never a secret. The app is made once at developer.spotify.com/dashboard
// with the redirect URI http://127.0.0.1:8888/callback.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { GENRES, MOODS, PLAYLISTS } from '../site/assets/playlists.js';

const DATA = new URL('../site/assets/playlists.js', import.meta.url);
const STORE = join(homedir(), '.theraglee-spotify.json');
const REDIRECT = 'http://127.0.0.1:8888/callback';
const SCOPE = 'playlist-modify-public playlist-read-private';
const API = 'https://api.spotify.com/v1';

const [cmd, ...args] = process.argv.slice(2);
const store = () => existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : {};
const save = (o) => writeFileSync(STORE, JSON.stringify(o, null, 2) + '\n');
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const die = (m) => { console.error(m); process.exit(1); };

/* ------------------------------------------------------------------ auth */
if (cmd === 'auth') {
  const client_id = process.env.SPOTIFY_CLIENT_ID || store().client_id;
  if (!client_id) die('Set SPOTIFY_CLIENT_ID to the Client ID of the Spotify app (developer.spotify.com/dashboard).');
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  save({ ...store(), client_id, verifier });
  const u = new URL('https://accounts.spotify.com/authorize');
  u.search = new URLSearchParams({ client_id, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPE,
    code_challenge_method: 'S256', code_challenge: challenge }).toString();
  console.log(`Open this while signed in to Theraglee's Spotify account, press Agree, then copy the address of the page it lands on:\n\n${u}\n`);
  process.exit(0);
}

if (cmd === 'token') {
  const s = store();
  if (!s.verifier) die('Run the auth command first.');
  let code;
  try { code = new URL(args[0] || '').searchParams.get('code'); } catch {}
  if (!code) die('Paste the whole address the browser landed on, in quotes. It contains code=...');
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: s.client_id, grant_type: 'authorization_code', code,
      redirect_uri: REDIRECT, code_verifier: s.verifier }) });
  const t = await r.json();
  if (!t.access_token) die(`Spotify said no: ${JSON.stringify(t)}`);
  save({ client_id: s.client_id, access_token: t.access_token, refresh_token: t.refresh_token,
    expires_at: Date.now() + t.expires_in * 1000 });
  console.log(`Signed in. The sign-in is kept in ${STORE}. Now run: node tools/spotify_playlists.mjs build`);
  process.exit(0);
}

/* ------------------------------------------------------------- the API */
async function token() {
  const s = store();
  if (!s.refresh_token) die('Not signed in yet. Run the auth command, then token.');
  if (Date.now() < (s.expires_at || 0) - 60_000) return s.access_token;
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: s.client_id, grant_type: 'refresh_token', refresh_token: s.refresh_token }) });
  const t = await r.json();
  if (!t.access_token) die(`Could not renew the sign-in (${JSON.stringify(t)}). Run auth and token again.`);
  save({ ...s, access_token: t.access_token, refresh_token: t.refresh_token || s.refresh_token,
    expires_at: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

async function api(path, { method = 'GET', body } = {}) {
  for (let tries = 0; tries < 5; tries++) {
    const r = await fetch(path.startsWith('http') ? path : API + path, { method,
      headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429) {                       // rate limit: wait as long as Spotify asks, within reason
      const wait = Number(r.headers.get('retry-after')) || 2;
      if (wait > 600) die(`Spotify's daily quota for this app is used up; it asks for a ${Math.round(wait / 3600)} hour wait. Run build again after that; lists already made are kept.`);
      await new Promise(ok => setTimeout(ok, wait * 1000)); continue;
    }
    if (r.status >= 500) {                        // Spotify hiccup: try again in a moment
      await new Promise(ok => setTimeout(ok, 3000 * (tries + 1))); continue;
    }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j.error || j)}`);
    return j;
  }
  throw new Error(`${method} ${path}: rate limited too long`);
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const firstArtist = (a) => a.split(/ & |, | and | feat\.? | ft\.? /i)[0];

/* Finds a song: a strict search on title and lead artist first, then a loose one. */
async function findTrack(title, artist) {
  const queries = [
    `track:"${title}" artist:"${firstArtist(artist)}"`,
    `${title} ${firstArtist(artist)}`,
    `${title} ${artist}`,
  ];
  for (const q of queries) {
    const r = await api(`/search?${new URLSearchParams({ q, type: 'track', market: 'US', limit: '5' })}`);
    const items = r.tracks?.items || [];
    const want = norm(title), wantArtist = norm(firstArtist(artist));
    const hit = items.find(t => norm(t.name).startsWith(want) && t.artists.some(a => norm(a.name) === wantArtist))
             || items.find(t => norm(t.name).includes(want) && t.artists.some(a => norm(a.name).includes(wantArtist) || wantArtist.includes(norm(a.name))));
    if (hit) return hit;
  }
  // Last resort: the right artist but a title that does not match (a renamed
  // single, a live cut). Kept, but marked so the run reports it for a look.
  const r = await api(`/search?${new URLSearchParams({ q: `${title} ${firstArtist(artist)}`, type: 'track', market: 'US', limit: '5' })}`);
  const near = (r.tracks?.items || []).find(t => t.artists.some(a => norm(a.name) === norm(firstArtist(artist))));
  return near ? { ...near, loose: true } : null;
}

/* Writes a playlist id into site/assets/playlists.js, next to that list's title. */
function writeId(list, id) {
  const src = readFileSync(DATA, 'utf8');
  const title = list.title.replace(/'/g, "\\'");
  const at = src.indexOf(`title: '${title}'`);
  if (at < 0) throw new Error(`cannot find the list "${list.title}" in playlists.js`);
  const slot = src.indexOf("spotify: ''", at);
  const nextList = src.indexOf('songs: [', at);
  if (slot < 0 || slot > nextList) throw new Error(`"${list.title}" already has an id or its spotify field is missing`);
  writeFileSync(DATA, src.slice(0, slot) + `spotify: '${id}'` + src.slice(slot + "spotify: ''".length));
}

const pairs = (only) => GENRES.flatMap(g => MOODS.map(m => ({ g, m, list: PLAYLISTS[g.key][m.key] })))
  .filter(p => !only.length || only.includes(`${p.g.key}/${p.m.key}`));

/* Every playlist already in the account, by name, so a run cut short (the
   daily quota, a lost connection) picks its half-made playlist back up
   instead of making a second one. */
async function myPlaylists() {
  const byName = new Map();
  for (let url = '/me/playlists?limit=50'; url;) {
    const page = await api(url);
    for (const p of page.items || []) byName.set(p.name, p.id);
    url = page.next;
  }
  return byName;
}

if (cmd === 'build') {
  const me = await api('/me');
  console.log(`Signed in as ${me.display_name || me.id}.`);
  const existing = await myPlaylists();
  const missing = [], loose = [];
  for (const { g, m, list } of pairs(args)) {
    const tag = `${g.key}/${m.key}`;
    if (list.spotify) { console.log(`${tag}: already made (${list.spotify})`); continue; }
    process.stdout.write(`${tag}: finding ${list.songs.length} songs`);
    const uris = [];
    for (const [t, a] of list.songs) {
      const hit = await findTrack(t, a);
      if (hit) uris.push(hit.uri); else missing.push(`${tag}: ${t} — ${a}`);
      if (hit?.loose) loose.push(`${tag}: ${t} — ${a}  →  Spotify has "${hit.name}"`);
      process.stdout.write(!hit ? 'x' : hit.loose ? '~' : '.');
    }
    const name = `Theraglee · ${g.name} · ${m.name}`;
    const pl = existing.has(name) ? { id: existing.get(name) } : await api('/me/playlists', { method: 'POST', body: {
      name, public: true,
      description: `${list.title}. ${list.blurb} Curated by Theraglee (theraglee.com).`.slice(0, 300) } });
    // PUT replaces whatever a half-made playlist already holds; a fresh one is empty anyway.
    await api(`/playlists/${pl.id}/items`, { method: 'PUT', body: { uris: uris.slice(0, 100) } });
    for (let i = 100; i < uris.length; i += 100)
      await api(`/playlists/${pl.id}/items`, { method: 'POST', body: { uris: uris.slice(i, i + 100) } });
    writeId(list, pl.id); list.spotify = pl.id;
    console.log(` ${uris.length} added → ${pl.id}`);
  }
  if (loose.length) console.log(`\nMatched on the artist only (check the song is the one meant; swap it if not):\n  ${loose.join('\n  ')}`);
  if (missing.length) console.log(`\nNot found on Spotify (swap these in playlists.js, then run build for those pairs again after clearing their id):\n  ${missing.join('\n  ')}`);
  console.log('\nDone. Run node tests/playlists-fixture/check.mjs, then commit site/assets/playlists.js.');
}

if (cmd === 'verify') {
  for (const { g, m, list } of pairs(args)) {
    const tag = `${g.key}/${m.key}`;
    if (!list.spotify) { console.log(`${tag}: no playlist yet`); continue; }
    const pl = await api(`/playlists/${list.spotify}?fields=name,public,items.total,tracks.total`);
    console.log(`${tag}: ${(pl.items || pl.tracks).total}/${list.songs.length} songs, ${pl.public ? 'public' : 'NOT PUBLIC'} — ${pl.name}`);
  }
}

if (!['auth', 'token', 'build', 'verify'].includes(cmd)) {
  console.log('Usage: node tools/spotify_playlists.mjs auth | token "<address>" | build [genre/mood ...] | verify');
  process.exit(1);
}
