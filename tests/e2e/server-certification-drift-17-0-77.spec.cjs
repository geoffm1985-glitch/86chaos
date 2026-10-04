'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.77 independent server certification drift regression', () => {
  test('all six formerly failing server guards are covered by the 17.0.77 targeted regression', async () => {
    const source = fs.readFileSync(path.join(root, 'api/release-gate-server-certification-drift-17-0-77.test.cjs'), 'utf8');
    for (const file of [
      'release-gate-hostile-fixture-manifest-17-0-70.test.cjs',
      'release-gate-maturity-16-0-207.test.cjs',
      'release-gate-maturity-16-0-209.test.cjs',
      'release-gate-runner-observability.test.cjs',
      'schedule-warning-request-off-controls.test.cjs',
      'spanish-release-gate-fidelity-17-0-29.test.cjs',
    ]) expect(source).toContain(file);
  });

  test('targeted delta discovery includes both 17.0.77 Playwright regressions', async () => {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    expect(workflow).toContain('tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs');
    expect(workflow).toContain('tests/e2e/server-certification-drift-17-0-77.spec.cjs');
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs');
  });
});
