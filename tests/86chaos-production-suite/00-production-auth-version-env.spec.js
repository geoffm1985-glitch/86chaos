// 86 Chaos Production Deep Deep Deep Suite
// 00: Environment, auth, version, app-shell health, and problem watchers.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  EXPECTED_VERSION,
  ownerLikeCreds,
  managerCredsOrOwner,
  staffCredsOrNull,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  bodyText,
  attachReport,
  summarizeProblems,
  envDebugSummary,
} = require('./utils/chaos-helpers');

const fatalRe = /Application error|Unhandled Runtime Error|Cannot read properties of undefined|Minified React error|Something went wrong|NaN|Infinity/i;

test.describe('86 Chaos production readiness: auth/version/env', () => {
  test('owner-like account can log in, sees expected version, and has no fatal shell errors', async ({ page }, testInfo) => {
    const problems = [];
    watchForProblems(page, problems);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'owner-like account');

    const text = await login(page, account.email, account.password);
    await expectVersion(page, EXPECTED_VERSION);
    expect(text, 'App shell should not show fatal text immediately after login').not.toMatch(fatalRe);

    await attachReport(testInfo, '00-auth-version-env.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      expectedVersion: EXPECTED_VERSION,
      accountLabel: account.label,
      env: envDebugSummary(),
      problems: summarizeProblems(problems),
      textStart: (await bodyText(page, 4000)).slice(0, 4000),
    });

    expect(problems, 'Owner login should not create page errors, console TypeErrors, or HTTP 5xx responses').toEqual([]);
  });

  test('manager account, when configured, can log in without fatal UI', async ({ page }, testInfo) => {
    const account = managerCredsOrOwner();
    requireCreds(test, account, 'manager or owner fallback account');
    const problems = [];
    watchForProblems(page, problems);
    const text = await login(page, account.email, account.password);
    await expectVersion(page, EXPECTED_VERSION);
    expect(text, 'Manager/fallback login should not show fatal UI').not.toMatch(fatalRe);
    await attachReport(testInfo, '00-manager-login.json', {
      runId: RUN_ID,
      label: account.label,
      problems: summarizeProblems(problems),
      textStart: text.slice(0, 3500),
    });
    expect(problems, 'Manager/fallback login should not create fatal browser problems').toEqual([]);
  });

  test('staff account, when configured, can log in without fatal UI', async ({ page }, testInfo) => {
    const account = staffCredsOrNull();
    if (!account) {
      testInfo.skip(true, 'STAFF_EMAIL/STAFF_PASSWORD not configured. Add staff creds to test staff production behavior.');
      return;
    }
    const problems = [];
    watchForProblems(page, problems);
    const text = await login(page, account.email, account.password);
    await expectVersion(page, EXPECTED_VERSION);
    expect(text, 'Staff login should not show fatal UI').not.toMatch(fatalRe);
    await attachReport(testInfo, '00-staff-login.json', {
      runId: RUN_ID,
      label: account.label,
      problems: summarizeProblems(problems),
      textStart: text.slice(0, 3500),
    });
    expect(problems, 'Staff login should not create fatal browser problems').toEqual([]);
  });
});
