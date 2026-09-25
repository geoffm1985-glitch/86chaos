'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.12 Android installed-PWA 86Voice panel repair', () => {
  test('real touchscreen tap renders the Voice panel outside the legacy dock and starts recognition once', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'PWA panel regression is mobile-only.');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.__voicePwaPanel = { created: 0, started: 0 };
      class MockSpeechRecognition {
        constructor() {
          window.__voicePwaPanel.created += 1;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
          this.onresult = null;
        }
        start() { window.__voicePwaPanel.started += 1; this.onstart?.(); }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password, { chooseWorkspace: true });

    const mic = page.getByTestId('concept17-mobile-voice-button');
    await expect(mic).toBeVisible({ timeout: 15000 });
    const box = await mic.boundingBox();
    expect(box).toBeTruthy();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    const panel = page.getByTestId('voice-command-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toHaveClass(/voice-command-panel-surface/);
    await expect(page.getByRole('button', { name: /stop listening/i })).toBeVisible({ timeout: 5000 });

    const geometry = await panel.evaluate(el => {
      const r = el.getBoundingClientRect();
      return {
        dockAncestor: Boolean(el.closest('.voice-command-dock')),
        position: getComputedStyle(el).position,
        zIndex: Number(getComputedStyle(el).zIndex || 0),
        top: r.top,
        bottom: r.bottom,
        height: r.height,
        viewportHeight: window.innerHeight,
      };
    });
    expect(geometry.dockAncestor, 'mobile panel must be portaled out of the zero-sized legacy dock').toBe(false);
    expect(geometry.position).toBe('fixed');
    expect(geometry.zIndex).toBeGreaterThanOrEqual(120);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.height).toBeGreaterThan(40);

    await expect.poll(async () => (await page.evaluate(() => window.__voicePwaPanel)).started, { timeout: 3000 }).toBe(1);
    const state = await page.evaluate(() => window.__voicePwaPanel);
    expect(state.created).toBe(1);
    expect(state.started).toBe(1);
  });
});
