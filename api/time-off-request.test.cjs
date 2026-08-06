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
      getAdminAppForRequest: () => ({ auth: () => ({ verifyIdToken: async () => ({ uid: 'test' }) }), firestore: () => ({}) }),
      getAdminAppForProject: () => ({}),
      getRequestedProjectId: () => 'chaos-test-d1601',
      verifyTrustedFirebaseIdToken: async () => ({ uid: 'test' })
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const api = require('./time-off-request.js')._test;

test('conflict summaries dedupe employees and hide private request fields', () => {
  const requester = { authUid: 'employee-b', userId: 'employee-b', email: 'b@example.test', name: 'Employee B' };
  const rows = [
    { id: 'a1', restaurantId: 'r1', date: '2026-09-04', status: 'pending', userId: 'employee-a', employeeName: 'Maicol', reason: 'private reason', employeeEmail: 'a@example.test' },
    { id: 'a2', restaurantId: 'r1', date: '2026-09-04', status: 'approved', employeeId: 'employee-a', employeeName: 'Maicol', notes: 'private notes' },
    { id: 'self', restaurantId: 'r1', date: '2026-09-04', status: 'pending', userId: 'employee-b', employeeName: 'Employee B' },
    { id: 'denied', restaurantId: 'r1', date: '2026-09-04', status: 'denied', userId: 'employee-c', employeeName: 'Denied Person' }
  ];
  const summary = api.summarizeConflictRows(rows, requester);
  assert.equal(summary.hasConflict, true);
  assert.equal(summary.count, 1);
  assert.deepEqual(summary.names, ['Maicol']);
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'reason'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'email'), false);
});

test('active conflict statuses include only pending and approved active requests', () => {
  assert.equal(api.isActiveConflictRequest({ status: 'pending' }), true);
  assert.equal(api.isActiveConflictRequest({ status: 'approved' }), true);
  for (const status of ['denied', 'rejected', 'cancelled', 'canceled', 'archived', 'processed', 'completed']) {
    assert.equal(api.isActiveConflictRequest({ status }), false, status);
  }
  assert.equal(api.isActiveConflictRequest({ status: 'pending', archived: true }), false);
});

test('ghost payload belongs to target employee and keeps administrator in audit metadata only', () => {
  const ctx = { restaurantId: 'cheers-test', uid: 'admin-uid', email: 'admin@example.test', user: { name: 'Admin' }, workspaceProfile: { name: 'System Admin' } };
  const target = { authUid: 'target-auth', userId: 'target-auth', accountUserId: 'target-account', employeeId: 'target-employee', rosterUserId: 'target-roster', scheduleUserId: 'target-schedule', email: 'target@example.test', name: 'Target Employee' };
  const payload = api.buildRequestPayload(ctx, target, '2026-09-04', { isPartial: true, startTime: '12:00', endTime: '16:00' });
  assert.equal(payload.userId, 'target-auth');
  assert.equal(payload.employeeId, 'target-auth');
  assert.equal(payload.authUid, 'target-auth');
  assert.equal(payload.createdBy, 'target-auth');
  assert.equal(payload.requestedBy, 'target-auth');
  assert.equal(payload.submittedByAdminUid, 'admin-uid');
  assert.equal(payload.submittedViaGhostMode, true);
  assert.equal(payload.source, 'ghost_time_off_request');
  assert.notEqual(payload.userId, payload.submittedByAdminUid);
});

test('public Request Off response strips private notes, reason, and email fields', () => {
  const shaped = api.publicRequestShape({
    id: 'r1', restaurantId: 'rest', userId: 'u1', employeeName: 'Maicol', employeeEmail: 'secret@example.test', reason: 'private', notes: 'private', date: '2026-09-04', status: 'pending'
  });
  assert.equal(shaped.employeeName, 'Maicol');
  assert.equal(shaped.userName, 'Maicol');
  assert.equal(shaped.date, '2026-09-04');
  assert.equal(Object.prototype.hasOwnProperty.call(shaped, 'reason'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(shaped, 'notes'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(shaped, 'employeeEmail'), false);
});

test('invalid and oversized conflict date lists are rejected', () => {
  assert.throws(() => api.parseDateList({ date: '2026-02-30' }), /valid Request Off date/);
  assert.throws(() => api.parseDateList({ dates: Array.from({ length: 15 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`) }), /Too many/);
  assert.deepEqual(api.parseDateList({ dates: ['2026-09-04', '2026-09-04'] }), ['2026-09-04']);
});
