const { verifyRequestToken } = require('./_firebase-project-admin');
const { APP_VERSION } = require('./_version');

const safeText = (value = '', max = 220) => String(value || '')
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/\s+/g, ' ')
  .slice(0, max)
  .trim();

const json = (res, status, payload) => res.status(status).json({ version: APP_VERSION, ...payload });

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const fetchJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': '86Chaos/FreeAiServices contact: support@86chaos.com',
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: safeText(text, 500) }; }
    if (!response.ok) {
      const err = new Error(`External service returned ${response.status}`);
      err.status = response.status;
      err.body = body;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
};

const normalizeDurationForecastRisk = (periods = [], alerts = []) => {
  const text = periods.slice(0, 4).map(p => `${p.shortForecast || ''} ${p.detailedForecast || ''}`).join(' ').toLowerCase();
  const alertText = alerts.map(a => `${a.event || ''} ${a.severity || ''} ${a.headline || ''}`).join(' ').toLowerCase();
  const joined = `${text} ${alertText}`;
  const notes = [];
  if (/snow|ice|sleet|blizzard|winter storm/.test(joined)) notes.push('possible travel/vendor delay and staff-arrival risk');
  if (/thunder|severe|tornado|hail|damaging wind|flood/.test(joined)) notes.push('watch staffing, delivery timing, and patio/service disruption');
  if (/rain|showers/.test(joined)) notes.push('patio demand may soften and takeout patterns may change');
  if (/hot|heat|humid|excessive heat/.test(joined)) notes.push('watch beverage/patio demand and cold-prep pressure');
  if (/cold|freeze|wind chill/.test(joined)) notes.push('watch staff arrival timing and vendor delivery reliability');
  return notes.join('; ');
};

const getWeather = async ({ latitude, longitude }) => {
  const lat = toNumber(latitude);
  const lon = toNumber(longitude);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok:false, error:'Weather check needs a valid restaurant latitude and longitude.' };
  }
  const pointUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const point = await fetchJson(pointUrl);
  const forecastUrl = point?.properties?.forecast;
  const forecastHourlyUrl = point?.properties?.forecastHourly;
  const alertUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  const [forecast, alerts] = await Promise.all([
    forecastUrl ? fetchJson(forecastUrl).catch(err => ({ error:safeText(err.message) })) : Promise.resolve({}),
    fetchJson(alertUrl).catch(err => ({ features:[], error:safeText(err.message) }))
  ]);
  const periods = Array.isArray(forecast?.properties?.periods) ? forecast.properties.periods.slice(0, 8).map(p => ({
    name:p.name || '',
    startTime:p.startTime || '',
    endTime:p.endTime || '',
    temperature:p.temperature,
    temperatureUnit:p.temperatureUnit || 'F',
    windSpeed:p.windSpeed || '',
    windDirection:p.windDirection || '',
    shortForecast:p.shortForecast || '',
    detailedForecast:safeText(p.detailedForecast || '', 500)
  })) : [];
  const alertRows = Array.isArray(alerts?.features) ? alerts.features.slice(0, 8).map(f => ({
    id:f.id || '',
    event:f.properties?.event || '',
    severity:f.properties?.severity || '',
    urgency:f.properties?.urgency || '',
    headline:safeText(f.properties?.headline || '', 260),
    effective:f.properties?.effective || '',
    expires:f.properties?.expires || ''
  })) : [];
  return {
    ok:true,
    source:'api.weather.gov',
    point:{ latitude:lat, longitude:lon, forecastUrl: forecastUrl || '', forecastHourlyUrl: forecastHourlyUrl || '' },
    periods,
    alerts:alertRows,
    operationNote:normalizeDurationForecastRisk(periods, alertRows)
  };
};

const normalizeOpenFoodProduct = (product = {}) => ({
  productName: product.product_name || product.generic_name || product.abbreviated_product_name || '',
  brands: product.brands || '',
  quantity: product.quantity || '',
  categories: product.categories || '',
  allergens: String(product.allergens_tags || '')
    ? String(product.allergens_tags || '').split(',').map(v => v.replace(/^en:/, '').replace(/-/g, ' ')).filter(Boolean).slice(0, 8)
    : Array.isArray(product.allergens_hierarchy) ? product.allergens_hierarchy.map(v => String(v).replace(/^en:/, '').replace(/-/g, ' ')).slice(0, 8) : [],
  nutritionGrade: product.nutrition_grades || '',
  ingredientsText: safeText(product.ingredients_text || '', 500),
  source:'openfoodfacts'
});

const getFoodData = async ({ queryText = '', barcode = '' }) => {
  const query = safeText(queryText || barcode, 120);
  if (!query) return { ok:false, error:'Food lookup needs an ingredient name or barcode.' };
  const digits = String(barcode || query).replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 14) {
    const product = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(digits)}.json`);
    const row = product?.product ? normalizeOpenFoodProduct(product.product) : null;
    return { ok:true, queryText:query, source:'openfoodfacts', products:row ? [row] : [] };
  }
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,generic_name,brands,quantity,categories,allergens_tags,allergens_hierarchy,nutrition_grades,ingredients_text`;
  const data = await fetchJson(url);
  const products = Array.isArray(data?.products) ? data.products.map(normalizeOpenFoodProduct).filter(p => p.productName || p.brands).slice(0, 5) : [];
  return { ok:true, queryText:query, source:'openfoodfacts', products };
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok:false, error:'POST required.' });
  try {
    await verifyRequestToken(req, { requireProjectCredentials: true });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const service = String(body.service || '').toLowerCase();
    if (service === 'weather') return json(res, 200, await getWeather(body));
    if (service === 'food' || service === 'food-data' || service === 'open-food-facts') return json(res, 200, await getFoodData(body));
    return json(res, 400, { ok:false, error:'Unknown free AI service.' });
  } catch (err) {
    const status = Number(err.status || err.statusCode || 500);
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    return json(res, safeStatus, { ok:false, error:safeText(err.message || 'Free AI service failed.'), category:safeStatus === 401 || safeStatus === 403 ? 'auth' : 'external-service' });
  }
};
