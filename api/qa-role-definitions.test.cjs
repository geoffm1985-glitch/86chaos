'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ROLE_DEFINITIONS, roleForKey, safeAccountDefinition } = require('../scripts/86chaos-release-gate/qa-role-definitions.cjs');
const { analyzeRoleRows } = require('../scripts/86chaos-release-gate/verify-role-accounts.cjs');

test('QA System Administrator is Kitchen and non-owner/non-admin in the restaurant workspace', () => {
  const systemAdmin = safeAccountDefinition(roleForKey('systemAdmin'));
  assert.equal(systemAdmin.role, 'Kitchen');
  assert.equal(systemAdmin.restaurantRole, 'Kitchen');
  assert.equal(systemAdmin.isAdmin, false);
  assert.equal(systemAdmin.isOwner, false);
  assert.equal(systemAdmin.accountOwner, false);
  assert.equal(systemAdmin.workspaceOwner, false);
  assert.equal(systemAdmin.expectedPlatformAuthority, true);
  assert.equal(systemAdmin.expectedSuperAdmin, true);
});

test('restaurant owner manager and staff role definitions remain platform non-administrators', () => {
  for (const key of ['owner', 'manager', 'staff']) {
    const account = safeAccountDefinition(roleForKey(key));
    assert.equal(account.expectedSuperAdmin, false, `${key} should not be a platform admin`);
    assert.equal(account.expectedPlatformAuthority, false, `${key} should not have System Administrator authority`);
  }
  assert.equal(ROLE_DEFINITIONS.length, 4);
});

test('role verification fails if the System Administrator membership becomes owner/admin', () => {
  const baseRows = ROLE_DEFINITIONS.map((def, index) => ({
    ...safeAccountDefinition(def),
    email: `86chaos.qa.${def.key === 'systemAdmin' ? 'system-admin' : def.key}.20260729-1302@example.test`,
    uid: `uid-${index}`,
    firebaseProjectId: 'chaos-test-d1601',
    runtimeProjectId: 'chaos-test-d1601',
    superAdmin: def.key === 'systemAdmin',
    customClaimSuperAdmin: def.key === 'systemAdmin',
    serverMasterAdminMatched: false,
    firestoreSuperAdmin: def.key === 'systemAdmin',
    firestoreSystemAdministrator: def.key === 'systemAdmin',
  }));
  assert.deepEqual(analyzeRoleRows(baseRows), []);
  const badRows = baseRows.map(row => row.key === 'systemAdmin' ? { ...row, role: 'Owner', isAdmin: true, isOwner: true } : row);
  const errors = analyzeRoleRows(badRows);
  assert.ok(errors.some(error => /workspace role must remain Kitchen/i.test(error)));
  assert.ok(errors.some(error => /non-owner and non-admin/i.test(error)));
});
