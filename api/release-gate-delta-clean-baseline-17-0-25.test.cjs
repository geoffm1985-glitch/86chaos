'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  findMostRecentCompletedFullRun,
  generateFailedOnlyManifestFromRun,
  validateBaselineManifest,
  collectFailedEntriesFromSummary,
} = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function cleanSummary(runId = '2026-09-22T10-33-36') {
  return {
    runId,
    generatedAt: '2026-09-22T19:53:00.000Z',
    sourceVersion: '',
    deployedVersion: '',
    testedVersion: '17.0.22',
    sourceIdentity: { version: '17.0.22', sourceHash: 'a'.repeat(64), commit: '1'.repeat(40), branch: 'testing' },
    deploymentIdentityValidation: { end: { server: { version: '17.0.22' }, client: { version: '17.0.22' } } },
    playwright: {
      totalResults: 277,
      passed: 270,
      failed: 0,
      timedOut: 0,
      skipped: 7,
      unexpected: 0,
      failedTests: [],
      timedOutTests: [],
    },
  };
}

test('17.0.25 delta accepts the real 17.0.22 evidence-loss shape: clean full Playwright summary survives without raw report/preflight', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-delta-clean-baseline-'));
  const resultsRoot = path.join(root, 'test-results', '86chaos-play-store-release-gate');
  const baseline = path.join(resultsRoot, '2026-09-22T10-33-36');
  const current = path.join(resultsRoot, '2026-09-22T18-15-43');
  try {
    fs.mkdirSync(baseline, { recursive: true });
    fs.mkdirSync(current, { recursive: true });
    writeJson(path.join(baseline, 'runner-state.json'), {
      runId: '2026-09-22T10-33-36', mode: 'full', playwrightStarted: true,
      currentPhase: 'report-collection', blockingReason: '', status: 'passed', anyTestsRan: true,
      blockedBeforeTestExecution: false, finalExitCode: 0,
    });
    // Deliberately do NOT write playwright-report.json, environment-preflight.json,
    // or source-inventory.json. That is the evidence-loss shape from the 17.0.22 run.
    writeJson(path.join(baseline, 'source-identity-start.json'), { version: '17.0.22', sourceHash: 'a'.repeat(64), commit: '1'.repeat(40), branch: 'testing', dirty: false });
    writeJson(path.join(baseline, 'source-identity-end.json'), { version: '17.0.22', sourceHash: 'a'.repeat(64), commit: '1'.repeat(40), branch: 'testing', dirty: false });
    writeJson(path.join(baseline, '86chaos-play-store-release-gate-summary-17.0.22-2026-09-22T10-33-36.json'), cleanSummary());

    assert.equal(findMostRecentCompletedFullRun({ currentRunDir: current, resultsRoot }), baseline);
    const manifest = generateFailedOnlyManifestFromRun(baseline, { write: false, currentRunDir: current });
    assert.equal(manifest.ok, true);
    assert.equal(manifest.selected.length, 0, 'a clean baseline legitimately has no prior failures');
    assert.equal(manifest.baselineSourceVersion, '17.0.22');
    assert.equal(manifest.baselineDeployedVersion, '17.0.22');
    const validation = validateBaselineManifest(manifest, { currentRunDir: current });
    assert.deepEqual(validation, { ok: true, errors: [] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('17.0.25 summary-only delta recovery preserves timed-out identities instead of silently dropping them', () => {
  const summary = cleanSummary('timeout-baseline');
  summary.playwright.totalResults = 2;
  summary.playwright.passed = 1;
  summary.playwright.timedOut = 1;
  summary.playwright.unexpected = 1;
  summary.playwright.timedOutTests = [{
    title: 'e2e/example.spec.cjs > suite > timed test',
    file: 'e2e/example.spec.cjs',
    projectName: 'chromium',
    status: 'timedOut',
    duration: 30000,
    error: 'Timed out',
  }];
  const rows = collectFailedEntriesFromSummary(summary, { fullRunId: 'timeout-baseline', sourceVersion: '17.0.22', deployedVersion: '17.0.22' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].priorStatus, 'timedOut');
  assert.equal(rows[0].specPath, 'e2e/example.spec.cjs');
  assert.equal(rows[0].project, 'chromium');
});


test('17.0.25 delta command runs current-release regressions first and safely no-ops when no browser identities are selected', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const runner = fs.readFileSync(path.join(__dirname, '..', 'RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1'), 'utf8');
  const collector = fs.readFileSync(path.join(__dirname, '..', 'scripts/86chaos-release-gate/collect-release-gate-report.cjs'), 'utf8');
  const prepare = fs.readFileSync(path.join(__dirname, '..', 'scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs'), 'utf8');

  assert.match(pkg.scripts['test:play-store:delta'] || '', /^npm run test:current-release-targeted && powershell /);
  assert.match(pkg.scripts['test:current-release-targeted'] || '', /schedule-shift-delete-17-0-25\.test\.cjs/);
  assert.match(pkg.scripts['test:current-release-targeted'] || '', /release-gate-delta-clean-baseline-17-0-25\.test\.cjs/);
  assert.match(runner, /noScopedPlaywrightTestsRemain/);
  assert.match(runner, /no-scoped-playwright-tests-remain/);
  assert.match(prepare, /noFailedOrNewPlaywrightTestsRemain/);
  assert.match(collector, /noPlaywrightTestsRequired/);
  assert.match(collector, /No scoped Playwright tests required/);
});
