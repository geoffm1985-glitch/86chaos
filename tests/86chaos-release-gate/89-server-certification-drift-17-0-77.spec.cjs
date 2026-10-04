'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.77 server certification drift repair', () => {
  test('release-gate source assertions follow the current stable contracts', async () => {
    expect(read('api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs')).toContain("scripts?.['test:source']");
    expect(read('api/release-gate-maturity-16-0-209.test.cjs')).toContain("getByTestId('schedule-copilot-warnings-tab')");
    expect(read('api/release-gate-runner-observability.test.cjs')).toContain('yardmaster-dependency-install.cjs');
    expect(read('api/schedule-warning-request-off-controls.test.cjs')).toContain('assert.equal(rows[0].existing, 2)');
    expect(read('api/spanish-release-gate-fidelity-17-0-29.test.cjs')).toContain("saveLanguagePreference(page, 'es')");
  });

  test('the exact 17.0.77 targeted Node regression remains wired into current release validation', async () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['test:current-release-targeted']).toContain('release-gate-server-certification-drift-17-0-77.test.cjs');
    expect(pkg.scripts['test:source']).toBe('node scripts/validate-17-0-77.js');
  });
});
