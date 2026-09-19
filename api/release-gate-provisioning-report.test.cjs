'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  safeClaimPatchForAccount,
  summarizeCustomClaims,
} = require('../scripts/86chaos-release-gate/provision-test-accounts.cjs');

test('release-gate provisioning reports only actually enabled custom claims', () => {
  const systemAdminClaims = safeClaimPatchForAccount({ key: 'systemAdmin' });
  const systemAdminSummary = summarizeCustomClaims(systemAdminClaims);
  assert.equal(systemAdminSummary.qaRoleClaim, 'systemAdmin');
  assert.ok(systemAdminSummary.customClaimKeysProcessed.includes('superAdmin'));
  assert.ok(systemAdminSummary.enabledCustomClaims.includes('superAdmin'));
  assert.ok(systemAdminSummary.enabledCustomClaims.includes('systemAdministrator'));

  for (const key of ['owner', 'manager', 'staff']) {
    const claims = safeClaimPatchForAccount({ key });
    const summary = summarizeCustomClaims(claims);
    assert.equal(summary.qaRoleClaim, key);
    assert.ok(summary.customClaimKeysProcessed.includes('superAdmin'), `${key} should still process cleanup keys`);
    assert.equal(summary.enabledCustomClaims.includes('superAdmin'), false, `${key} should not report enabled superAdmin`);
    assert.equal(summary.enabledCustomClaims.includes('systemAdmin'), false, `${key} should not report enabled systemAdmin`);
    assert.equal(summary.enabledCustomClaims.includes('systemAdministrator'), false, `${key} should not report enabled systemAdministrator`);
    assert.equal(summary.enabledCustomClaims.includes('chaosSystemAdministrator'), false, `${key} should not report enabled chaosSystemAdministrator`);
  }
});
