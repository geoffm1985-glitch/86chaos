const FALLBACK_LOCATIONS = [
  {
    test: (q) => /cheers/i.test(q) || (/chilton/i.test(q) && /(n\s*34|highway\s*57|hwy\s*57|57\b)/i.test(q)),
    lat: 44.024911,
    lon: -88.157794,
    label: 'Cheers Chilton geofence fallback',
    source: '86chaos-known-location'
  }
];

function send(res, status, payload) {
  res.status(status).json({ generatedAt: new Date().toISOString(), ...payload });
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toResult(lat, lon, label, source, extra = {}) {
  return {
    ok: true,
    lat: Number(lat),
    lon: Number(lon),
    label: label || 'Coordinates found',
    source,
    ...extra
  };
}

async function geocodeNominatim(q) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', q);
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': '86Chaos-Geocoder/14.0.0 (https://app.86chaos.com)'
    }
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const data = await response.json();
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit?.lat || !hit?.lon) return null;
  return toResult(hit.lat, hit.lon, hit.display_name, 'nominatim');
}

async function geocodePhoton(q) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '1');
  url.searchParams.set('lang', 'en');
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error(`Photon ${response.status}`);
  const data = await response.json();
  const feature = Array.isArray(data?.features) ? data.features[0] : null;
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const props = feature.properties || {};
  const label = [props.name, props.street, props.city, props.state, props.country].filter(Boolean).join(', ');
  return toResult(coords[1], coords[0], label, 'photon');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
  const q = normalizeQuery(req.query.q);
  if (q.length < 4) return send(res, 400, { ok: false, error: 'Enter a fuller address before searching.' });
  if (q.length > 220) return send(res, 400, { ok: false, error: 'Address search is too long.' });

  const errors = [];
  try {
    const result = await geocodeNominatim(q);
    if (result) return send(res, 200, result);
    errors.push('nominatim:no-result');
  } catch (err) {
    errors.push(err.message || 'nominatim:failed');
  }

  try {
    const result = await geocodePhoton(q);
    if (result) return send(res, 200, result);
    errors.push('photon:no-result');
  } catch (err) {
    errors.push(err.message || 'photon:failed');
  }

  const fallback = FALLBACK_LOCATIONS.find(item => item.test(q));
  if (fallback) {
    return send(res, 200, toResult(fallback.lat, fallback.lon, fallback.label, fallback.source, {
      warning: 'Live map lookup was unavailable, so 86 Chaos used a saved restaurant fallback coordinate.'
    }));
  }

  return send(res, 404, {
    ok: false,
    error: 'Address not found. Add city/state, type the latitude/longitude manually, or click the map to set the geofence center.',
    attempts: errors.slice(0, 4)
  });
};
