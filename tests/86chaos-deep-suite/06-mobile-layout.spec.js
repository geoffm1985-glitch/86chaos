// 86 Chaos 15.0.95 Mobile layout checks.
const { test, expect, devices } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  staffCredsOrNull,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  openMenu,
  closeTransientUi,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

async function expectNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0,
  }));
  expect(metrics.scrollWidth, `${label} should not create page-level horizontal overflow: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.width + 12);
}

test.describe('86 Chaos Mobile Layout', () => {
  test.use({ viewport: devices['iPhone 13'].viewport, isMobile: true, hasTouch: true });

  test('mobile core routes fit the viewport and menu overlays instead of pushing layout', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const account = staffCredsOrNull() || ownerLikeCreds();
    requireCreds(test, account, 'STAFF or OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const routeReports = [];
    for (const tab of ['today', 'published', 'inventory', 'team', 'settings', 'help']) {
      const result = await expectRouteHealthy(page, tab);
      routeReports.push({ tab, gated: result.gated, unavailable: result.unavailable, textStart: result.text.slice(0, 1000) });
      await expectNoHorizontalOverflow(page, tab);
    }

    await expectRouteHealthy(page, 'today');
    const beforeHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const menuOpened = await openMenu(page);
    const afterHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    if (menuOpened) {
      expect(afterHeight, 'Drawer menu should overlay the app, not shove the whole page downward').toBeLessThanOrEqual(beforeHeight + 240);
    }
    await closeTransientUi(page);

    await attachReport(testInfo, '06-mobile-layout-report.json', {
      runId: RUN_ID,
      routeReports,
      menuOpened,
      beforeHeight,
      afterHeight,
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
