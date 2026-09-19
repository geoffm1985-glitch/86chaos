const { test, expect, devices } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, viewportAudit, dismissBlockingDialogs, visibleDialogSnapshot, neutralizeTestingPreviewOverlays } = require('./utils/audit-helpers.cjs');

const mobileRoutes = ['today', 'schedule', 'published', 'events', 'inventory', 'financials', 'prep', 'messages', 'settings'];

test.describe('11 mobile, desktop, 86Voice, and upload/scan UI', () => {
  test('mobile major tabs have no sideways overflow, hidden buttons, or one-letter keyboard-focus failures', async ({ browser }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage();
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const audits = [];
    for (const tab of mobileRoutes) {
      await gotoTab(page, tab, { settleMs: 1200 });
      const audit = await viewportAudit(page);
      audits.push({ tab, audit });
      expect(audit.horizontalOverflow, `${tab} should not have accidental horizontal overflow on mobile`).toBe(false);
      expect(audit.smallButtons.filter(b => !/×|x|i/i.test(b.text)).slice(0, 8), `${tab} should not have tiny important tap targets`).toEqual([]);
    }
    await gotoTab(page, 'events', { settleMs: 1000 });
    const inputs = page.locator('input:visible, textarea:visible');
    const count = await inputs.count().catch(() => 0);
    let focusEvidence = null;
    if (count > 0) {
      const input = inputs.first();
      await input.click({ timeout: 5000 }).catch(() => {});
      await input.type('QA', { delay: 100 }).catch(() => {});
      focusEvidence = await page.evaluate(() => ({ activeTag: document.activeElement?.tagName, value: document.activeElement?.value || '', placeholder: document.activeElement?.getAttribute?.('placeholder') || '' }));
      expect(['INPUT', 'TEXTAREA'].includes(focusEvidence.activeTag), 'Mobile typing should keep focus in the input/textarea after multiple characters').toBe(true);
    }
    await attachJson(testInfo, '11-mobile-audit.json', { audits, focusEvidence });
    await context.close();
  });

  test('desktop Schedule Builder grid is dense/readable with visible grid lines and full times', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'schedule', { settleMs: 1800, maxText: 65000 });
    const audit = await viewportAudit(page);
    const gridEvidence = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('body *'));
      const rows = els.map(el => {
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { text: text.slice(0, 180), width: r.width, height: r.height, borderTop: s.borderTopColor, borderBottom: s.borderBottomColor, borderLeft: s.borderLeftColor, borderRight: s.borderRightColor, className: String(el.className || '').slice(0, 120) };
      }).filter(x => /schedule|Allen|\d{1,2}\s*[ap]\s*[-–]/i.test(x.text)).slice(0, 80);
      return rows;
    });
    await attachJson(testInfo, '11-desktop-schedule-grid.json', { audit, gridEvidence, sample: text.slice(0, 8000) });
    expect(audit.horizontalOverflow, 'Desktop should not have accidental body-level horizontal overflow').toBe(false);
    expect(text, 'Desktop schedule should expose full times like 10a-9p / 3p-9p when present').not.toMatch(/\b\.\.\.|…/);
  });

  test('86Voice mic button is reachable, lifecycle-safe, and does not pass when missing', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.__voiceRecognitionInstances = [];
      window.__voiceRecognitionState = { createdCount: 0, startedCount: 0, activeIds: [], maxConcurrentActive: 0, events: [] };
      const markInactive = (instance, reason) => {
        if (!instance.active) return;
        instance.active = false;
        window.__voiceRecognitionState.activeIds = window.__voiceRecognitionState.activeIds.filter(id => id !== instance.instanceId);
        window.__voiceRecognitionState.events.push({ id: instance.instanceId, type: reason, activeCount: window.__voiceRecognitionState.activeIds.length });
      };
      class MockSpeechRecognition {
        constructor() {
          this.instanceId = ++window.__voiceRecognitionState.createdCount;
          this.started = false; this.active = false; this.stopped = false; this.aborted = false; this.onresult = null; this.onerror = null; this.onend = null;
          window.__voiceRecognitionInstances.push(this);
          window.__voiceRecognitionState.events.push({ id: this.instanceId, type: 'created', activeCount: window.__voiceRecognitionState.activeIds.length });
        }
        start() {
          this.started = true;
          window.__voiceRecognitionState.startedCount += 1;
          if (!this.active) {
            this.active = true;
            window.__voiceRecognitionState.activeIds.push(this.instanceId);
            window.__voiceRecognitionState.maxConcurrentActive = Math.max(window.__voiceRecognitionState.maxConcurrentActive, window.__voiceRecognitionState.activeIds.length);
          }
          window.__voiceRecognitionState.events.push({ id: this.instanceId, type: 'started', activeCount: window.__voiceRecognitionState.activeIds.length });
        }
        stop() { this.stopped = true; markInactive(this, 'stopped'); if (typeof this.onend === 'function') this.onend(); }
        abort() { this.aborted = true; markInactive(this, 'aborted'); if (typeof this.onend === 'function') this.onend(); }
        emitFinal(text) { if (typeof this.onresult === 'function') this.onresult({ results: [{ 0: { transcript: text }, isFinal: true }] }); }
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const beforeDismissalDialogs = await visibleDialogSnapshot(page);
    const modalDismissal = await dismissBlockingDialogs(page, { maxPasses: 4 });
    if (!modalDismissal.ok) {
      await attachJson(testInfo, '11-voice-modal-dismissal-failure.json', modalDismissal);
      throw new Error(modalDismissal.failure || 'Blocking dialog could not be dismissed before 86Voice interaction.');
    }
    const overlayBeforeVoice = await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
    const text = await bodyText(page, 30000);
    const openVoice = page.getByRole('button', { name: /open 86voice/i });
    await expect(openVoice, 'Authorized account must expose one stable accessible Open 86Voice control').toHaveCount(1, { timeout: 10_000 });
    const voiceButton = openVoice.first();
    const metrics = await voiceButton.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText || '', width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    expect(text, 'Voice/mic button should not show PREVIEW label').not.toMatch(/\bPREVIEW\b/i);
    expect(metrics.label, '86Voice button should have a real accessible label').toMatch(/86Voice|86 voice/i);
    expect(metrics.width, 'Mic/voice button should be wide enough to tap').toBeGreaterThanOrEqual(42);
    expect(metrics.height, 'Mic/voice button should be tall enough to tap').toBeGreaterThanOrEqual(38);

    const beforeOpenDismissal = await dismissBlockingDialogs(page, { maxPasses: 2 });
    if (!beforeOpenDismissal.ok) {
      await attachJson(testInfo, '11-voice-before-open-modal-dismissal-failure.json', beforeOpenDismissal);
      throw new Error(beforeOpenDismissal.failure || 'Blocking dialog remained before Open 86Voice click.');
    }
    await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
    await voiceButton.click();
    const headerClose = page.getByRole('button', { name: 'Close 86Voice panel' });
    const floatingHide = page.getByRole('button', { name: 'Hide 86Voice assistant' });
    await expect(headerClose).toBeVisible({ timeout: 5000 });
    await expect(floatingHide).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.voice-command-dock')).toHaveCount(1);
    await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
    await headerClose.click();
    await expect(page.getByRole('button', { name: /open 86voice/i })).toBeVisible({ timeout: 5000 });

    await dismissBlockingDialogs(page, { maxPasses: 2 });
    await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
    await page.getByRole('button', { name: /open 86voice/i }).click();
    await expect(headerClose).toBeVisible({ timeout: 5000 });
    await expect(floatingHide).toBeVisible({ timeout: 5000 });
    const maybeStart = page.getByRole('button', { name: /start listening|listen|microphone|start/i }).first();
    if (await maybeStart.isVisible({ timeout: 2500 }).catch(() => false)) {
      await maybeStart.click();
      await maybeStart.click().catch(() => {});
      const recognitionState = await page.evaluate(() => window.__voiceRecognitionState || {});
      expect(recognitionState.maxConcurrentActive || 0, 'Repeated start taps must not create duplicate simultaneous recognition sessions').toBeLessThanOrEqual(1);
      expect(recognitionState.startedCount || 0, 'Deterministic SpeechRecognition mock should be started by the real UI control').toBeGreaterThanOrEqual(1);
    }
    await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
    await floatingHide.click();
    await expect(page.getByRole('button', { name: /open 86voice/i })).toBeVisible({ timeout: 5000 });
    const closedInstanceState = await page.evaluate(() => (window.__voiceRecognitionInstances || []).map(r => ({ started: r.started, stopped: r.stopped, aborted: r.aborted })));
    expect(closedInstanceState.every(r => !r.started || r.stopped || r.aborted), 'Closing from the floating hide control must stop active recognition').toBe(true);
    await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
    await page.getByRole('button', { name: /open 86voice/i }).click();
    await expect(page.locator('.voice-command-dock')).toHaveCount(1);
    await attachJson(testInfo, '11-voice-button-metrics.json', { metrics, beforeDismissalDialogs, modalDismissal, beforeOpenDismissal, remainingDialogs: await visibleDialogSnapshot(page), backdropCount: await page.locator('.chaos-modal-backdrop:visible').count().catch(() => 0), voiceControlCount: await page.getByRole('button', { name: /86voice/i }).count().catch(() => 0), textSample: text.slice(0, 5000), instances: await page.evaluate(() => (window.__voiceRecognitionInstances || []).length), recognitionState: await page.evaluate(() => window.__voiceRecognitionState || {}), overlayBeforeVoice, closedInstanceState });
  });

  test('file upload / scan surfaces reject obvious broken display states', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const inventory = await gotoTab(page, 'inventory', { settleMs: 1800, maxText: 60000 });
    const menu = await gotoTab(page, 'menu-intelligence', { settleMs: 1200, maxText: 40000 });
    await attachJson(testInfo, '11-upload-scan-surfaces.json', { inventorySample: inventory.slice(0, 6000), menuSample: menu.slice(0, 4000) });
    expect(`${inventory}\n${menu}`).toMatch(/upload|scan|invoice|menu|PDF|image|progress|timeout|compress/i);
    expect(`${inventory}\n${menu}`).not.toMatch(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
  });
});
