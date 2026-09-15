'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { encryptTokenBundle, decryptTokenBundle, tokenBundleFromOAuth } = require('./_shift4-crypto');
const { createOAuthState, consumeOAuthState, locationSupport, localDateRangeToUtc, previousDateKey } = require('./_shift4-service');
const { saveCredentialForAttempt } = require('./_shift4-storage');

function fakeDb() {
  const docs = new Map();
  const ref = key => ({ key, async set(value, options = {}) { docs.set(key, options.merge ? { ...(docs.get(key) || {}), ...value } : { ...value }); }, async get() { return { exists: docs.has(key), data: () => docs.get(key) }; } });
  return {
    docs,
    collection(name) { return { doc(id) { return ref(`${name}/${id}`); } }; },
    async runTransaction(fn) { return fn({ get: item => item.get(), set(item, value, options = {}) { docs.set(item.key, options.merge ? { ...(docs.get(item.key) || {}), ...value } : { ...value }); }, update(item, patch) { docs.set(item.key, { ...(docs.get(item.key) || {}), ...patch }); } }); }
  };
}

test('AES-256-GCM token envelope is tenant-bound and refresh preserves official reusable token metadata', () => {
  const key = crypto.randomBytes(32); const tokens = { accessToken: 'access-secret', refreshToken: 'refresh-secret', permissions: ['tickets.read'] };
  const envelope = encryptTokenBundle(tokens, 'restaurant-a', { key, keyVersion: 'k2', iv: Buffer.alloc(12, 7) });
  assert.ok(!JSON.stringify(envelope).includes('access-secret')); assert.deepEqual(decryptTokenBundle(envelope, 'restaurant-a', { key }), tokens);
  assert.throws(() => decryptTokenBundle(envelope, 'restaurant-b', { key }));
  const prior = { refreshToken: 'same-refresh', refreshExpiresAt: '2030-01-01T00:00:00.000Z', permissions: ['pos.read'] };
  const refreshed = tokenBundleFromOAuth({ access_token: 'new-access', refresh_token: 'same-refresh', permissions: ['pos.read'] }, Date.UTC(2026, 0, 1), { refresh: true, priorBundle: prior });
  assert.equal(refreshed.refreshToken, 'same-refresh'); assert.equal(refreshed.refreshExpiresAt, prior.refreshExpiresAt);
  assert.throws(() => tokenBundleFromOAuth({ access_token: 'a', refresh_token: 'r', expires_in: '86400' }), error => error.code === 'token_exchange_failed');
});

test('OAuth state is browser/session, project, callback, tenant and user bound; replay and expiry fail', async () => {
  const db = fakeDb(); const args = { uid: 'user-a', restaurantId: 'restaurant-a', callbackUri: 'https://app.example/api/shift4-callback', projectId: 'project-a', nowMs: 1000 };
  const handoff = await createOAuthState(db, args);
  await assert.rejects(() => consumeOAuthState(db, handoff.state, { callbackUri: args.callbackUri, browserSecret: 'other-browser-secret-that-is-long-enough', projectId: 'project-a', nowMs: 2000 }), error => error.code === 'browser_handoff_mismatch');
  const record = await consumeOAuthState(db, handoff.state, { callbackUri: args.callbackUri, browserSecret: handoff.browserSecret, projectId: 'project-a', expectedUid: 'user-a', expectedRestaurantId: 'restaurant-a', nowMs: 2000 });
  assert.equal(record.restaurantId, 'restaurant-a');
  await assert.rejects(() => consumeOAuthState(db, handoff.state, { callbackUri: args.callbackUri, browserSecret: handoff.browserSecret, projectId: 'project-a', nowMs: 3000 }), error => error.code === 'state_replayed');
  for (const [override, code] of [[{ callbackUri: 'https://wrong' }, 'callback_mismatch'], [{ projectId: 'other' }, 'project_mismatch'], [{ expectedUid: 'other' }, 'user_mismatch'], [{ expectedRestaurantId: 'other' }, 'restaurant_mismatch']]) {
    const next = await createOAuthState(db, args); await assert.rejects(() => consumeOAuthState(db, next.state, { callbackUri: args.callbackUri, browserSecret: next.browserSecret, projectId: 'project-a', nowMs: 2000, ...override }), error => error.code === code);
  }
  const expired = await createOAuthState(db, { ...args, nowMs: 0 });
  await assert.rejects(() => consumeOAuthState(db, expired.state, { callbackUri: args.callbackUri, browserSecret: expired.browserSecret, projectId: 'project-a', nowMs: 700000 }), error => error.code === 'expired_state');
});

test('newer connection attempts prevent an older callback from overwriting credentials', async () => {
  const db = fakeDb(); const args = { uid: 'u', restaurantId: 'r', callbackUri: 'https://app/cb', projectId: 'p', nowMs: 1000 };
  const older = await createOAuthState(db, args); const newer = await createOAuthState(db, { ...args, nowMs: 2000 }); const key = crypto.randomBytes(32);
  await assert.rejects(() => saveCredentialForAttempt(db, 'r', { accessToken: 'old', refreshToken: 'old' }, { connectionGeneration: older.connectionGeneration, stateHash: require('./_shift4-service').stateHash(older.state) }, { key }), error => error.code === 'superseded_state');
  await saveCredentialForAttempt(db, 'r', { accessToken: 'new', refreshToken: 'new', permissions: [] }, { connectionGeneration: newer.connectionGeneration, stateHash: require('./_shift4-service').stateHash(newer.state) }, { key });
  assert.doesNotMatch(JSON.stringify([...db.docs.values()]), /"new"|"old"/);
});

test('Shift4 Dine support and timezone/range behavior fail closed at DST, leap day and invalid dates', () => {
  const entry = { isAvailable: true, location: { id: 17, name: 'Cheers' } };
  assert.equal(locationSupport(entry, { dineLocationIds: new Set() }).status, 'unverified'); assert.equal(locationSupport(entry, { dineLocationIds: new Set(['17']) }).status, 'supported'); assert.equal(locationSupport({ ...entry, isAvailable: false }, { dineLocationIds: new Set(['17']) }).status, 'unsupported');
  assert.equal(localDateRangeToUtc('2026-03-08', '2026-03-08', 'America/Chicago').to, '2026-03-09T04:59:59.999Z');
  assert.equal(localDateRangeToUtc('2026-11-01', '2026-11-01', 'America/Chicago').to, '2026-11-02T05:59:59.999Z');
  assert.equal(localDateRangeToUtc('2024-02-29', '2024-02-29', 'America/Chicago').requestedFrom, '2024-02-29');
  assert.equal(previousDateKey(new Date('2026-01-01T03:00:00Z'), 'America/Chicago'), '2025-12-30');
  assert.throws(() => localDateRangeToUtc('2026-02-30', '2026-02-30', 'America/Chicago'), error => error.code === 'invalid_range');
  assert.throws(() => localDateRangeToUtc('2026-01-01', '2026-01-01', ''), error => error.code === 'invalid_location_timezone');
});

test('inactive canonical membership cannot fall back to a legacy admin profile', async () => {
  const direct = { exists: true, data: () => ({ restaurantId: 'restaurant-a', isActive: false, isAdmin: true }), id: 'member' };
  const db = { collection(name) { if (name !== 'workspaceMembers') throw new Error(name); return { doc: () => ({ get: async () => direct }), where() { return this; }, limit() { return this; }, get: async () => ({ empty: true, docs: [] }) }; } };
  const { canonicalMembershipState, requireActiveElevatedAccount } = require('./_shift4-authority');
  const state = await canonicalMembershipState(db, 'uid', 'owner@example.com', 'restaurant-a');
  assert.throws(() => requireActiveElevatedAccount({ accountUser: { isAdmin: true }, workspaceUser: { isAdmin: true }, memberState: state, isSuperAdmin: false }), error => error.code === 'membership_revoked');
  assert.throws(() => requireActiveElevatedAccount({ accountUser: { isActive: false }, workspaceUser: { isAdmin: true }, memberState: { exists: false }, isSuperAdmin: true }), error => error.code === 'account_inactive');
  assert.throws(() => requireActiveElevatedAccount({ accountUser: {}, workspaceUser: { role: 'staff' }, memberState: { exists: false }, isSuperAdmin: false }), error => error.code === 'permission_insufficient');
});

test('authorization runs before provider or credential work on every Shift4 data route', async () => {
  const routes = ['./shift4-status','./shift4-locations','./shift4-select-location','./shift4-test','./shift4-sync','./shift4-records','./shift4-export'];
  const authPath = require.resolve('./_shift4-authority'); const original = require.cache[authPath];
  try {
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authorizeShift4: async () => { throw Object.assign(new Error('denied'), { statusCode: 403 }); } } };
    for (const routeName of routes) {
      const routePath = require.resolve(routeName); delete require.cache[routePath]; const handler = require(routeName); const res = { status(value) { this.statusCode = value; return this; }, setHeader() {}, end(value) { this.body = value; } };
      const method = /select|sync/.test(routeName) ? 'POST' : 'GET'; await handler({ method, headers: {}, query: { restaurantId: 'forged' }, body: { restaurantId: 'forged', locationId: '1' } }, res); assert.equal(res.statusCode, 403, routeName); delete require.cache[routePath];
    }
  } finally { if (original) require.cache[authPath] = original; else delete require.cache[authPath]; }
});
