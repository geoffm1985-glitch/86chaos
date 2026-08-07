'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'firebase-admin') {
    return {
      apps: [],
      initializeApp: () => ({}),
      credential: { cert: () => ({}) },
      firestore: { FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) } }
    };
  }
  if (request === './_firebase-project-admin' || request.endsWith('/_firebase-project-admin')) {
    return {
      getAdminAppForRequest: () => ({}),
      getAdminAppForProject: () => ({}),
      getRequestedProjectId: () => 'chaos-test-d1601',
      verifyTrustedFirebaseIdToken: async () => ({ uid: 'test' })
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const api = require('./personal-reminder-list.js')._test;

test('personal reminder public shape keeps only safe drawer/page fields', () => {
  const shaped = api.publicReminderShape({
    id: 'rem-1', restaurantId: 'r1', title: 'Prep reminder', notes: 'visible reminder note', email: 'hidden@example.test', token: 'secret', participantUserIds: ['owner-uid', 'manager-uid', 'third'], participantSchemaVersion: 1,
  });
  assert.equal(shaped.id, 'rem-1');
  assert.equal(shaped.restaurantId, 'r1');
  assert.equal(shaped.title, 'Prep reminder');
  assert.deepEqual(shaped.participantUserIds, ['owner-uid', 'manager-uid']);
  assert.equal(Object.prototype.hasOwnProperty.call(shaped, 'email'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(shaped, 'token'), false);
});

test('participantRowsOnly filters by restaurant, canonical schema, and real Auth UID', () => {
  const rows = [
    { id: 'own', restaurantId: 'r1', participantSchemaVersion: 1, participantUserIds: ['uid-a'] },
    { id: 'shared', restaurantId: 'r1', participantSchemaVersion: 1, participantUserIds: ['uid-a', 'uid-b'] },
    { id: 'legacy', restaurantId: 'r1', participantUserIds: ['uid-a'] },
    { id: 'other-tenant', restaurantId: 'r2', participantSchemaVersion: 1, participantUserIds: ['uid-a'] },
    { id: 'nonparticipant', restaurantId: 'r1', participantSchemaVersion: 1, participantUserIds: ['uid-c'] },
  ];
  const filtered = api.participantRowsOnly(rows, 'uid-a', 'r1').map(row => row.id);
  assert.deepEqual(filtered, ['own', 'shared']);
});

test('listPersonalReminders uses the exact canonical production query and bounded limit', async () => {
  const calls = [];
  const docs = [
    { id: 'rem-1', data: () => ({ restaurantId: 'r1', participantSchemaVersion: 1, participantUserIds: ['uid-a'], title: 'Visible' }) },
    { id: 'wrong-user', data: () => ({ restaurantId: 'r1', participantSchemaVersion: 1, participantUserIds: ['uid-b'], title: 'Hidden' }) },
  ];
  const query = {
    where(field, op, value) { calls.push(['where', field, op, value]); return this; },
    limit(value) { calls.push(['limit', value]); return this; },
    async get() { return { forEach(fn) { docs.forEach(fn); } }; },
  };
  const db = { collection(name) { calls.push(['collection', name]); return query; } };
  const rows = await api.listPersonalReminders({ db, uid: 'uid-a', restaurantId: 'r1', limitCount: 9999 });
  assert.deepEqual(calls, [
    ['collection', 'personalReminders'],
    ['where', 'restaurantId', '==', 'r1'],
    ['where', 'participantSchemaVersion', '==', 1],
    ['where', 'participantUserIds', 'array-contains', 'uid-a'],
    ['limit', 200],
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'rem-1');
});


function memberDocId(uid, restaurantId) {
  return `${String(uid).replace(/[^A-Za-z0-9_-]/g, '_')}_${String(restaurantId).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
}

function makeCollectionRows(rowsById = {}) {
  const rows = Object.entries(rowsById);
  const query = (filters = []) => ({
    where(field, op, value) { return query([...filters, [field, op, value]]); },
    limit() { return this; },
    async get() {
      const matched = rows.filter(([, data]) => filters.every(([field, op, value]) => {
        if (op !== '==') return true;
        return data?.[field] === value;
      }));
      return { empty: matched.length === 0, docs: matched.map(([id, data]) => ({ id, exists: true, data: () => data })), forEach(fn) { matched.forEach(([id, data]) => fn({ id, exists: true, data: () => data })); } };
    },
    doc(id) {
      const data = rowsById[id];
      return { async get() { return { id, exists: Boolean(data), data: () => data || {} }; } };
    },
  });
  return query();
}

function makeDb({ users = {}, members = {} } = {}) {
  return {
    collection(name) {
      if (name === 'users') return makeCollectionRows(users);
      if (name === 'workspaceMembers') return makeCollectionRows(members);
      return makeCollectionRows({});
    }
  };
}

test('personal reminder API rejects missing user and missing workspace membership evidence', async () => {
  const db = makeDb();
  await assert.rejects(() => api.verifyCaller({ db, decoded: { uid: 'uid-a', email: 'a@example.test' }, restaurantId: 'r1' }), /active access/);
});

test('personal reminder API rejects empty identity objects and inactive membership evidence', async () => {
  assert.equal(api.activeUser({}), false);
  assert.equal(api.activeMember({}, 'r1'), false);
  assert.equal(api.activeMember({ restaurantId: 'r1', isActive: false, role: 'staff' }, 'r1'), false);
  const db = makeDb({ users: { 'uid-a': {} }, members: { [memberDocId('uid-a', 'r1')]: { restaurantId: 'r1', isActive: false, role: 'staff' } } });
  await assert.rejects(() => api.verifyCaller({ db, decoded: { uid: 'uid-a', email: 'a@example.test' }, restaurantId: 'r1' }), /active access/);
});

test('personal reminder API accepts concrete active workspace evidence from supported user and member records', async () => {
  const cases = [
    { users: { 'uid-primary': { isActive: true, restaurantId: 'r1', email: 'primary@example.test' } }, decoded: { uid: 'uid-primary', email: 'primary@example.test' } },
    { users: { 'profile-workspaces': { isActive: true, authUid: 'uid-workspaces', workspaceIds: ['r1'], email: 'workspaces@example.test' } }, decoded: { uid: 'uid-workspaces', email: 'workspaces@example.test' } },
    { users: { 'uid-embedded': { isActive: true, memberships: { r1: { isActive: true, role: 'staff' } }, email: 'embedded@example.test' } }, decoded: { uid: 'uid-embedded', email: 'embedded@example.test' } },
    { users: {}, members: { [memberDocId('uid-member', 'r1')]: { restaurantId: 'r1', isActive: true, role: 'staff' } }, decoded: { uid: 'uid-member', email: 'member@example.test' } },
  ];
  for (const row of cases) {
    const db = makeDb({ users: row.users || {}, members: row.members || {} });
    const ctx = await api.verifyCaller({ db, decoded: row.decoded, restaurantId: 'r1' });
    assert.ok(ctx.user || ctx.member);
  }
});

test('personal reminder API rejects inactive, archived, disabled, cross-workspace, and ambiguous caller identity', async () => {
  const invalidUsers = [
    { isActive: false, restaurantId: 'r1' },
    { archived: true, restaurantId: 'r1' },
    { disabled: true, restaurantId: 'r1' },
    { accountDisabled: true, restaurantId: 'r1' },
    { isActive: true, restaurantId: 'r2' },
  ];
  for (const user of invalidUsers) {
    const db = makeDb({ users: { 'uid-a': user } });
    await assert.rejects(() => api.verifyCaller({ db, decoded: { uid: 'uid-a', email: 'a@example.test' }, restaurantId: 'r1' }), /active access/);
  }
  const ambiguousDb = makeDb({ users: {
    'profile-a': { isActive: true, authUid: 'uid-a', restaurantId: 'r1', email: 'same@example.test' },
    'profile-b': { isActive: true, uid: 'uid-a', restaurantId: 'r1', email: 'same@example.test' },
  } });
  await assert.rejects(() => api.verifyCaller({ db: ambiguousDb, decoded: { uid: 'uid-a', email: 'same@example.test' }, restaurantId: 'r1' }), /multiple user records/);
});

test('personal reminder list still returns only reminders containing the real authenticated UID', async () => {
  const docs = [
    { id: 'own', data: () => ({ restaurantId: 'r1', participantSchemaVersion: 1, participantUserIds: ['uid-a'], title: 'Mine' }) },
    { id: 'other', data: () => ({ restaurantId: 'r1', participantSchemaVersion: 1, participantUserIds: ['uid-b'], title: 'Hidden' }) },
    { id: 'cross', data: () => ({ restaurantId: 'r2', participantSchemaVersion: 1, participantUserIds: ['uid-a'], title: 'Cross' }) },
  ];
  const query = {
    where() { return this; },
    limit() { return this; },
    async get() { return { forEach(fn) { docs.forEach(fn); } }; },
  };
  const db = { collection(name) { assert.equal(name, 'personalReminders'); return query; } };
  const rows = await api.listPersonalReminders({ db, uid: 'uid-a', restaurantId: 'r1' });
  assert.deepEqual(rows.map(row => row.id), ['own']);
});
