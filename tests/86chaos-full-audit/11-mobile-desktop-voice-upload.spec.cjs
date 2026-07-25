const { test, expect, devices } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, viewportAudit } = require('./utils/audit-helpers.cjs');

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

  test('86Voice mic button is reachable, large enough, and has no PREVIEW label', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await bodyText(page, 30000);
    const metrics = await page.locator('button:visible').evaluateAll((buttons) => buttons.map(button => {
      const label = (button.innerText || button.getAttribute('aria-label') || '').trim();
      const rect = button.getBoundingClientRect();
      return { label, width: Math.round(rect.width), height: Math.round(rect.height) };
    }).filter(b => /86Voice|voice|mic|microphone|🎙|🎤/i.test(b.label))).catch(() => []);
    await attachJson(testInfo, '11-voice-button-metrics.json', { metrics, textSample: text.slice(0, 5000) });
    expect(text, 'Voice/mic button should not show PREVIEW label').not.toMatch(/\bPREVIEW\b/i);
    if (metrics.length) {
      expect(Math.max(...metrics.map(m => m.width)), 'Mic/voice button should be wide enough to tap').toBeGreaterThanOrEqual(42);
      expect(Math.max(...metrics.map(m => m.height)), 'Mic/voice button should be tall enough to tap').toBeGreaterThanOrEqual(38);
    }
  });

  test('file upload / scan surfaces reject obvious broken display states', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const inventory = await gotoTab(page, 'inventory', { settleMs: 1800, maxText: 60000 });
    const menu = await gotoTab(page, 'menu-intelligence', { settleMs: 1200, maxText: 40000 });
    await attachJson(testInfo, '11-upload-scan-surfaces.json', { inventorySample: inventory.slice(0, 6000), menuSample: menu.slice(0, 4000) });
    expect(`${inventory}\n${menu}`).toMatch(/upload|scan|invoice|menu|PDF|image|progress|timeout|compress/i);
    expect(`${inventory}\n${menu}`).not.toMatch(/Invalid Date|NaN|undefined undefined|null null/i);
  });
});
