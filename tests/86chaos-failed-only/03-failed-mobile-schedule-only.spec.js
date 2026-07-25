// Failed-only regression: mobile Time Clock & Schedule timeout / availability usability.
// This avoids the full long schedule suite and checks only the surfaces involved in the failure.
const { test, expect, devices } = require('@playwright/test');

// Playwright does not allow test.use({ ...devices['Pixel 7'] }) inside a describe
// when the device preset changes defaultBrowserType / worker options. Keep it top-level.
test.use({ ...devices['Pixel 7'] });
const {
  RUN_ID,
  BASE_URL,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectRouteClean,
  bodyText,
  attachReport,
  dismissBlockingModals,
  assertNoHorizontalOverflow,
  clickScheduleSubtab,
  FATAL_UI_RE,
  BROKEN_VISIBLE_VALUE_RE,
} = require('./utils/failed-only-helpers');

test.describe('86 Chaos failed-only mobile Time Clock & Schedule regressions', () => {
  test.setTimeout(150000);

  test('mobile schedule subtabs and availability remain usable without timeout or sideways overflow', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const problems = [];
    watchForProblems(page, problems);

    await login(page, account.email, account.password);
    await expectRouteClean(page, 'published', testInfo, {
      expected: /My Schedule|Clock In|Clock Out|Request Off|Availability|Full Schedule|Month View/i,
      routeReadyTimeout: 55000,
    });

    const subTabs = [
      { name: /my schedule/i, expected: /My Schedule|No upcoming shifts|Next:|Clock In|Clock Out/i },
      { name: /full schedule/i, expected: /Full Schedule|Active Roster|No shifts|published shifts|Jump to Date/i },
      { name: /month view/i, expected: /Month View|Schedule|Sun|Mon|Tue|Wed|Thu|Fri|Sat/i },
      { name: /request off/i, expected: /Request Off|Tap specific dates|Partial Day|Submit/i },
      { name: /availability/i, expected: /My Availability|Availability|Effective Start|Preferred shift window|Submit Availability Change/i },
    ];

    const results = [];
    for (const subTab of subTabs) {
      const clicked = await clickScheduleSubtab(page, subTab.name, testInfo);
      expect(clicked, `Should be able to open schedule subtab ${subTab.name}`).toBeTruthy();
      await assertNoHorizontalOverflow(page, `mobile ${subTab.name}`);
      const text = await bodyText(page, 12000);
      expect(text, `${subTab.name} should not show fatal UI`).not.toMatch(FATAL_UI_RE);
      expect(text, `${subTab.name} should not show broken visible values`).not.toMatch(BROKEN_VISIBLE_VALUE_RE);
      expect(text, `${subTab.name} should render expected content`).toMatch(subTab.expected);
      results.push({ name: String(subTab.name), textStart: text.slice(0, 1500) });
    }

    await attachReport(testInfo, 'mobile-schedule-failed-only-summary.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      results,
      runtimeProblems: problems,
    });

    expect(problems, 'Mobile schedule failed-only test should not throw console/page/server failures').toEqual([]);
  });
});
