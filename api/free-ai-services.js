const { verifyRequestToken } = require('./_firebase-project-admin');
const { authorizeAiScanWorkspace } = require('./_ai-usage');
const { requireAppCheckIfEnforced } = require('./_chaos-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');
const { getHardRateLimit } = require('./_ai-policy');
const { vendorMemory } = require('./_vendor-memory');

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
      ,package: String(product.quantity || '').slice(0, 100),
      sourceUrl: /^\d{8,14}$/.test(String(product.code || '')) ? `https://world.openfoodfacts.org/product/${product.code}` : 'https://world.openfoodfacts.org'
    }))
  };
}

function safeProductQuery(body) {
  const code = String(body.productCode || '').trim();
  if (/^\d{8,14}$/.test(code)) return code;
  const query = clean(body.productName).slice(0, 160);
  if (!query || /@|https?:|\b(?:customer|invoice|account|ship to|bill to|payment|terms|street|avenue|highway)\b|\b\d{5}(?:-\d{4})?\b/i.test(query)) throw new Error('Use a product description or barcode, without invoice, address, or customer details.');
  return query.replace(/[^A-Za-z0-9 /().&-]/g, ' ').replace(/\s+/g, ' ').trim();
}
async function researchProduct(body, access, decoded) {
  if (body.needsReview !== true) throw new Error('Product research is available from Needs Review.');
  const query = safeProductQuery(body);
  const code = String(body.productCode || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const base = { reviewOnly: true, approvalRequired: true, researchedAt: new Date().toISOString(), confidence: 'low' };
  if (body.vendorId) {
    const memory = await vendorMemory({ db: access.db, ctx: { restaurantId: access.restaurantId, uid: decoded.uid },
      body: { action: 'vendor-memory-resolve', vendorId: body.vendorId, rows: [{ productCode: code, itemName: query }] } });
    const active = memory.mappings.filter(row => row.active && row.state !== 'revoked');
    if (active.length) return { ...base, provider: 'Workspace vendor memory', products: active.map(row => ({ name: row.inventoryItemName, package: row.approvedPackSize, code: row.productCode, sourceUrl: '/?tab=inventory' })),
      reason: 'A prior approved workspace mapping exists. Confirm that this invoice still has the same package and unit.', evidenceRefs: active.map(row => `vendors/${body.vendorId}/productMappings/${row.id}`) };
  }
  // Bounded existing history, no broad customer-data crawl and no new index.
  if (code) {
    const history = await access.db.collection('invoices').where('restaurantId', '==', access.restaurantId).limit(20).get();
    const matches = history.docs.flatMap(doc => {
      const invoice = doc.data();
      if (invoice.status && invoice.status !== 'approved') return [];
      if (body.vendorId && invoice.vendorId !== body.vendorId) return [];
      return (invoice.lineItems || []).filter(row => String(row.productCode || row.sku || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() === code).slice(0, 3)
        .map(row => ({ name: row.itemName || row.description || '', package: row.packSize || '', code, sourceUrl: '/?tab=inventory', sourceInvoiceId: doc.id }));
    }).slice(0, 5);
    if (matches.length) return { ...base, provider: 'Workspace invoice history', products: matches, reason: 'Earlier approved invoice evidence was found. Package changes and substitutions still need review.' };
  }
  const publicResult = await foodLookup({ query });
  return { ...base, provider: publicResult.provider, products: publicResult.products.map(product => ({ name: String(product.name).slice(0, 160), brands: String(product.brands).slice(0, 160), package: product.package, code: product.code, sourceUrl: product.sourceUrl })),
    reason: 'Public product evidence may describe a retail package rather than your distributor case. Confirm SKU, package, and delivered quantity. Nothing is approved or changed.' };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const kind = clean(body.kind || body.type || '').toLowerCase();
    const auth = await verifyRequestToken(req, { requireProjectCredentials: kind === 'product-research' });
    if (kind === 'product-research') {
      const access = await authorizeAiScanWorkspace({ app: auth.app, decoded: auth.decoded, restaurantId: body.restaurantId, scanType: 'invoice' });
      const appCheck = await requireAppCheckIfEnforced(auth.app, req);
      if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
      const rate = await enforceRateLimit({ db: access.db, req, decoded: auth.decoded, routeName: 'product-research', limit: getHardRateLimit('research', 4), windowMs: 60000 });
      if (!rate.ok) return sendRateLimited(res, rate);
      return res.status(200).json({ ok: true, kind, payload: await researchProduct(body, access, auth.decoded) });
    }
    const payload = kind === 'weather' ? await weatherLookup(body) : kind === 'food' ? await foodLookup(body) : null;
    if (!payload) return res.status(400).json({ ok: false, error: 'Unknown free service lookup. Use kind weather or food.' });
    return res.status(200).json({ ok: true, kind, payload });
  } catch (err) {
    const status = /authorization|token|login|auth/i.test(String(err?.message || '')) ? 401 : 400;
    return res.status(status).json({ ok: false, error: safeError(err) });
  }
};
module.exports.__test = { safeProductQuery, researchProduct, foodLookup };
