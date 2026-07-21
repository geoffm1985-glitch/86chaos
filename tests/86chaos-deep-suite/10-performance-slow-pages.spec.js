// 86 Chaos 15.0.96 performance/slow page route timing checks.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const MAX_ROUTE_MS = Number(process.env.CHAOS_ROUTE_MAX_MS || 30000);

test.describe('86 Chaos Performance / Slow Pages', () => {
  test('key app routes render under the configured route budget', async ({ page }, testInfo) => {
    test.setTimeout(360000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const reports = [];
    for (const tab of ['today', 'inventory', 'financials', 'back-office', 'schedule', 'team', 'settings', 'help']) {
      const start = Date.now();
      const result = await expectRouteHealthy(page, tab, { settleMs: 1200, timeout: MAX_ROUTE_MS });
      const elapsedMs = Date.now() - start;
      reports.push({ tab, elapsedMs, gated: result.gated, unavailable: result.unavailable, textStart: result.text.slice(0, 800) });
      expect(elapsedMs, `${tab} should render within ${MAX_ROUTE_MS}ms`).toBeLessThanOrEqual(MAX_ROUTE_MS);
    }

    await attachReport(testInfo, '10-performance-slow-pages-report.json', { runId: RUN_ID, maxRouteMs: MAX_ROUTE_MS, reports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
