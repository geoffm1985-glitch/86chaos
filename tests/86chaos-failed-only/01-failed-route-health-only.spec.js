// Failed-only regression: routes that failed in the production run.
// This closes Employee Quick Start first, then verifies only the previously failed tabs.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectRouteClean,
  attachReport,
  FAILED_ROUTE_EXPECTED,
} = require('./utils/failed-only-helpers');

test.describe('86 Chaos failed-only route health regressions', () => {
  test.setTimeout(180000);

  const failedTabs = [
    'financials',
    'back-office',
    'recipes',
    'messages',
    'team',
    'maintenance',
    'help',
    'godmode',
  ];

  let account;

  test.beforeEach(async ({ page }, testInfo) => {
    account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const problems = [];
    watchForProblems(page, problems);
    testInfo.problems = problems;
    await login(page, account.email, account.password);
  });

  for (const tab of failedTabs) {
    test(`previously failed route now renders cleanly: ${tab}`, async ({ page }, testInfo) => {
      const allowGate = tab === 'godmode';
      const result = await expectRouteClean(page, tab, testInfo, {
        allowGate,
        expected: FAILED_ROUTE_EXPECTED[tab],
        routeReadyTimeout: 50000,
      });

      await attachReport(testInfo, `${tab}-failed-only-route-summary.json`, {
        runId: RUN_ID,
        baseUrl: BASE_URL,
        tab,
        allowGate,
        gated: result.gated,
        visibleTextStart: result.text.slice(0, 2500),
        runtimeProblems: testInfo.problems || [],
      });

      expect(testInfo.problems || [], `${tab} should not throw console/page/server failures`).toEqual([]);
    });
  }
});
