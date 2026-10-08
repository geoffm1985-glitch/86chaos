const { test, expect } = require('@playwright/test');

test.describe('17.0.56 Firebase entrypoint import repair', () => {
  test('bundled app boots past Firebase entry import and exposes diagnostics', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__CHAOS_FIREBASE_DIAGNOSTICS__), null, { timeout: 15000 });
    const diagnostics = await page.evaluate(() => window.__CHAOS_FIREBASE_DIAGNOSTICS__);
    expect(['LIVE', 'EMULATOR']).toContain(diagnostics.target);
    await expect(page.getByTestId('firebase-emulator-startup-failure')).toHaveCount(0);
    expect(pageErrors.filter(message => /firebaseRuntimeTarget|not exported|import/i.test(message))).toEqual([]);
  });
});
