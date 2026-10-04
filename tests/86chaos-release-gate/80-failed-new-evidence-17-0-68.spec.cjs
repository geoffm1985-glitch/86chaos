'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test.describe('17.0.68 failed+new evidence repair', () => {
  test('Prep exhaustive coverage follows the rendered Food Prep control without weakening other states', async () => {
    const matrix = read('tests/86chaos-release-gate/exhaustive-surface-matrix.cjs');
    expect(matrix).toContain("prep: [[/^food prep$/i], [/line.?check/i], [/daily/i], [/weekly/i], [/monthly/i]]");
    expect(matrix).not.toContain('prep: [[/^prep$/i]');
  });

  test('sticky day-header regression uses the real nearest scrollport for both scrolling and geometry', async () => {
    const source = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
    expect(source).toContain('let scrollport = sticky?.parentElement || null');
    expect(source).toContain('scrollport.scrollHeight > scrollport.clientHeight + 8');
    expect(source).toContain('(scrollportRect?.top ?? 0) + computedStickyTop');
  });

  test('mobile authenticated readiness recognizes the actual Active workspace compact header', async () => {
    const source = read('tests/e2e/utils/release-login-helper.cjs');
    expect(source).toContain("page.getByRole('button', { name: /^Active workspace\\b/i })");
  });

  test('emulator Firebase Auth iframe CSP noise is ignored only for the exact Google bootstrap URL', async () => {
    const source = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
    expect(source).toContain('isExpectedEmulatorFirebaseAuthBootstrapNoise');
    expect(source).toContain('apis\\.google\\.com\\/js\\/api\\.js');
    expect(source).toContain("trim().toLowerCase() === 'emulator'");
  });

  test('nested accessibility performs one route-remount retry before declaring a state missing', async () => {
    const source = read('tests/86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs');
    expect(source).toContain('if(!applied.ok&&state.length)');
    expect(source).toContain('settleMs:350');
    expect(source).toContain('applied=await applyStatePath(page,state,{strict:false})');
  });
});
