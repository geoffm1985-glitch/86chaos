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
} = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function playwrightReport() {
  const tests = [];
  for (let i = 0; i < 482; i += 1) {
    tests.push({ title: `passed ${i}`, projectName: i % 2 ? 'mobile-chromium' : 'chromium', results: [{ status: 'passed', duration: 2 }] });
  }
  for (let i = 0; i < 19; i += 1) {
    tests.push({ title: `failed ${i}`, projectName: i % 2 ? 'mobile-chromium' : 'chromium', results: [{ status: 'failed', duration: 12, error: { message: `expected failure ${i}` } }] });
  }
  for (let i = 0; i < 8; i += 1) {
    tests.push({ title: `expected skip ${i}`, projectName: i % 2 ? 'mobile-chromium' : 'chromium', results: [{ status: 'skipped', duration: 0 }] });
  }
  return {
    suites: [{
      title: 'release',
      suites: [],
      specs: tests.map((row, index) => ({
        title: row.title,
        file: `86chaos-release-gate/exact-baseline-${index}.spec.cjs`,
        tests: [row],
      })),
    }],
  };
}

function createRun(resultsRoot, name, {
  sourceVersion = '17.0.77',
  deployedVersion = '17.0.76',
  firebaseTarget = 'EMULATOR',
  firebaseProjectId = 'demo-86chaos',
  appUrl = 'http://127.0.0.1:3000',
} = {}) {
  const dir = path.join(resultsRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'runner-state.json'), {
    runId: name,
    mode: 'full',
    playwrightStarted: true,
    playwrightCompleted: true,
    currentPhase: 'report-collection',
    blockingReason: '',
    status: 'failed',
    anyTestsRan: true,
    blockedBeforeTestExecution: false,
    finalExitCode: 1,
  });
  writeJson(path.join(dir, 'environment-preflight.json'), {
    ok: true,
    runId: name,
    sourceVersion,
    deployedVersion,
    firebaseTarget,
    firebaseProjectId,
    appUrl,
    sourceIdentity: { version: sourceVersion, dirty: false },
  });
  writeJson(path.join(dir, 'playwright-report.json'), playwrightReport());
  writeJson(path.join(dir, `86chaos-play-store-release-gate-summary-${sourceVersion}-${name}.json`), {
    runId: name,
    generatedAt: '2026-10-04T12:00:00.000Z',
    sourceVersion,
    deployedVersion,
    firebaseProjectId,
    appUrl,
    playwright: {
      totalResults: 509,
      passed: 482,
      failed: 19,
      timedOut: 0,
      skipped: 8,
      unexpected: 19,
      failedTests: Array.from({ length: 19 }, (_, i) => ({
        title: `86chaos-release-gate/exact-baseline-${482 + i}.spec.cjs > release > failed ${i}`,
        file: `86chaos-release-gate/exact-baseline-${482 + i}.spec.cjs`,
        projectName: i % 2 ? 'mobile-chromium' : 'chromium',
        status: 'failed',
        duration: 12,
        error: `expected failure ${i}`,
      })),
      timedOutTests: [],
    },
  });
  return dir;
}

test('17.0.79 accepts only the explicit 17.0.77 to 17.0.76 runtime-equivalent managed-emulator baseline', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-17079-baseline-'));
  try {
    const resultsRoot = path.join(root, 'test-results', '86chaos-play-store-release-gate');
    const baseline = createRun(resultsRoot, '2026-10-04T06-28-57');
    const current = path.join(resultsRoot, '2026-10-04T12-54-18');
    fs.mkdirSync(current, { recursive: true });

    assert.equal(findMostRecentCompletedFullRun({ currentRunDir: current, resultsRoot }), baseline);
    const manifest = generateFailedOnlyManifestFromRun(baseline, { write: false, currentRunDir: current });
    assert.equal(manifest.baselineSourceVersion, '17.0.77');
    assert.equal(manifest.baselineDeployedVersion, '17.0.76');
    assert.equal(manifest.selected.length, 19, 'the saved 509-result run contributes its 19 failures');
    assert.deepEqual(validateBaselineManifest(manifest, { currentRunDir: current }), { ok: true, errors: [] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('17.0.79 keeps mismatched live and unapproved emulator baselines fail-closed', () => {
  assert.equal(baselineVersionsAreCompatible({
    sourceVersion: '17.0.77', deployedVersion: '17.0.76',
    preflight: { firebaseTarget: 'LIVE', firebaseProjectId: 'chaos-test-d1601', appUrl: 'https://testing.86chaos.com', sourceIdentity: { version: '17.0.77', dirty: false } },
  }), false);
  assert.equal(baselineVersionsAreCompatible({
    sourceVersion: '17.0.78', deployedVersion: '17.0.76',
    preflight: { firebaseTarget: 'EMULATOR', firebaseProjectId: 'demo-86chaos', appUrl: 'http://127.0.0.1:3000', sourceIdentity: { version: '17.0.78', dirty: false } },
  }), false);
  assert.equal(baselineVersionsAreCompatible({
    sourceVersion: '17.0.77', deployedVersion: '17.0.76',
    preflight: { firebaseTarget: 'EMULATOR', firebaseProjectId: 'demo-86chaos', appUrl: 'http://203.0.113.10:3000', sourceIdentity: { version: '17.0.77', dirty: false } },
  }), false);
});

test('17.0.79 preserves exact-version full baseline behavior', () => {
  assert.equal(baselineVersionsAreCompatible({ sourceVersion: '17.0.78', deployedVersion: '17.0.78', preflight: {} }), true);
});
