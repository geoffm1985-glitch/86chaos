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

function makeCollectionRows(rowsById = {}) {
  const rows = Object.entries(rowsById);
  const query = (filters = []) => ({
    where(field, op, value) { return query([...filters, [field, op, value]]); },
    limit() { return this; },
    async get() {
      const matched = rows.filter(([, data]) => filters.every(([field, op, value]) => op === '==' ? data[field] === value : true));
      return { empty: matched.length === 0, docs: matched.map(([id, data]) => ({ id, data: () => data })), forEach(fn) { matched.forEach(([id, data]) => fn({ id, data: () => data })); } };
    },
    doc(id) {
      const data = rowsById[id];
      return { async get() { return { id, exists: Boolean(data), data: () => data || {} }; } };
    },
  });
  return query();
}

function makeDb({ users = {}, members = {}, timeOffRequests = {} } = {}) {
  return {
    collection(name) {
      if (name === 'users') return makeCollectionRows(users);
      if (name === 'workspaceMembers') return makeCollectionRows(members);
      if (name === 'timeOffRequests') return makeCollectionRows(timeOffRequests);
      return makeCollectionRows({});
    }
  };
}

function makeAuth({ existing = [], byEmail = {} } = {}) {
  return {
    async getUser(uid) {
      if (existing.includes(uid)) return { uid };
      const err = new Error('not found'); err.code = 'auth/user-not-found'; throw err;
    },
    async getUserByEmail(email) {
      const uid = byEmail[email];
      if (uid) return { uid, email };
      const err = new Error('not found'); err.code = 'auth/user-not-found'; throw err;
    }
  };
}

test('Ghost target workspace evidence accepts only durable membership proof and rejects selector-only fields', () => {
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: true, restaurantId: 'r1' }, null, 'r1'), true);
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: true, activeRestaurantId: 'r1' }, null, 'r1'), false);
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: true, defaultRestaurantId: 'r1' }, null, 'r1'), false);
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: true, workspaceIds: ['r1'] }, null, 'r1'), true);
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: true, memberships: { r1: { isActive: true, role: 'staff' } } }, null, 'r1'), true);
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: true }, { restaurantId: 'r1', isActive: true, role: 'staff' }, 'r1'), true);
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: true }, { restaurantId: 'r2', isActive: true, role: 'staff' }, 'r1'), false);
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: true, restaurantId: 'r2' }, null, 'r1'), false);
  assert.equal(api.targetHasWorkspaceEvidence({ isActive: false, restaurantId: 'r1' }, null, 'r1'), false);
  assert.equal(api.targetHasWorkspaceEvidence({ archived: true, restaurantId: 'r1' }, null, 'r1'), false);
});

test('Ghost target Auth UID resolution uses proven sources and rejects guesses', async () => {
  const ctx = { app: { auth: () => makeAuth({ existing: ['doc-is-auth'], byEmail: { 'target@example.test': 'email-auth' } }) } };
  assert.equal(await api.resolveTargetAuthUid(ctx, { authUid: 'explicit-auth' }, {}), 'explicit-auth');
  assert.equal(await api.resolveTargetAuthUid(ctx, { id: 'doc-is-auth' }, {}), 'doc-is-auth');
  assert.equal(await api.resolveTargetAuthUid(ctx, { id: 'profile-doc', email: 'target@example.test' }, {}), 'email-auth');
  await assert.rejects(() => api.resolveTargetAuthUid({ app: { auth: () => makeAuth() } }, { id: 'profile-doc' }, {}), /Firebase Auth UID could not be resolved/);
});

test('Ghost target identity accepts active legacy restaurant user and stores proven Auth UID', async () => {
  const db = makeDb({ users: { 'legacy-profile': { id: 'legacy-profile', restaurantId: 'r1', isActive: true, authUid: 'auth-legacy', email: 'legacy@example.test', name: 'Legacy Employee' } } });
  const ctx = { db, restaurantId: 'r1', app: { auth: () => makeAuth({ existing: ['auth-legacy'] }) } };
  const target = await api.resolveTargetIdentity(ctx, { targetUserId: 'legacy-profile' });
  assert.equal(target.authUid, 'auth-legacy');
  assert.equal(target.userId, 'auth-legacy');
  assert.equal(target.employeeId, 'auth-legacy');
  assert.equal(target.name, 'Legacy Employee');
});

test('Ghost target identity rejects cross-tenant and unresolved Auth UID targets', async () => {
  const db = makeDb({ users: {
    'cross-profile': { id: 'cross-profile', restaurantId: 'r2', isActive: true, authUid: 'auth-cross' },
    'no-auth': { id: 'no-auth', restaurantId: 'r1', isActive: true, email: 'noauth@example.test' },
  } });
  const ctx = { db, restaurantId: 'r1', app: { auth: () => makeAuth({ existing: [] }) } };
  await assert.rejects(() => api.resolveTargetIdentity(ctx, { targetUserId: 'cross-profile' }), /not an active member/);
  await assert.rejects(() => api.resolveTargetIdentity(ctx, { targetUserId: 'no-auth' }), /Firebase Auth UID could not be resolved/);
});

test('Ghost Mode Request Off source delegates System Administrator checks to canonical platform authority resolver', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'time-off-request.js'), 'utf8');
  assert.match(source, /decidePlatformAdminAuthority/);
  assert.match(source, /platformAuthority\.superAdmin === true/);
  assert.doesNotMatch(source, /role\s*===\s*['"]System Administrator['"]/);
});


test('Ghost target identity rejects activeRestaurantId-only, defaultRestaurantId-only, and archived users', async () => {
  const db = makeDb({ users: {
    'active-only': { id: 'active-only', activeRestaurantId: 'r1', isActive: true, authUid: 'auth-active-only' },
    'default-only': { id: 'default-only', defaultRestaurantId: 'r1', isActive: true, authUid: 'auth-default-only' },
    'archived': { id: 'archived', restaurantId: 'r1', archived: true, authUid: 'auth-archived' },
  } });
  const ctx = { db, restaurantId: 'r1', app: { auth: () => makeAuth({ existing: ['auth-active-only', 'auth-default-only', 'auth-archived'] }) } };
  await assert.rejects(() => api.resolveTargetIdentity(ctx, { targetUserId: 'active-only' }), /not an active member/);
  await assert.rejects(() => api.resolveTargetIdentity(ctx, { targetUserId: 'default-only' }), /not an active member/);
  await assert.rejects(() => api.resolveTargetIdentity(ctx, { targetUserId: 'archived' }), /active member|inactive/);
});

test('Ghost target identity still accepts workspaceIds, embedded membership, and standalone membership targets', async () => {
  const db = makeDb({
    users: {
      'workspace-list': { id: 'workspace-list', workspaceIds: ['r1'], isActive: true, authUid: 'auth-list', name: 'List User' },
      'embedded': { id: 'embedded', isActive: true, memberships: { r1: { isActive: true, employeeName: 'Embedded User', authUid: 'auth-embedded' } } },
      'member-profile': { id: 'member-profile', isActive: true, email: 'member@example.test', name: 'Member User' },
    },
    members: {
      [`member-profile_r1`]: { restaurantId: 'r1', isActive: true, userId: 'member-profile', authUid: 'auth-member', employeeName: 'Member User', email: 'member@example.test' },
    }
  });
  const ctx = { db, restaurantId: 'r1', app: { auth: () => makeAuth({ existing: ['auth-list', 'auth-embedded', 'auth-member'] }) } };
  assert.equal((await api.resolveTargetIdentity(ctx, { targetUserId: 'workspace-list' })).authUid, 'auth-list');
  assert.equal((await api.resolveTargetIdentity(ctx, { targetUserId: 'embedded' })).authUid, 'auth-embedded');
  assert.equal((await api.resolveTargetIdentity(ctx, { targetUserId: 'member-profile' })).authUid, 'auth-member');
});

test('Request Off conflicts do not treat shared createdBy provenance as employee ownership', () => {
  const allenIdentity = {
    authUid: 'allen-auth-current',
    userId: 'allen-auth-current',
    employeeId: 'allen-employee-current',
    createdBy: '86chaos-full-audit',
    employeeEmail: 'allen-current@example.test',
    name: 'Allen QA'
  };
  const rows = [
    {
      id: 'sara-conflict',
      restaurantId: 'r1',
      date: '2026-09-04',
      status: 'pending',
      userId: 'sara-auth-current',
      employeeId: 'sara-employee-current',
      createdBy: '86chaos-full-audit',
      employeeName: 'Sara QA',
      reason: 'private reason',
      employeeEmail: 'sara-current@example.test'
    },
    {
      id: 'allen-own',
      restaurantId: 'r1',
      date: '2026-09-04',
      status: 'approved',
      userId: 'allen-auth-current',
      employeeId: 'allen-employee-current',
      createdBy: '86chaos-full-audit',
      employeeName: 'Allen QA'
    },
    {
      id: 'sara-denied',
      restaurantId: 'r1',
      date: '2026-09-04',
      status: 'denied',
      userId: 'sara-auth-current',
      employeeId: 'sara-employee-current',
      createdBy: '86chaos-full-audit',
      employeeName: 'Sara QA'
    },
    {
      id: 'sara-cancelled',
      restaurantId: 'r1',
      date: '2026-09-04',
      status: 'cancelled',
      userId: 'sara-auth-current',
      employeeId: 'sara-employee-current',
      createdBy: '86chaos-full-audit',
      employeeName: 'Sara QA'
    }
  ];
  assert.equal(api.requestBelongsToIdentity(rows[0], allenIdentity), false);
  assert.equal(api.requestBelongsToIdentity(rows[1], allenIdentity), true);
  const summary = api.summarizeConflictRows(rows, allenIdentity);
  assert.equal(summary.hasConflict, true);
  assert.equal(summary.count, 1);
  assert.deepEqual(summary.names, ['Sara QA']);
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'reason'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'employeeEmail'), false);
});


test('Ghost Mode conflict lookup finds legacy workspace/date rows for other employees', async () => {
  const db = makeDb({
    timeOffRequests: {
      'sara-legacy-conflict': {
        workspaceId: 'r1',
        requestDate: '2026-08-14',
        status: 'pending',
        userId: 'sara-auth',
        employeeId: 'sara-schedule',
        employeeName: 'Sara QA',
        employeeEmail: 'sara@example.test',
      },
      'allen-own-request': {
        restaurantId: 'r1',
        date: '2026-08-14',
        status: 'approved',
        userId: 'allen-auth',
        scheduleUserId: 'allen-schedule',
        employeeName: 'Allen QA',
      },
      'other-date': {
        restaurantId: 'r1',
        date: '2026-08-15',
        status: 'pending',
        userId: 'sara-auth',
        employeeName: 'Sara QA',
      },
      'other-workspace': {
        restaurantId: 'r2',
        date: '2026-08-14',
        status: 'pending',
        userId: 'r2-sara',
        employeeName: 'Wrong Workspace',
      },
    }
  });
  const rows = await api.listRequestsByDates(db, 'r1', ['2026-08-14']);
  const allenIdentity = { authUid: 'allen-auth', userId: 'allen-auth', scheduleUserId: 'allen-schedule', employeeName: 'Allen QA' };
  const summary = api.summarizeConflictRows(rows, allenIdentity);
  assert.equal(rows.some(row => row.id === 'sara-legacy-conflict'), true);
  assert.equal(rows.some(row => row.id === 'other-date'), false);
  assert.equal(rows.some(row => row.id === 'other-workspace'), false);
  assert.equal(summary.hasConflict, true);
  assert.equal(summary.count, 1);
  assert.deepEqual(summary.names, ['Sara QA']);
});

test('Ghost Mode list returns target Request Off rows stored under legacy schedule identity', async () => {
  const db = makeDb({
    timeOffRequests: {
      'allen-legacy-request': {
        restaurantId: 'r1',
        requestDate: '2026-08-14',
        status: 'approved',
        userId: 'allen-schedule',
        employeeId: 'allen-schedule',
        employeeName: 'Allen QA',
      },
      'sara-request': {
        restaurantId: 'r1',
        date: '2026-08-14',
        status: 'pending',
        userId: 'sara-auth',
        employeeName: 'Sara QA',
      },
    }
  });
  const ctx = { db, restaurantId: 'r1' };
  const target = { authUid: 'allen-auth', userId: 'allen-auth', scheduleUserId: 'allen-schedule', employeeId: 'allen-schedule', employeeName: 'Allen QA' };
  const rows = await api.listTargetRequests(ctx, target);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'allen-legacy-request');
  assert.equal(rows[0].date, '2026-08-14');
  assert.equal(rows[0].employeeName, 'Allen QA');
});
