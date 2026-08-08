'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  extractServerFirebaseProjectId,
  extractCredentialSourceName,
  classifyWhoamiBoundary,
  chooseProbeAccount,
  redactCredentialContents,
} = require('../scripts/86chaos-release-gate/server-firebase-boundary-preflight.cjs');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-server-boundary-')); }
function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

const appUrlValue = 'https://86chaos-git-testing-example.vercel.app';

function classify(overrides = {}) {
  return classifyWhoamiBoundary({
    appUrlValue,
    expectedProject: 'chaos-test-d1601',
    clientProjectId: 'chaos-test-d1601',
    responseStatus: 200,
    responseOk: true,
    data: { ok: true, runtime: { firebaseProjectId: 'chaos-test-d1601', vercelEnv: 'preview' } },
    text: '{}',
    ...overrides,
  });
}

test('preview client chaos-test-d1601 plus preview server Admin chaos-test-d1601 passes before mutation', () => {
  const result = classify();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.clientFirebaseProjectId, 'chaos-test-d1601');
  assert.equal(result.deployedServerFirebaseProjectId, 'chaos-test-d1601');
  assert.equal(result.beforeMutation, true);
  assert.equal(result.testAccountProvisioningAttempted, false);
});

test('preview client chaos-test-d1601 plus server Admin cheers-34b8d blocks as deployment environment failure', () => {
  const result = classify({
    responseStatus: 503,
    responseOk: false,
    data: {
      ok: false,
      reasonCategory: 'firebase-admin-initialization',
      diagnostic: 'No server credential is configured for Firebase project chaos-test-d1601. FIREBASE_SERVICE_ACCOUNT_KEY currently contains project_id cheers-34b8d; this route requested chaos-test-d1601.'
    },
    text: '{"reasonCategory":"firebase-admin-initialization"}',
  });
  assert.equal(result.ok, false);
  assert.equal(result.failureCategory, 'previewServerFirebaseBoundaryFailure');
  assert.equal(result.deployedServerFirebaseProjectId, 'cheers-34b8d');
  assert.equal(result.credentialSourceName, 'FIREBASE_SERVICE_ACCOUNT_KEY');
  assert.match(result.primaryBlockingFailure, /browser\/test project is chaos-test-d1601/);
  assert.match(result.primaryBlockingFailure, /deployed server Firebase Admin credential resolves to cheers-34b8d/);
  assert.doesNotMatch(result.primaryBlockingFailure, /password|role-account/i);
});

test('preview with no matching server Admin credential blocks before mutation', () => {
  const result = classify({
    responseStatus: 503,
    responseOk: false,
    data: {
      ok: false,
      reasonCategory: 'firebase-admin-initialization',
      diagnostic: 'No server credential is configured for Firebase project chaos-test-d1601.'
    },
    text: '',
  });
  assert.equal(result.ok, false);
  assert.equal(result.failureCategory, 'previewServerFirebaseBoundaryFailure');
  assert.equal(result.beforeMutation, true);
});

test('production app.86chaos.com with cheers-34b8d remains valid for production runtime classification', () => {
  const result = classifyWhoamiBoundary({
    appUrlValue: 'https://app.86chaos.com',
    expectedProject: 'cheers-34b8d',
    clientProjectId: 'cheers-34b8d',
    responseStatus: 200,
    responseOk: true,
    data: { ok: true, runtime: { firebaseProjectId: 'cheers-34b8d', vercelEnv: 'production' } },
    text: '{}',
  });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.deployedServerFirebaseProjectId, 'cheers-34b8d');
});

test('release-gate runner verifies deployed server Firebase boundary before provisioning or QA mutation', () => {
  for (const file of ['RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.ok(source.includes('Verify deployed server Firebase boundary'), `${file} must run server boundary preflight`);
    assert.ok(source.indexOf('Verify deployed server Firebase boundary') < source.indexOf('Provision temporary release-gate test accounts'), `${file} must verify server identity before provisioning accounts`);
    assert.ok(source.indexOf('Verify deployed server Firebase boundary') < source.indexOf('Verify release-gate role accounts'), `${file} must verify server identity before role verification`);
    assert.ok(source.indexOf('Verify deployed server Firebase boundary') < source.indexOf('$RunnerState.playwrightStarted = $true'), `${file} must verify server identity before Playwright starts`);
  }
});

test('Firebase Admin initialization 503 is reported as deployment-environment failure, not account password failure', () => {
  const result = classify({
    responseStatus: 503,
    data: { reasonCategory: 'firebase-admin-initialization', diagnostic: 'FIREBASE_SERVICE_ACCOUNT_KEY currently contains project_id cheers-34b8d; this route requested chaos-test-d1601.' },
  });
  assert.equal(result.failureCategory, 'previewServerFirebaseBoundaryFailure');
  assert.doesNotMatch(result.primaryBlockingFailure, /password|testAccountConfigurationFailure/i);
});

test('credential values are redacted but safe credential source names may appear', () => {
  const raw = '{"private_key":"-----BEGIN PRIVATE KEY-----abc-----END PRIVATE KEY-----","client_email":"svc@example.com","idToken":"abc.def.ghi","project_id":"chaos-test-d1601"} FIREBASE_TEST_SERVICE_ACCOUNT_KEY';
  const redacted = redactCredentialContents(raw);
  assert.doesNotMatch(redacted, /BEGIN PRIVATE KEY|svc@example\.com|abc\.def\.ghi/);
  assert.match(redacted, /FIREBASE_TEST_SERVICE_ACCOUNT_KEY/);
  assert.equal(extractCredentialSourceName({ diagnostic: raw }), 'FIREBASE_TEST_SERVICE_ACCOUNT_KEY');
});

test('extracts server project and credential source from the 16.0.149 whoami failure diagnostic', () => {
  const diagnostic = 'No server credential is configured for Firebase project chaos-test-d1601. FIREBASE_SERVICE_ACCOUNT_KEY currently contains project_id cheers-34b8d; this route requested chaos-test-d1601.';
  assert.equal(extractServerFirebaseProjectId({ diagnostic }), 'cheers-34b8d');
  assert.equal(extractCredentialSourceName({ diagnostic }), 'FIREBASE_SERVICE_ACCOUNT_KEY');
});

test('chooses an existing configured test account without requiring provisioning first', () => {
  const account = chooseProbeAccount([
    { key: 'owner', email: 'owner@example.test', password: 'pw', emailEnv: 'OWNER_EMAIL' },
    { key: 'systemAdmin', email: 'sys@example.test', password: 'pw', emailEnv: 'SYSTEM_ADMIN_EMAIL' },
  ]);
  assert.equal(account.key, 'systemAdmin');
});

test('failed+new Playwright lineage is not replaced by this zero-execution server-boundary run', () => {
  const root = tmpDir();
  const baseline = path.join(root, 'baseline-full');
  const executed = path.join(root, 'failed-executed');
  const blocked = path.join(root, 'failed-blocked-server-boundary-later');
  writeJson(path.join(baseline, 'runner-state.json'), { runId: 'baseline-full', mode: 'full', playwrightStarted: true });
  writeJson(path.join(baseline, 'playwright-report.json'), { suites: [{ title: 'baseline', specs: [{ title: 'alpha', file: 'e2e/app-health.spec.cjs', tests: [{ title: 'alpha', projectName: 'chromium', results: [{ status: 'failed' }] }] }] }] });
  writeJson(path.join(executed, 'runner-state.json'), { runId: 'failed-executed', mode: 'failed-only', playwrightStarted: true });
  writeJson(path.join(executed, 'failed-only-test-manifest.json'), { baselineFullRunId: 'baseline-full', baselineFullRunDir: baseline, selected: [{ specPath: 'e2e/app-health.spec.cjs', title: 'alpha', project: 'chromium' }] });
  writeJson(path.join(executed, 'playwright-report.json'), { suites: [{ title: 'executed', specs: [{ title: 'alpha', file: 'e2e/app-health.spec.cjs', tests: [{ title: 'alpha', projectName: 'chromium', results: [{ status: 'failed' }] }] }] }] });
  writeJson(path.join(blocked, 'runner-state.json'), { runId: 'failed-blocked-server-boundary-later', mode: 'failed-only', playwrightStarted: false, serverIdentityPreflightStarted: true, serverIdentityPreflightPassed: false, blockingReason: 'Preview Firebase boundary mismatch.' });
  writeJson(path.join(blocked, 'server-firebase-boundary-preflight.json'), { ok: false, failureCategory: 'previewServerFirebaseBoundaryFailure', errors: ['Preview Firebase boundary mismatch.'] });
  const now = Date.now();
  fs.utimesSync(executed, new Date(now - 10000), new Date(now - 10000));
  fs.utimesSync(blocked, new Date(now), new Date(now));
  const { findLatestCompletedFailedOnlyDescendant } = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
  const latest = findLatestCompletedFailedOnlyDescendant({ baselineFullRunId: 'baseline-full', currentRunDir: path.join(root, 'current'), resultsRoot: root });
  assert.equal(path.basename(latest), 'failed-executed');
});

test('collect report classifies server-boundary blocks separately from role account configuration', () => {
  const dir = tmpDir();
  const runId = 'server-boundary-blocked';
  const runDir = path.join(dir, 'test-results', '86chaos-play-store-release-gate', runId);
  writeJson(path.join(runDir, 'runner-state.json'), {
    runId,
    mode: 'failed+new',
    dependencyInstallPassed: true,
    dependencyPreflightPassed: true,
    sourceInventoryPassed: true,
    browserInstallPassed: true,
    serverIdentityPreflightStarted: true,
    serverIdentityPreflightPassed: false,
    testAccountProvisionAttempted: false,
    rolePreflightStarted: false,
    playwrightStarted: false,
    blockingReason: 'Preview Firebase boundary mismatch: browser/test project is chaos-test-d1601 but deployed server Firebase Admin credential resolves to cheers-34b8d.',
  });
  writeJson(path.join(runDir, 'environment-preflight.json'), { ok: true, runId, appUrl: appUrlValue, sourceVersion: '16.0.150', expectedVersion: '16.0.150', deployedVersion: '16.0.150', firebaseProjectId: 'chaos-test-d1601' });
  writeJson(path.join(runDir, 'dependency-preflight.json'), { ok: true, runId });
  writeJson(path.join(runDir, 'source-inventory.json'), { ok: true, runId, version: '16.0.150', firebaseProjectId: 'chaos-test-d1601' });
  writeJson(path.join(runDir, 'server-firebase-boundary-preflight.json'), { ok: false, runId, failureCategory: 'previewServerFirebaseBoundaryFailure', primaryBlockingFailure: 'Preview Firebase boundary mismatch: browser/test project is chaos-test-d1601 but deployed server Firebase Admin credential resolves to cheers-34b8d.', errors: ['Preview Firebase boundary mismatch: browser/test project is chaos-test-d1601 but deployed server Firebase Admin credential resolves to cheers-34b8d.'], beforeMutation: true, testAccountProvisioningAttempted: false });
  writeJson(path.join(runDir, 'failed-only-test-manifest.json'), { totalSelected: 1, selected: [{ stableKey: 'a', project: 'chromium' }] });
  const script = path.join(__dirname, '..', 'scripts', '86chaos-release-gate', 'collect-release-gate-report.cjs');
  const result = spawnSync(process.execPath, [script], { cwd: dir, env: { ...process.env, CHAOS_RELEASE_GATE_RUN_ID: runId, CHAOS_FULL_AUDIT_RUN_ID: runId, CHAOS_FAILED_AND_NEW_RELEASE_GATE: 'true' }, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const summaryFile = fs.readdirSync(runDir).find(name => /^86chaos-play-store-release-gate-summary-.*\.json$/.test(name));
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, summaryFile), 'utf8'));
  assert.equal(summary.outcome, 'BLOCKED BEFORE TEST EXECUTION');
  assert.equal(summary.previewServerFirebaseBoundaryFailure, true);
  assert.equal(summary.testAccountConfigurationFailure, false);
  assert.equal(summary.attemptStatus.testAccountProvisioning.attempted, false);
  assert.equal(summary.attemptStatus.roleVerification.attempted, false);
  assert.match(summary.primaryBlockingFailure, /server Firebase Admin credential resolves to cheers-34b8d/);
});
