'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const releaseSpec =
  'tests/86chaos-release-gate/86-partial-run-evidence-emulator-target-17-0-74.spec.cjs';
const independentSpec =
  'tests/e2e/partial-run-evidence-emulator-target-17-0-74.spec.cjs';

test.describe('17.0.74 independent partial-resume target regression', () => {
  test('release discovery keeps the exact blocked-gate repair mandatory', async () => {
    const universe = require(
      '../../scripts/86chaos-release-gate/release-test-universe.cjs'
    );

    expect(universe.RELEASE_CRITICAL_SPECS).toContain(releaseSpec);
  });

  test('targeted delta discovery includes both Playwright regressions', async () => {
    const workflow = fs.readFileSync(
      path.join(root, '.github/workflows/testing-targeted-delta.yml'),
      'utf8'
    );

    expect(workflow).toContain(releaseSpec);
    expect(workflow).toContain(independentSpec);
  });
});