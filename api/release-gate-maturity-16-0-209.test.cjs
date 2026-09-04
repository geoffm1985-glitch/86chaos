const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));

test('16.0.209 Request Off Warnings helper targets the current tab semantics before stale button fallback', () => {
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
  assert.match(spec, /getByRole\('tab', \{ name: \/\^Warnings\$\/i \}\)/);
  assert.match(spec, /Warnings tool control should use the current accessible tab\/button name/);
  assert.match(spec, /Warnings panel should open after activating the current Warnings control/);
});

test('16.0.209 bulk Request Off eligibility accepts visible legacy rows without workspace metadata but rejects explicit wrong-workspace rows', () => {
  const helper = read('src/core/scheduleWarningControls.shared.js');
  assert.match(helper, /if \(workspaceId && requestWorkspace && requestWorkspace !== workspaceId\) return false;/);
  const coverage = read('api/schedule-warning-request-off-controls.test.cjs');
  assert.match(coverage, /isRequestOffBulkEligible\(\{ id: 'req-visible', status: 'pending' \}/);
  assert.match(coverage, /req-other-workspace/);
});

test('16.0.209 historical maturity assertions coexist with current 16.0.226 version metadata', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  const version = json('public/version.json');
  const appCore = read('src/core/appCore.js');
  const apiVersion = read('api/_version.js');
  assert.equal(pkg.version, '16.0.226');
  assert.equal(lock.version, '16.0.226');
  assert.equal(lock.packages[''].version, '16.0.226');
  assert.equal(pkg.scripts['test:source'], 'node scripts/validate-16-0-226.js');
  assert.equal(version.version, '16.0.226');
  assert.equal(version.build, '16.0.226');
  assert.equal(version.releaseTitle, 'Request Off Bulk Archive Determinism Repair');
  assert.match(appCore, /CURRENT_VERSION = '16\.0\.226'/);
  assert.match(apiVersion, /APP_VERSION = '16\.0\.226'/);
});
