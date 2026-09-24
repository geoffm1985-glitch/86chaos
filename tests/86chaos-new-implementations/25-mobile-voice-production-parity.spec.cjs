'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.10 production 17.0.29 86Voice parity', () => {
  test('first toolbar Voice tap uses the production Web Speech lifecycle inside the new UI', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.__voiceProdParity = { created: 0, started: 0, stopped: 0, aborted: 0 };
      class MockSpeechRecognition {
        constructor() {
          window.__voiceProdParity.created += 1;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
          this.onresult = null;
        }
        start() {
          window.__voiceProdParity.started += 1;
          this.onstart?.();
        }
        stop() {
          window.__voiceProdParity.stopped += 1;
          this.onend?.();
        }
        abort() {
          window.__voiceProdParity.aborted += 1;
          this.onend?.();
        }
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
      window.MediaRecorder = undefined;
    });

    let voiceApiCalls = 0;
    await page.route('**/api/voice-command', async route => {
      voiceApiCalls += 1;
      await route.continue();
    });

    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password, { chooseWorkspace: true });

    const nav = page.getByTestId('concept17-mobile-bottom-nav');
    await expect(nav).toBeVisible({ timeout: 15000 });
    await expect(nav.locator('button').first()).toHaveAttribute('data-shell-action', 'voice');

    const mic = page.getByTestId('concept17-mobile-voice-button');
    await mic.click();
    await expect(page.getByTestId('voice-command-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('86 Voice', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /stop listening/i })).toBeVisible({ timeout: 5000 });

    await expect.poll(async () => (await page.evaluate(() => window.__voiceProdParity)).started, { timeout: 3000 }).toBe(1);
    const state = await page.evaluate(() => window.__voiceProdParity);
    expect(state.created).toBe(1);
    expect(state.started).toBe(1);
    expect(voiceApiCalls, 'restored production path must not invoke server transcription just to start the microphone').toBe(0);
  });
});
