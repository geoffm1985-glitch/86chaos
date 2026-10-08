'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.75 independent QA role target regression', () => {
  test('release discovery keeps the QA role target guard mandatory', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');

    expect(universe.RELEASE_CRITICAL_SPECS).toContain(
      'tests/86chaos-release-gate/87-qa-role-emulator-target-17-0-75.spec.cjs'
    );
  });

  test('targeted delta discovery includes both 17.0.75 Playwright regressions', async () => {
    const workflow = fs.readFileSync(
      path.join(root, '.github/workflows/testing-targeted-delta.yml'),
      'utf8'
    );

    expect(workflow).toContain(
      'tests/86chaos-release-gate/87-qa-role-emulator-target-17-0-75.spec.cjs'
    );

    expect(workflow).toContain(
      'tests/e2e/qa-role-emulator-target-17-0-75.spec.cjs'
    );
  });
});
