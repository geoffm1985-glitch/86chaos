'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.83 independent Request Off maturity refactor regression', () => {
  test('release discovery and targeted delta keep the exact 17.0.83 regression mandatory', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/95-request-off-maturity-refactor-17-0-83.spec.cjs');

    const workflow = read('.github/workflows/testing-targeted-delta.yml');
    expect(workflow).toContain('tests/86chaos-release-gate/95-request-off-maturity-refactor-17-0-83.spec.cjs');
    expect(workflow).toContain('tests/e2e/request-off-maturity-refactor-17-0-83.spec.cjs');
  });

  test('the 16.0.210 check verifies helper behavior and live spec wiring at their current locations', async () => {
    const maturity = read('api/release-gate-maturity-16-0-210.test.cjs');
    const helper = read('tests/e2e/utils/schedule-request-off-fixture-anchor.cjs');
    const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');

    expect(maturity).toContain("const anchorHelper = read('tests/e2e/utils/schedule-request-off-fixture-anchor.cjs');");
    expect(helper).toContain('return fixture.currentWeekStart || overCoverageDate || fixture.anchor');
    expect(spec).toContain('fixtureDateOverride || scheduleFixtureDateFromSeed(seed)');
    expect(maturity).not.toContain('assert.match(spec, /return fixture\\.currentWeekStart');
  });
});