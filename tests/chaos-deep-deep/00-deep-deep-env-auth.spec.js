const { test, expect } = require('@playwright/test');
const {
  RUN_ID, BASE_URL, EXPECTED_VERSION, ownerLikeCreds, staffCredsOrNull, systemAdminCredsOrNull, requireCreds,
  watchForProblems, login, expectVersion, bodyText, pageMetrics, attachReport, summarizeProblems, envDebugSummary,
} = require('./utils/deep-helpers');

test.describe('86 Chaos DEEP DEEP baseline auth/environment', () => {
  test('environment, login, version, shell, and starting dashboard are valid', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Covered by the mobile-specific layout suite.');
    test.setTimeout(240000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);

    const loginText = await login(page, account.email, account.password);
    const version = await expectVersion(page);
    const metrics = await pageMetrics(page);
    const text = await bodyText(page, 60000);

    expect(text, 'Logged-in app should expose a real app shell/dashboard, not just the login card').toMatch(/Today|Schedule|Inventory|Settings|Help Center|86 Chaos|Workspace/i);
    expect(metrics.buttons, 'App shell should expose clickable controls after login').toBeGreaterThanOrEqual(8);
    expect(metrics.panels, 'App shell should expose dashboard cards/panels after login').toBeGreaterThanOrEqual(4);
    expect(text, 'App should not leak backend credentials on first load').not.toMatch(/private_key|firebase-adminsdk|CRON_SECRET|service account key/i);

    await attachReport(testInfo, '00-deep-deep-env-auth.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      expectedVersion: EXPECTED_VERSION,
      resolvedVersion: version,
      ownerSeen: Boolean(account.email && account.password),
      staffSeen: Boolean(staffCredsOrNull()),
      systemAdminSeen: Boolean(systemAdminCredsOrNull()),
      metrics,
      env: envDebugSummary(),
      textStart: text.slice(0, 1500),
      loginTextStart: loginText.slice(0, 1000),
      problems: summarizeProblems(problems),
    });

    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
