// 86 Chaos 15.0.95 Inventory, invoice scanner, menu intelligence, and AI ordering smoke/deep checks.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  maybeClick,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

test.describe('86 Chaos Inventory + Invoice + AI Ordering', () => {
  test('inventory and ordering intelligence routes are stable and review-first', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const routeReports = [];
    for (const tab of ['inventory', 'menu-intelligence', 'ai-tools']) {
      const result = await expectRouteHealthy(page, tab);
      routeReports.push({ tab, gated: result.gated, unavailable: result.unavailable, textStart: result.text.slice(0, 1200) });
    }

    const inventoryText = routeReports.find((r) => r.tab === 'inventory')?.textStart || (await bodyText(page));
    expect(inventoryText, 'Inventory should still show inventory/vendor/invoice concepts').toMatch(/Inventory|Vendor|Invoice|Par|Burn|Waste|Order|COGS/i);

    await expectRouteHealthy(page, 'inventory');
    await maybeClick(page, page.getByRole('button', { name: /invoice|scan|upload/i }).first());
    const afterClickText = await bodyText(page);
    expect(afterClickText, 'Invoice scanner should remain review/upload oriented, not auto-posting').not.toMatch(/posts automatically|auto.?post to quickbooks|live posting without approval/i);

    await attachReport(testInfo, '03-inventory-ai-ordering-report.json', { runId: RUN_ID, routes: routeReports, afterClickText: afterClickText.slice(0, 1200), problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
