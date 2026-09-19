'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const responseRecorder = () => ({ statusCode: 0, headers: {}, status(value) { this.statusCode = value; return this; }, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } });
function withMocks(routeName, storageExports, callback) {
  const authPath = require.resolve('./_shift4-authority'); const storagePath = require.resolve('./_shift4-storage'); const originals = [[authPath, require.cache[authPath]], [storagePath, require.cache[storagePath]]]; const routePath = require.resolve(routeName);
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authorizeShift4: async () => ({ db: {}, uid: 'owner' }) } };
  require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: storageExports }; delete require.cache[routePath];
  return Promise.resolve(callback(require(routeName))).finally(() => { originals.forEach(([path, value]) => value ? require.cache[path] = value : delete require.cache[path]); delete require.cache[routePath]; });
}
const location = { id: 'location-b', name: 'B', timeZone: 'America/Chicago', supportStatus: 'supported', isAvailable: true };
const record = { schemaVersion: 3, identityVersion: 2, provider: 'shift4', providerProduct: 'shift4-dine', providerLocationId: 'location-b', recordType: 'ticket', sourceRecordId: 'ticket-b', businessDate: '2026-09-13', netAmountCents: 100, sourceCompleteness: 'api_contract_unverified', pan: '4111111111111111', customerName: 'Private' };

test('review and JSON export use the same selected location and explicit field projection', async () => {
  let reviewScope; let exportScope;
  await withMocks('./shift4-records', { readCredentialMetadata: async () => ({ selectedLocation: location }), listRecordsPage: async (db, restaurantId, options) => { reviewScope = options.providerLocationId; return { records: [record], returned: 1, pageSize: 100, hasMore: false, nextCursor: null, completeness: 'complete_stored_range', scopedDocumentReads: 1 }; } }, async route => {
    const res = responseRecorder(); await route({ method: 'GET', headers: {}, query: { restaurantId: 'restaurant-a', from: '2026-09-13', to: '2026-09-13' } }, res); const payload = JSON.parse(res.body);
    assert.equal(res.statusCode, 200); assert.equal(reviewScope, 'location-b'); assert.equal(payload.providerLocationId, 'location-b'); assert.equal(payload.page.hasMore, false); assert.doesNotMatch(res.body, /4111111111111111|Private|pan|customerName/);
  });
  await withMocks('./shift4-export', { readCredentialMetadata: async () => ({ selectedLocation: location }), listAllRecords: async (db, restaurantId, options) => { exportScope = options.providerLocationId; return { complete: true, records: [record] }; } }, async route => {
    const res = responseRecorder(); await route({ method: 'GET', headers: {}, query: { restaurantId: 'restaurant-a', from: '2026-09-13', to: '2026-09-13', format: 'json' } }, res); const payload = JSON.parse(res.body);
    assert.equal(res.statusCode, 200); assert.equal(exportScope, 'location-b'); assert.equal(payload.providerLocationId, 'location-b'); assert.equal(payload.sourceCompleteness, 'incomplete_or_unverified'); assert.doesNotMatch(res.body, /4111111111111111|Private|pan|customerName/);
  });
});

test('bounded export overflow returns JSON error and never emits a partial attachment', async () => {
  await withMocks('./shift4-export', { readCredentialMetadata: async () => ({ selectedLocation: location }), listAllRecords: async () => ({ complete: false, reason: 'record_limit_exceeded', records: Array(50000) }) }, async route => {
    const res = responseRecorder(); await route({ method: 'GET', headers: {}, query: { restaurantId: 'restaurant-a', from: '2026-09-13', to: '2026-09-13', format: 'csv' } }, res);
    assert.equal(res.statusCode, 409); assert.equal(res.headers['Content-Disposition'], undefined); assert.equal(JSON.parse(res.body).code, 'export_incomplete');
  });
});
