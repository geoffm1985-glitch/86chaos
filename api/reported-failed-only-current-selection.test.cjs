const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'scripts/86chaos-release-gate/reported-failed-only-20260809-233053.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rows = manifest.selected || [];
const chromiumTitles = new Set([
  'direct navigation follows the canonical denied-route matrix',
  'lazy chunk failure reports once, avoids a reload loop, and recovers without losing auth',
  'Request Off employee filter narrows and clears manager-visible requests',
  'Approve All Visible updates only filtered visible pending requests',
]);
const mobileTitles = new Set([
  'direct navigation follows the canonical denied-route matrix',
  'lazy chunk failure reports once, avoids a reload loop, and recovers without losing auth',
  'Schedule Builder requested-off warning shows employee name and never Someone',
  'Request Off employee filter narrows and clears manager-visible requests',
  'Approve All Visible updates only filtered visible pending requests',
  'Archive All Visible archives only filtered visible eligible requests',
]);

function projectRows(project) {
  return rows.filter(row => row.project === project || row.projects?.includes(project));
}

test('reported failed-only manifest selects exactly the ten current FAIL identities', () => {
  assert.equal(manifest.mode, 'reported-failed-only');
  assert.equal(manifest.source, 'uploaded-failed-tests-20260809-233053');
  assert.equal(manifest.selectionSource, 'uploaded-failed-tests-20260809-233053');
  assert.equal(rows.length, 10);
  assert.equal(projectRows('chromium').length, 4);
  assert.equal(projectRows('mobile-chromium').length, 6);
  assert.deepEqual([...new Set(rows.map(row => row.project))].sort(), ['chromium', 'mobile-chromium']);
  assert.equal(manifest.previousFailuresSelected, 10);
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
  assert.ok(rows.some(row => row.project === 'chromium' && row.specPath === 'e2e/authenticated-release.spec.cjs' && row.fullSuitePath === 'manager authenticated release surfaces'));
  assert.ok(rows.some(row => row.project === 'mobile-chromium' && row.specPath === 'e2e/schedule-request-off-management.spec.cjs' && row.leafTitle === 'Archive All Visible archives only filtered visible eligible requests'));
});

test('reported failed-current npm command uses the strict reported failed-only mode', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts['test:play-store:failed-current'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1 -SelectionMode reported-failed-only'
  );
  const runner = fs.readFileSync(path.join(root, 'RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1'), 'utf8');
  assert.match(runner, /ValidateSet\('failed\+new','failed-only','repair','reported-failed-only'\)/);
});
