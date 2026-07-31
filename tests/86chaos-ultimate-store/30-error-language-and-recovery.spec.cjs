const { test, expect } = require('@playwright/test');
const {
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  bodyText,
  expectNoFatal,
  attachJson,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const RAW_TECHNICAL_RE = /FirebaseError|auth\/[a-z-]+|permission-denied|failed-precondition|ChunkLoadError|TypeError:|ReferenceError:|at\s+[A-Za-z_$][\w$]*\s*\([^\n]+:\d+:\d+\)|\{\s*"(?:code|stack|errorInfo)"/i;

test.describe('30 Plain-English errors and recovery', () => {
  test('unknown route fails safely with a plain-English recovery screen', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like');
    await login(page, account.email, account.password);
    await page.evaluate(() => {
      const url = new URL(location.href);
      url.searchParams.set('tab', 'definitely-not-a-real-86chaos-route');
      history.pushState({ tab: 'definitely-not-a-real-86chaos-route' }, '', `${url.pathname}${url.search}`);
      dispatchEvent(new PopStateEvent('popstate', { state: { tab: 'definitely-not-a-real-86chaos-route' } }));
    });
    await page.waitForTimeout(800);
    const text = await bodyText(page, 20_000);
    expect(text).toMatch(/page is not available|not available|Go to Today|Open Menu/i);
    expect(text).not.toMatch(RAW_TECHNICAL_RE);
    await expectNoFatal(page, 'unknown route recovery');
    await attachJson(testInfo, 'unknown-route-recovery.txt', { text: text.slice(0, 5000) });
  });

  test('visible alerts, toasts, dialogs, and route errors never expose raw stack traces or Firebase codes', async ({ page }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like');
    await login(page, account.email, account.password);
    const routes = ['today', 'published', 'schedule', 'events', 'financials', 'inventory', 'prep', 'recipes', 'messages', 'reminders', 'team', 'maintenance', 'settings', 'help'];
    const rows = [];
    for (const route of routes) {
      const text = await gotoTab(page, route, { settleMs: 350, timeout: 45_000 });
      const technical = text.match(RAW_TECHNICAL_RE)?.[0] || '';
      rows.push({ route, technical, sample: text.slice(0, 1200) });
      expect(technical, `${route} should not expose raw technical error language`).toBe('');
      await expectNoFatal(page, `${route} plain-English error review`);
    }
    await attachJson(testInfo, 'plain-english-route-errors.json', rows);
  });

  test('brief offline transition returns online without logout or a permanent error screen', async ({ page, context }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like');
    await login(page, account.email, account.password);
    await gotoTab(page, 'today');
    await context.setOffline(true);
    await page.waitForTimeout(1200);
    const offlineText = await bodyText(page, 15_000);
    expect(offlineText).not.toMatch(RAW_TECHNICAL_RE);
    await context.setOffline(false);
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    const onlineText = await bodyText(page, 20_000);
    expect(onlineText).not.toMatch(/Email Address\s*Password|Unlock System|Sign In/i);
    expect(onlineText).not.toMatch(RAW_TECHNICAL_RE);
    await expectNoFatal(page, 'offline recovery');
    await attachJson(testInfo, 'offline-recovery-language.json', { offlineSample: offlineText.slice(0, 4000), onlineSample: onlineText.slice(0, 4000) });
  });
});
