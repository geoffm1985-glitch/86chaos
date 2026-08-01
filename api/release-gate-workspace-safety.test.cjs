'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildQaWorkspaceName, validateQaWorkspaceName, LEGACY_QA_WORKSPACE_NAME } = require('../scripts/86chaos-release-gate/qa-workspace.cjs');
const { assertMutationSafety, isProductionHost, parseHost } = require('../scripts/86chaos-release-gate/mutation-safety.cjs');
const cleanup = require('../scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');

const runId = '2026-08-01T13-37-00';
const safeEnv = {
  APP_URL: 'https://cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app',
  CHAOS_RELEASE_GATE_RUN_ID: runId,
  CHAOS_ALLOW_MUTATION: 'true',
  SYSTEM_ADMIN_EMAIL: '86chaos.qa.system-admin.20260729-1302@example.test',
  OWNER_EMAIL: '86chaos.qa.owner.20260729-1302@example.test',
  MANAGER_EMAIL: '86chaos.qa.manager.20260729-1302@example.test',
  STAFF_EMAIL: '86chaos.qa.staff.20260729-1302@example.test',
};

test('unique current-run QA workspace name passes and stale names fail', () => {
  const name = buildQaWorkspaceName(runId);
  assert.equal(name, `86 Chaos Release Gate QA ${runId}`);
  assert.equal(validateQaWorkspaceName(name, runId).ok, true);
  assert.equal(validateQaWorkspaceName(buildQaWorkspaceName('other-run'), runId).ok, false);
  assert.equal(validateQaWorkspaceName(LEGACY_QA_WORKSPACE_NAME, runId).ok, false);
  assert.equal(validateQaWorkspaceName('Cheers', runId).ok, false);
  assert.equal(validateQaWorkspaceName('', runId).ok, false);
  assert.equal(validateQaWorkspaceName(name, '').ok, false);
});

test('shared mutation safety guard rejects production hosts and projects before mutation', () => {
  assert.equal(assertMutationSafety({ env: safeEnv, projectId: 'chaos-test-d1601', runId, adminCredentialPresent: true }).ok, true);
  for (const url of ['https://86chaos.com', 'https://www.86chaos.com', 'https://app.86chaos.com', 'https://APP.86CHAOS.COM.']) {
    const result = assertMutationSafety({ env: { ...safeEnv, APP_URL: url }, projectId: 'chaos-test-d1601', runId, adminCredentialPresent: true });
    assert.equal(result.ok, false, `${url} must be blocked`);
    assert.match(result.errors.join('\n'), /production host/i);
  }
  assert.equal(assertMutationSafety({ env: safeEnv, projectId: 'cheers-34b8d', runId, adminCredentialPresent: true }).ok, false);
  assert.equal(assertMutationSafety({ env: { ...safeEnv, APP_URL: '' }, projectId: 'chaos-test-d1601', runId, adminCredentialPresent: true }).ok, false);
});

test('production hostname detection uses hostname boundaries', () => {
  assert.equal(isProductionHost(parseHost('https://app.86chaos.com/path?x=1')), true);
  assert.equal(isProductionHost(parseHost('https://evil86chaos.com.example.test')), false);
});

test('cleanup validation allows partial current-run writes and refuses mismatched run ids', () => {
  const partial = { runId, createdRestaurant: true, restaurantId: 'qa_run_restaurant_1', ok: false, seededDocuments: [] };
  const setupState = { runId, writesStarted: true, restaurantId: 'qa_run_restaurant_1' };
  const validation = cleanup.validateSeedForCleanup(partial, runId, setupState);
  assert.equal(validation.ok, true);
  assert.equal(validation.writesStarted, true);
  assert.equal(validation.restaurantId, 'qa_run_restaurant_1');
  const wrong = cleanup.validateSeedForCleanup({ ...partial, runId: 'other' }, runId, setupState);
  assert.equal(wrong.ok, false);
});
