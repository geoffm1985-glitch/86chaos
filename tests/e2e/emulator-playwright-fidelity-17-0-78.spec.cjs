'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
test.describe('17.0.78 independent Yardmaster emulator browser fidelity regression', () => {
  test('targeted delta discovery includes both 17.0.78 Playwright regressions', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/90-emulator-playwright-fidelity-17-0-78.spec.cjs');
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    expect(workflow).toContain('tests/86chaos-release-gate/90-emulator-playwright-fidelity-17-0-78.spec.cjs');
    expect(workflow).toContain('tests/e2e/emulator-playwright-fidelity-17-0-78.spec.cjs');
  });
});
