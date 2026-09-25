const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));

test('16.0.210 archive-only Request Off check uses the seeded date and an actual workflow row', () => {
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
  assert.match(spec, /return fixture\.currentWeekStart \|\| overCoverageDate \|\| fixture\.anchor/);
  assert.match(spec, /request-off-workflow-panel div\.font-black\.text-white\.text-sm/);
  const archiveOnlyBlock = spec.slice(spec.indexOf("test('Archive All Visible archives only filtered visible eligible requests'"));
  assert.match(archiveOnlyBlock, /openRequestOffView\(page, 'All'\)/);
  assert.doesNotMatch(archiveOnlyBlock, /openRequestOffView\(page, 'Upcoming Approved'\)/);
  assert.equal((archiveOnlyBlock.match(/waitForRequestOffEmployee\(page, 'Allen QA'/g) || []).length, 2);
  assert.match(archiveOnlyBlock, /Bulk archive should show one final summary toast/);
});

test('16.0.210 historical maturity assertions coexist with current 17.0.30 version metadata', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  const version = json('public/version.json');
  const appCore = read('src/core/appCore.js');
  const apiVersion = read('api/_version.js');
  assert.equal(pkg.version, '17.0.30');
  assert.equal(lock.version, '17.0.30');
  assert.equal(lock.packages[''].version, '17.0.30');
  assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-30.js');
  assert.equal(version.version, '17.0.30');
  assert.equal(version.build, '17.0.30');
  assert.equal(version.releaseTitle, 'Unified Feature and Release-Gate Parity Merge');
  assert.match(appCore, /CURRENT_VERSION = '17\.0\.30'/);
  assert.match(apiVersion, /APP_VERSION = '17\.0\.30'/);
  assert.match(apiVersion, /SECURITY_SCHEMA_VERSION = '17\.0\.30'/);
});
