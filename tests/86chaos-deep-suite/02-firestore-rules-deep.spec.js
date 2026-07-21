// 86 Chaos 15.0.95 Firestore/security rules UI safety checks.
// This does not replace Firebase emulator rule tests. It verifies that restricted UI surfaces do not expose protected data/actions.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  staffCredsOrNull,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  INTERNAL_ADMIN_DEBUG_RE,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const PROTECTED_DATA_LEAK_RE = /service account|private_key|client_email|firebase-adminsdk|CRON_SECRET|MASTER_ADMIN_EMAILS|refresh token|access token/i;

test.describe('86 Chaos Firestore Rules + Protected Surface Deep Checks', () => {
  test('owner routes render without leaking server secrets', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const routeReports = [];
    for (const tab of ['today', 'financials', 'back-office', 'inventory', 'team', 'settings', 'help']) {
      const result = await expectRouteHealthy(page, tab);
      routeReports.push({ tab, gated: result.gated, unavailable: result.unavailable, textStart: result.text.slice(0, 1000) });
      expect(result.text, `${tab} should not leak protected env/server credential material`).not.toMatch(PROTECTED_DATA_LEAK_RE);
    }

    await attachReport(testInfo, '02-owner-protected-surface-report.json', { runId: RUN_ID, routeReports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });

  test('staff cannot see admin diagnostics or protected setup instructions', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const account = staffCredsOrNull();
    requireCreds(test, account, 'STAFF');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const checked = [];
    for (const tab of ['godmode', 'back-office', 'financials', 'schedule']) {
      await expectRouteHealthy(page, tab);
      const text = await bodyText(page);
      checked.push({ tab, textStart: text.slice(0, 1000) });
      expect(text, `${tab} should not expose internal admin diagnostics to STAFF`).not.toMatch(INTERNAL_ADMIN_DEBUG_RE);
      expect(text, `${tab} should not expose protected env/server credential material to STAFF`).not.toMatch(PROTECTED_DATA_LEAK_RE);
    }

    await attachReport(testInfo, '02-staff-protected-surface-report.json', { runId: RUN_ID, checked, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
