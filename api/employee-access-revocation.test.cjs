const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'firebase-admin') {
    return { firestore: { FieldValue: { arrayRemove: (...values) => ({ __op: 'arrayRemove', values }), delete: () => ({ __op: 'delete' }) } } };
  }
  if (request.endsWith('/_firebase-project-admin') || request === './_firebase-project-admin') {
    return { getAdminAppForRequest: () => { throw new Error('not used in helper tests'); } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const staffMember = require('./staff-member.js');
const loginBootstrap = require('./login-bootstrap.js');
const workspaceMemberships = require('./workspace-memberships.js');

const { _test: staff } = staffMember;

test('staff removal identity helpers deactivate canonical and stale duplicate memberships for the same workspace', () => {
  const target = { uid: 'auth_123', email: 'worker@example.com' };
  assert.equal(staff.workspaceMemberMatchesTargetWorkspace({ id: 'auth_123_cheers', userId: 'auth_123', restaurantId: 'cheers' }, target, 'cheers'), true);
  assert.equal(staff.workspaceMemberMatchesTargetWorkspace({ id: 'legacy_cheers', authUid: 'auth_123', workspaceId: 'cheers' }, target, 'cheers'), true);
  assert.equal(staff.workspaceMemberMatchesTargetWorkspace({ id: 'email_cheers', employeeEmail: 'worker@example.com', restaurantId: 'cheers' }, target, 'cheers'), true);
  assert.equal(staff.workspaceMemberMatchesTargetWorkspace({ id: 'other_workspace', userId: 'auth_123', restaurantId: 'other' }, target, 'cheers'), false);
  assert.equal(staff.workspaceMemberMatchesTargetWorkspace({ id: 'different_person', userId: 'someone_else', restaurantId: 'cheers' }, target, 'cheers'), false);
});

test('inactive membership patch marks access inactive without destroying historical identity fields', () => {
  const patch = staff.buildInactiveMembershipPatch(
    { id: 'auth_123_cheers', employeeId: 'roster-7', scheduleUserId: 'sched-7', role: 'Cook' },
    { uid: 'auth_123', email: 'worker@example.com' },
    'cheers',
    { callerDocId: 'owner_1', callerEmail: 'owner@example.com', decoded: { uid: 'owner_1' } },
    '2026-08-09T07:00:00.000Z'
  );
  assert.equal(patch.isActive, false);
  assert.equal(patch.removed, true);
  assert.equal(patch.status, 'inactive');
  assert.equal(patch.membershipStatus, 'inactive');
  assert.equal(patch.restaurantId, 'cheers');
  assert.equal(patch.employeeId, 'roster-7');
  assert.equal(patch.scheduleUserId, 'sched-7');
});

test('login bootstrap and workspace-memberships APIs make explicit inactive membership beat stale legacy workspace fields', () => {
  const current = { restaurantId: 'cheers', membershipSource: 'legacy-user-restaurantId', isActive: true };
  const inactive = { restaurantId: 'cheers', membershipSource: 'workspaceMembers-userId', isActive: false, removed: true, status: 'inactive' };
  const mergedBootstrap = loginBootstrap._test.mergeWorkspaceAccessOption(current, inactive);
  const mergedWorkspaceApi = workspaceMemberships._test.mergeWorkspaceAccessOption(current, inactive);
  assert.equal(mergedBootstrap.isActive, false);
  assert.equal(mergedBootstrap.membershipSuppressedByInactiveRecord, true);
  assert.equal(mergedWorkspaceApi.isActive, false);
  assert.equal(mergedWorkspaceApi.membershipSuppressedByInactiveRecord, true);
  const revivedBootstrap = loginBootstrap._test.mergeWorkspaceAccessOption(inactive, current);
  assert.equal(revivedBootstrap.isActive, false, 'stale legacy fallback cannot revive an explicitly inactive membership');
});
