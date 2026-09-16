'use strict';
const { initAdmin } = require('./_chaos-admin');
const { revalidateShift4Initiator } = require('./_shift4-authority');
const { Shift4Client } = require('./_shift4-client');
const { tokenBundleFromOAuth } = require('./_shift4-crypto');
const { saveCredentialForAttempt } = require('./_shift4-storage');
const { requireOAuthConfig, consumeOAuthState, readHandoffCookie, clearHandoffCookie, projectIdFor, stateHash, publicError } = require('./_shift4-service');
const { queryValue } = require('./_shift4-route');

const finish = (res, ok, config, code = '') => {
  if (config.appReturnUri) {
    const target = new URL(config.appReturnUri);
    target.searchParams.set('shift4', ok ? 'connected' : 'error');
    if (!ok && code) target.searchParams.set('reason', code);
    res.statusCode = 302; res.setHeader('Location', target.toString()); return res.end();
  }
  res.statusCode = ok ? 200 : 400;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(`<!doctype html><meta charset="utf-8"><title>Shift4 connection</title><body style="font-family:system-ui;background:#12161A;color:#fff;padding:2rem"><h1>${ok ? 'Shift4 connected' : 'Shift4 connection stopped'}</h1><p>${ok ? 'Return to 86 Chaos and choose the verified Shift4 Dine location.' : 'Return to 86 Chaos and start the connection again.'}</p></body>`);
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end('GET only'); }
  let config = { appReturnUri: '' };
  try {
    config = requireOAuthConfig();
    const state = String(queryValue(req.query?.state) || '');
    const handoff = readHandoffCookie(req);
    const app = initAdmin(handoff.projectId);
    const db = app.firestore();
    const stateRecord = await consumeOAuthState(db, state, { callbackUri: config.redirectUri, browserSecret: handoff.secret, projectId: projectIdFor(app) });
    await revalidateShift4Initiator(app, { uid: stateRecord.uid, restaurantId: stateRecord.restaurantId });
    if (queryValue(req.query?.error)) throw Object.assign(new Error('Shift4 authorization was denied.'), { code: 'authorization_expired', statusCode: 401 });
    const code = String(queryValue(req.query?.code) || '');
    if (!code) throw Object.assign(new Error('Shift4 authorization code is missing.'), { code: 'invalid_state', statusCode: 400 });
    const payload = await new Shift4Client().exchangeAuthorizationCode({ code, redirectUri: config.redirectUri, clientId: config.clientId, clientSecret: config.clientSecret });
    const bundle = tokenBundleFromOAuth(payload);
    await saveCredentialForAttempt(db, stateRecord.restaurantId, bundle, { authorizedByUid: stateRecord.uid, connectedAt: new Date().toISOString(), connectionGeneration: stateRecord.connectionGeneration, stateHash: stateHash(state) });
    try { await db.collection('restaurants').doc(stateRecord.restaurantId).set({ integrations: { posProvider: 'shift4', posProviderProduct: 'shift4-dine', posConnectionMode: 'oauth_server_encrypted', posSecretStatus: 'server_only', posWebhookStatus: 'deferred' } }, { merge: true }); } catch (_) {}
    clearHandoffCookie(res);
    return finish(res, true, config);
  } catch (error) { clearHandoffCookie(res); return finish(res, false, config, publicError(error).code); }
};
