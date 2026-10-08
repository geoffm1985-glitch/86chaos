'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.73 independent failed-only recovery target regression', () => {
  test('release discovery keeps the exact recovery-target guard mandatory', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/85-failed-only-repair-selection-emulator-target-17-0-73.spec.cjs');
  });

  test('targeted delta discovery includes both 17.0.73 Playwright regressions', async () => {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    expect(workflow).toContain('tests/86chaos-release-gate/85-failed-only-repair-selection-emulator-target-17-0-73.spec.cjs');
    expect(workflow).toContain('tests/e2e/failed-only-repair-selection-emulator-target-17-0-73.spec.cjs');
  });
});
