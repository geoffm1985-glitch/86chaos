'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.72 independent nested reporter regression', () => {
  test('release discovery keeps the reporter-independence guard mandatory', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/84-failed-only-manifest-reporter-independence-17-0-72.spec.cjs');
  });

  test('targeted delta discovery includes both 17.0.72 Playwright regressions', async () => {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    expect(workflow).toContain('tests/86chaos-release-gate/84-failed-only-manifest-reporter-independence-17-0-72.spec.cjs');
    expect(workflow).toContain('tests/e2e/failed-only-manifest-reporter-independence-17-0-72.spec.cjs');
  });
});
