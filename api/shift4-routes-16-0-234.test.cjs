'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function memoryDb() {
  const docs = new Map();
  const collection = name => ({ doc(id) { const key = `${name}/${id}`; return { key, async get() { return { exists: docs.has(key), data: () => docs.get(key) }; }, async set(value, options = {}) { docs.set(key, options.merge ? { ...(docs.get(key) || {}), ...value } : { ...value }); } }; } });
  return { docs, collection, async runTransaction(fn) { return fn({ get: ref => ref.get(), set(ref, value, options = {}) { docs.set(ref.key, options.merge ? { ...(docs.get(ref.key) || {}), ...value } : { ...value }); }, update(ref, patch) { docs.set(ref.key, { ...(docs.get(ref.key) || {}), ...patch }); } }); } };
}

function responseRecorder() {
  return { statusCode: 0, headers: {}, status(value) { this.statusCode = value; return this; }, setHeader(key, value) { this.headers[key] = value; }, end(value = '') { this.body = value; } };
}

test('OAuth callback accepts a validated state and never returns token material', async () => {
  const db = memoryDb(); let saved; let restaurantWrite;
  db.collection = name => name === 'restaurants' ? ({ doc: id => ({ async set(value) { restaurantWrite = { id, value }; } }) }) : ({ doc(id) { const key = `${name}/${id}`; return { key, async get() { return { exists: db.docs.has(key), data: () => db.docs.get(key) }; }, async set(value) { db.docs.set(key, value); } }; } });
  const paths = ['./_chaos-admin','./_shift4-authority','./_shift4-client','./_shift4-crypto','./_shift4-storage','./_shift4-service'];
  const resolved = paths.map(require.resolve); const originals = resolved.map(path => require.cache[path]); const routePath = require.resolve('./shift4-callback');
  try {
    const app = { options: { projectId: 'project-a' }, firestore: () => db };
    require.cache[resolved[0]] = { id: resolved[0], filename: resolved[0], loaded: true, exports: { initAdmin: () => app } };
    require.cache[resolved[1]] = { id: resolved[1], filename: resolved[1], loaded: true, exports: { revalidateShift4Initiator: async () => ({ ok: true }) } };
    require.cache[resolved[2]] = { id: resolved[2], filename: resolved[2], loaded: true, exports: { Shift4Client: class { async exchangeAuthorizationCode() { return { access_token: 'access-secret', refresh_token: 'refresh-secret' }; } } } };
    require.cache[resolved[3]] = { id: resolved[3], filename: resolved[3], loaded: true, exports: { tokenBundleFromOAuth: payload => ({ accessToken: payload.access_token, refreshToken: payload.refresh_token }) } };
    require.cache[resolved[4]] = { id: resolved[4], filename: resolved[4], loaded: true, exports: { saveCredentialForAttempt: async (ignored, restaurantId, bundle, metadata) => { saved = { restaurantId, bundle, metadata }; } } };
    require.cache[resolved[5]] = { id: resolved[5], filename: resolved[5], loaded: true, exports: {
      requireOAuthConfig: () => ({ clientId: 'client', clientSecret: 'client-secret', redirectUri: 'https://app.example/api/shift4-callback', appReturnUri: '' }),
      readHandoffCookie: () => ({ secret: 'browser-secret', projectId: 'project-a' }), clearHandoffCookie: () => {}, projectIdFor: () => 'project-a', stateHash: () => 'state-hash',
      consumeOAuthState: async () => ({ restaurantId: 'restaurant-a', uid: 'owner-a', connectionGeneration: 1 }), publicError: error => ({ code: error.code || 'unknown_error' })
    } };
    delete require.cache[routePath]; const callback = require('./shift4-callback'); const res = responseRecorder();
    await callback({ method: 'GET', query: { state: 'valid-state', code: 'valid-code' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(saved.restaurantId, 'restaurant-a'); assert.equal(saved.metadata.authorizedByUid, 'owner-a');
    assert.equal(restaurantWrite.id, 'restaurant-a'); assert.equal(restaurantWrite.value.integrations.posProviderProduct, 'shift4-dine');
    assert.doesNotMatch(String(res.body), /access-secret|refresh-secret|client-secret/);
  } finally {
    resolved.forEach((path, index) => originals[index] ? require.cache[path] = originals[index] : delete require.cache[path]); delete require.cache[routePath];
  }
});

test('OAuth callback fails safely for denial, missing code, and exchange failure', async () => {
  const cases = [
    { query: { state: 's', error: 'access_denied' }, exchangeFails: false },
    { query: { state: 's' }, exchangeFails: false },
    { query: { state: 's', code: 'bad-code' }, exchangeFails: true }
  ];
  for (const scenario of cases) {
    const paths = ['./_chaos-admin','./_shift4-authority','./_shift4-client','./_shift4-crypto','./_shift4-storage','./_shift4-service'];
    const resolved = paths.map(require.resolve); const originals = resolved.map(path => require.cache[path]); const routePath = require.resolve('./shift4-callback'); let saved = 0;
    try {
      const app = { options: { projectId: 'project-a' }, firestore: () => ({}) };
      require.cache[resolved[0]] = { id: resolved[0], filename: resolved[0], loaded: true, exports: { initAdmin: () => app } };
      require.cache[resolved[1]] = { id: resolved[1], filename: resolved[1], loaded: true, exports: { revalidateShift4Initiator: async () => ({ ok: true }) } };
      require.cache[resolved[2]] = { id: resolved[2], filename: resolved[2], loaded: true, exports: { Shift4Client: class { async exchangeAuthorizationCode() { if (scenario.exchangeFails) throw Object.assign(new Error('provider internal secret'), { code: 'token_exchange_failed' }); return {}; } } } };
      require.cache[resolved[3]] = { id: resolved[3], filename: resolved[3], loaded: true, exports: { tokenBundleFromOAuth: () => ({}) } };
      require.cache[resolved[4]] = { id: resolved[4], filename: resolved[4], loaded: true, exports: { saveCredentialForAttempt: async () => { saved += 1; } } };
      require.cache[resolved[5]] = { id: resolved[5], filename: resolved[5], loaded: true, exports: { requireOAuthConfig: () => ({ clientId: 'id', clientSecret: 'secret', redirectUri: 'https://app.example/cb', appReturnUri: '' }), readHandoffCookie: () => ({ secret: 'browser', projectId: 'project-a' }), clearHandoffCookie: () => {}, projectIdFor: () => 'project-a', stateHash: () => 'hash', consumeOAuthState: async () => ({ restaurantId: 'restaurant-a', uid: 'owner-a', connectionGeneration: 1 }), publicError: error => ({ code: error.code || 'unknown_error' }) } };
      delete require.cache[routePath]; const callback = require('./shift4-callback'); const res = responseRecorder(); await callback({ method: 'GET', query: scenario.query }, res);
      assert.equal(res.statusCode, 400); assert.equal(saved, 0); assert.doesNotMatch(String(res.body), /provider internal secret|bad-code|clientSecret|access_token|refresh_token/i);
    } finally { resolved.forEach((path, index) => originals[index] ? require.cache[path] = originals[index] : delete require.cache[path]); delete require.cache[routePath]; }
  }
});

test('expired access token refreshes and refresh failure becomes authorization-required without leaking secrets', async () => {
  const { saveCredential, readCredential } = require('./_shift4-storage');
  const { freshCredential } = require('./_shift4-service');
  const db = memoryDb(); const rootKey = crypto.randomBytes(32).toString('base64');
  const env = { SHIFT4_CLIENT_ID: 'client', SHIFT4_CLIENT_SECRET: 'client-secret', SHIFT4_OAUTH_REDIRECT_URI: 'https://app.example/api/shift4-callback', SHIFT4_TOKEN_ENCRYPTION_KEY: rootKey, SHIFT4_TOKEN_KEY_VERSION: 'k2' };
  const expired = { accessToken: 'expired-access', refreshToken: 'refresh-secret', tokenType: 'Bearer', permissions: ['pos.read'], accessExpiresAt: '2000-01-01T00:00:00.000Z', refreshExpiresAt: null };
  await saveCredential(db, 'restaurant-a', expired, { authorizedByUid: 'owner-a', selectedLocation: { id: '17', name: 'Cheers' }, latestImportStatus: { status: 'incomplete' } }, { env });
  let refreshCalls = 0;
  const refreshed = await freshCredential(db, 'restaurant-a', { env, cryptoOptions: { env }, client: { async refreshToken(input) { refreshCalls += 1; assert.equal(input.refreshToken, 'refresh-secret'); return { access_token: 'new-access', permissions: ['pos.read'] }; } } });
  assert.equal(refreshCalls, 1); assert.equal(refreshed.tokenBundle.accessToken, 'new-access');
  const reread = await readCredential(db, 'restaurant-a', { env }); assert.equal(reread.tokenBundle.refreshToken, 'refresh-secret'); assert.equal(reread.data.selectedLocation.id, '17'); assert.equal(reread.data.latestImportStatus.status, 'incomplete');

  const dbFailure = memoryDb(); await saveCredential(dbFailure, 'restaurant-a', expired, { authorizedByUid: 'owner-a' }, { env });
  await assert.rejects(() => freshCredential(dbFailure, 'restaurant-a', { env, cryptoOptions: { env }, client: { async refreshToken() { throw Object.assign(new Error('provider leaked token text'), { code: 'network_error' }); } } }), error => error.code === 'network_error');
  assert.equal([...dbFailure.docs.values()].some(value => value.connectionStatus === 'authorization_required'), false);
  const rejected = memoryDb(); await saveCredential(rejected, 'restaurant-a', expired, { authorizedByUid: 'owner-a' }, { env });
  await assert.rejects(() => freshCredential(rejected, 'restaurant-a', { env, cryptoOptions: { env }, client: { async refreshToken() { throw Object.assign(new Error('secret'), { code: 'authorization_expired' }); } } }), error => error.code === 'refresh_rejected' && !error.message.includes('secret'));
  assert.equal([...rejected.docs.values()].some(value => value.connectionStatus === 'authorization_required'), true);
});

test('location selection preserves availability denial and binds its metadata write to the credential generation', async () => {
  const paths = ['./_shift4-authority','./_shift4-client','./_shift4-service','./_shift4-storage'];
  const resolved = paths.map(require.resolve); const originals = resolved.map(path => require.cache[path]); const routePath = require.resolve('./shift4-select-location');
  let metadataWrite = null; let installed = 0;
  try {
    require.cache[resolved[0]] = { id: resolved[0], filename: resolved[0], loaded: true, exports: { authorizeShift4: async () => ({ db: {} }) } };
    require.cache[resolved[1]] = { id: resolved[1], filename: resolved[1], loaded: true, exports: { Shift4Client: class {
      async getLocations() { return { results: [{ isAvailable: true, location: { id: 17, name: 'Fixture Dine', timeZone: 'America/Chicago' } }] }; }
      async getInstalledLocations() { return { results: [{ id: 17, name: 'Fixture Dine', timeZone: 'America/Chicago' }] }; }
      async installLocation() { installed += 1; }
    } } };
    require.cache[resolved[2]] = { id: resolved[2], filename: resolved[2], loaded: true, exports: {
      shift4Config: () => ({ dineLocationIds: new Set(['17']) }), freshCredential: async () => ({ tokenBundle: { accessToken: 'server-only' }, stored: { data: { connectionGeneration: 9 } } }),
      safeLocation: (entry) => { const location = entry.location || entry; return { id: String(location.id), name: location.name, timeZone: location.timeZone, timeZoneStatus: 'valid', isAvailable: entry.isAvailable !== false, availabilityReason: entry.reason || '', supportStatus: 'supported', supportReason: 'verified' }; },
      publicError: error => ({ code: error.code || 'unknown_error', message: error.message })
    } };
    require.cache[resolved[3]] = { id: resolved[3], filename: resolved[3], loaded: true, exports: { updateCredentialMetadata: async (db, restaurantId, patch, options) => { metadataWrite = { db, restaurantId, patch, options }; } } };
    delete require.cache[routePath]; const handler = require('./shift4-select-location'); const res = responseRecorder();
    await handler({ method: 'POST', body: { restaurantId: 'restaurant-a', locationId: '17' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(installed, 0); assert.equal(metadataWrite.restaurantId, 'restaurant-a'); assert.equal(metadataWrite.patch.selectedLocation.id, '17'); assert.equal(metadataWrite.options.expectedGeneration, 9);
  } finally { resolved.forEach((path, index) => originals[index] ? require.cache[path] = originals[index] : delete require.cache[path]); delete require.cache[routePath]; }
});
