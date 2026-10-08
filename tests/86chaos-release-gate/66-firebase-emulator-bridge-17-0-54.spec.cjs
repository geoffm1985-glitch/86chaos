const { test, expect } = require('@playwright/test');
const { getFirebaseTarget } = require('../../scripts/86chaos-firebase-target.cjs');

const FORBIDDEN_LIVE_FIREBASE = /(firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebasestorage\.googleapis\.com|(?:^|\.)firebaseio\.com|(?:^|\.)firebasedatabase\.app)/i;

test.describe('17.0.54 Firebase Emulator Bridge', () => {
  test('runtime remains on the selected Firebase target with no silent live fallback', async ({ page }, testInfo) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__CHAOS_FIREBASE_DIAGNOSTICS__), null, { timeout: 15000 });
    const diagnostics = await page.evaluate(() => window.__CHAOS_FIREBASE_DIAGNOSTICS__);
    const requestedTarget = getFirebaseTarget(process.env).emulator ? 'emulator' : 'live';

    if (requestedTarget === 'emulator') {
      expect(diagnostics.target).toBe('EMULATOR');
      expect(diagnostics.projectId).toBe('demo-86chaos');
      expect(diagnostics.failClosed).toBe(true);
      expect(diagnostics.emulator.host).toMatch(/^(127\.0\.0\.1|localhost|::1)$/);
      await page.evaluate(() => window.__CHAOS_FIREBASE_EMULATOR_READY__);
      const forbidden = requests.filter(raw => {
        try { return FORBIDDEN_LIVE_FIREBASE.test(new URL(raw).hostname); } catch (_) { return false; }
      });
      expect(forbidden, 'emulator traffic must not reach live Firebase endpoints').toEqual([]);
      await expect(page.getByTestId('firebase-emulator-startup-failure')).toHaveCount(0);
    } else {
      expect(diagnostics.target).toBe('LIVE');
      expect(['chaos-test-d1601', 'cheers-34b8d']).toContain(diagnostics.projectId);
      expect(diagnostics.failClosed).toBe(false);
    }

    if (testInfo.project.name === 'mobile-webkit-pwa') {
      const viewport = testInfo.project.use.viewport;
      expect(viewport ? viewport.width : 390).toBeLessThanOrEqual(430);
    }
  });
});
