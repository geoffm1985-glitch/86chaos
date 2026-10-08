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
  baselineVersionsAreCompatible,
  isExplicitCompletedFailureLineage,
  hasCompletedReleaseGateEvidence,
} = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function report({ failed = 19, passed = 482, skipped = 8 } = {}) {
  const tests = [];
  for (let i = 0; i < passed; i += 1) tests.push({ title: `pass ${i}`, projectName: i % 2 ? 'mobile-chromium' : 'chromium', results: [{ status: 'passed' }] });
  for (let i = 0; i < failed; i += 1) tests.push({ title: `fail ${i}`, projectName: i % 2 ? 'mobile-chromium' : 'chromium', results: [{ status: 'failed', error: { message: `failure ${i}` } }] });
  for (let i = 0; i < skipped; i += 1) tests.push({ title: `skip ${i}`, projectName: i % 2 ? 'mobile-chromium' : 'chromium', results: [{ status: 'skipped' }] });
  return { suites: [{ title: 'saved full gate', specs: tests.map((row, i) => ({ title: row.title, file: `86chaos-release-gate/saved-${i}.spec.cjs`, tests: [row] })) }] };
}

function makeRun(resultsRoot, name, { sourceVersion = '17.0.77', deployedVersion = '17.0.76', failed = 19, firebaseTarget = 'LIVE', appUrl = 'https://testing.86chaos.com' } = {}) {
  const dir = path.join(resultsRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'runner-state.json'), {
    runId: name,
    mode: 'full',
    currentPhase: 'report-collection',
    playwrightStarted: true,
    playwrightCompleted: true,
    anyTestsRan: true,
    blockedBeforeTestExecution: false,
    blockingReason: '',
    status: 'failed',
    finalExitCode: failed > 0 ? 1 : 0,
  });
  writeJson(path.join(dir, 'environment-preflight.json'), {
    runId: name,
    sourceVersion,
    deployedVersion,
    firebaseTarget,
    firebaseProjectId: firebaseTarget === 'EMULATOR' ? 'demo-86chaos' : 'chaos-test-d1601',
    appUrl,
    sourceIdentity: { version: sourceVersion, dirty: false },
  });
  const playwright = report({ failed, passed: failed ? 482 : 501, skipped: 8 });
  writeJson(path.join(dir, 'playwright-report.json'), playwright);
  writeJson(path.join(dir, `86chaos-play-store-release-gate-summary-${sourceVersion}-${name}.json`), {
    runId: name,
    sourceVersion,
    deployedVersion,
    playwright: {
      totalResults: failed ? 509 : 509,
      passed: failed ? 482 : 501,
      failed,
      timedOut: 0,
      skipped: 8,
      unexpected: failed,
      failedTests: Array.from({ length: failed }, (_, i) => ({
        title: `86chaos-release-gate/saved-${482 + i}.spec.cjs > saved full gate > fail ${i}`,
        file: `86chaos-release-gate/saved-${482 + i}.spec.cjs`,
        projectName: i % 2 ? 'mobile-chromium' : 'chromium',
        status: 'failed',
        error: `failure ${i}`,
      })),
      timedOutTests: [],
    },
  });
  return dir;
}

test('17.0.80 preserves the completed 17.0.77/17.0.76 full run strictly as failed-test lineage when runtime-equivalence proof is unavailable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-17080-lineage-'));
  try {
    const resultsRoot = path.join(root, 'test-results', '86chaos-play-store-release-gate');
    const baseline = makeRun(resultsRoot, '2026-10-04T06-28-57');
    const current = path.join(resultsRoot, '2026-10-04T13-57-47');
    fs.mkdirSync(current, { recursive: true });

    const completed = hasCompletedReleaseGateEvidence(baseline);
    assert.equal(completed.ok, true);
    const meta = {
      sourceVersion: '17.0.77',
      deployedVersion: '17.0.76',
      preflight: { firebaseTarget: 'LIVE', firebaseProjectId: 'chaos-test-d1601', appUrl: 'https://testing.86chaos.com', sourceIdentity: { version: '17.0.77', dirty: false } },
    };
    assert.equal(baselineVersionsAreCompatible(meta), false, 'certification/runtime equivalence remains fail-closed');
    assert.equal(isExplicitCompletedFailureLineage(meta, completed), true, 'the exact completed failed lineage is still reusable');
    assert.equal(findMostRecentCompletedFullRun({ currentRunDir: current, resultsRoot }), baseline);

    const manifest = generateFailedOnlyManifestFromRun(baseline, { write: false, currentRunDir: current });
    assert.equal(manifest.lineageMode, 'full-failure-lineage');
    assert.equal(manifest.failureLineageOnly, true);
    assert.equal(manifest.selected.length, 19);
    assert.deepEqual(validateBaselineManifest(manifest, { currentRunDir: current }), { ok: true, errors: [] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('17.0.80 does not treat a mismatched clean pass as a reusable baseline', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-17080-clean-'));
  try {
    const resultsRoot = path.join(root, 'test-results', '86chaos-play-store-release-gate');
    makeRun(resultsRoot, 'clean-mismatch', { failed: 0 });
    const current = path.join(resultsRoot, 'current');
    fs.mkdirSync(current, { recursive: true });
    assert.equal(findMostRecentCompletedFullRun({ currentRunDir: current, resultsRoot }), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('17.0.80 refuses unrelated mismatched failure lineage', () => {
  const completed = { ok: true, counts: { total: 509, unexpected: 19 } };
  assert.equal(isExplicitCompletedFailureLineage({ sourceVersion: '17.0.78', deployedVersion: '17.0.76' }, completed), false);
  assert.equal(isExplicitCompletedFailureLineage({ sourceVersion: '17.0.77', deployedVersion: '17.0.75' }, completed), false);
  assert.equal(isExplicitCompletedFailureLineage({ sourceVersion: '17.0.77', deployedVersion: '17.0.76' }, { ok: true, counts: { total: 509, unexpected: 0 } }), false);
});
