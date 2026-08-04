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

test('mutation safety refuses missing project identity instead of defaulting to testing project', () => {
  const env = { ...safeEnv };
  delete env.REACT_APP_FIREBASE_PROJECT_ID;
  delete env.REACT_APP_TEST_FIREBASE_PROJECT_ID;
  delete env.GCLOUD_PROJECT;
  delete env.GOOGLE_CLOUD_PROJECT;
  delete env.FIREBASE_PROJECT_ID;
  const result = assertMutationSafety({ env, runId, adminCredentialPresent: true });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /project identity is missing|expected chaos-test-d1601/i);
});

test('mutation safety refuses project identity mismatches', () => {
  const result = assertMutationSafety({ env: { ...safeEnv, REACT_APP_FIREBASE_PROJECT_ID: 'chaos-test-d1601', GCLOUD_PROJECT: 'cheers-34b8d' }, runId, adminCredentialPresent: true });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /identities disagree|production Firebase project/i);
});

test('PowerShell runners trigger cleanup when partial current-run writes began', () => {
  for (const file of ['RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1', 'RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1']) {
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', file), 'utf8');
    assert.match(source, /\$WritesStarted\s*=\s*\[bool\]\(\$setup\.writesStarted -or \$setup\.qaDataWritesStarted/, `${file} should key cleanup from first Firebase write`);
    assert.match(source, /\$CleanupEligible\s*=\s*\$WritesStarted -and \(\$SetupRunId -eq \$RunId\) -and \(\$SetupProjectId -eq 'chaos-test-d1601'\)/, `${file} should require current run and testing project`);
    assert.doesNotMatch(source, /\$setup\.attempted -and \$setup\.seeded -and \$setup\.verified -and \$setup\.runId -eq \$RunId/, `${file} must not require fully seeded and verified setup before cleanup`);
    assert.match(source, /cleanup unnecessary because no current-run Firebase writes began/, `${file} should preserve no-write cleanup skip reporting`);
  }
});

test('cleanup utility knows the current-run Document Vault Storage prefix and ownership evidence', () => {
  assert.equal(cleanup.documentVaultObjectOwnershipErrors({ name: `restaurants/qa_rest/back-office/document-vault/record/file.pdf`, metadata: { purpose: 'document-vault', restaurantId: 'qa_rest', source: '86chaos-document-vault' } }, 'qa_rest').length, 0);
  const missing = cleanup.documentVaultObjectOwnershipErrors({ name: `restaurants/qa_rest/back-office/document-vault/record/file.pdf`, metadata: { restaurantId: 'qa_rest' } }, 'qa_rest');
  assert.ok(missing.some(reason => /purpose=document-vault/.test(reason)));
  assert.ok(missing.some(reason => /source/.test(reason)));
  const otherRun = cleanup.documentVaultObjectOwnershipErrors({ name: `restaurants/qa_rest/back-office/document-vault/record/file.pdf`, metadata: { purpose: 'document-vault', restaurantId: 'qa_rest', source: '86chaos-document-vault', qaRunId: 'other-run' } }, 'qa_rest');
  assert.ok(otherRun.some(reason => /another run/.test(reason)));
});

test('mutation safety reports explicit project identity comparisons', () => {
  const ok = assertMutationSafety({ env: safeEnv, projectId: 'chaos-test-d1601', credentialProjectId: 'chaos-test-d1601', runId, adminCredentialPresent: true });
  assert.equal(ok.ok, true);
  assert.equal(ok.projectIdentitySupplied, true);
  assert.deepEqual(ok.projectIdentitiesCompared, ['chaos-test-d1601']);
  const mismatch = assertMutationSafety({ env: safeEnv, projectId: 'chaos-test-d1601', credentialProjectId: 'cheers-34b8d', runId, adminCredentialPresent: true });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.errors.join('\n'), /identities disagree|production Firebase project/i);
});
