/* ==========================================================================
   Theraglee — the "Nearby help" tab on Goals & tracking (goals.html#map).
   Type a zip code or town (or share a location) and it draws a Leaflet map of
   the mental health places around it, with a tile for each one below, then
   the national resources. The finding and sorting live in nearby-help.js.

   Listings come from OpenStreetMap, a community map, so they are not vetted
   by Theraglee and the page says so.
   ========================================================================== */
import { esc, toast, busy } from './app.js';
import {
  RADIUS_MI, KINDS, kindInfo, overpassQuery, geocodeUrl, toPlaces,
  fmtMiles, directionsHref, telHref,
} from './nearby-help.js';

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
/* Public Overpass servers, tried in turn — any one of them can be busy. */
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const NATIONAL = `
  <h2 style="margin-top:40px">National resources</h2>
  <div class="grid g2">
    <div class="card"><h3>988 Suicide &amp; Crisis Lifeline</h3>
      <p class="muted">Free, 24/7, confidential. Call or text <a href="tel:988">988</a>.</p></div>
    <div class="card"><h3>SAMHSA treatment locator</h3>
      <p class="muted">Federal directory of treatment facilities.
        <a href="https://findtreatment.gov" target="_blank" rel="noopener">findtreatment.gov</a></p></div>
    <div class="card"><h3>Crisis Text Line</h3>
      <p class="muted">Text HOME to <a href="sms:741741">741741</a>.</p></div>
    <div class="card"><h3>Find a therapist here</h3>
      <p class="muted">Verified listings in the Theraglee directory.
        <a href="therapists.html">Search the directory</a></p></div>
  </div>`;

const STYLE = `
  #nearby-map{height:440px;border-radius:var(--r);border:1px solid var(--hair);z-index:0}
  .nearby-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin:12px 0 0;font-size:.82rem;color:var(--muted)}
  .nearby-legend i,.place .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;
    vertical-align:middle}
  .place{cursor:pointer}
  .place.more{display:none}
  #places.all .place.more{display:flex}
  .place.on{border-color:var(--green);box-shadow:var(--shadow-2)}
  .place .addr{font-size:.9rem;color:var(--muted);margin:0}
  .place .row{margin-top:auto;padding-top:6px}
  .place .spread{align-items:flex-start;gap:10px;flex-wrap:nowrap}
  .leaflet-popup-content{font-family:var(--sans)}`;

let leafletReady;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return leafletReady ||= new Promise((ok, fail) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.min.css';
    document.head.append(css);
    const js = document.createElement('script');
    js.src = LEAFLET + 'leaflet.min.js';
    js.onload = () => ok(window.L);
    js.onerror = () => { leafletReady = null; fail(new Error('map library')); };
    document.head.append(js);
  });
}

async function geocode(q) {
  const r = await fetch(geocodeUrl(q), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('geocode');
  const [hit] = await r.json();
  if (!hit) return null;
  return { lat: +hit.lat, lon: +hit.lon, label: hit.display_name.split(',').slice(0, 3).join(',') };
}

/* Asks each server in turn, giving each OVERPASS_WAIT_MS before moving on.
   Answers are kept for the session, so switching tabs doesn't search again. */
const OVERPASS_WAIT_MS = 20000;
async function overpass(lat, lon) {
  const query = overpassQuery(lat, lon);
  const cacheKey = 'nearby:' + query;
  try { const hit = sessionStorage.getItem(cacheKey); if (hit) return JSON.parse(hit); } catch {}
  const body = 'data=' + encodeURIComponent(query);
  for (const url of OVERPASS) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), OVERPASS_WAIT_MS);
    try {
      const r = await fetch(url, { method: 'POST', body, signal: stop.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) continue;
      const json = await r.json();
      try { sessionStorage.setItem(cacheKey, JSON.stringify(json)); } catch {}
      return json;
    } catch { /* busy or slow: try the next server */ }
    finally { clearTimeout(timer); }
  }
  throw new Error('overpass');
}

/* How many tiles show before "Show more". */
const FIRST = 12;

const tile = (p, i) => {
  const k = kindInfo(p.kind);
  return `
  <div class="tile place${i >= FIRST ? ' more' : ''}" data-i="${i}" tabindex="0">
    <div class="spread">
      <h3>${esc(p.name)}</h3>
      <span class="faint" style="white-space:nowrap">${fmtMiles(p.miles)}</span>
    </div>
    <div><span class="badge gray"><span class="dot" style="background:${k.color}"></span>${esc(k.label)}</span></div>
    ${p.address ? `<p class="addr">${esc(p.address)}</p>` : ''}
    ${p.hours ? `<p class="addr">Hours: ${esc(p.hours)}</p>` : ''}
    <div class="row">
      ${p.phone ? `<a class="btn sm" href="${esc(telHref(p.phone))}">Call ${esc(p.phone)}</a>` : ''}
      ${p.website ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(p.website)}">Website</a>` : ''}
      <a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(directionsHref(p))}">Directions</a>
    </div>
  </div>`;
};

/* Directory searches for the same place; q is '' for a shared location. */
const moreLinks = (q) => q ? `
  <div class="row" style="margin-top:14px">
    <a class="btn sm ghost" target="_blank" rel="noopener"
      href="https://findtreatment.gov/results?location=${encodeURIComponent(q)}">SAMHSA results near ${esc(q)}</a>
    <a class="btn sm ghost" target="_blank" rel="noopener"
      href="https://search.211.org/search?location=${encodeURIComponent(q)}&query=mental%20health">211 local services</a>
  </div>` : `
  <div class="row" style="margin-top:14px">
    <a class="btn sm ghost" target="_blank" rel="noopener" href="https://findtreatment.gov">SAMHSA treatment locator</a>
    <a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.211.org">211 local services</a>
  </div>`;

export function mapView(body, zip = '') {
  body.innerHTML = `
    <style>${STYLE}</style>
    <h2>Mental health help near you</h2>
    <p class="muted">Clinics, community centers and counseling services within ${RADIUS_MI} miles.</p>
    <form class="row" id="nearby-form" style="margin:16px 0">
      <input id="where" placeholder="Zip code or town" value="${esc(zip)}" style="max-width:240px"
        autocomplete="postal-code" aria-label="Zip code or town">
      <button class="btn" id="go">Show the map</button>
      <button class="btn ghost" type="button" id="here">Use my location</button>
    </form>
    <div id="nearby"></div>
    ${NATIONAL}`;

  const box = body.querySelector('#nearby');
  const go = body.querySelector('#go');
  let map, markers = [];

  const searching = (label) => {
    box.innerHTML = `<p class="muted">Looking for help near ${esc(label)}…</p>
      <div class="skeleton" style="height:440px"></div>`;
  };

  async function draw(center, label, q) {
    let places, L;
    try {
      [L, places] = await Promise.all([
        loadLeaflet(),
        overpass(center.lat, center.lon).then(j => toPlaces(j, center.lat, center.lon)),
      ]);
    } catch (e) {
      box.innerHTML = `<div class="notice err">We couldn't load the map right now. Please try again
        in a minute, or use the links below.</div>${moreLinks(q)}`;
      return;
    }
    const used = KINDS.filter(k => places.some(p => p.kind === k[0]));
    box.innerHTML = `
      <div id="nearby-map" role="region" aria-label="Map of mental health help near ${esc(label)}"></div>
      ${used.length ? `<div class="nearby-legend">${used.map(k =>
        `<span><i style="background:${k[2]}"></i>${esc(k[1])}</span>`).join('')}</div>` : ''}
      <div class="spread" style="margin-top:28px">
        <h2 style="margin:0">Near ${esc(label)}</h2>
        <span class="faint">${places.length
          ? `${places.length} place${places.length === 1 ? '' : 's'}, closest first` : ''}</span>
      </div>
      ${places.length ? `<div class="grid g3" id="places" style="margin-top:18px">
          ${places.map(tile).join('')}</div>
        ${places.length > FIRST ? `<button class="btn ghost" id="more" style="margin-top:18px">
          Show all ${places.length}</button>` : ''}`
        : `<div class="notice" style="margin-top:18px">The community map doesn't list any mental
          health services within ${RADIUS_MI} miles of here yet. The links below search
          federal and local directories instead.</div>`}
      ${moreLinks(q)}
      <p class="faint" style="margin-top:14px">Listings come from OpenStreetMap, a community-made map,
        and aren't checked by Theraglee. Call ahead to confirm hours and services. In a crisis,
        call or text <a href="tel:988">988</a>.</p>`;

    if (map) map.remove();
    map = L.map('nearby-map', { scrollWheelZoom: false }).setView([center.lat, center.lon], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.circleMarker([center.lat, center.lon], { radius: 7, color: '#16241C', weight: 2,
      fillColor: '#FBF9F2', fillOpacity: 1 }).addTo(map).bindTooltip('You searched here');

    const tiles = [...box.querySelectorAll('.place')];
    const showAll = () => { box.querySelector('#places')?.classList.add('all'); box.querySelector('#more')?.remove(); };
    box.querySelector('#more')?.addEventListener('click', showAll);
    const pick = (i, pan) => {
      tiles.forEach(t => t.classList.toggle('on', +t.dataset.i === i));
      if (pan) { map.setView(markers[i].getLatLng(), Math.max(map.getZoom(), 14)); markers[i].openPopup(); }
    };
    markers = places.map((p, i) => {
      const k = kindInfo(p.kind);
      return L.circleMarker([p.lat, p.lon], { radius: 8, color: '#fff', weight: 2,
        fillColor: k.color, fillOpacity: .95 })
        .addTo(map)
        .bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(k.label)} · ${fmtMiles(p.miles)}` +
          (p.address ? `<br>${esc(p.address)}` : '') +
          (p.phone ? `<br><a href="${esc(telHref(p.phone))}">${esc(p.phone)}</a>` : ''))
        .on('click', () => {
          pick(i, false);
          if (i >= FIRST) showAll();
          tiles[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });
    if (places.length) {
      map.fitBounds(L.latLngBounds([[center.lat, center.lon], ...places.map(p => [p.lat, p.lon])]),
        { padding: [30, 30], maxZoom: 14 });
    }
    tiles.forEach(t => {
      const open = (e) => {
        if (e.target.closest('a')) return;
        pick(+t.dataset.i, true);
        box.querySelector('#nearby-map').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      t.onclick = open;
      t.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } };
    });
  }

  async function search(q) {
    busy(go, true, 'Searching…');
    searching(q);
    try {
      const hit = await geocode(q);
      if (!hit) {
        box.innerHTML = `<div class="notice warn">We couldn't find “${esc(q)}”. Try a five-digit
          US zip code, or a town and state such as “Portland, OR”.</div>`;
        return;
      }
      await draw(hit, hit.label, q);
    } catch {
      box.innerHTML = `<div class="notice err">We couldn't look that place up right now. Please try
        again in a minute.</div>${moreLinks(q)}`;
    } finally { busy(go, false); }
  }

  body.querySelector('#nearby-form').onsubmit = (e) => {
    e.preventDefault();
    const q = body.querySelector('#where').value.trim();
    q ? search(q) : toast('Type a zip code or town first.', 'err');
  };
  body.querySelector('#here').onclick = () => {
    if (!navigator.geolocation) return toast('Your browser will not share a location.', 'err');
    searching('your location');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        draw({ lat, lon }, 'your location', '');
      },
      () => { box.innerHTML = ''; toast('Could not get your location. Type a zip code instead.', 'err'); });
  };
  if (zip) search(zip);
}
