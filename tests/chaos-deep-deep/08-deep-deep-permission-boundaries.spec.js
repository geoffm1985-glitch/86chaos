const { test, expect } = require('@playwright/test');
const {
  RUN_ID, ownerLikeCreds, staffCredsOrNull, systemAdminCredsOrNull, requireCreds, watchForProblems, login, expectVersion,
  expectRouteHealthy, bodyText, attachReport, summarizeProblems, INTERNAL_ADMIN_RE, PROTECTED_SECRET_RE,
} = require('./utils/deep-helpers');

const STAFF_ALLOWED = ['today', 'published', 'inventory', 'team', 'settings', 'help', 'messages', 'prep', 'recipes', 'reminders'];
const STAFF_RESTRICTED = ['godmode', 'financials', 'sales', 'labor', 'back-office', 'schedule', 'audit'];

test.describe('86 Chaos DEEP DEEP permission boundaries', () => {
  test('staff-visible pages stay clean and restricted direct URLs are gated', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Permission boundaries are desktop-route based.');
    const staff = staffCredsOrNull();
    test.skip(!staff, 'Add STAFF_EMAIL/STAFF_PASSWORD to run staff permission boundary checks.');
    test.setTimeout(360000);

    const problems = [];
    watchForProblems(page, problems);
    await login(page, staff.email, staff.password);
    await expectVersion(page);

    const reports = [];
    for (const tab of STAFF_ALLOWED) {
      const result = await expectRouteHealthy(page, { tab, name: `staff ${tab}`, mayGate: true }, { settleMs: 800 });
      expect(result.text, `Staff ${tab} should not leak internal admin surfaces`).not.toMatch(INTERNAL_ADMIN_RE);
      expect(result.text, `Staff ${tab} should not leak protected credential terms`).not.toMatch(PROTECTED_SECRET_RE);
      reports.push({ tab, allowed: true, gated: result.gated, unavailable: result.unavailable, textStart: result.text.slice(0, 1000) });
    }

    for (const tab of STAFF_RESTRICTED) {
      const result = await expectRouteHealthy(page, { tab, name: `staff restricted ${tab}`, mayGate: true }, { settleMs: 800, allowSecretTerms: true });
      expect(result.gated || result.unavailable, `Staff direct URL ${tab} should be gated/unavailable`).toBeTruthy();
      expect(result.text, `Staff direct URL ${tab} should not show internal admin labels/actions`).not.toMatch(/Backup Now|Restore Backup|Forensics Timeline|Security Diagnostics|Global Users|Access Control|Deploy Workspace|Emergency Read-Only|private_key|firebase-adminsdk/i);
      reports.push({ tab, restricted: true, gated: result.gated, unavailable: result.unavailable, textStart: result.text.slice(0, 1000) });
    }

    await attachReport(testInfo, '08-deep-deep-staff-permission-boundaries.json', { runId: RUN_ID, staff: staff.email, reports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });

  test('owner sees normal owner tools and super admin gets System Administrator only when configured', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Desktop-route permission check.');
    test.setTimeout(300000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const ownerRoutes = ['today', 'financials', 'inventory', 'schedule', 'settings'];
    const ownerReports = [];
    for (const tab of ownerRoutes) {
      const result = await expectRouteHealthy(page, { tab, name: `owner ${tab}`, mayGate: true }, { settleMs: 800 });
      const ok = result.gated || result.unavailable || /Today|Financial|Inventory|Schedule|Settings|Labor|Sales/i.test(result.text);
      expect(ok, `Owner route ${tab} should expose normal owner tools or a valid gate`).toBeTruthy();
      ownerReports.push({ tab, gated: result.gated, unavailable: result.unavailable, textStart: result.text.slice(0, 1000) });
    }

    const sys = systemAdminCredsOrNull();
    const sysReport = { configured: Boolean(sys) };
    if (sys) {
      const sysPage = await page.context().newPage();
      const sysProblems = [];
      watchForProblems(sysPage, sysProblems);
      await login(sysPage, sys.email, sys.password);
      await expectVersion(sysPage);
      const result = await expectRouteHealthy(sysPage, { tab: 'godmode', name: 'system admin', mayGate: false }, { settleMs: 1000 });
      expect(result.text, 'Configured system admin should see System Administrator console').toMatch(/System Administrator|Backup Center|Security Center|Forensics|Platform Health/i);
      expect(result.text, 'System Administrator console should not leak raw server secrets').not.toMatch(/private_key|refresh token|access token|firebase-adminsdk/i);
      sysReport.textStart = result.text.slice(0, 1200);
      sysReport.problems = summarizeProblems(sysProblems);
      expect(sysProblems, JSON.stringify(summarizeProblems(sysProblems), null, 2)).toEqual([]);
      await sysPage.close().catch(() => {});
    }

    await attachReport(testInfo, '08-deep-deep-owner-system-permission-boundaries.json', { runId: RUN_ID, owner: account.email, ownerReports, sysReport, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
