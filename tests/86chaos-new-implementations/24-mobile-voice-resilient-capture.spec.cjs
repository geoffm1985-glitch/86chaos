'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.8 resilient mobile 86Voice capture', () => {
  test('mobile toolbar records, transcribes, and processes a command without SpeechRecognition', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.__voice1718 = { permissionRequests: 0, recorderStarts: 0, recorderStops: 0, trackStops: 0 };
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            window.__voice1718.permissionRequests += 1;
            return { getTracks: () => [{ stop() { window.__voice1718.trackStops += 1; } }] };
          },
        },
      });
      window.SpeechRecognition = undefined;
      window.webkitSpeechRecognition = undefined;
      class MockMediaRecorder {
        static isTypeSupported(type) { return /audio\/webm/.test(type); }
        constructor(stream, options = {}) {
          this.stream = stream;
          this.mimeType = options.mimeType || 'audio/webm';
          this.state = 'inactive';
          this.ondataavailable = null;
          this.onstop = null;
          this.onerror = null;
        }
        start() {
          this.state = 'recording';
          window.__voice1718.recorderStarts += 1;
        }
        stop() {
          if (this.state === 'inactive') return;
          this.state = 'inactive';
          window.__voice1718.recorderStops += 1;
          this.ondataavailable?.({ data: new Blob(['fake restaurant voice audio'], { type: this.mimeType }) });
          this.onstop?.();
        }
      }
      window.MediaRecorder = MockMediaRecorder;
    });

    let transcribeCalls = 0;
    await page.route('**/api/voice-command', async route => {
      const request = route.request();
      let payload = {};
      try { payload = JSON.parse(request.postData() || '{}'); } catch (_) {}
      if (payload.mode === 'transcribe') {
        transcribeCalls += 1;
        expect(payload.audioBase64).toBeTruthy();
        expect(payload.mimeType).toContain('audio/webm');
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ intent: 'transcript', transcript: 'open help' }) });
        return;
      }
      await route.continue();
    });

    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password, { chooseWorkspace: true });

    const mic = page.getByTestId('concept17-mobile-voice-button');
    await expect(mic).toBeVisible({ timeout: 15000 });
    await mic.click();

    await expect(page.getByTestId('voice-command-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('voice-command-status')).toContainText(/recording/i, { timeout: 5000 });
    await expect(page.getByRole('button', { name: /stop listening/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /stop listening/i }).click();

    await expect.poll(() => transcribeCalls, { timeout: 10000 }).toBe(1);
    await expect(page.getByText('open help', { exact: true })).toBeVisible({ timeout: 10000 });
    const state = await page.evaluate(() => window.__voice1718);
    expect(state.permissionRequests).toBe(1);
    expect(state.recorderStarts).toBe(1);
    expect(state.recorderStops).toBe(1);
    expect(state.trackStops).toBeGreaterThanOrEqual(1);
  });
});
