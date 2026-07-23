const { test, expect } = require('@playwright/test');
const {
  RUN_ID, ownerLikeCreds, staffCredsOrNull, requireCreds, watchForProblems, login, expectVersion, expectRouteHealthy,
  bodyText, maybeClick, pageMetrics, expectNoHorizontalOverflow, attachReport, summarizeProblems,
} = require('./utils/deep-helpers');

test.describe('86 Chaos DEEP DEEP mobile layout, clock, and schedule access', () => {
  test('mobile is sleek/readable, no page sideways overflow, and Clock/Schedule are one tap away', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only suite.');
    test.setTimeout(360000);
    const account = staffCredsOrNull() || ownerLikeCreds();
    requireCreds(test, account, 'STAFF or OWNER/TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const routes = ['today', 'published', 'schedule', 'prep', 'inventory', 'settings', 'help'];
    const routeReports = [];
    for (const tab of routes) {
      const result = await expectRouteHealthy(page, { tab, name: tab, expect: /Today|Schedule|Clock|Prep|Inventory|Settings|Help|Permission|not available/i, mayGate: true }, { settleMs: 1000 });
      const metrics = await expectNoHorizontalOverflow(page, tab, 14);
      const text = await bodyText(page, 25000);
      routeReports.push({ tab, gated: result.gated, unavailable: result.unavailable, metrics, textStart: text.slice(0, 1000) });
    }

    await expectRouteHealthy(page, { tab: 'today', name: 'today' }, { settleMs: 800 });
    const quickText = await bodyText(page, 25000);
    expect(quickText, 'Mobile should expose fast access to Time Clock and Schedule').toMatch(/Time Clock|Clock\b|Schedule/i);

    const beforeMetrics = await pageMetrics(page);
    const quickClockClicked = await maybeClick(page, page.getByRole('button', { name: /Time Clock|Clock/i }).first(), { force: true, settleMs: 1000 });
    expect(quickClockClicked, 'Mobile should have an easy Time Clock button').toBeTruthy();
    await expectNoHorizontalOverflow(page, 'mobile time clock after tap', 14);
    const clockText = await bodyText(page, 30000);
    expect(clockText, 'Time Clock route should expose punch/shift controls or a valid schedule view').toMatch(/Clock In|Clock Out|Start Break|End Break|Next Shift|Timesheet|My Schedule|Published Schedule|Schedule/i);

    const quickScheduleClicked = await maybeClick(page, page.getByRole('button', { name: /^Schedule$|Schedule/i }).first(), { force: true, settleMs: 1000 });
    expect(quickScheduleClicked, 'Mobile should have an easy Schedule button').toBeTruthy();
    await expectNoHorizontalOverflow(page, 'mobile schedule after tap', 14);
    const scheduleText = await bodyText(page, 30000);
    expect(scheduleText, 'Schedule route should expose schedule content or a permission gate').toMatch(/Schedule|Coverage|Open Shifts|Availability|Publish|Permission|not available/i);

    const beforeHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const moreOpened = await maybeClick(page, page.getByRole('button', { name: /More|More tools|menu/i }).last(), { force: true, settleMs: 700 });
    const afterHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    if (moreOpened) {
      expect(afterHeight, 'Mobile More menu should overlay instead of shoving the whole app downward').toBeLessThanOrEqual(beforeHeight + 260);
      await expectNoHorizontalOverflow(page, 'mobile drawer overlay', 14);
    }

    const bottomNav = await page.locator('.native-mobile-bottom-nav').first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(bottomNav, 'Mobile bottom nav should be visible').toBeTruthy();
    const bottomNavText = await page.locator('.native-mobile-bottom-nav').first().innerText().catch(() => '');
    expect(bottomNavText, 'Mobile bottom nav should prioritize Today, Clock, Schedule, Prep, and More').toMatch(/Today[\s\S]*Clock[\s\S]*Schedule[\s\S]*Prep[\s\S]*More/i);

    await attachReport(testInfo, '06-deep-deep-mobile-clock-schedule-layout.json', {
      runId: RUN_ID,
      account: account.label,
      routeReports,
      beforeMetrics,
      quickClockClicked,
      quickScheduleClicked,
      moreOpened,
      beforeHeight,
      afterHeight,
      bottomNavText,
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
