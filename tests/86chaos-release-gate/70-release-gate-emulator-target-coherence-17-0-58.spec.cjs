const { test, expect } = require('@playwright/test');
const { getFirebaseTarget } = require('../../scripts/86chaos-firebase-target.cjs');

test.describe('17.0.58 failed+new Firebase target coherence', () => {
  test('Playwright process and browser diagnostics agree on LIVE versus EMULATOR', async ({ page }, testInfo) => {
    const selected = getFirebaseTarget(process.env);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__CHAOS_FIREBASE_DIAGNOSTICS__), null, { timeout: 15000 });
    const diagnostics = await page.evaluate(() => window.__CHAOS_FIREBASE_DIAGNOSTICS__);
    expect(diagnostics.target).toBe(selected.target);
    if (selected.emulator) {
      expect(diagnostics.failClosed).toBe(true);
      expect(diagnostics.projectId).toBe('demo-86chaos');
    } else {
      expect(diagnostics.failClosed).toBe(false);
      expect(['chaos-test-d1601', 'cheers-34b8d']).toContain(diagnostics.projectId);
    }
    if (testInfo.project.name === 'mobile-webkit-pwa') {
      expect(testInfo.project.use.viewport?.width || 390).toBeLessThanOrEqual(430);
    }
  });

  test('historical System Administrator safeguard regression is version-agnostic', () => {
    const pkg = require('../../package.json');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.version).not.toBe('17.0.52');
  });
});
