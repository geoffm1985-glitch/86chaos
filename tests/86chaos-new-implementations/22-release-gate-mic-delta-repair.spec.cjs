'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.6 microphone and delta-gate interaction repair', () => {
  test('86Voice starts recognition from the first microphone tap', async ({ page }) => {
    await page.addInitScript(() => {
      window.__voiceFirstTap = { created: 0, started: 0, stopped: 0, aborted: 0 };
      class MockSpeechRecognition {
        constructor() {
          window.__voiceFirstTap.created += 1;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
          this.onresult = null;
        }
        start() {
          window.__voiceFirstTap.started += 1;
          if (typeof this.onstart === 'function') this.onstart();
        }
        stop() {
          window.__voiceFirstTap.stopped += 1;
          if (typeof this.onend === 'function') this.onend();
        }
        abort() {
          window.__voiceFirstTap.aborted += 1;
          if (typeof this.onend === 'function') this.onend();
        }
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner/admin-like');
    await login(page, account.email, account.password, { chooseWorkspace: true });

    const mic = page.getByTestId('concept17-mobile-voice-button');
    await expect(mic).toBeVisible({ timeout: 15000 });
    await mic.click();
    await expect(page.getByRole('button', { name: /stop listening/i })).toBeVisible({ timeout: 5000 });
    const state = await page.evaluate(() => window.__voiceFirstTap);
    expect(state.started, 'first toolbar tap should start SpeechRecognition').toBe(1);
    expect(state.created, 'first toolbar tap should create one recognition session').toBe(1);
  });
});
