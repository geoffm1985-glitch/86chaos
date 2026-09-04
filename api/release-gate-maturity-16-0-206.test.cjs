'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

test('16.0.206 failed-only report reconciliation strips Playwright file-title prefixes from executed identities', () => {
  const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
  assert.match(collector, /function stripPlaywrightFileTitlePrefix/);
  assert.match(collector, /normalizedTitle\.startsWith\(`\$\{normalizedPrefix\} > `\)/);
  assert.match(collector, /stripPlaywrightFileTitlePrefix\(spec, row\.title \|\| row\.fullTitle \|\| ''\)/);
});

test('16.0.206 failed-only run with matching selected/executed tests is PASS even when Playwright title includes the spec file', () => {
  const runId = `unit-16-0-206-reconcile-${process.pid}-${Date.now()}`;
  const runDir = path.join(root, 'test-results', '86chaos-play-store-release-gate', runId);
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  const spec = 'e2e/schedule-request-off-management.spec.cjs';
  const suite = '16.0.153 Schedule warnings and Request Off management';
  const leaf = 'Request Off employee filter narrows and clears manager-visible requests';
  const fullTitle = `${suite} > ${leaf}`;
  const commonOk = { ok: true, runId };
  writeJson(path.join(runDir, 'runner-state.json'), {
    runId,
    mode: 'reported-failed-only',
    playwrightStarted: true,
    dependencyInstallAttempted: true,
    dependencyInstallPassed: true,
    dependencyPreflightPassed: true,
    sourceInventoryPassed: true,
    browserInstallPassed: true,
    serverIdentityPreflightStarted: true,
    serverIdentityPreflightPassed: true,
    testAccountProvisionAttempted: true,
    testAccountProvisionPassed: true,
    rolePreflightStarted: true,
    rolePreflightPassed: true,
    qaSeedAttempted: true,
    qaSeedVerified: true,
    cleanupAttempted: true,
    cleanupCompleted: true,
    currentPhase: 'report-collection',
  });
  writeJson(path.join(runDir, 'environment-preflight.json'), { ...commonOk, expectedVersion: '16.0.206', sourceVersion: '16.0.206', deployedVersion: '16.0.206' });
  writeJson(path.join(runDir, 'dependency-preflight.json'), commonOk);
  writeJson(path.join(runDir, 'source-inventory.json'), { ...commonOk, version: '16.0.206', packageVersion: '16.0.206' });
  writeJson(path.join(runDir, 'server-firebase-boundary-preflight.json'), commonOk);
  writeJson(path.join(runDir, 'test-account-provisioning.json'), commonOk);
  writeJson(path.join(runDir, 'role-identity-verification.json'), commonOk);
  writeJson(path.join(runDir, 'qa-setup-state.json'), { ...commonOk, attempted: true, verified: true, seeded: true });
  writeJson(path.join(runDir, '86chaos-full-audit-seed-report.json'), { ...commonOk, restaurantId: 'qa_unit', verification: { ok: true } });
  writeJson(path.join(runDir, '86chaos-full-audit-cleanup-report.json'), { ...commonOk, remaining: {}, accountedFailures: [] });
  writeJson(path.join(runDir, 'failed-only-test-manifest.json'), {
    ok: true,
    mode: 'reported-failed-only',
    totalSelected: 1,
    desktopSelected: 1,
    mobileSelected: 0,
    selected: [{ spec, specPath: spec, fullSuitePath: suite, suitePathParts: [suite], fullTitle, leafTitle: leaf, exactTestTitle: leaf, project: 'chromium', projects: ['chromium'] }],
  });
  writeJson(path.join(runDir, 'failed-only-manifest-validation.json'), { ...commonOk, mode: 'reported-failed-only', totalSelected: 1 });
  writeJson(path.join(runDir, 'failed-and-new-manifest-selection.json'), { ...commonOk, mode: 'reported-failed-only', totalSelected: 1, selected: [] });
  writeJson(path.join(runDir, 'playwright-report.json'), {
    config: { rootDir: path.join(root, 'tests') },
    suites: [{
      title: 'e2e\\schedule-request-off-management.spec.cjs',
      specs: [],
      suites: [{
        title: suite,
        suites: [],
        specs: [{
          title: leaf,
          file: spec,
          tests: [{ projectName: 'chromium', expectedStatus: 'passed', results: [{ status: 'passed', duration: 7 }] }],
        }],
      }],
    }],
    errors: [],
    stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0, duration: 7, startTime: new Date().toISOString() },
  });

  execFileSync(process.execPath, ['scripts/86chaos-release-gate/collect-release-gate-report.cjs'], {
    cwd: root,
    env: {
      ...process.env,
      CHAOS_RELEASE_GATE_RUN_ID: runId,
      CHAOS_RELEASE_GATE_RUN_DIR: runDir,
      CHAOS_RELEASE_GATE_SELECTION_MODE: 'reported-failed-only',
      CHAOS_FAILED_ONLY_RELEASE_GATE: 'true',
      CHAOS_EXPECTED_VERSION: '16.0.206',
      CHAOS_RELEASE_GATE_STEP_FAILURES: '0',
    },
    stdio: 'pipe',
  });
  const summaryPath = path.join(runDir, `86chaos-play-store-release-gate-summary-16.0.206-${runId}.json`);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.ok, true);
  assert.equal(summary.outcome, 'PASS');
  assert.equal(summary.playwright.passed, 1);
  assert.equal(summary.playwright.deltaReconciliation.reconciled, true);
  assert.equal(summary.playwright.deltaReconciliation.selectedNotExecutedCount, 0);
  assert.equal(summary.playwright.deltaReconciliation.unexpectedExtraExecutionCount, 0);
  fs.rmSync(runDir, { recursive: true, force: true });
});

test('16.0.206 validator remains archived after later version bumps', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/validate-16-0-206.js')));
  const validator = read('scripts/validate-16-0-206.js');
  assert.match(validator, /package\.json version is 16\.0\.206/);
  assert.match(validator, /failed-only result reconciliation repair/);
});
