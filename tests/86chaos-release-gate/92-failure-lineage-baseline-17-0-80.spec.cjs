const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  findMostRecentCompletedFullRun,
  generateFailedOnlyManifestFromRun,
} = require('../../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

test.describe('17.0.80 failed full-gate lineage recovery', () => {
  test('failed+new preserves the exact saved 17.0.77 full failures without treating the mismatched run as certification parity', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-17080-pw-'));
    try {
      const resultsRoot = path.join(root, 'test-results', '86chaos-play-store-release-gate');
      const baseline = path.join(resultsRoot, '2026-10-04T06-28-57');
      const current = path.join(resultsRoot, 'current');
      fs.mkdirSync(current, { recursive: true });
      writeJson(path.join(baseline, 'runner-state.json'), { runId: '2026-10-04T06-28-57', mode: 'full', currentPhase: 'report-collection', playwrightStarted: true, playwrightCompleted: true, anyTestsRan: true, blockedBeforeTestExecution: false, blockingReason: '', status: 'failed', finalExitCode: 1 });
      writeJson(path.join(baseline, 'environment-preflight.json'), { sourceVersion: '17.0.77', deployedVersion: '17.0.76', firebaseTarget: 'LIVE', firebaseProjectId: 'chaos-test-d1601', appUrl: 'https://testing.86chaos.com', sourceIdentity: { version: '17.0.77', dirty: false } });
      writeJson(path.join(baseline, 'playwright-report.json'), { suites: [{ title: 'full', specs: [{ title: 'saved failure', file: '86chaos-release-gate/saved.spec.cjs', tests: [{ title: 'saved failure', projectName: 'chromium', results: [{ status: 'failed', error: { message: 'saved failure' } }] }] }] }] });
      writeJson(path.join(baseline, '86chaos-play-store-release-gate-summary-17.0.77.json'), { runId: '2026-10-04T06-28-57', sourceVersion: '17.0.77', deployedVersion: '17.0.76', playwright: { totalResults: 1, passed: 0, failed: 1, timedOut: 0, skipped: 0, unexpected: 1, failedTests: [{ title: '86chaos-release-gate/saved.spec.cjs > full > saved failure', file: '86chaos-release-gate/saved.spec.cjs', projectName: 'chromium', status: 'failed' }], timedOutTests: [] } });

      expect(findMostRecentCompletedFullRun({ currentRunDir: current, resultsRoot })).toBe(baseline);
      const manifest = generateFailedOnlyManifestFromRun(baseline, { write: false, currentRunDir: current });
      expect(manifest.lineageMode).toBe('full-failure-lineage');
      expect(manifest.selected).toHaveLength(1);
      expect(manifest.selected[0].title).toBe('saved failure');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
