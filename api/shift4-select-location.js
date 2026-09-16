'use strict';
const { authorizeShift4 } = require('./_shift4-authority');
const { Shift4Client } = require('./_shift4-client');
const { shift4Config, freshCredential, safeLocation, publicError } = require('./_shift4-service');
const { updateCredentialMetadata } = require('./_shift4-storage');
const { json, restaurantIdFrom, statusFor } = require('./_shift4-route');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    const restaurantId = restaurantIdFrom(req);
    const requestedId = String(req.body?.locationId || '').trim();
    const ctx = await authorizeShift4(req, restaurantId);
    if (!/^\d+$/.test(requestedId) || !Number.isSafeInteger(Number(requestedId))) throw Object.assign(new Error('Shift4 location ID is invalid.'), { code: 'unverified_pos', statusCode: 400 });
    const client = new Shift4Client();
    const { tokenBundle, stored } = await freshCredential(ctx.db, restaurantId, { client });
    const [payload, installedBefore] = await Promise.all([client.getLocations(tokenBundle.accessToken), client.getInstalledLocations(tokenBundle.accessToken)]);
    const entry = payload.results.find(row => String(row?.location?.id ?? row?.id ?? '') === requestedId);
    if (!entry) throw Object.assign(new Error('Location is not authorized for this Shift4 merchant.'), { code: 'permission_insufficient', statusCode: 403 });
    let installed = installedBefore.results.find(row => String(row?.id ?? '') === requestedId);
    const eligibleLocation = safeLocation(entry, shift4Config());
    let location = eligibleLocation;
    if (location.supportStatus !== 'supported') throw Object.assign(new Error(location.supportReason), { code: location.supportStatus === 'unsupported' ? 'unsupported_pos' : 'unverified_pos', statusCode: 403 });
    if (!installed) {
      try { await client.installLocation(tokenBundle.accessToken, requestedId); }
      catch (error) {
        const recovery = await client.getInstalledLocations(tokenBundle.accessToken);
        installed = recovery.results.find(row => String(row?.id ?? '') === requestedId);
        if (!installed) throw error;
      }
      const installedAfter = await client.getInstalledLocations(tokenBundle.accessToken);
      installed = installed || installedAfter.results.find(row => String(row?.id ?? '') === requestedId);
      if (!installed) throw Object.assign(new Error('Shift4 did not confirm the location installation.'), { code: 'shift4_unavailable', statusCode: 502 });
    }
    const installedLocation = safeLocation(installed, shift4Config());
    location = { ...installedLocation, isAvailable: eligibleLocation.isAvailable, availabilityReason: eligibleLocation.availabilityReason, supportStatus: eligibleLocation.supportStatus, supportReason: eligibleLocation.supportReason };
    if (!location.isAvailable || location.timeZoneStatus !== 'valid' || location.supportStatus !== 'supported') throw Object.assign(new Error(location.supportReason), { code: location.isAvailable ? 'unverified_pos' : 'unsupported_pos', statusCode: 403 });
    await updateCredentialMetadata(ctx.db, restaurantId, { selectedLocation: location, connectionStatus: 'connected' }, { expectedGeneration: stored.data.connectionGeneration });
    return json(res, 200, { ok: true, selectedLocation: location });
  } catch (error) { const safe = publicError(error); return json(res, statusFor(error), { ok: false, ...safe }); }
};
