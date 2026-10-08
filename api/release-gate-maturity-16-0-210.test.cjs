const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const { assertCurrentReleaseIdentity } = require('./_current-release-identity.cjs');

test('16.0.210 archive-only Request Off check uses the seeded date and an actual workflow row', () => {
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
  const anchorHelper = read('tests/e2e/utils/schedule-request-off-fixture-anchor.cjs');
  assert.match(anchorHelper, /return fixture\.currentWeekStart \|\| overCoverageDate \|\| fixture\.anchor/);
  assert.match(spec, /scheduleFixtureDateFromSeed/);
  assert.match(spec, /fixtureDateOverride \|\| scheduleFixtureDateFromSeed\(seed\)/);
  assert.match(spec, /request-off-workflow-panel div\.font-black\.text-white\.text-sm/);
  const archiveOnlyBlock = spec.slice(spec.indexOf("test('Archive All Visible archives only filtered visible eligible requests'"));
  assert.match(archiveOnlyBlock, /openRequestOffView\(page, 'All'\)/);
  assert.doesNotMatch(archiveOnlyBlock, /openRequestOffView\(page, 'Upcoming Approved'\)/);
  assert.equal((archiveOnlyBlock.match(/waitForRequestOffEmployee\(page, 'Allen QA'/g) || []).length, 2);
  assert.match(archiveOnlyBlock, /Bulk archive should show one final summary toast/);
});

test('16.0.210 historical maturity assertions coexist with advancing current release identity', () => {
  assert.equal(assertCurrentReleaseIdentity(root), require('../package.json').version);
});
