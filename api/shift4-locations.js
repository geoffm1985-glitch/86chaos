'use strict';
const { authorizeShift4 } = require('./_shift4-authority');
const { Shift4Client } = require('./_shift4-client');
const { shift4Config, freshCredential, safeLocation, publicError } = require('./_shift4-service');
const { json, restaurantIdFrom, statusFor } = require('./_shift4-route');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'GET only' });
  try {
    const restaurantId = restaurantIdFrom(req);
    const ctx = await authorizeShift4(req, restaurantId);
    const client = new Shift4Client();
    const { tokenBundle } = await freshCredential(ctx.db, restaurantId, { client });
    const payload = await client.getLocations(tokenBundle.accessToken);
    const config = shift4Config();
    return json(res, 200, { ok: true, providerProduct: 'shift4-dine', locations: payload.results.map(entry => safeLocation(entry, config)) });
  } catch (error) { const safe = publicError(error); return json(res, statusFor(error), { ok: false, ...safe }); }
};
