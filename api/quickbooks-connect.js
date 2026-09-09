const { authorizeQuickBooks } = require('./_quickbooks-authority');
const crypto = require('crypto');
const { admin, initAdmin } = require('./_chaos-admin');

const json = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    await authorizeQuickBooks(req, String(req.body?.restaurantId || ''));
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
      connectUrl: null,
      callbackVerified: false,
      tokenStorageVerified: false,
      statePreview: `${state.slice(0, 6)}...`,
      message: 'QuickBooks configuration is present. Connection remains in readiness state until a verified callback, secure token storage, and recovery workflow are available.'
    });
  } catch (error) {
    const message = String(error?.message || 'QuickBooks connect failed safely.');
    const status = error.statusCode || (/missing.*token|unauthorized/i.test(message) ? 401 : /invalid.*token|permission|forbidden/i.test(message) ? 403 : 500);
    return json(res, status, { ok: false, message: status >= 500 ? 'QuickBooks connect failed safely.' : message });
  }
};
