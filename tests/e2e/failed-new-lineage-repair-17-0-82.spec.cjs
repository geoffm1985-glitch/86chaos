'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

test.describe('17.0.82 independent failed+new lineage regression', () => {
  test('targeted delta discovery keeps both 17.0.82 Playwright regressions', async () => {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    expect(workflow).toContain('tests/86chaos-release-gate/94-failed-new-lineage-repair-17-0-82.spec.cjs');
    expect(workflow).toContain('tests/e2e/failed-new-lineage-repair-17-0-82.spec.cjs');
  });

  test('release discovery keeps the exact 17.0.82 failed-lineage repair mandatory', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/94-failed-new-lineage-repair-17-0-82.spec.cjs');
    const scheduleSpec = fs.readFileSync(path.join(root, 'tests/e2e/schedule-request-off-management.spec.cjs'), 'utf8');
    expect(scheduleSpec).toContain("await resetSeededRequestOffFixture(seed, 'allen');");
    expect(scheduleSpec).toContain('scheduleRequestOffConflictAnchorFromSeed(seed)');
  });
});
