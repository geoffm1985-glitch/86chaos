const { test, expect } = require('@playwright/test');
const { ROUTE_SPECS, ownerLikeCreds, requireCreds, login, gotoTab, clickSafeButtons, watchForProblems, summarizeProblems, attachJson } = require('./utils/audit-helpers.cjs');

test.describe('03 safe button click crawl', () => {
  test('safe visible buttons across every major tab do not crash or poison the next route', async ({ page }, testInfo) => {
    test.setTimeout(20 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    const tabResults = [];
    for (const route of ROUTE_SPECS) {
      await gotoTab(page, route.tab, { settleMs: 900 });
      const clicked = await clickSafeButtons(page, testInfo, { tab: route.tab, maxButtons: route.tab === 'financials' ? 12 : 16 });
      tabResults.push({ tab: route.tab, clicked: clicked.length });
      await gotoTab(page, route.tab, { settleMs: 500 });
    }
    await attachJson(testInfo, '03-safe-button-crawl.json', { tabResults, problems: summarizeProblems(problems) });
    expect(problems, 'Safe button crawl should not create fatal page errors or HTTP 5xx').toEqual([]);
  });
});
