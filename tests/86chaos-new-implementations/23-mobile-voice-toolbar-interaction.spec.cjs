'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.7 mobile 86Voice toolbar carried forward under 17.1.10 production parity', () => {
  test('first toolbar microphone tap opens 86Voice and starts native recognition', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.__voiceParity = { created: 0, started: 0 };
      class MockSpeechRecognition {
        constructor() { window.__voiceParity.created += 1; this.onstart = null; this.onend = null; this.onerror = null; this.onresult = null; }
        start() { window.__voiceParity.started += 1; this.onstart?.(); }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
      window.MediaRecorder = undefined;
    });

    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password, { chooseWorkspace: true });

    const mic = page.getByTestId('concept17-mobile-voice-button');
    await expect(mic).toBeVisible({ timeout: 15000 });
    await mic.click();
    await expect(page.getByTestId('voice-command-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /stop listening/i })).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => (await page.evaluate(() => window.__voiceParity)).started, { timeout: 3000 }).toBe(1);
    const state = await page.evaluate(() => window.__voiceParity);
    expect(state.created).toBe(1);
    expect(state.started).toBe(1);
  });
});
