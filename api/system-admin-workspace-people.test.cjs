'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { safeWorkspace, safeUser, safePlatformUser } = require('./system-admin-safe-rows.cjs');

function doc(id, data) { return { id, data: () => data }; }

test('System Admin workspace roster response is sanitized and deterministic', () => {
  const row = safeWorkspace(doc('restaurant_b', { name: 'Bravo', ownerEmail: 'owner@example.com', apiKey: 'secret', serviceAccount: 'nope', isActive: true }));
  assert.equal(row.id, 'restaurant_b');
  assert.equal(row.name, 'Bravo');
  assert.equal(row.ownerEmail, 'owner@example.com');
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'apiKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'serviceAccount'), false);
});

test('System Admin exact people search row exposes safe target evidence only', () => {
  const row = safeUser(doc('userDoc123', { name: 'Allen QA', email: 'Allen@Example.com', authUid: 'auth123', restaurantId: 'qa_restaurant', workspaceIds: ['qa_restaurant'], archived: false }));
  assert.equal(row.id, 'userDoc123');
  assert.equal(row.authUid, 'auth123');
  assert.equal(row.email, 'allen@example.com');
  assert.equal(row.restaurantId, 'qa_restaurant');
  assert.equal(row.isActive, true);
});

test('System Admin exact people search marks archived users inactive', () => {
  const row = safeUser(doc('oldUser', { name: 'Old Allen', email: 'old@example.com', archived: true, restaurantId: 'qa_restaurant' }));
  assert.equal(row.isActive, false);
});

test('System Admin platform people row preserves multi-workspace membership without inactive workspaces', () => {
  const row = safePlatformUser(doc('userDoc123', {
    name: 'Multi Person',
    email: 'multi@example.com',
    restaurantId: 'restaurant_a',
    workspaceIds: ['restaurant_a', 'restaurant_b'],
    memberships: {
      restaurant_c: { isActive: true },
      restaurant_old: { isActive: false }
    }
  }));
  assert.deepEqual(row.workspaceIds.sort(), ['restaurant_a', 'restaurant_b', 'restaurant_c'].sort());
  assert.equal(row.workspaceIds.includes('restaurant_old'), false);
  assert.equal(new Set(row.workspaceIds).size, row.workspaceIds.length);
});

test('System Admin platform people row counts push devices without exposing tokens', () => {
  const row = safePlatformUser(doc('pushUser', {
    name: 'Push Person',
    email: 'push@example.com',
    fcmToken: 'token-1',
    fcmTokens: ['token-1', 'token-2'],
    pushTokens: [{ token: 'token-3' }],
    pushDevices: {
      phone: { token: 'token-4', active: true },
      retired: { token: 'token-5', active: false }
    }
  }));
  assert.equal(row.pushDeviceCount, 4);
  for (const key of ['fcmToken', 'fcmTokens', 'pushTokens', 'pushDevices']) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, key), false, `${key} must not be returned`);
  }
  const serialized = JSON.stringify(row);
  for (const token of ['token-1', 'token-2', 'token-3', 'token-4', 'token-5']) {
    assert.equal(serialized.includes(token), false, `${token} leaked`);
  }
});

test('System Admin platform people row preserves safe support-editor fields only', () => {
  const row = safePlatformUser(doc('editorUser', {
    name: 'Editor Person',
    email: 'editor@example.com',
    phone: '555-1212',
    wage: 18.5,
    isAdmin: true,
    isActive: true,
    forcePasswordChange: true,
    permissions: { schedule: true, events: true, ops: true, inventory: true, prep: true, sales: false, team: true, labor: true, unknownSecret: true },
    apiKey: 'secret',
    serviceAccount: 'nope',
    password: 'secret',
    passwordHash: 'hash',
    refreshToken: 'refresh',
    accessToken: 'access'
  }));
  assert.equal(row.phone, '555-1212');
  assert.equal(row.wage, 18.5);
  assert.equal(row.isAdmin, true);
  assert.equal(row.isActive, true);
  assert.equal(row.forcePasswordChange, true);
  assert.deepEqual(Object.keys(row.permissions).sort(), ['events', 'inventory', 'labor', 'ops', 'prep', 'sales', 'schedule', 'team'].sort());
  for (const key of ['apiKey', 'serviceAccount', 'password', 'passwordHash', 'refreshToken', 'accessToken']) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, key), false, `${key} must not be returned`);
  }
});

test('System Admin platform people row accepts canonical workspaceMembers enrichment without changing primary restaurant', () => {
  const row = safePlatformUser(doc('userDoc123', {
    name: 'Workspace Member',
    email: 'member@example.com',
    restaurantId: 'restaurant_a',
    workspaceIds: [],
    memberships: {}
  }), ['restaurant_b', 'restaurant_c', 'restaurant_b']);
  assert.equal(row.restaurantId, 'restaurant_a');
  assert.deepEqual(row.workspaceIds.sort(), ['restaurant_a', 'restaurant_b', 'restaurant_c'].sort());
  assert.equal(new Set(row.workspaceIds).size, row.workspaceIds.length);
});

test('System Admin workspaceMembers helpers match legacy email identity and ignore inactive memberships', () => {
  const helpers = require('./system-admin-safe-rows.cjs');
  const userKeys = new Set(helpers.platformUserIdentityKeys({ email: 'Legacy@Example.com' }, 'userDoc123'));
  const activeMember = { restaurantId: 'restaurant_b', email: 'legacy@example.com', isActive: true };
  const inactiveMember = { restaurantId: 'restaurant_old', email: 'legacy@example.com', isActive: false };
  assert.equal(helpers.workspaceMemberIsActive(activeMember), true);
  assert.equal(helpers.workspaceMemberIsActive(inactiveMember), false);
  assert.equal(helpers.workspaceIdForMember(activeMember, 'memberDoc'), 'restaurant_b');
  assert.ok(helpers.workspaceMemberIdentityKeys(activeMember, 'memberDoc').some(key => userKeys.has(key)), 'email identity should match without using display name');
});
