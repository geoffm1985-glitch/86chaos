'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.76 independent Ghost Request Off selector regression', () => {
  test('release discovery keeps the repaired Ghost Request Off certification mandatory', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');

    expect(universe.RELEASE_CRITICAL_SPECS).toContain(
      'tests/86chaos-release-gate/88-ghost-request-off-selector-17-0-76.spec.cjs'
    );
  });

  test('targeted delta discovery includes both 17.0.76 Playwright regressions', async () => {
    const workflow = fs.readFileSync(
      path.join(root, '.github/workflows/testing-targeted-delta.yml'),
      'utf8'
    );

    expect(workflow).toContain(
      'tests/86chaos-release-gate/88-ghost-request-off-selector-17-0-76.spec.cjs'
    );

    expect(workflow).toContain(
      'tests/e2e/ghost-request-off-selector-17-0-76.spec.cjs'
    );
  });
});
