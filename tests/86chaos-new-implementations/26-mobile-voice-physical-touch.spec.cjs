'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.11 mobile 86Voice physical touch repair', () => {
  test('real touchscreen tap opens 86Voice and starts one production recognition session', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Physical touchscreen regression is mobile-only.');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.__voiceTouchRepair = { created: 0, started: 0, pointerDown: 0, clicks: 0, contextMenus: 0 };
      class MockSpeechRecognition {
        constructor() {
          window.__voiceTouchRepair.created += 1;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
          this.onresult = null;
        }
        start() { window.__voiceTouchRepair.started += 1; this.onstart?.(); }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
      document.addEventListener('pointerdown', event => {
        if (event.target?.closest?.('[data-testid="concept17-mobile-voice-button"]')) window.__voiceTouchRepair.pointerDown += 1;
      }, true);
      document.addEventListener('click', event => {
        if (event.target?.closest?.('[data-testid="concept17-mobile-voice-button"]')) window.__voiceTouchRepair.clicks += 1;
      }, true);
      document.addEventListener('contextmenu', event => {
        if (event.target?.closest?.('[data-testid="concept17-mobile-voice-button"]')) window.__voiceTouchRepair.contextMenus += 1;
      }, true);
    });

    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password, { chooseWorkspace: true });

    const mic = page.getByTestId('concept17-mobile-voice-button');
    await expect(mic).toBeVisible({ timeout: 15000 });
    const box = await mic.boundingBox();
    expect(box).toBeTruthy();

    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.getByTestId('voice-command-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /stop listening/i })).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => (await page.evaluate(() => window.__voiceTouchRepair)).started, { timeout: 3000 }).toBe(1);

    const state = await page.evaluate(() => window.__voiceTouchRepair);
    expect(state.pointerDown).toBe(1);
    expect(state.contextMenus).toBe(0);
    expect(state.created).toBe(1);
    expect(state.started).toBe(1);
  });
});
