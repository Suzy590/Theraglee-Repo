/* ==========================================================================
   Theraglee — the logic behind the "Nearby help" tab on Goals & tracking.
   No DOM and no network here, so tests/nearby-help/check.mjs can run it under
   plain Node. nearby-ui.js does the fetching and drawing.

   A zip code or town is turned into a point with OpenStreetMap's Nominatim,
   then the Overpass API is asked for mental health places within RADIUS_MI of
   it. Each OpenStreetMap element becomes a "place": a name, what kind of help
   it is, an address, a phone, a website, and how far away it is.
   ========================================================================== */

export const RADIUS_MI = 25;
export const MAX_PLACES = 60;
const KM_PER_MI = 1.609344;

/* Kinds of help, in the order they win when a place carries several tags.
   [key, label shown on the tile, marker color] */
export const KINDS = [
  ['crisis',     'Crisis & mental health center', '#A32B2B'],
  ['psychiatry', 'Psychiatry',                    '#6A3FA0'],
  ['addiction',  'Addiction & recovery',          '#B2541E'],
  ['therapist',  'Therapist',                     '#187C1A'],
  ['counseling', 'Counseling',                    '#1F6FA8'],
  ['other',      'Mental health service',         '#5A6760'],
];
export const kindInfo = (key) => {
  const k = KINDS.find(r => r[0] === key) || KINDS[KINDS.length - 1];
  return { key: k[0], label: k[1], color: k[2] };
};

/* The OpenStreetMap tags that mark a place as mental health help. Exact
   values where possible — they are much cheaper for Overpass than patterns. */
const FILTERS = [
  '[healthcare=psychotherapist]',
  '[healthcare=psychologist]',
  '[healthcare=counselling]',
  '["healthcare:speciality"~"psychiatry|psychology|psychotherapy|mental_health|addiction"]',
  '["social_facility:for"~"mental_health|addiction"]',
  '[office=psychologist]',
  '[office=therapist]',
];

/* The box that holds a circle of `radiusMi` around lat/lon: [s, w, n, e]. */
export function bbox(lat, lon, radiusMi = RADIUS_MI) {
  const dLat = radiusMi / 69.0;
  const dLon = radiusMi / (69.17 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map(v => +v.toFixed(4));
}

/* The Overpass QL query for everything in the box around lat/lon. A box is
   quicker for Overpass than a circle; toPlaces trims the corners. */
export function overpassQuery(lat, lon, radiusMi = RADIUS_MI) {
  return `[out:json][timeout:20][bbox:${bbox(lat, lon, radiusMi).join(',')}];` +
    `(${FILTERS.map(f => `nwr${f};`).join('')});out center tags;`;
}

/* A five-digit US zip (optionally zip+4) — searched as a postal code. */
export const isZip = (q) => /^\d{5}(-\d{4})?$/.test(String(q).trim());

/* Nominatim search URL for a zip code or a town, US only. */
export function geocodeUrl(q) {
  const p = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'us' });
  const s = String(q).trim();
  if (isZip(s)) p.set('postalcode', s.slice(0, 5)); else p.set('q', s);
  return 'https://nominatim.openstreetmap.org/search?' + p;
}

/* Great-circle distance in miles. */
export function miles(lat1, lon1, lat2, lon2) {
  const r = (d) => d * Math.PI / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a))) / KM_PER_MI;
}

/* Which kind of help a set of OpenStreetMap tags describes. */
export function kindOf(t = {}) {
  const has = (k, re) => re.test(t[k] || '');
  if (/crisis/i.test(t.name || '') || has('healthcare:counselling', /crisis/)) return 'crisis';
  if (has('healthcare:speciality', /addiction/) || has('social_facility:for', /addiction/) ||
      has('healthcare:counselling', /addiction|drug/)) return 'addiction';
  if (has('healthcare:speciality', /psychiatry/) || has('healthcare:counselling', /psychiatry/))
    return 'psychiatry';
  if (has('social_facility:for', /mental_health/) || has('healthcare:speciality', /mental_health/))
    return 'crisis';
  if (has('healthcare', /^(psychotherapist|psychologist)$/) || has('office', /^(psychologist|therapist)$/) ||
      has('healthcare:speciality', /psychology|psychotherapy/)) return 'therapist';
  if (has('healthcare', /^counselling$/)) return 'counseling';
  return 'other';
}

/* A one-line street address, or '' when the map has none. */
export function address(t = {}) {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const unit = t['addr:unit'] ? `Unit ${t['addr:unit']}` : '';
  const town = [t['addr:city'], [t['addr:state'], t['addr:postcode']].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');
  return [street, unit, town].filter(Boolean).join(', ') || t['addr:full'] || '';
}

/* Only http(s) links, so a tag can never become a javascript: URL. */
export function website(t = {}) {
  let u = (t.website || t['contact:website'] || t.url || '').trim().split(';')[0].trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; }
  catch { return ''; }
}

export function phone(t = {}) {
  return (t.phone || t['contact:phone'] || '').split(';')[0].trim();
}

/* The digits a tel: link needs. */
export const telHref = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');

/* Overpass JSON → places within radiusMi of lat/lon: named, de-duplicated,
   closest first. */
export function toPlaces(json, lat, lon, max = MAX_PLACES, radiusMi = RADIUS_MI) {
  const seen = new Set();
  const out = [];
  for (const e of (json && json.elements) || []) {
    const t = e.tags || {};
    const name = (t.name || t.operator || '').trim();
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    if (!name || typeof la !== 'number' || typeof lo !== 'number') continue;
    const key = name.toLowerCase() + '|' + la.toFixed(3) + '|' + lo.toFixed(3);
    const away = miles(lat, lon, la, lo);
    if (away > radiusMi || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `${e.type}/${e.id}`,
      name, lat: la, lon: lo,
      kind: kindOf(t),
      address: address(t),
      phone: phone(t),
      website: website(t),
      hours: (t.opening_hours || '').trim(),
      miles: away,
    });
  }
  return out.sort((a, b) => a.miles - b.miles).slice(0, max);
}

export const fmtMiles = (m) => m < 0.1 ? 'under 0.1 mi' : `${m < 10 ? m.toFixed(1) : Math.round(m)} mi`;

/* Links that open directions in the member's own maps app. */
export const directionsHref = (p) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
