// 86 Chaos 15.0.95 Reminders + push dispatch UI/API safety checks.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
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

test.describe('86 Chaos Reminders + Push Dispatch', () => {
  test('reminders route and push-related surfaces render safely', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const reminders = await expectRouteHealthy(page, 'reminders');
    expect(reminders.text, 'Reminders should render personal/shared reminder language or a valid gate').toMatch(/Reminder|Personal|Shared|Due|Schedule|Permission|not available/i);

    const today = await expectRouteHealthy(page, 'today');
    expect(today.text, 'Today route should not show push/reminder fatal errors').not.toMatch(/dispatch failed|push token crash|undefined.*reminder/i);

    // Protected API endpoints should not be openly successful without server auth/secret.
    const endpoints = ['/api/dispatch-reminders', '/api/send-push'];
    const apiReports = [];
    for (const endpoint of endpoints) {
      const response = await request.get(`${BASE_URL}${endpoint}`, { failOnStatusCode: false }).catch((error) => ({ error }));
      if (response.error) {
        apiReports.push({ endpoint, error: response.error.message });
        continue;
      }
      apiReports.push({ endpoint, status: response.status() });
      expect(response.status(), `${endpoint} should not be openly executable by an unauthenticated GET`).not.toBe(200);
    }

    await attachReport(testInfo, '05-reminders-push-dispatch-report.json', {
      runId: RUN_ID,
      remindersText: reminders.text.slice(0, 1200),
      todayText: today.text.slice(0, 1200),
      apiReports,
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
