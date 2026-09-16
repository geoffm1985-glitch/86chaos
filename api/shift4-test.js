'use strict';
const { authorizeShift4 } = require('./_shift4-authority');
const { Shift4Client } = require('./_shift4-client');
const { freshCredential, publicError } = require('./_shift4-service');
const { json, restaurantIdFrom, statusFor } = require('./_shift4-route');

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { ok: false, message: 'GET or POST only' });
  try {
    const restaurantId = restaurantIdFrom(req);
    const ctx = await authorizeShift4(req, restaurantId);
    const client = new Shift4Client();
    const { stored, tokenBundle } = await freshCredential(ctx.db, restaurantId, { client });
    const selected = stored.data.selectedLocation;
    if (!selected || selected.supportStatus !== 'supported') {
      return json(res, 200, { ok: true, state: 'unknown_unverified', connected: true, message: 'Authorization is present, but a verified Shift4 Dine location must be selected.' });
    }
    const menu = await client.getMenu(tokenBundle.accessToken, selected.id);
    return json(res, 200, { ok: true, state: 'connected', connected: true, providerProduct: 'shift4-dine', location: selected, menuItemCount: menu.items.length, message: 'Shift4 Dine read access is working.' });
  } catch (error) { const safe = publicError(error); return json(res, statusFor(error), { ok: false, state: safe.code, ...safe }); }
};
