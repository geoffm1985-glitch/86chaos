'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  selectFailedOnlyManifestForCurrentRun,
  inventoryFromPlaywrightReport,
  generateFailedOnlyManifestFromRun,
  targetQualifiedManifest,
  hasCompletedReleaseGateEvidence,
  selectionKey,
} = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const {
  buildRepairSelection,
  resolveCurrentReleaseRepairScope,
} = require('../scripts/86chaos-release-gate/current-release-repair-scope.cjs');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-153-selection-'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function makeRow(index, status = 'passed', overrides = {}) {
  const project = overrides.project || (index % 2 === 0 ? 'chromium' : 'mobile-chromium');
  const fullSuitePath = overrides.fullSuitePath || `release fixture group ${Math.floor(index / 10)}`;
  const title = overrides.title || `release fixture test ${String(index).padStart(3, '0')}`;
  const specPath = overrides.specPath || `e2e/fixture-${Math.floor(index / 20)}.spec.cjs`;
  return {
    specPath,
    file: specPath,
    fullSuitePath,
    title,
    exactTestTitle: title,
    leafTitle: title,
    project,
    status,
    stableKey: `${specPath}\u0000${fullSuitePath}\u0000${title}\u0000${project}`,
  };
}

function reportFromRows(rows = []) {
  const suiteMap = new Map();
  for (const row of rows) {
    const suiteKey = row.fullSuitePath || 'release fixture';
    if (!suiteMap.has(suiteKey)) suiteMap.set(suiteKey, []);
    suiteMap.get(suiteKey).push(row);
  }
  return {
    suites: Array.from(suiteMap.entries()).map(([title, suiteRows]) => ({
      title,
      specs: suiteRows.map((row, index) => ({
        title: row.title,
        file: row.specPath || row.file,
        tests: [{
          title: row.title,
          projectName: row.project,
          results: [{ status: row.status, duration: 100 + index, error: ['passed', 'skipped'].includes(row.status) ? undefined : { message: `${row.status} ${row.title}` } }],
        }],
      })),
    })),
  };
}

function writeCompletedRun(resultsRoot, runId, { mode = 'full', rows = [], sourceVersion = '16.0.152', deployedVersion = '16.0.152', summary = true, phase = 'report-collection', blockingReason = '' } = {}) {
  const dir = path.join(resultsRoot, runId);
  const report = reportFromRows(rows);
  writeJson(path.join(dir, 'runner-state.json'), { runId, mode, playwrightStarted: true, currentPhase: phase, blockingReason });
  writeJson(path.join(dir, 'environment-preflight.json'), { runId, sourceVersion, deployedVersion, visibleVersion: deployedVersion, firebaseProjectId: 'chaos-test-d1601' });
  writeJson(path.join(dir, 'playwright-report.json'), report);
  if (summary) writeJson(path.join(dir, `86chaos-play-store-release-gate-summary-${runId}.json`), { runId, sourceVersion, deployedVersion, firebaseProjectId: 'chaos-test-d1601', playwright: { totalResults: rows.length } });
  return { dir, report };
}

function touch(dir, offsetMs) {
  const time = new Date(Date.now() + offsetMs);
  fs.utimesSync(dir, time, time);
}

function makeCurrentRun(resultsRoot, runId = 'current') {
  const dir = path.join(resultsRoot, runId);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'runner-state.json'), { runId, mode: 'failed-only', playwrightStarted: false, currentPhase: 'created' });
  return dir;
}

test('strict failed-only selects failed and timedOut identities only, never passed or historical new_test rows', () => {
  const resultsRoot = tempRoot();
  const rows = [
    ...Array.from({ length: 150 }, (_, index) => makeRow(index, 'passed')),
    ...Array.from({ length: 5 }, (_, index) => makeRow(150 + index, 'failed')),
    ...Array.from({ length: 2 }, (_, index) => makeRow(155 + index, 'timedOut')),
  ];
  const { report } = writeCompletedRun(resultsRoot, 'run-a-full', { rows });
  const currentRunDir = makeCurrentRun(resultsRoot, 'run-b-current');
  touch(path.join(resultsRoot, 'run-a-full'), -1000);
  touch(currentRunDir, 1000);

  const selected = selectFailedOnlyManifestForCurrentRun({
    currentRunDir,
    resultsRoot,
    includeNewInventory: false,
    currentRecords: inventoryFromPlaywrightReport(report),
  });
  assert.equal(selected.manifest.selected.length, 7);
  assert.equal(selected.manifest.totalSelected, 7);
  assert.equal(selected.manifest.newTestsCount, 0);
  assert.equal(selected.manifest.previousFailuresCount, 5);
  assert.equal(selected.manifest.previousTimeoutsCount, 2);
  assert.ok(selected.manifest.selected.every(row => ['failed', 'timedOut'].includes(row.priorStatus)));
  assert.ok(selected.manifest.selected.every(row => !(row.selectionReasons || []).includes('new_test')));
});

test('passed failures disappear after newest completed failed-only descendant narrows lineage', () => {
  const resultsRoot = tempRoot();
  const baselineRows = Array.from({ length: 7 }, (_, index) => makeRow(index, index === 6 ? 'timedOut' : 'failed'));
  const { dir: fullDir, report } = writeCompletedRun(resultsRoot, 'run-a-full', { rows: baselineRows });
  const baselineManifest = generateFailedOnlyManifestFromRun(fullDir, { write: false, validateBaseline: false });
  const targetManifest = targetQualifiedManifest(baselineManifest, { targetRunId: 'run-b-failed-only', targetRunDir: path.join(resultsRoot, 'run-b-failed-only'), targetSourceVersion: '16.0.152', targetDeployedVersion: '16.0.152' });
  const retryRows = baselineRows.map((row, index) => ({ ...row, status: index === 6 ? 'failed' : 'passed' }));
  const { dir: retryDir } = writeCompletedRun(resultsRoot, 'run-b-failed-only', { mode: 'failed-only', rows: retryRows });
  writeJson(path.join(retryDir, 'failed-only-test-manifest.json'), targetManifest);
  const currentRunDir = makeCurrentRun(resultsRoot, 'run-c-current');
  touch(fullDir, -3000);
  touch(retryDir, -1000);
  touch(currentRunDir, 1000);

  const selected = selectFailedOnlyManifestForCurrentRun({
    currentRunDir,
    resultsRoot,
    includeNewInventory: false,
    currentRecords: inventoryFromPlaywrightReport(report),
  });
  assert.equal(selected.manifest.selected.length, 1);
  assert.equal(selected.manifest.selected[0].title, baselineRows[6].title);
});

test('canceled or incomplete newest run is ignored as failed-only lineage evidence', () => {
  const resultsRoot = tempRoot();
  const completedRows = Array.from({ length: 6 }, (_, index) => makeRow(index, 'failed'));
  const { dir: runA, report } = writeCompletedRun(resultsRoot, 'run-a-completed', { rows: completedRows });
  const runB = path.join(resultsRoot, 'run-b-canceled');
  writeJson(path.join(runB, 'runner-state.json'), { runId: 'run-b-canceled', mode: 'full', playwrightStarted: true, currentPhase: 'playwright' });
  writeJson(path.join(runB, 'playwright-report.json'), reportFromRows(Array.from({ length: 25 }, (_, index) => makeRow(100 + index, 'failed'))));
  const currentRunDir = makeCurrentRun(resultsRoot, 'run-c-current');
  touch(runA, -3000);
  touch(runB, -1000);
  touch(currentRunDir, 1000);

  assert.equal(hasCompletedReleaseGateEvidence(runB).ok, false);
  const selected = selectFailedOnlyManifestForCurrentRun({
    currentRunDir,
    resultsRoot,
    includeNewInventory: false,
    currentRecords: inventoryFromPlaywrightReport(report),
  });
  assert.equal(path.basename(selected.baselineFullRunDir), 'run-a-completed');
  assert.equal(selected.manifest.selected.length, 6);
});

test('repair selection equals strict failed-only union explicit current release scope with duplicates removed', () => {
  const unrelatedFailures = Array.from({ length: 4 }, (_, index) => makeRow(index, 'failed'));
  const featureRows = Array.from({ length: 8 }, (_, index) => makeRow(100 + index, 'failed', { specPath: 'e2e/schedule-request-off-management.spec.cjs', fullSuitePath: '16.0.153 Schedule warnings and Request Off management', title: `feature ${index}` }));
  const failedSelected = [...unrelatedFailures, featureRows[0], featureRows[1]];
  const repair = buildRepairSelection({ failedOnlySelected: failedSelected, currentReleaseSelected: featureRows });
  assert.equal(repair.previousFailuresSelected, 6);
  assert.equal(repair.previousTimeoutsSelected, 0);
  assert.equal(repair.currentReleaseFeatureTestsSelected, 8);
  assert.equal(repair.duplicateIdentitiesRemoved, 2);
  assert.equal(repair.totalSelected, 12);
});

test('repair scope does not add unrelated historically new inventory rows', () => {
  const explicit = [{
    specPath: 'e2e/schedule-request-off-management.spec.cjs',
    fullSuitePath: '16.0.153 Schedule warnings and Request Off management',
    exactTestTitle: 'Schedule Builder requested-off warning shows employee name and never Someone',
    project: 'chromium',
  }];
  const currentRecords = [
    { ...explicit[0], title: explicit[0].exactTestTitle, leafTitle: explicit[0].exactTestTitle, stableKey: `${explicit[0].specPath}\u0000${explicit[0].fullSuitePath}\u0000${explicit[0].exactTestTitle}\u0000${explicit[0].project}` },
    makeRow(999, 'passed', { specPath: 'e2e/unrelated-new.spec.cjs', fullSuitePath: 'unrelated new suite', title: 'unrelated historically new test', project: 'chromium' }),
  ];
  const resolved = resolveCurrentReleaseRepairScope({ currentRecords, explicitScope: explicit });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.selected.length, 1);
  assert.equal(resolved.selected[0].exactTestTitle, explicit[0].exactTestTitle);
});

test('exact schema-v3 identity keeps same leaf titles under different suites separate', () => {
  const sameLeafOwner = makeRow(1, 'failed', { specPath: 'e2e/authenticated-release.spec.cjs', fullSuitePath: 'owner authenticated release surfaces', title: 'opens every permitted primary surface without runtime or layout failure', project: 'chromium' });
  const sameLeafStaff = makeRow(2, 'failed', { specPath: 'e2e/authenticated-release.spec.cjs', fullSuitePath: 'staff authenticated release surfaces', title: 'opens every permitted primary surface without runtime or layout failure', project: 'chromium' });
  const repair = buildRepairSelection({ failedOnlySelected: [sameLeafOwner, sameLeafStaff], currentReleaseSelected: [] });
  assert.equal(repair.totalSelected, 2);
  assert.notEqual(selectionKey(repair.selected[0]), selectionKey(repair.selected[1]));
});
