'use strict';
const { authorizeShift4 } = require('./_shift4-authority');
const { Shift4Client } = require('./_shift4-client');
const { requireOAuthConfig, createOAuthState, setHandoffCookie, projectIdFor, publicError } = require('./_shift4-service');
const { json, restaurantIdFrom, statusFor } = require('./_shift4-route');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    const restaurantId = restaurantIdFrom(req);
    const ctx = await authorizeShift4(req, restaurantId);
    const config = requireOAuthConfig();
    const handoff = await createOAuthState(ctx.db, { uid: ctx.uid, restaurantId, callbackUri: config.redirectUri, projectId: projectIdFor(ctx.app) });
    setHandoffCookie(res, { secret: handoff.browserSecret, projectId: projectIdFor(ctx.app) });
    const authorizationUrl = new Shift4Client().authorizationUrl({ clientId: config.clientId, redirectUri: config.redirectUri, state: handoff.state });
    return json(res, 200, { ok: true, provider: 'shift4', providerProduct: 'shift4-dine', authorizationUrl, expiresInSeconds: 600 });
  } catch (error) { const safe = publicError(error); return json(res, statusFor(error), { ok: false, ...safe }); }
};
