'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
test.describe('17.0.77 independent server certification drift regression', () => {
  test('release discovery keeps server-certification drift coverage mandatory', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs');
  });
  test('targeted delta discovery includes both 17.0.77 Playwright regressions', async () => {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    expect(workflow).toContain('tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs');
    expect(workflow).toContain('tests/e2e/server-certification-drift-17-0-77.spec.cjs');
  });
});
