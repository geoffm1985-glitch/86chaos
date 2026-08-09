const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'scripts/86chaos-release-gate/reported-failed-only-20260809-004632.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rows = manifest.selected || [];
const runtimeTitle = 'Schedule Builder warning runtime renders without Runtime Recovery or TypeError';
const expectedTitles = [
  'Request Off employee filter narrows and clears manager-visible requests',
  'Approve All Visible updates only filtered visible pending requests',
  'Archive All Visible archives only filtered visible eligible requests',
];
const excludedPassingTitles = [
  runtimeTitle,
  'Schedule Builder requested-off warning shows employee name and never Someone',
  'Schedule Builder coverage warnings show under and over target math',
  'Schedule Builder warning dismissal hides only the warning',
];

test('reported failed-only manifest selects exactly the six current uploaded failures', () => {
  assert.equal(manifest.mode, 'reported-failed-only');
  assert.equal(rows.length, 6);
  assert.equal(rows.filter(row => row.project === 'chromium').length, 3);
  assert.equal(rows.filter(row => row.project === 'mobile-chromium').length, 3);
  assert.deepEqual([...new Set(rows.map(row => row.project))].sort(), ['chromium', 'mobile-chromium']);
  assert.ok(rows.every(row => row.specPath === 'e2e/schedule-request-off-management.spec.cjs'));
  assert.ok(rows.every(row => row.fullSuitePath === '16.0.153 Schedule warnings and Request Off management'));
  assert.ok(rows.every(row => row.selectionReasons?.includes('uploaded_current_failed_report_failure')));
});

test('reported failed-only manifest excludes already-passing runtime/passing Schedule tests and unrelated current-release scope', () => {
  for (const title of excludedPassingTitles) assert.equal(rows.some(row => row.leafTitle === title), false, `${title} should not be selected`);
  assert.equal(rows.some(row => row.selectionReasons?.includes('current_release_feature_test')), false);
  for (const title of expectedTitles) {
    assert.equal(rows.filter(row => row.leafTitle === title).length, 2, `${title} should appear once per project`);
  }
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
