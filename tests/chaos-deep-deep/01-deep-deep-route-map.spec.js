const { test, expect } = require('@playwright/test');
const {
  RUN_ID, ROUTES, ownerLikeCreds, requireCreds, watchForProblems, login, expectVersion, expectRouteHealthy,
  pageMetrics, attachReport, summarizeProblems, PERMISSION_GATE_RE,
} = require('./utils/deep-helpers');

test.describe('86 Chaos DEEP DEEP route map and screen contracts', () => {
  test('every major app route loads, exposes expected content, charts/panels/buttons, and no fatal shell', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Mobile has its own route/layout suite.');
    test.setTimeout(540000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const reports = [];
    for (const route of ROUTES) {
      const result = await expectRouteHealthy(page, route, { settleMs: 1000 });
      const metrics = await pageMetrics(page);
      const gated = result.gated || PERMISSION_GATE_RE.test(result.text);
      const unavailable = result.unavailable;

      if (!gated && !unavailable) {
        expect(metrics.buttons, `${route.name} should have usable controls/buttons`).toBeGreaterThanOrEqual(route.minButtons || 1);
        expect(metrics.panels, `${route.name} should render compact app panels/cards`).toBeGreaterThanOrEqual(route.minPanels || 1);
      } else {
        expect(route.mayGate, `${route.name} unexpectedly gated or unavailable`).toBeTruthy();
      }

      reports.push({ tab: route.tab, name: route.name, gated, unavailable, metrics, textStart: result.text.slice(0, 1500) });
    }

    await attachReport(testInfo, '01-deep-deep-route-map.json', { runId: RUN_ID, reports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
