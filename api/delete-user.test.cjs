'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const helpers = require('./_delete-user-cleanup-logic.cjs');

test('workspace membership identity matching supports canonical and legacy fields', () => {
  const target = helpers.buildTargetIdentity('auth-123', 'person@example.com', { uid: 'legacy-uid' });
  assert.equal(helpers.membershipMatchesTargetIdentity({ userId: 'auth-123' }, target, 'anything'), true);
  assert.equal(helpers.membershipMatchesTargetIdentity({ uid: 'legacy-uid' }, target, 'anything'), true);
  assert.equal(helpers.membershipMatchesTargetIdentity({ authUid: 'auth-123' }, target, 'anything'), true);
  assert.equal(helpers.membershipMatchesTargetIdentity({ email: 'person@example.com' }, target, 'anything'), true);
  assert.equal(helpers.membershipMatchesTargetIdentity({}, target, helpers.canonicalMembershipDocId('auth-123', 'rest-a')), true);
});

test('workspace membership cleanup matching does not use similar names or emails', () => {
  const target = helpers.buildTargetIdentity('auth-123', 'person@example.com', {});
  assert.equal(helpers.membershipMatchesTargetIdentity({ name: 'Person Example' }, target, 'other-rest'), false);
  assert.equal(helpers.membershipMatchesTargetIdentity({ email: 'other-person@example.com' }, target, 'other-rest'), false);
  assert.equal(helpers.membershipMatchesTargetIdentity({ userId: 'auth-1234' }, target, 'other-rest'), false);
});

test('tombstoned memberships are not active roster sources', () => {
  assert.equal(helpers.isActiveWorkspaceMembership({ userId: 'u1', isActive: true }), true);
  assert.equal(helpers.isActiveWorkspaceMembership({ userId: 'u1', isActive: false }), false);
  assert.equal(helpers.isActiveWorkspaceMembership({ userId: 'u1', deleted: true }), false);
  assert.equal(helpers.isActiveWorkspaceMembership({ userId: 'u1', status: 'deleted' }), false);
  assert.equal(helpers.isActiveWorkspaceMembership({ userId: 'u1', recordStatus: 'removed' }), false);
});

test('workspace IDs are collected from current and legacy account locations', () => {
  const ids = helpers.targetWorkspaceIds('u1', {
    restaurantId: 'rest-a',
    activeRestaurantId: 'rest-b',
    defaultRestaurantId: 'rest-c',
    workspaceIds: ['rest-d'],
    memberships: { 'rest-e': { isActive: true } }
  }).sort();
  assert.deepEqual(ids, ['rest-a', 'rest-b', 'rest-c', 'rest-d', 'rest-e']);
});
