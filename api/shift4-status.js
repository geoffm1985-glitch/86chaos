'use strict';
const { authorizeShift4 } = require('./_shift4-authority');
const { shift4Config, previousDateKey, publicError } = require('./_shift4-service');
const { readCredentialMetadata } = require('./_shift4-storage');
const { json, restaurantIdFrom, statusFor } = require('./_shift4-route');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'GET only' });
  try {
    const restaurantId = restaurantIdFrom(req);
    const ctx = await authorizeShift4(req, restaurantId);
    const config = shift4Config();
    const configured = Boolean(config.clientId && config.clientSecret && config.redirectUri && process.env.SHIFT4_TOKEN_ENCRYPTION_KEY);
    if (!configured) return json(res, 200, { ok: true, configured: false, state: 'configuration_incomplete', provider: 'shift4', providerProduct: 'shift4-dine', readOnly: true, webhooks: 'deferred' });
    const stored = await readCredentialMetadata(ctx.db, restaurantId);
    if (!stored) return json(res, 200, { ok: true, configured: true, state: 'authorization_required', provider: 'shift4', providerProduct: 'shift4-dine', readOnly: true, webhooks: 'deferred' });
    return json(res, 200, {
      ok: true, configured: true, state: stored.connectionStatus || 'connected', provider: 'shift4', providerProduct: 'shift4-dine', readOnly: true, webhooks: 'deferred',
      selectedLocation: stored.selectedLocation || null, permissions: stored.permissions || [], connectedAt: stored.connectedAt || null,
      suggestedYesterday: stored.selectedLocation?.timeZone ? previousDateKey(new Date(), stored.selectedLocation.timeZone) : null,
      lastRefreshAt: stored.lastRefreshAt || null, lastSuccessfulImportAt: stored.lastSuccessfulImportAt || null, latestImportStatus: stored.latestImportStatus || null,
      ticketRetrievalReadiness: 'api_contract_unverified'
    });
  } catch (error) { const safe = publicError(error); return json(res, statusFor(error), { ok: false, ...safe }); }
};
