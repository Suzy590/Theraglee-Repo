/* ==========================================================================
   Theraglee — the logic behind the "Nearby help" tab on Goals & tracking.
   No DOM and no network here, so tests/nearby-help/check.mjs can run it under
   plain Node. nearby-ui.js does the fetching and drawing.

   A zip code or town is turned into a point with OpenStreetMap's Nominatim.
   Places within RADIUS_MI of it come from two sources:
   - SAMHSA's treatment locator, through /api/nearby (site/api/nearby.js):
     licensed mental health and substance use facilities. This is the main one.
   - OpenStreetMap's Overpass API: counseling services and mental health
     centers, when its public servers answer in time.
   Individual therapists and Planned Parenthood are left out of every result
   (see isExcluded).
   Each becomes a "place": a name, what kind of help it is, an address, a
   phone, a website, and how far away it is.
   ========================================================================== */

export const RADIUS_MI = 25;
export const MAX_PLACES = 100;
const KM_PER_MI = 1.609344;

/* Kinds of help, in the order they win when a place carries several tags.
   [key, label shown on the tile, marker color] */
export const KINDS = [
  ['crisis',     'Crisis & mental health center', '#A32B2B'],
  ['psychiatry', 'Psychiatry',                    '#6A3FA0'],
  ['clinic',     'Mental health clinic',          '#0E7C7B'],
  ['addiction',  'Addiction & recovery',          '#B2541E'],
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
  '[healthcare=counselling]',
  '["healthcare:speciality"~"psychiatry|mental_health|addiction"]',
  '["social_facility:for"~"mental_health|addiction"]',
];

/* Never listed, from either source: individual therapists (psychotherapists,
   psychologists, therapist offices) and Planned Parenthood. */
const EXCLUDED_NAMES = /planned\s*parenthood/i;
/* A name carrying a clinician's license or degree is one therapist's practice. */
const CREDENTIALS = /(^|[\s,(])(LMFT|LAMFT|MFT|LCSW|LICSW|LMSW|LPC|LPCC|LMHC|LCPC|LCMHC|LPCC|PsyD|Psy\.D\.?|Ph\.?D\.?|EdD|LCAT|NCC)\b/;
export function isExcluded(place = {}, tags = {}) {
  if (EXCLUDED_NAMES.test(place.name || '') || EXCLUDED_NAMES.test(tags.operator || '') ||
      EXCLUDED_NAMES.test(tags.brand || '')) return true;
  if (CREDENTIALS.test(place.name || '')) return true;
  /* Not mental health help at all: diet and weight-loss counseling. */
  if (/dietitian|nutrition/.test(tags['healthcare:counselling'] || '') ||
      /weight_loss/.test(tags['healthcare:speciality'] || '')) return true;
  if (/^(psychotherapist|psychologist)$/.test(tags.healthcare || '')) return true;
  if (/^(psychologist|therapist)$/.test(tags.office || '')) return true;
  if (/psychology|psychotherapy/.test(tags['healthcare:speciality'] || '') &&
      !/psychiatry|mental_health|addiction/.test(tags['healthcare:speciality'] || '')) return true;
  return false;
}

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

/* Which kind of help a SAMHSA locator row is. */
export function samhsaKind(row = {}) {
  if (/crisis|emergency/i.test(row.EMS || '')) return 'crisis';
  if (/psychiatric/i.test(row.FT || '')) return 'psychiatry';
  if (row.typeFacility === 'MH' || /mental health/i.test(row.TC || '')) return 'clinic';
  if (row.typeFacility === 'SA' || row.typeFacility === 'OTP' || /substance/i.test(row.TC || ''))
    return 'addiction';
  return 'other';
}

/* /api/nearby JSON → places within radiusMi of lat/lon, closest first. SAMHSA
   lists a facility once per program, so rows with the same name and address
   become one place: the more urgent kind, and both programs' settings. */
export function samhsaPlaces(json, lat, lon, radiusMi = RADIUS_MI) {
  const out = [], byKey = new Map();
  const rank = (k) => KINDS.findIndex(r => r[0] === k);
  for (const r of (json && json.rows) || []) {
    const la = parseFloat(r.latitude), lo = parseFloat(r.longitude);
    const name = [r.name1, r.name2].map(x => (x || '').trim()).filter(Boolean).join(' — ');
    if (!name || !Number.isFinite(la) || !Number.isFinite(lo) || isExcluded({ name })) continue;
    const away = miles(lat, lon, la, lo);
    if (away > radiusMi) continue;
    const street = [r.street1, r.street2].map(x => (x || '').trim()).filter(Boolean).join(', ');
    const town = [r.city, [r.state, r.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const place = {
      id: `samhsa/${la.toFixed(5)},${lo.toFixed(5)}/${name}`,
      name, lat: la, lon: lo,
      kind: samhsaKind(r),
      address: [street, town].filter(Boolean).join(', '),
      phone: (r.phone || r.intake1 || '').trim(),
      website: website({ website: r.website || '' }),
      hours: '',
      setting: (r.SET || '').split(';').map(x => x.trim()).filter(Boolean).slice(0, 3).join(' · '),
      source: 'samhsa',
      miles: away,
    };
    const key = name.toLowerCase() + '|' + place.address.toLowerCase();
    const seen = byKey.get(key);
    if (!seen) { byKey.set(key, place); out.push(place); continue; }
    if (rank(place.kind) < rank(seen.kind)) seen.kind = place.kind;
    seen.setting = [...new Set([...seen.setting.split(' · '), ...place.setting.split(' · ')]
      .filter(Boolean))].slice(0, 3).join(' · ');
    seen.phone ||= place.phone;
    seen.website ||= place.website;
  }
  return out.sort((a, b) => a.miles - b.miles);
}

/* Both sources together, closest first. A community-map listing is dropped
   when SAMHSA already lists the same name, or anything within 0.03 miles. */
export function mergePlaces(samhsa = [], osm = [], max = MAX_PLACES) {
  const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
  const names = new Set(samhsa.map(p => norm(p.name.split(' — ')[0])));
  const extra = osm.filter(o => !names.has(norm(o.name)) &&
    !samhsa.some(p => miles(p.lat, p.lon, o.lat, o.lon) < 0.03));
  return [...samhsa, ...extra].filter(p => !isExcluded(p)).sort((a, b) => a.miles - b.miles).slice(0, max);
}

/* Overpass JSON → places within radiusMi of lat/lon: named, de-duplicated,
   closest first. */
export function toPlaces(json, lat, lon, max = MAX_PLACES, radiusMi = RADIUS_MI) {
  const seen = new Set();
  const out = [];
  for (const e of (json && json.elements) || []) {
    const t = e.tags || {};
    const name = (t.name || t.operator || '').trim();
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    if (!name || typeof la !== 'number' || typeof lo !== 'number' || isExcluded({ name }, t)) continue;
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
      setting: '',
      source: 'osm',
      miles: away,
    });
  }
  return out.sort((a, b) => a.miles - b.miles).slice(0, max);
}

export const fmtMiles = (m) => m < 0.1 ? 'under 0.1 mi' : `${m < 10 ? m.toFixed(1) : Math.round(m)} mi`;

/* Links that open directions in the member's own maps app. */
export const directionsHref = (p) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
