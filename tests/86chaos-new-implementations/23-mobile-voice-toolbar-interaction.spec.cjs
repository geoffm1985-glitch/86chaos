'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.7 mobile 86Voice toolbar interaction', () => {
  test('first toolbar microphone tap opens 86Voice and Start Listening begins recognition', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.__voice1717 = { permissionRequests: 0, created: 0, started: 0, trackStops: 0 };
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            window.__voice1717.permissionRequests += 1;
            return { getTracks: () => [{ stop() { window.__voice1717.trackStops += 1; } }] };
          },
        },
      });
      class MockSpeechRecognition {
        constructor() {
          window.__voice1717.created += 1;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
          this.onresult = null;
        }
        start() {
          window.__voice1717.started += 1;
          this.onstart?.();
        }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password, { chooseWorkspace: true });

    const nav = page.getByTestId('concept17-mobile-bottom-nav');
    await expect(nav).toBeVisible({ timeout: 15000 });
    const buttons = nav.locator('button');
    await expect(buttons.first()).toHaveAttribute('data-shell-action', 'voice');

    const mic = page.getByTestId('concept17-mobile-voice-button');
    await expect(mic).toBeVisible();
    await mic.click();

    await expect(page.getByText('86 Voice', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /start listening/i })).toBeVisible({ timeout: 5000 });
    let state = await page.evaluate(() => window.__voice1717);
    expect(state.permissionRequests).toBe(0);
    expect(state.created).toBe(0);
    expect(state.started).toBe(0);

    await page.getByRole('button', { name: /start listening/i }).click();
    await expect(page.getByRole('button', { name: /stop listening/i })).toBeVisible({ timeout: 5000 });
    state = await page.evaluate(() => window.__voice1717);
    expect(state.created).toBe(1);
    expect(state.started).toBe(1);
  });
});
