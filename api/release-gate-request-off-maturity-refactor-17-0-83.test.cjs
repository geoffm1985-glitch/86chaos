'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('17.0.83 historical 16.0.210 maturity check follows the extracted Request Off anchor helper', () => {
  const maturity = read('api/release-gate-maturity-16-0-210.test.cjs');
  const helper = read('tests/e2e/utils/schedule-request-off-fixture-anchor.cjs');
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');

  assert.match(maturity, /const anchorHelper = read\('tests\/e2e\/utils\/schedule-request-off-fixture-anchor\.cjs'\)/);
  assert.match(maturity, /assert\.match\(anchorHelper, \/return fixture\\\.currentWeekStart/);
  assert.doesNotMatch(maturity, /assert\.match\(spec, \/return fixture\\\.currentWeekStart/);
  assert.match(helper, /return fixture\.currentWeekStart \|\| overCoverageDate \|\| fixture\.anchor/);
  assert.match(spec, /scheduleFixtureDateFromSeed/);
  assert.match(spec, /fixtureDateOverride \|\| scheduleFixtureDateFromSeed\(seed\)/);
});

test('17.0.83 archive-only maturity evidence remains attached to the real Request Off workflow row', () => {
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
  const archiveOnlyBlock = spec.slice(spec.indexOf("test('Archive All Visible archives only filtered visible eligible requests'"));
  assert.ok(archiveOnlyBlock.length > 0, 'Archive All Visible test remains present');
  assert.match(archiveOnlyBlock, /openRequestOffView\(page, 'All'\)/);
  assert.doesNotMatch(archiveOnlyBlock, /openRequestOffView\(page, 'Upcoming Approved'\)/);
  assert.equal((archiveOnlyBlock.match(/waitForRequestOffEmployee\(page, 'Allen QA'/g) || []).length, 2);
  assert.match(archiveOnlyBlock, /Bulk archive should show one final summary toast/);
});