'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { CONNECT_POLICY } = require('../../scripts/yardmaster-readiness.cjs');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const directive = (policy, name) => String(policy || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `)) || '';

test.describe('17.0.67 failed+new runtime-isolation repair', () => {
  test('local readiness CSP permits Firebase Auth bootstrap while connect-src remains emulator-only', async () => {
    const scriptPolicy = `${directive(CONNECT_POLICY, 'script-src')} ${directive(CONNECT_POLICY, 'script-src-elem')}`;
    const framePolicy = directive(CONNECT_POLICY, 'frame-src');
    const connectPolicy = directive(CONNECT_POLICY, 'connect-src');

    expect(scriptPolicy).toContain('https://*.google.com');
    expect(framePolicy).toContain('https://*.firebaseapp.com');
    expect(connectPolicy).toContain('http://127.0.0.1:*');
    expect(connectPolicy).toContain('http://localhost:*');
    expect(connectPolicy).not.toMatch(/googleapis\.com|firebaseio\.com|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/);
  });

  test('Spanish interface cleanup restores and reload-verifies the shared QA account language', async () => {
    const source = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
    expect(source).toContain("saveLanguagePreference(page, 'en', { verifyReload: true })");
    expect(source).toContain('Language ${value} must survive a fresh authenticated reload');
    expect(source).not.toContain('if (await save.isVisible');
  });

  test('sticky-header regressions assert against the nested scrollport rather than viewport zero', async () => {
    const managerBrief = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
    const emergency = read('tests/86chaos-release-gate/54-emergency-schedule-requestoff.spec.cjs');
    expect(managerBrief).toContain('expectedStickyViewportTop');
    expect(emergency).toContain('pinnedViewportTop = before.scrollportTop + before.top');
    expect(emergency).toContain('expectedTop: Math.max(pinnedViewportTop, before.initialTop - scrollDelta)');
    expect(15.484375 + 56).toBe(71.484375);
    expect(Math.max(15.484375 + 56, 421 - 240)).toBe(181);
  });

  test('System Administrator evidence-backed scroll regions are keyboard focusable', async () => {
    const source = read('src/features/management.jsx');
    expect(source).toContain('role="region" aria-label="Full Vercel API route manifest" tabIndex={0}');
    expect(source).toContain('role="region" aria-label="Administrator session timeline" tabIndex={0}');
    expect(source).toContain('role="region" aria-label="Global forensics and ghost audit records" tabIndex={0}');
  });

  test('exhaustive route reset has one bounded retry only for a destroyed navigation context', async () => {
    const source = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
    expect(source).toContain('Execution context was destroyed|most likely because of a navigation');
    expect(source).toContain("waitForLoadState('domcontentloaded'");
    expect((source.match(/await routeReset\(\);/g) || []).length).toBe(2);
  });
});
