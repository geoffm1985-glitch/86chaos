'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { countPlaywrightResults } = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

test('locator assertion timeouts remain failed Playwright results, not test timeouts', () => {
  const report = { suites: [{ specs: [{ file: 'x.spec.cjs', tests: [] }] }] };
  for (let i = 0; i < 126; i += 1) report.suites[0].specs[0].tests.push({ title: `pass ${i}`, projectName: 'chromium', results: [{ status: 'passed', duration: 1 }] });
  for (let i = 0; i < 3; i += 1) report.suites[0].specs[0].tests.push({ title: `fail ${i}`, projectName: 'chromium', results: [{ status: 'failed', duration: 10, error: { message: i < 2 ? 'expect(locator).toBeVisible timeout 15000ms' : 'regular assertion failure' } }] });
  const counts = countPlaywrightResults(report);
  assert.deepEqual(counts, { total: 129, passed: 126, failed: 3, timedOut: 0, skipped: 0, unexpected: 3 });
});
