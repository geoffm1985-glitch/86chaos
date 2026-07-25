// Failed-only regression: safe button crawl tabs that failed in the production run.
// This is intentionally smaller than the nuclear crawl: today, financials, back-office only.
const { test, expect } = require('@playwright/test');
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
  visibleSafeButtons,
  FATAL_UI_RE,
  BROKEN_VISIBLE_VALUE_RE,
} = require('./utils/failed-only-helpers');

test.describe('86 Chaos failed-only safe button crawl regressions', () => {
  test.setTimeout(180000);

  const failedButtonTabs = ['today', 'financials', 'back-office'];

  test.beforeEach(async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const problems = [];
    watchForProblems(page, problems);
    testInfo.problems = problems;
    await login(page, account.email, account.password);
  });

  for (const tab of failedButtonTabs) {
    test(`previously failed safe button crawl now stays stable: ${tab}`, async ({ page }, testInfo) => {
      await expectRouteClean(page, tab, testInfo, {
        routeReadyTimeout: 50000,
        expected: tab === 'today' ? /Manager Brief|Today|Need Attention|Clocked In|On Schedule/i : undefined,
      });

      const buttons = await visibleSafeButtons(page);
      const failures = [];

      for (const item of buttons) {
        const beforeUrl = page.url();
        const beforeText = await bodyText(page, 6000);
        try {
          await dismissBlockingModals(page);
          await item.locator.click({ timeout: 5000 });
          await page.waitForTimeout(350);
          await dismissBlockingModals(page);
          const afterText = await bodyText(page, 8000);
          const afterUrl = page.url();

          if (FATAL_UI_RE.test(afterText) || BROKEN_VISIBLE_VALUE_RE.test(afterText)) {
            failures.push({
              button: item.name,
              index: item.index,
              beforeUrl,
              afterUrl,
              reason: 'fatal-or-broken-visible-output-after-click',
              beforeText: beforeText.slice(0, 1200),
              afterText: afterText.slice(0, 1800),
            });
          }
        } catch (error) {
          failures.push({
            button: item.name,
            index: item.index,
            beforeUrl,
            afterUrl: page.url(),
            reason: error.message,
            beforeText: beforeText.slice(0, 1200),
          });
        } finally {
          // Reset the tab between clicks so one drawer/modal doesn't poison the next button.
          await page.goto(`${BASE_URL}/?tab=${encodeURIComponent(tab)}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.waitForTimeout(450);
          await dismissBlockingModals(page);
        }
      }

      await attachReport(testInfo, `${tab}-failed-only-button-crawl.json`, {
        runId: RUN_ID,
        baseUrl: BASE_URL,
        tab,
        buttonsChecked: buttons.map((b) => ({ name: b.name, index: b.index })),
        failures,
        runtimeProblems: testInfo.problems || [],
      });

      expect(failures, `${tab} should not have safe visible button click failures`).toEqual([]);
      expect(testInfo.problems || [], `${tab} should not throw console/page/server failures during failed-only crawl`).toEqual([]);
    });
  }
});
