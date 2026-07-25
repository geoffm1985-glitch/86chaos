// 86 Chaos Production Deep Deep Deep Suite
// 03: Calculation-heavy pages should not render broken math or bad date/money/hour output.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  TAB_LABELS,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const CALC_TABS = ['published', 'schedule', 'financials', 'back-office', 'inventory', 'menu-intelligence', 'prep', 'recipes', 'team', 'maintenance'];
const brokenMathRe = /\bNaN\b|\bInfinity\b|Invalid Date|undefined|null null|undefined undefined|\$NaN|NaNh|NaN%|\b0\/0\b/i;
const suspectMoneyRe = /\$\s*-?\s*NaN|\$\s*undefined|\$\s*null/i;
const suspectPercentRe = /NaN\s*%|Infinity\s*%/i;
const suspectHourRe = /NaN\s*(?:h|hr|hrs|hours)|undefined\s*(?:h|hr|hrs|hours)/i;

async function collectNumbers(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    const money = Array.from(text.matchAll(/\$\s?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\s?-?\d+(?:\.\d{2})?/g)).map((m) => m[0]).slice(0, 80);
    const percents = Array.from(text.matchAll(/-?\d+(?:\.\d+)?\s?%/g)).map((m) => m[0]).slice(0, 80);
    const hours = Array.from(text.matchAll(/-?\d+(?:\.\d+)?\s?(?:h|hr|hrs|hours)\b/gi)).map((m) => m[0]).slice(0, 80);
    const dates = Array.from(text.matchAll(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)\b[^\n]{0,60}/g)).map((m) => m[0]).slice(0, 80);
    return { money, percents, hours, dates, textStart: text.slice(0, 3500) };
  });
}

test.describe('86 Chaos production readiness: calculations and display integrity', () => {
  test.beforeEach(async ({ page }) => {
    const account = ownerLikeCreds();
    requireCreds(test, account, 'owner-like account');
    await login(page, account.email, account.password);
    await expectVersion(page);
  });

  for (const tab of CALC_TABS) {
    test(`math/display guard: ${tab}`, async ({ page }, testInfo) => {
      const problems = [];
      watchForProblems(page, problems);
      const route = await expectRouteHealthy(page, tab, { allowGate: true, expected: TAB_LABELS[tab], routeReadyTimeout: 55000, settleMs: 1200 });
      const text = await bodyText(page, 22000);
      const numbers = await collectNumbers(page);

      expect(text, `${tab} should not display broken math/date placeholders`).not.toMatch(brokenMathRe);
      expect(text, `${tab} should not display broken money`).not.toMatch(suspectMoneyRe);
      expect(text, `${tab} should not display broken percentages`).not.toMatch(suspectPercentRe);
      expect(text, `${tab} should not display broken hours`).not.toMatch(suspectHourRe);

      await attachReport(testInfo, `03-calculation-display-${tab}.json`, {
        runId: RUN_ID,
        baseUrl: BASE_URL,
        tab,
        route,
        numbers,
        problems: summarizeProblems(problems),
      });

      expect(problems, `${tab} calculation pages should not create fatal browser/network problems`).toEqual([]);
    });
  }
});
