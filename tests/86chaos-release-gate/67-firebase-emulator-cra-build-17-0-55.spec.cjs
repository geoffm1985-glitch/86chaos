const { test, expect } = require('@playwright/test');

test.describe('17.0.55 CRA-safe Firebase emulator bootstrap', () => {
  test('bundled app boots and exposes Firebase target diagnostics', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__CHAOS_FIREBASE_DIAGNOSTICS__), null, { timeout: 15000 });
    const diagnostics = await page.evaluate(() => window.__CHAOS_FIREBASE_DIAGNOSTICS__);
    expect(['LIVE', 'EMULATOR']).toContain(diagnostics.target);
    await expect(page.getByTestId('firebase-emulator-startup-failure')).toHaveCount(0);
    if (testInfo.project.name === 'mobile-webkit-pwa') {
      const viewport = testInfo.project.use.viewport;
      expect(viewport ? viewport.width : 390).toBeLessThanOrEqual(430);
    }
  });
});
