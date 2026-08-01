'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

function loadWhoamiWithFakeAdmin({ verifyIdToken, getProfile, initError } = {}) {
  const chaosPath = path.join(__dirname, '_chaos-admin.js');
  const whoamiPath = path.join(__dirname, 'whoami.js');
  delete require.cache[whoamiPath];
  require.cache[chaosPath] = {
    id: chaosPath,
    filename: chaosPath,
    loaded: true,
    exports: {
      admin: {},
      initAdmin: () => {
        if (initError) throw initError;
        return {
          options: { projectId: 'chaos-test-d1601', storageBucket: 'bucket' },
          auth: () => ({ verifyIdToken }),
          firestore: () => ({
            collection: (name) => ({
              doc: (id) => ({ get: async () => {
                const profile = await getProfile?.(id, name);
                return profile ? { exists: true, id, data: () => profile } : { exists: false, id, data: () => ({}) };
              } }),
              where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) })
            })
          })
        };
      },
      norm: (v = '') => String(v || '').toLowerCase().trim(),
      clean: (v = '', fallback = '') => String(v == null ? fallback : v).trim(),
      parseMasterEmailEnv: () => ({ valid: [], skipped: [], rawCount: 0 }),
      masterEmails: () => []
    }
  };
  return require('./whoami.js');
}

function makeRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

async function call(handler, authorization = 'Bearer token') {
  const req = { method: 'GET', headers: { authorization } };
  const res = makeRes();
  await handler(req, res);
  return res;
}

test('/api/whoami returns 401 only for missing or invalid token states', async () => {
  let handler = loadWhoamiWithFakeAdmin({ verifyIdToken: async () => ({ uid: 'u1', email: 'u@example.com' }) });
  let res = await call(handler, '');
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.reasonCategory, 'missing-token');

  handler = loadWhoamiWithFakeAdmin({ verifyIdToken: async () => { const err = new Error('Firebase ID token has expired.'); err.code = 'auth/id-token-expired'; throw err; } });
  res = await call(handler);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.reasonCategory, 'invalid-token');
  assert.equal(res.body.retryable, false);
});

test('/api/whoami returns 503 for temporary admin/profile failures instead of converting them to 401', async () => {
  let handler = loadWhoamiWithFakeAdmin({ initError: new Error('Admin SDK unavailable') });
  let res = await call(handler);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.platformAuthority.temporarilyUnavailable, true);
  assert.equal(res.body.retryable, true);

  handler = loadWhoamiWithFakeAdmin({
    verifyIdToken: async () => ({ uid: 'u2', email: 'u2@example.com' }),
    getProfile: async () => { throw new Error('Firestore unavailable'); }
  });
  res = await call(handler);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.reasonCategory, 'firestore-profile-read-unavailable');
  assert.equal(res.body.platformAuthority.authoritative, false);
});

test('/api/whoami returns 403 for completed authoritative non-admin decisions and 200 for protected founding admin', async () => {
  let handler = loadWhoamiWithFakeAdmin({
    verifyIdToken: async () => ({ uid: 'staff', email: 'staff@example.com' }),
    getProfile: async () => ({ id: 'staff', email: 'staff@example.com', role: 'Kitchen', restaurantId: 'cheers' })
  });
  let res = await call(handler);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.reasonCategory, 'not-platform-admin');
  assert.equal(res.body.platformAuthority.authoritative, true);

  handler = loadWhoamiWithFakeAdmin({
    verifyIdToken: async () => ({ uid: 'founder', email: 'geoffm1985@gmail.com' }),
    getProfile: async () => ({ id: 'founder', email: 'geoffm1985@gmail.com', role: 'Kitchen', restaurantId: 'cheers' })
  });
  res = await call(handler);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.superAdmin, true);
  assert.equal(res.body.platformAuthority.restaurantRole, 'Kitchen');
  assert.equal(res.body.platformAuthority.protected, true);
});
