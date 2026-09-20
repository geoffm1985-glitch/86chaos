'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  CANONICAL_VERCEL_PROJECT_SLUG,
  normalizeUrlForCompare,
  isCanonicalVercelPreviewHost,
  isRetiredVercelHost,
  inspectReleaseTargetEnvConflicts,
  validateReleaseTarget,
} = require('../scripts/86chaos-release-gate/vercel-targets.cjs');
const { assertMutationSafety } = require('../scripts/86chaos-release-gate/mutation-safety.cjs');
const { findLatestCompletedFailedOnlyDescendant } = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

const qaEnv = {
  APP_URL: 'https://86chaos-git-testing-example.vercel.app',
  CHAOS_ALLOW_MUTATION: 'true',
  CHAOS_RELEASE_GATE_RUN_ID: 'target-unit-run',
  SYSTEM_ADMIN_EMAIL: '86chaos.qa.system-admin.20260729-1302@example.test',
  OWNER_EMAIL: '86chaos.qa.owner.20260729-1302@example.test',
  MANAGER_EMAIL: '86chaos.qa.manager.20260729-1302@example.test',
  STAFF_EMAIL: '86chaos.qa.staff.20260729-1302@example.test',
};

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-target-')); }
function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function writeCompletedSummary(dir, runId, overrides = {}) {
  writeJson(path.join(dir, `86chaos-play-store-release-gate-summary-${runId}.json`), {
    runId,
    outcome: 'FAILED',
    sourceVersion: '16.0.147',
    deployedVersion: '16.0.147',
    firebaseProjectId: 'chaos-test-d1601',
    playwright: { totalResults: 1, failedTests: [{ file: 'e2e/app-health.spec.cjs', title: 'baseline > alpha', projectName: 'chromium', status: 'failed' }] },
    ...overrides,
  });
}

function collectorFixtureEnv(runId, overrides = {}) {
  const childEnv = { ...process.env };
  delete childEnv.CHAOS_RELEASE_GATE_RUN_DIR;
  return {
    ...childEnv,
    CHAOS_RELEASE_GATE_RUN_ID: runId,
    CHAOS_FULL_AUDIT_RUN_ID: runId,
    CHAOS_FAILED_AND_NEW_RELEASE_GATE: 'true',
    ...overrides,
  };
}

test('canonical Vercel preview target accepts 86chaos and rejects production, retired, and unrelated projects', () => {
  assert.equal(CANONICAL_VERCEL_PROJECT_SLUG, '86chaos');
  assert.equal(isCanonicalVercelPreviewHost('86chaos-git-testing-abc.vercel.app'), true);
  assert.equal(isRetiredVercelHost('cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app'), true);
  const accepted = validateReleaseTarget({ appUrl: 'https://86chaos-git-testing-abc.vercel.app/', expectedProjectSlug: '86chaos', expectedVersion: '16.0.149', sourceVersion: '16.0.149', deployedVersion: '16.0.149' });
  assert.equal(accepted.ok, true, accepted.errors.join('\n'));
  const production = validateReleaseTarget({ appUrl: 'https://app.86chaos.com', expectedVersion: '16.0.149', sourceVersion: '16.0.149', deployedVersion: '16.0.149' });
  assert.equal(production.ok, false);
  assert.match(production.errors.join('\n'), /production host/i);
  const retired = validateReleaseTarget({ appUrl: 'https://cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app', expectedVersion: '16.0.149', sourceVersion: '16.0.149', deployedVersion: '16.0.148' });
  assert.equal(retired.ok, false);
  assert.match(retired.errors.join('\n'), /retired Vercel project cheers-portal-4oxv/);
  assert.match(retired.errors.join('\n'), /Testing preview is stale/);
  const unrelated = validateReleaseTarget({ appUrl: 'https://other-project-git-testing.vercel.app', expectedVersion: '16.0.149', sourceVersion: '16.0.149', deployedVersion: '16.0.149' });
  assert.equal(unrelated.ok, false);
  assert.match(unrelated.errors.join('\n'), /not in the canonical Vercel project family 86chaos/);
});

test('APP_URL and CHAOS_BASE_URL must agree by host and tolerate trailing slash differences', () => {
  assert.equal(normalizeUrlForCompare('https://86chaos-git-testing-a.vercel.app/'), normalizeUrlForCompare('https://86chaos-git-testing-a.vercel.app'));
  const ok = validateReleaseTarget({ appUrl: 'https://86chaos-git-testing-a.vercel.app/', chaosBaseUrl: 'https://86chaos-git-testing-a.vercel.app', expectedVersion: '16.0.149', sourceVersion: '16.0.149', deployedVersion: '16.0.149' });
  assert.equal(ok.ok, true, ok.errors.join('\n'));
  const mismatch = validateReleaseTarget({ appUrl: 'https://86chaos-git-testing-a.vercel.app', chaosBaseUrl: 'https://cheers-portal-4oxv-git-testing-old.vercel.app', expectedVersion: '16.0.149', sourceVersion: '16.0.149', deployedVersion: '16.0.149' });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.errors.join('\n'), /APP_URL and CHAOS_BASE_URL point to different hosts/);
});

test('stale process APP_URL conflicting with .env.test.local blocks before mutation', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, '.env.test.local'), 'APP_URL=https://86chaos-git-testing-current.vercel.app\nCHAOS_EXPECTED_VERSION=16.0.149\n');
  const result = inspectReleaseTargetEnvConflicts(dir, { APP_URL: 'https://cheers-portal-4oxv-git-testing-old.vercel.app', CHAOS_EXPECTED_VERSION: '16.0.149' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Conflicting APP_URL values detected/);
});

test('source version and deployed preview mismatch remains a strict blocker with canonical target context', () => {
  const stale = validateReleaseTarget({ appUrl: 'https://86chaos-git-testing-current.vercel.app', expectedVersion: '16.0.149', sourceVersion: '16.0.149', deployedVersion: '16.0.148' });
  assert.equal(stale.ok, false);
  assert.match(stale.errors.join('\n'), /Testing preview is stale/);
  assert.match(stale.errors.join('\n'), /canonical Vercel project 86chaos/);
});

test('mutation safety rejects retired duplicate Vercel hosts and accepts canonical previews', () => {
  const ok = assertMutationSafety({ env: qaEnv, projectId: 'chaos-test-d1601', credentialProjectId: 'chaos-test-d1601', runId: 'target-unit-run', adminCredentialPresent: true });
  assert.equal(ok.ok, true, ok.errors.join('\n'));
  const retired = assertMutationSafety({ env: { ...qaEnv, APP_URL: 'https://cheers-portal-4oxv-git-testing-old.vercel.app' }, projectId: 'chaos-test-d1601', credentialProjectId: 'chaos-test-d1601', runId: 'target-unit-run', adminCredentialPresent: true });
  assert.equal(retired.ok, false);
  assert.match(retired.errors.join('\n'), /retired Vercel project/);
});

test('preflight-only blocked run does not replace executed Playwright lineage', () => {
  const root = tmpDir();
  const baseline = path.join(root, 'baseline-full');
  const executed = path.join(root, 'failed-executed');
  const blocked = path.join(root, 'failed-blocked-later');
  writeJson(path.join(baseline, 'runner-state.json'), { runId: 'baseline-full', mode: 'full', playwrightStarted: true, currentPhase: 'report-collection' });
  writeJson(path.join(baseline, 'environment-preflight.json'), { runId: 'baseline-full', sourceVersion: '16.0.147', deployedVersion: '16.0.147' });
  writeJson(path.join(baseline, 'playwright-report.json'), { suites: [{ title: 'baseline', specs: [{ title: 'alpha', file: 'e2e/app-health.spec.cjs', tests: [{ title: 'alpha', projectName: 'chromium', results: [{ status: 'failed' }] }] }] }] });
  writeCompletedSummary(baseline, 'baseline-full');
  writeJson(path.join(executed, 'runner-state.json'), { runId: 'failed-executed', mode: 'failed-only', playwrightStarted: true, currentPhase: 'report-collection' });
  writeJson(path.join(executed, 'failed-only-test-manifest.json'), { baselineFullRunId: 'baseline-full', baselineFullRunDir: baseline, baselineSourceVersion: '16.0.147', baselineDeployedVersion: '16.0.147', selected: [{ specPath: 'e2e/app-health.spec.cjs', title: 'alpha', project: 'chromium' }] });
  writeJson(path.join(executed, 'playwright-report.json'), { suites: [{ title: 'executed', specs: [{ title: 'alpha', file: 'e2e/app-health.spec.cjs', tests: [{ title: 'alpha', projectName: 'chromium', results: [{ status: 'failed' }] }] }] }] });
  writeCompletedSummary(executed, 'failed-executed');
  writeJson(path.join(blocked, 'runner-state.json'), { runId: 'failed-blocked-later', mode: 'failed-only', playwrightStarted: false, blockingReason: 'Environment preflight blocked before test execution.' });
  writeJson(path.join(blocked, 'environment-preflight.json'), { ok: false, runId: 'failed-blocked-later', sourceVersion: '16.0.148', deployedVersion: '16.0.147' });
  const now = Date.now();
  fs.utimesSync(executed, new Date(now - 10000), new Date(now - 10000));
  fs.utimesSync(blocked, new Date(now), new Date(now));
  const latest = findLatestCompletedFailedOnlyDescendant({ baselineFullRunId: 'baseline-full', currentRunDir: path.join(root, 'current'), resultsRoot: root });
  assert.equal(path.basename(latest), 'failed-executed');
});

test('active release harness fixtures do not depend on retired cheers-portal duplicate host', () => {
  const scanFiles = [
    'api/release-gate-workspace-safety.test.cjs',
    'tests/86chaos-release-gate/test-account-provisioning.test.cjs',
    'tests/86chaos-release-gate/role-account-verification.test.cjs',
    'RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1',
    'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1',
  ];
  for (const file of scanFiles) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /cheers-portal-4oxv/, `${file} must not use the retired duplicate Vercel project`);
  }
});

test('blocked preflight-only delta report stays blocked and does not claim reconciliation success', () => {
  const dir = tmpDir();
  const runId = 'blocked-target-unit';
  const runDir = path.join(dir, 'test-results', '86chaos-play-store-release-gate', runId);
  writeJson(path.join(runDir, 'runner-state.json'), { runId, mode: 'failed+new', playwrightStarted: false, currentPhase: 'report-collection', blockingReason: 'Release gate blocked before dependency installation because environment/deployment preflight failed.' });
  writeJson(path.join(runDir, 'environment-preflight.json'), { ok: false, runId, appUrl: 'https://cheers-portal-4oxv-git-testing-old.vercel.app/', sourceVersion: '16.0.148', expectedVersion: '16.0.148', deployedVersion: '16.0.147', errors: ['Deployed /version.json reports 16.0.147, but CHAOS_EXPECTED_VERSION is 16.0.148. Stop now; the preview is stale.'] });
  const script = path.join(__dirname, '..', 'scripts', '86chaos-release-gate', 'collect-release-gate-report.cjs');
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, [script], { cwd: dir, env: collectorFixtureEnv(runId), encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const summaries = fs.readdirSync(runDir).filter(name => /^86chaos-play-store-release-gate-summary-.*\.json$/.test(name));
  assert.equal(summaries.length, 1, `nested collector should write exactly one summary inside its temporary run directory: ${runDir}`);
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, summaries[0]), 'utf8'));
  assert.equal(summary.outcome, 'BLOCKED BEFORE TEST EXECUTION');
  assert.equal(summary.playwright.status, 'BLOCKED BEFORE TEST EXECUTION');
  assert.equal(summary.playwright.totalResults, 0);
  assert.equal(summary.playwright.deltaReconciliation.reconciled, false);
  assert.match(summary.playwright.deltaReconciliation.reconciliationProof, /not applicable/);
});
