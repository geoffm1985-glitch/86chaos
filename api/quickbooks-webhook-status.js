const { admin, initAdmin } = require('./_chaos-admin');

const json = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'GET only' });
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return json(res, 401, { ok: false, message: 'Missing Firebase Auth token' });
    const app = initAdmin(req);
    const authClient = app && typeof app.auth === 'function' ? app.auth() : admin.auth(app);
    const decoded = await authClient.verifyIdToken(token);
    const hasVerifier = !!process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
    const hasClient = !!(process.env.QUICKBOOKS_CLIENT_ID || process.env.INTUIT_CLIENT_ID);
    return json(res, 200, {
      ok: true,
      checkedByUid: decoded.uid,
      receiverPath: '/api/quickbooks-webhook',
      configured: hasVerifier && hasClient,
      hasVerifierToken: hasVerifier,
      hasQuickBooksClient: hasClient,
      liveWritesEnabled: String(process.env.QUICKBOOKS_ALLOW_SERVER_WRITES || '').toLowerCase() === 'true',
      message: hasVerifier
        ? 'Webhook receiver scaffold is configured. Incoming QuickBooks notices are acknowledged and kept read-only until token storage and owner-approved sync are enabled.'
        : 'Webhook receiver scaffold exists, but QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN is not configured yet. Live webhook sync remains off.'
    });
  } catch (error) {
    return json(res, 500, { ok: false, message: error?.message || 'QuickBooks webhook status failed.' });
  }
};
