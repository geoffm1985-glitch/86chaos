const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'scripts/86chaos-release-gate/reported-failed-only-20260810-015004.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rows = manifest.selected || [];
const chromiumTitles = new Set([
  'Request Off employee filter narrows and clears manager-visible requests',
  'Approve All Visible updates only filtered visible pending requests',
]);

const {
  qualifyManifestSelectionsWithCurrentInventory,
  targetQualifiedManifest,
  loadFailedOnlyManifest,
} = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

const mobileTitles = new Set([
  'Schedule Builder requested-off warning shows employee name and never Someone',
  'Request Off employee filter narrows and clears manager-visible requests',
  'Approve All Visible updates only filtered visible pending requests',
  'Archive All Visible archives only filtered visible eligible requests',
]);

function projectRows(project) {
  return rows.filter(row => row.project === project || row.projects?.includes(project));
}

test('reported failed-only manifest selects exactly the six current FAIL identities', () => {
  assert.equal(manifest.mode, 'reported-failed-only');
  assert.equal(manifest.source, 'uploaded-failed-tests-20260810-015004');
  assert.equal(manifest.selectionSource, 'uploaded-failed-tests-20260810-015004');
  assert.equal(rows.length, 6);
  assert.equal(projectRows('chromium').length, 2);
  assert.equal(projectRows('mobile-chromium').length, 4);
  assert.deepEqual([...new Set(rows.map(row => row.project))].sort(), ['chromium', 'mobile-chromium']);
  assert.equal(manifest.previousFailuresSelected, 6);
  assert.equal(manifest.previousTimeoutsSelected, 0);
  assert.equal(manifest.currentReleaseFeatureTestsSelected, 0);
  assert.equal(manifest.newTestsCount, 0);
  assert.ok(rows.every(row => row.priorStatus === 'failed'));
  assert.ok(rows.every(row => row.baselineStatus === 'failed'));
  assert.equal(new Set(rows.map(row => row.stableKey)).size, rows.length);
});

test('reported failed-only manifest excludes timeout, current-release, and sibling passed selections', () => {
  assert.equal(rows.some(row => /timedout|timeout/i.test(String(row.priorStatus || row.baselineStatus || ''))), false);
  assert.equal(rows.some(row => row.selectionReasons?.some(reason => /previous_timeout|current_release_feature_test|new_test|repair/i.test(String(reason)))), false);
  assert.equal(rows.some(row => /86chaos-full-audit\/06-request-off-events-integration\.spec\.cjs/.test(row.specPath || row.spec || '')), false);
  assert.equal(rows.some(row => /e2e\/cost-regression\.spec\.cjs/.test(row.specPath || row.spec || '')), false);
});

test('reported failed-only manifest contains the exact chromium and mobile chromium fail sets', () => {
  assert.deepEqual(new Set(projectRows('chromium').map(row => row.leafTitle)), chromiumTitles);
  assert.deepEqual(new Set(projectRows('mobile-chromium').map(row => row.leafTitle)), mobileTitles);
  assert.ok(rows.every(row => row.specPath === 'e2e/schedule-request-off-management.spec.cjs'));
  assert.equal(rows.some(row => /authenticated-release|chunk-recovery/.test(row.specPath || '')), false);
  assert.ok(rows.some(row => row.project === 'mobile-chromium' && row.specPath === 'e2e/schedule-request-off-management.spec.cjs' && row.leafTitle === 'Archive All Visible archives only filtered visible eligible requests'));
});



test('reported failed-only manifest excludes the four identities that passed in 20260810-015004', () => {
  const selectedKeys = new Set(rows.map(row => `${row.specPath}\u0000${row.fullSuitePath || ''}\u0000${row.leafTitle}\u0000${row.project}`));
  assert.equal([...selectedKeys].some(key => /authenticated-release\.spec\.cjs.*direct navigation follows the canonical denied-route matrix/.test(key)), false);
  assert.equal([...selectedKeys].some(key => /chunk-recovery\.spec\.cjs.*lazy chunk failure reports once/.test(key)), false);
});

test('reported failed-current npm command uses the strict reported failed-only mode', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts['test:play-store:failed-current'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1 -SelectionMode reported-failed-only'
  );
  const runner = fs.readFileSync(path.join(root, 'RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1'), 'utf8');
  assert.match(runner, /ValidateSet\('failed\+new','failed-only','repair','reported-failed-only','partial-resume'\)/);
});


test('reported failed-only baseline status survives inventory qualification, targeting, and reload', () => {
  const currentRecords = rows.map(row => ({
    specPath: row.specPath || row.spec,
    spec: row.specPath || row.spec,
    exactTestTitle: row.exactTestTitle || row.leafTitle || row.title,
    leafTitle: row.leafTitle || row.exactTestTitle || row.title,
    title: row.title || row.exactTestTitle || row.leafTitle,
    fullSuitePath: row.fullSuitePath || '',
    suitePathParts: row.suitePathParts || [],
    titlePathParts: row.titlePathParts || [],
    fullTitle: row.fullTitle || '',
    stableKey: row.stableKey || '',
    project: row.project,
    projects: row.projects,
    sourceFileHash: row.sourceFileHash || `unit-source-hash-${row.project}-${row.leafTitle || row.title}`,
  }));

  assert.equal(currentRecords.some(row => Object.prototype.hasOwnProperty.call(row, 'baselineStatus')), false);

  const qualified = qualifyManifestSelectionsWithCurrentInventory(manifest, { currentRecords });
  assert.equal(qualified.selected.length, 6);
  assert.ok(qualified.selected.every(row => row.baselineStatus === 'failed'));
  assert.ok(qualified.selected.every(row => row.priorStatus === 'failed'));

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-failed-only-baseline-status-'));
  try {
    const targeted = targetQualifiedManifest(qualified, {
      targetRunId: 'unit-test-run',
      targetRunDir: tempDir,
      targetSourceVersion: '16.0.167',
      targetDeployedVersion: '16.0.167',
    });
    assert.equal(targeted.selected.length, 6);
    assert.ok(targeted.selected.every(row => row.baselineStatus === 'failed'));

    const tempManifestPath = path.join(tempDir, 'failed-only-test-manifest.json');
    fs.writeFileSync(tempManifestPath, JSON.stringify(targeted, null, 2));
    const loaded = loadFailedOnlyManifest(tempManifestPath);
    assert.equal(loaded.ok, true, loaded.errors?.join('\n') || 'manifest should load');
    assert.equal(loaded.selected.length, 6);
    assert.ok(loaded.selected.every(row => row.baselineStatus === 'failed'));
    assert.ok(loaded.selected.every(row => row.priorStatus === 'failed'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
