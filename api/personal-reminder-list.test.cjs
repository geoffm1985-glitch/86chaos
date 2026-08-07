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
