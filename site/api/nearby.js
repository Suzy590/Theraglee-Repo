/* ==========================================================================
   Theraglee — GET /api/nearby?lat=..&lon=..
   A Vercel Function that asks SAMHSA's treatment locator (findtreatment.gov)
   for licensed mental health and substance use facilities within 25 miles of
   a point, for the "Nearby help" tab. The locator doesn't allow browsers on
   other sites to call it, so the page asks this instead.

   It only relays public directory data: no keys, nothing stored, and the
   point is rounded to about a kilometer before it leaves. Answers are cached
   at Vercel's edge for a day. docs/nearby-help.md is the guide.
   ========================================================================== */
const LOCATOR = 'https://findtreatment.gov/locator/exportsAsJson/v2';
const RADIUS_M = 40234;   // 25 miles
const PAGE_SIZE = 100;
const WAIT_MS = 15000;

/* Just the fields the tab uses, so the reply stays small. */
function slim(row) {
  const services = {};
  for (const s of row.services || []) if (s && s.f2) services[s.f2] = s.f3 || '';
  return {
    name1: row.name1 || '', name2: row.name2 || '',
    street1: row.street1 || '', street2: row.street2 || '',
    city: row.city || '', state: row.state || '', zip: row.zip || '',
    phone: row.phone || '', intake1: row.intake1 || '', hotline1: row.hotline1 || '',
    website: row.website || '',
    latitude: row.latitude, longitude: row.longitude, miles: row.miles,
    typeFacility: row.typeFacility || '',
    TC: services.TC || '', SET: services.SET || '', FT: services.FT || '', EMS: services.EMS || '',
  };
}

export default async function handler(req, res) {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }
  const url = `${LOCATOR}?` + new URLSearchParams({
    sAddr: `${lat.toFixed(2)},${lon.toFixed(2)}`,
    limitType: '2', limitValue: String(RADIUS_M),
    pageSize: String(PAGE_SIZE), page: '1', sort: '0',
  });
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), WAIT_MS);
  try {
    const r = await fetch(url, { signal: stop.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return res.status(502).json({ error: 'locator ' + r.status });
    const json = await r.json();
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ rows: (json.rows || []).map(slim) });
  } catch {
    return res.status(504).json({ error: 'locator unavailable' });
  } finally {
    clearTimeout(timer);
  }
}
