const { authorizeQuickBooks } = require('./_quickbooks-authority');
const { admin, initAdmin } = require('./_chaos-admin');

const json = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'GET only' });
  try {
    const { decoded } = await authorizeQuickBooks(req, String(req.query?.restaurantId || ''));
    const hasVerifier = !!process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
    const hasClient = !!(process.env.QUICKBOOKS_CLIENT_ID || process.env.INTUIT_CLIENT_ID);
    return json(res, 200, {
      ok: true,
      checkedByUid: decoded.uid,
      receiverPath: '/api/quickbooks-webhook',
      configured: hasVerifier && hasClient,
      hasVerifierToken: hasVerifier,
      hasQuickBooksClient: hasClient,
      liveWritesEnabled: false, callbackVerified: false, tokenStorageVerified: false,
      message: hasVerifier
        ? 'Webhook receiver scaffold is configured. Incoming QuickBooks notices are acknowledged and kept read-only until token storage and owner-approved sync are enabled.'
        : 'Webhook receiver scaffold exists, but QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN is not configured yet. Live webhook sync remains off.'
    });
  } catch (error) {
    return json(res, error.statusCode || 500, { ok: false, message: error?.message || 'QuickBooks webhook status failed.' });
  }
};
