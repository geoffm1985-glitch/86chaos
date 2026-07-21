// 86 Chaos 15.0.95 Voice Command surface checks.
// Avoids triggering the browser microphone permission prompt unless explicitly enabled.
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
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

test.describe('86 Chaos Voice Command Deep Checks', () => {
  test('voice dock/help surfaces render without exposing unsafe automation promises', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const routeReports = [];
    for (const tab of ['today', 'help', 'prep', 'inventory', 'reminders']) {
      const result = await expectRouteHealthy(page, tab);
      routeReports.push({ tab, gated: result.gated, unavailable: result.unavailable, textStart: result.text.slice(0, 1200) });
    }

    const combined = (await bodyText(page, 20000)) + '\n' + routeReports.map((r) => r.textStart).join('\n');
    expect(combined, 'Voice/help surfaces should not promise direct System Admin/Python mutation').not.toMatch(/Python automation can change restaurant records|auto.?apply recommendations|push accounting changes automatically/i);

    // The dock may be icon-only, so this is intentionally broad and non-brittle.
    expect(combined, 'Current app should still contain operational surfaces voice commands depend on').toMatch(/Prep|Inventory|Reminder|Help|86|Open Prep|Recipe/i);

    await attachReport(testInfo, '04-voice-command-deep-report.json', { runId: RUN_ID, routeReports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
