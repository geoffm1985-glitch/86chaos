// 86 Chaos Production Deep Deep Deep Suite
// 05: Mobile/desktop responsive layout, horizontal overflow, and tap target audit.
const { test, expect, devices } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  TAB_LABELS,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const VIEWPORTS = [
  { label: 'mobile-iphone-ish', width: 390, height: 844, isMobile: true },
  { label: 'mobile-small-android', width: 360, height: 780, isMobile: true },
  { label: 'tablet', width: 768, height: 1024, isMobile: false },
  { label: 'desktop', width: 1440, height: 900, isMobile: false },
];
const TABS = ['today', 'published', 'schedule', 'financials', 'inventory', 'prep', 'recipes', 'team', 'settings', 'godmode'];
const fatalRe = /Application error|Unhandled Runtime Error|Cannot read properties of undefined|Minified React error|Something went wrong/i;

async function layoutMetrics(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const buttons = Array.from(document.querySelectorAll('button')).filter(visible).map((el, index) => {
      const rect = el.getBoundingClientRect();
      const label = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);
      return { index, label, width: Math.round(rect.width), height: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y), disabled: el.disabled };
    });
    const tinyButtons = buttons.filter((b) => !b.disabled && b.width > 0 && b.height > 0 && (b.width < 36 || b.height < 36));
    return {
      url: location.href,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      buttons: buttons.slice(0, 120),
      tinyButtons: tinyButtons.slice(0, 80),
      textStart: (document.body?.innerText || '').slice(0, 2500),
    };
  });
}

test.describe('86 Chaos production readiness: responsive layout', () => {
  for (const viewport of VIEWPORTS) {
    test(`responsive sweep: ${viewport.label}`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ viewport, userAgent: devices['Desktop Chrome'].userAgent });
      const page = await context.newPage();
      const problems = [];
      watchForProblems(page, problems);
      const account = ownerLikeCreds();
      requireCreds(test, account, 'owner-like account');
      await login(page, account.email, account.password);
      await expectVersion(page);

      const reports = [];
      for (const tab of TABS) {
        await expectRouteHealthy(page, tab, { allowGate: true, expected: TAB_LABELS[tab], routeReadyTimeout: 55000, settleMs: 1000 });
        const metrics = await layoutMetrics(page);
        reports.push({ tab, metrics });
        expect(metrics.textStart, `${viewport.label}/${tab} should not show fatal UI`).not.toMatch(fatalRe);
        expect(metrics.scrollWidth, `${viewport.label}/${tab} should not have meaningful horizontal overflow: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientWidth + 18);

        // Do not fail for every tiny icon-only utility button, but do fail when primary visible text buttons are too small.
        const tinyTextButtons = metrics.tinyButtons.filter((b) => b.label && /clock|submit|publish|save|request|schedule|inventory|recipe|settings|help|team|today|full schedule|month view|availability/i.test(b.label));
        expect(tinyTextButtons, `${viewport.label}/${tab} core text buttons should be tappable`).toEqual([]);
      }

      await attachReport(testInfo, `05-responsive-${viewport.label}.json`, {
        runId: RUN_ID,
        baseUrl: BASE_URL,
        viewport,
        reports,
        problems: summarizeProblems(problems),
      });

      expect(problems, `${viewport.label} responsive sweep should not create fatal browser/network problems`).toEqual([]);
      await context.close();
    });
  }
});
