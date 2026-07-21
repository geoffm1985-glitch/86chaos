// 86 Chaos 15.0.96 backup/restore/admin safety checks.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  hasCreds,
  creds,
  staffCredsOrNull,
  ownerLikeCreds,
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

test.describe('86 Chaos Backup / Restore / Admin Safety', () => {
  test('staff godmode is a generic permission gate with no admin diagnostics', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const account = staffCredsOrNull();
    requireCreds(test, account, 'STAFF');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const result = await expectRouteHealthy(page, 'godmode');
    const text = await bodyText(page);
    expect(result.gated || result.unavailable, 'STAFF godmode should be gated or unavailable').toBeTruthy();
    expect(text, 'STAFF godmode must not expose super-admin diagnostics/setup instructions').not.toMatch(INTERNAL_ADMIN_DEBUG_RE);
    expect(text, 'STAFF godmode should not expose dangerous backup/restore actions').not.toMatch(/Backup Now|Restore Backup|Nuke|Grant Access|Security Diagnostics|Forensics Timeline/i);

    await attachReport(testInfo, '09-staff-admin-safety-report.json', { runId: RUN_ID, textStart: text.slice(0, 1500), problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });

  test('system admin route is available only to configured super admin credentials', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const account = hasCreds('SYSTEM_ADMIN') ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(test, account, 'SYSTEM_ADMIN or OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const result = await expectRouteHealthy(page, 'godmode');
    const text = await bodyText(page);

    if (/SYSTEM_ADMIN/i.test(account.label)) {
      expect(text, 'Configured SYSTEM_ADMIN should see admin center content').toMatch(/System Administrator|Backup Center|Security Center|Forensics|Admin/i);
      expect(text, 'Admin center should not display raw private keys or tokens').not.toMatch(/private_key|refresh token|access token|firebase-adminsdk/i);
    } else {
      expect(result.gated || result.unavailable, 'Non-system-admin owner/test account should not get raw godmode unless configured as super admin').toBeTruthy();
    }

    await attachReport(testInfo, '09-system-admin-route-report.json', { runId: RUN_ID, account: account.label, result: { gated: result.gated, unavailable: result.unavailable }, textStart: text.slice(0, 1500), problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
