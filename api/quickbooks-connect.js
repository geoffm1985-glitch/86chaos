const crypto = require('crypto');
const { admin, initAdmin } = require('./_chaos-admin');

const json = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    const token = String(req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return json(res, 401, { ok: false, message: 'Missing Firebase Auth token' });
    const app = initAdmin(req);
    const authClient = app && typeof app.auth === 'function' ? app.auth() : admin.auth(app);
    await authClient.verifyIdToken(token);
    const clientId = process.env.QUICKBOOKS_CLIENT_ID || process.env.INTUIT_CLIENT_ID || '';
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || process.env.INTUIT_REDIRECT_URI || '';
  const environment = (process.env.QUICKBOOKS_ENVIRONMENT || process.env.INTUIT_ENVIRONMENT || 'sandbox').toLowerCase();
  if (!clientId || !redirectUri) {
    return json(res, 200, {
      ok: true,
      configured: false,
      liveSyncEnabled: false,
      message: 'QuickBooks OAuth is not configured yet. Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_REDIRECT_URI in Vercel before live connect. Back Office mapping/review can still be used safely.'
    });
  }
  const scope = encodeURIComponent('com.intuit.quickbooks.accounting openid profile email');
  const state = crypto.randomBytes(24).toString('hex');
  const base = environment === 'production'
    ? 'https://appcenter.intuit.com/connect/oauth2'
    : 'https://appcenter.intuit.com/connect/oauth2';
  const connectUrl = `${base}?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    return json(res, 200, {
      ok: true,
      configured: true,
      environment,
      liveSyncEnabled: false,
      connectUrl,
      statePreview: `${state.slice(0, 6)}...`,
      message: 'QuickBooks OAuth URL generated. Token exchange/callback should store refresh tokens server-side only and require owner/admin approval before any QuickBooks write.'
    });
  } catch (error) {
    const message = String(error?.message || 'QuickBooks connect failed safely.');
    const status = /missing.*token|unauthorized/i.test(message) ? 401 : /invalid.*token|permission|forbidden/i.test(message) ? 403 : 500;
    return json(res, status, { ok: false, message: status >= 500 ? 'QuickBooks connect failed safely.' : message });
  }
};
