// 86 Chaos Performance / Slow Page Deep Test
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  assertNoUnavailablePage,
  attachReport,
} = require('./utils/chaos-helpers');

const PERFORMANCE_TABS = ['today', 'inventory', 'schedule', 'published', 'financials', 'back-office', 'team', 'messages', 'settings', 'help'];
const DEFAULT_ROUTE_BUDGET_MS = Number(process.env.PLAYWRIGHT_ROUTE_BUDGET_MS || 12000);
const INVENTORY_BUDGET_MS = Number(process.env.PLAYWRIGHT_INVENTORY_BUDGET_MS || 18000);
const SCHEDULE_BUDGET_MS = Number(process.env.PLAYWRIGHT_SCHEDULE_BUDGET_MS || 18000);

test.describe('86 Chaos Performance / Slow Page Deep Test', () => {
  test('login and chunky pages stay under rough performance budgets', async ({ page }, testInfo) => {
    test.setTimeout(420000);
    const problems = [];
    const report = { runId: RUN_ID, loginMs: null, routes: [] };
    watchForProblems(page, problems);

    const account = ownerLikeCreds();
    const loginStart = Date.now();
    await login(page, account.email, account.password);
    report.loginMs = Date.now() - loginStart;
    if (report.loginMs > Number(process.env.PLAYWRIGHT_LOGIN_BUDGET_MS || 30000)) {
      problems.push({ type: 'login-slow', loginMs: report.loginMs });
    }

    for (const tab of PERFORMANCE_TABS) {
      const start = Date.now();
      await gotoTab(page, tab).catch((error) => problems.push({ type: 'route-load-failed', tab, message: error.message, url: page.url() }));
      const loadMs = Date.now() - start;
      await assertNoUnavailablePage(page, problems, `Performance ${tab}`);
      const text = await bodyText(page);
      const budget = tab === 'inventory' ? INVENTORY_BUDGET_MS : ['schedule', 'published'].includes(tab) ? SCHEDULE_BUDGET_MS : DEFAULT_ROUTE_BUDGET_MS;
      const perf = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return nav ? {
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          loadEvent: Math.round(nav.loadEventEnd - nav.startTime),
          transferSize: nav.transferSize || 0,
        } : null;
      }).catch(() => null);
      report.routes.push({ tab, loadMs, budget, perf, textStart: text.slice(0, 350) });
      if (loadMs > budget) problems.push({ type: 'route-slow', tab, loadMs, budget, url: page.url() });
      if (/undefined|NaN|TypeError|ReferenceError/i.test(text)) problems.push({ type: 'visible-bad-value', tab, textStart: text.slice(0, 900), url: page.url() });
    }

    await attachReport(testInfo, 'performance-slow-pages-report.json', { report, problems });
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
