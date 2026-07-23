// 86 Chaos 15.1.10 full financials + schedule smoke/deep pass.
// Default mode is safe/non-mutating. Set CHAOS_ALLOW_MUTATION=1 only on testing/local if you want optional clicks.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  ownerLikeCreds,
  managerCredsOrOwner,
  requireCreds,
  isMutationAllowed,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  maybeClick,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

test.describe('86 Chaos Full Financials + Schedule Current Suite', () => {
  test('version, financials, back-office, and schedule builder are current and stable', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);

    await login(page, account.email, account.password);
    await expectVersion(page);

    const routeResults = [];
    for (const tab of ['today', 'financials', 'sales', 'labor', 'back-office', 'schedule', 'published']) {
      routeResults.push(await expectRouteHealthy(page, tab, { allowGate: tab !== 'today' }));
    }

    const financialText = routeResults.find((r) => r.tab === 'financials')?.text || '';
    expect(financialText, 'Financials should still include the core finance buckets').toMatch(/Financial|Daily Ledger|Sales|Labor|Timesheet|Prime Cost|Profit|Reports/i);

    const backOfficeText = routeResults.find((r) => r.tab === 'back-office')?.text || '';
    expect(backOfficeText, 'Back Office should remain review/export/accounting oriented when available').toMatch(/Back Office|QuickBooks|Accountant|Approval|Document|Owner Summary|Export|Permission|not available/i);
    expect(backOfficeText, 'QuickBooks must not claim automatic live posting').not.toMatch(/auto.?post|automatic live posting|posts automatically/i);

    const scheduleText = routeResults.find((r) => r.tab === 'schedule')?.text || '';
    expect(scheduleText, 'Schedule area should expose builder/publish/coverage concepts for owner-like accounts').toMatch(/Schedule Builder|Assign|Publish|Auto.?Schedule|Auto.?Fill|Template|Coverage|Schedule|Permission|not available/i);

    if (isMutationAllowed()) {
      await expectRouteHealthy(page, 'schedule');
      await maybeClick(page, page.getByRole('button', { name: /assign|schedule builder|auto schedule|quick actions/i }).first());
      await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error/i);
    }

    await attachReport(testInfo, '00-full-financials-schedule-current-report.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      mutationEnabled: isMutationAllowed(),
      routes: routeResults.map(({ tab, gated, unavailable, text }) => ({ tab, gated, unavailable, textStart: text.slice(0, 1000) })),
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });

  test('manager-compatible schedule and published schedule routes do not crash', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const account = managerCredsOrOwner();
    requireCreds(test, account, 'MANAGER or OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);

    const routeResults = [];
    for (const tab of ['published', 'schedule']) {
      routeResults.push(await expectRouteHealthy(page, tab));
    }

    const text = await bodyText(page);
    expect(text, 'Schedule routes should not expose fatal blank/broken states').not.toMatch(/No test found|undefined is not/i);

    await attachReport(testInfo, '00-manager-schedule-current-report.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      routes: routeResults.map(({ tab, gated, unavailable, text }) => ({ tab, gated, unavailable, textStart: text.slice(0, 1000) })),
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
