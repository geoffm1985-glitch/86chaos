'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.83 Request Off maturity refactor certification repair', () => {
  test('historical maturity contract follows the extracted seeded-date helper instead of requiring inline implementation', async () => {
    const maturity = read('api/release-gate-maturity-16-0-210.test.cjs');
    const helper = read('tests/e2e/utils/schedule-request-off-fixture-anchor.cjs');
    const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');

    expect(maturity).toContain("const anchorHelper = read('tests/e2e/utils/schedule-request-off-fixture-anchor.cjs');");
    expect(maturity).not.toContain('assert.match(spec, /return fixture\\.currentWeekStart');
    expect(helper).toContain('return fixture.currentWeekStart || overCoverageDate || fixture.anchor');
    expect(spec).toContain('fixtureDateOverride || scheduleFixtureDateFromSeed(seed)');
  });

  test('archive-only Request Off evidence still binds to the actual Allen QA workflow rows', async () => {
    const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
    const block = spec.slice(spec.indexOf("test('Archive All Visible archives only filtered visible eligible requests'"));
    expect(block).toContain("openRequestOffView(page, 'All')");
    expect(block).not.toContain("openRequestOffView(page, 'Upcoming Approved')");
    expect((block.match(/waitForRequestOffEmployee\(page, 'Allen QA'/g) || []).length).toBe(2);
    expect(block).toContain('Bulk archive should show one final summary toast');
  });
});