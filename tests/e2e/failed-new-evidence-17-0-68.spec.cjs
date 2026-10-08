'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test.describe('17.0.68 failed+new regression locks', () => {
  test('release harness keeps exact repaired selectors and geometry', async () => {
    const matrix = read('tests/86chaos-release-gate/exhaustive-surface-matrix.cjs');
    const sticky = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
    const login = read('tests/e2e/utils/release-login-helper.cjs');
    expect(matrix).toMatch(/prep:\s*\[\[\/\^food prep\$\/i\]/i);
    expect(sticky).toContain('usedElementScrollport: Boolean(scrollport)');
    expect(login).toMatch(/\^Active workspace\\b/);
  });

  test('emulator-only CSP filtering remains exact and accessibility still fails after its single retry', async () => {
    const audit = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
    const a11y = read('tests/86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs');
    expect(audit).toContain('https:\\/\\/apis\\.google\\.com\\/js\\/api\\.js');
    expect(audit).toContain('if (!emulatorSelected) return false');
    expect(a11y).toContain("if(!applied.ok){findings.push({route:route.tab,state:state.map(String),missing:true});continue;}");
  });
});
