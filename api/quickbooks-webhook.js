const crypto = require('crypto');

const json = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const readRawBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let total = 0;
  req.on('data', chunk => {
    total += chunk.length;
    if (total > 2_000_000) reject(new Error('Webhook body too large'));
    chunks.push(Buffer.from(chunk));
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const timingSafeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''), 'base64');
  const right = Buffer.from(String(b || ''), 'base64');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    const rawBody = await readRawBody(req);
    const verifier = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN || '';
    const signature = req.headers['intuit-signature'] || req.headers['x-intuit-signature'] || '';
    const signatureRequired = !!verifier;
    let signatureValid = false;
    if (verifier && signature) {
      const digest = crypto.createHmac('sha256', verifier).update(rawBody).digest('base64');
      signatureValid = timingSafeEqual(digest, signature);
    }
    if (signatureRequired && !signatureValid) return json(res, 401, { ok: false, message: 'Invalid QuickBooks webhook signature' });
    let payload = {};
    try { payload = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}; } catch (_) { payload = { parseError: 'Invalid JSON payload' }; }
    return json(res, 200, {
      ok: true,
      accepted: true,
      signatureValid,
      liveWritesEnabled: false,
      eventCount: Array.isArray(payload?.eventNotifications) ? payload.eventNotifications.length : 0,
      message: 'QuickBooks webhook received. Phase 3 acknowledges events only; no restaurant data or QuickBooks data is changed automatically.'
    });
  } catch (error) {
    return json(res, 500, { ok: false, message: error?.message || 'QuickBooks webhook failed safely.' });
  }
};
