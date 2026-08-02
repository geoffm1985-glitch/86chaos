'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

function makeDoc(id, data, writes) {
  return {
    id,
    exists: Boolean(data),
    data: () => data || {},
    ref: {
      set: async (payload, options) => { writes.push({ id, payload, options }); }
    }
  };
}

function loadHandler({ decoded, profiles = {}, verifyError = null } = {}) {
  const writes = [];
  const authUpdates = [];
  const audits = [];
  const adminHelperPath = path.join(__dirname, '_firebase-project-admin.js');
  const handlerPath = path.join(__dirname, 'complete-forced-password.js');
  delete require.cache[handlerPath];

  const usersCollection = {
    doc(id) {
      return { get: async () => makeDoc(id, profiles[id] || null, writes) };
    },
    where(field, op, value) {
      return {
        limit() {
          return {
            get: async () => {
              const entry = Object.entries(profiles).find(([, profile]) => profile?.[field] === value);
              return entry
                ? { empty: false, docs: [makeDoc(entry[0], entry[1], writes)] }
                : { empty: true, docs: [] };
            }
          };
        }
      };
    }
  };

  const db = {
    collection(name) {
      if (name === 'users') return usersCollection;
      if (name === 'auditLogs') return { add: async (payload) => { audits.push(payload); } };
      throw new Error(`Unexpected collection ${name}`);
    }
  };

  const auth = {
    verifyIdToken: async () => {
      if (verifyError) throw verifyError;
      return decoded;
    },
    updateUser: async (uid, payload) => { authUpdates.push({ uid, payload }); return { uid }; }
  };

  require.cache[adminHelperPath] = {
    id: adminHelperPath,
    filename: adminHelperPath,
    loaded: true,
    exports: { getAdminAppForRequest: () => ({ auth: () => auth, firestore: () => db }) }
  };

  return { handler: require('./complete-forced-password.js'), writes, authUpdates, audits };
}

function makeRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

async function call(handler, { body = {}, token = 'token', method = 'POST' } = {}) {
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  const res = makeRes();
  await handler(req, res);
  return res;
}

const recentDecoded = () => ({
  uid: 'userA',
  email: 'usera@example.com',
  auth_time: Math.floor(Date.now() / 1000) - 30,
  firebase: { sign_in_provider: 'password' }
});

test('forced-password endpoint rejects missing tokens and stale sign-ins', async () => {
  let loaded = loadHandler({ decoded: recentDecoded(), profiles: { userA: { forcePasswordChange: true } } });
  let res = await call(loaded.handler, { body: { newPassword: 'secret7' }, token: '' });
  assert.equal(res.statusCode, 401);
  assert.equal(loaded.authUpdates.length, 0);

  loaded = loadHandler({
    decoded: { ...recentDecoded(), auth_time: Math.floor(Date.now() / 1000) - (16 * 60) },
    profiles: { userA: { forcePasswordChange: true } }
  });
  res = await call(loaded.handler, { body: { newPassword: 'secret7' } });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'recent-login-required');
  assert.equal(loaded.authUpdates.length, 0);
});

test('forced-password endpoint refuses accounts without the server-controlled flag', async () => {
  const loaded = loadHandler({ decoded: recentDecoded(), profiles: { userA: { forcePasswordChange: false } } });
  const res = await call(loaded.handler, { body: { newPassword: 'secret7' } });
  assert.equal(res.statusCode, 409);
  assert.equal(loaded.authUpdates.length, 0);
  assert.equal(loaded.writes.length, 0);
});

test('forced-password endpoint changes Firebase Auth and clears only protected password-state fields', async () => {
  const loaded = loadHandler({
    decoded: recentDecoded(),
    profiles: { userA: { forcePasswordChange: true, passwordStored: true, restaurantId: 'tenant_a' } }
  });
  const res = await call(loaded.handler, { body: { newPassword: 'secret7' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(loaded.authUpdates, [{ uid: 'userA', payload: { password: 'secret7' } }]);
  assert.equal(loaded.writes.length, 1);
  assert.equal(loaded.writes[0].payload.forcePasswordChange, false);
  assert.equal(loaded.writes[0].payload.passwordStored, false);
  assert.equal(typeof loaded.writes[0].payload.passwordPurgedAt, 'string');
  assert.equal(Object.prototype.hasOwnProperty.call(loaded.writes[0].payload, 'password'), false);
  assert.equal(loaded.audits.length, 1);
});

test('forced-password endpoint supports legacy email-keyed user profiles', async () => {
  const loaded = loadHandler({
    decoded: recentDecoded(),
    profiles: { 'usera@example.com': { email: 'usera@example.com', forcePasswordChange: true, restaurantId: 'tenant_a' } }
  });
  const res = await call(loaded.handler, { body: { newPassword: 'secret7' } });
  assert.equal(res.statusCode, 200);
  assert.equal(loaded.writes[0].id, 'usera@example.com');
});
