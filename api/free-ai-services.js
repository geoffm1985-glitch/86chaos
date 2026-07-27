const { verifyRequestToken } = require('./_firebase-project-admin');

const clean = (value = '') => String(value || '').trim();
const safeError = (err) => clean(err?.message || err || 'Lookup failed.').replace(/(token|secret|private[_ -]?key|authorization|bearer)\s*[:=]?\s*[^\s,;}]+/gi, '$1 [redacted]').slice(0, 240);
const num = (value, fallback = NaN) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const response = await fetch(url, { headers: { 'accept': 'application/geo+json, application/json', 'user-agent': '86Chaos/restaurant-ops-intelligence support@86chaos.com', ...(options.headers || {}) }, signal: controller.signal });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.detail || json?.title || `Lookup failed (${response.status}).`);
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function weatherLookup(body = {}) {
  const lat = num(body.lat ?? body.latitude);
  const lng = num(body.lng ?? body.lon ?? body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Weather lookup needs valid latitude and longitude.');
  const points = await fetchJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`);
  const forecastUrl = points?.properties?.forecast;
  const alertsZone = points?.properties?.forecastZone || '';
  if (!forecastUrl) throw new Error('Weather forecast URL was not returned for this geofence.');
  const forecast = await fetchJson(forecastUrl);
  const periods = Array.isArray(forecast?.properties?.periods) ? forecast.properties.periods.slice(0, 6).map(p => ({ name: p.name, startTime: p.startTime, temperature: p.temperature, temperatureUnit: p.temperatureUnit, windSpeed: p.windSpeed, shortForecast: p.shortForecast, detailedForecast: p.detailedForecast })) : [];
  return { provider: 'National Weather Service', lat, lng, forecastOffice: points?.properties?.cwa || '', forecastZone: alertsZone, periods, summary: periods[0] ? `${periods[0].name}: ${periods[0].shortForecast || periods[0].detailedForecast || 'forecast available'}${periods[0].temperature ? `, ${periods[0].temperature}°${periods[0].temperatureUnit || 'F'}` : ''}.` : 'Forecast available.' };
}

async function foodLookup(body = {}) {
  const q = clean(body.query || body.barcode || body.product || body.ingredient);
  if (!q) throw new Error('Food lookup needs an ingredient, product, or barcode.');
  const isBarcode = /^\d{8,14}$/.test(q);
  const url = isBarcode
    ? `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(q)}.json`
    : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=5`;
  const data = await fetchJson(url, { timeoutMs: 14000 });
  const products = isBarcode ? [data.product].filter(Boolean) : (Array.isArray(data.products) ? data.products : []);
  return {
    provider: 'Open Food Facts',
    query: q,
    products: products.slice(0, 5).map(product => ({
      name: product.product_name || product.generic_name || product.brands || 'Product',
      brands: product.brands || '',
      allergens: product.allergens_tags || product.allergens || [],
      ingredients: product.ingredients_text || '',
      nutriments: product.nutriments || {},
      categories: product.categories || '',
      code: product.code || ''
    }))
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    await verifyRequestToken(req, { requireProjectCredentials: false });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const kind = clean(body.kind || body.type || '').toLowerCase();
    const payload = kind === 'weather' ? await weatherLookup(body) : kind === 'food' ? await foodLookup(body) : null;
    if (!payload) return res.status(400).json({ ok: false, error: 'Unknown free service lookup. Use kind weather or food.' });
    return res.status(200).json({ ok: true, kind, payload });
  } catch (err) {
    const status = /authorization|token|login|auth/i.test(String(err?.message || '')) ? 401 : 400;
    return res.status(status).json({ ok: false, error: safeError(err) });
  }
};
