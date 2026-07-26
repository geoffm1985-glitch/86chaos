const { admin, initAdmin, clean } = require('./_chaos-admin');

const json = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const readBody = (req) => {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (_) { return Promise.reject(new Error('Invalid JSON body')); }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1_000_000) reject(new Error('Request body too large')); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (err) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
};

const verifyUser = async (req) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase Auth token');
  const app = initAdmin(req);
  const authClient = app && typeof app.auth === 'function' ? app.auth() : admin.auth(app);
  const decoded = await authClient.verifyIdToken(token);
  return { decoded };
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    const { decoded } = await verifyUser(req);
    const body = await readBody(req);
    const mapping = body.mapping || {};
    const counts = body.counts || {};
    const required = ['accountsPayable', 'bankAccount', 'salesIncome', 'foodPurchases', 'beveragePurchases', 'supplies', 'cashOverShort'];
    const missingMappings = required.filter(key => !clean(mapping[key] || ''));
    const blocked = Number(counts.blocked || 0) || 0;
    const unmappedVendors = Number(counts.unmappedVendors || 0) || 0;
    const ready = Number(counts.ready || 0) || 0;
    const hasClient = !!(process.env.QUICKBOOKS_CLIENT_ID || process.env.INTUIT_CLIENT_ID);
    const hasSecret = !!(process.env.QUICKBOOKS_CLIENT_SECRET || process.env.INTUIT_CLIENT_SECRET);
    const hasRedirect = !!(process.env.QUICKBOOKS_REDIRECT_URI || process.env.INTUIT_REDIRECT_URI);
    const hasWebhookVerifier = !!process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
    const liveWrites = String(process.env.QUICKBOOKS_ALLOW_SERVER_WRITES || '').toLowerCase() === 'true';
    const score = Math.max(0, Math.min(100,
      100 - (missingMappings.length * 10) - (unmappedVendors * 5) - (blocked * 4) - (!hasClient ? 5 : 0) - (!hasRedirect ? 5 : 0) - (!hasWebhookVerifier ? 5 : 0)
    ));
    const status = score >= 85 && blocked === 0 ? 'healthy' : score >= 60 ? 'needs_review' : 'needs_repair';
    return json(res, 200, {
      ok: true,
      status,
      score,
      requestedByUid: decoded.uid,
      restaurantId: clean(body.restaurantId || ''),
      closeMonth: clean(body.closeMonth || ''),
      missingMappings,
      counts: { blocked, unmappedVendors, ready },
      server: {
        hasClient,
        hasSecret,
        hasRedirect,
        hasWebhookVerifier,
        liveWritesEnabled: liveWrites,
        tokenStorageEnabled: !!(process.env.QUICKBOOKS_TOKEN_STORAGE_ENABLED || process.env.QUICKBOOKS_REFRESH_TOKEN)
      },
      message: liveWrites
        ? 'QuickBooks sync health checked. Live write guard is enabled, but sends still require owner/admin approval and complete mappings.'
        : 'QuickBooks sync health checked. Live writes are still disabled by server guardrail.'
    });
  } catch (error) {
    return json(res, 500, { ok: false, status: 'failed_safe', message: error?.message || 'QuickBooks sync health failed safely.' });
  }
};
