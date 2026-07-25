// 86 Chaos Production Deep Deep Deep Suite
// 04: Permission and role-gate sweep.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  TAB_LABELS,
  STAFF_VISIBLE_FORBIDDEN_RE,
  STAFF_UNLOCKED_RESTRICTED_CONTENT_RE,
  ownerLikeCreds,
  managerCredsOrOwner,
  staffCredsOrNull,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const STAFF_ALLOWED_TABS = ['today', 'published', 'prep', 'recipes', 'messages', 'reminders', 'team', 'settings', 'help', 'maintenance'];
const STAFF_RESTRICTED_TABS = ['schedule', 'financials', 'back-office', 'inventory', 'menu-intelligence', 'ai-tools', 'godmode', 'audit', 'hr-training'];
const OWNER_ADMIN_TABS = ['schedule', 'financials', 'back-office', 'inventory', 'menu-intelligence', 'team', 'settings', 'godmode', 'audit'];
const fatalRe = /Application error|Unhandled Runtime Error|Cannot read properties of undefined|Minified React error|Something went wrong/i;
const gateRe = /Plan & Permission Gate|Your role does not include this tool|not authorized|permission|not available|internal-only/i;

test.describe('86 Chaos production readiness: permissions and role gates', () => {
  test('owner/manager routes do not accidentally gate core management tools', async ({ page }, testInfo) => {
    const account = managerCredsOrOwner();
    requireCreds(test, account, 'manager or owner fallback account');
    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const reports = [];
    for (const tab of OWNER_ADMIN_TABS) {
      const route = await expectRouteHealthy(page, tab, { allowGate: true, expected: TAB_LABELS[tab], routeReadyTimeout: 55000, settleMs: 900 });
      const text = await bodyText(page, 12000);
      reports.push({ tab, gated: route.gated, unavailable: route.unavailable, textStart: text.slice(0, 1500) });
      expect(text, `${tab} should not show fatal UI for manager/owner`).not.toMatch(fatalRe);
    }

    await attachReport(testInfo, '04-owner-manager-permission-sweep.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      accountLabel: account.label,
      reports,
      problems: summarizeProblems(problems),
    });

    expect(problems, 'Owner/manager permission sweep should not create fatal browser/network problems').toEqual([]);
  });

  test('staff can use staff-facing tools without seeing unlocked admin surfaces', async ({ page }, testInfo) => {
    const account = staffCredsOrNull();
    if (!account) {
      testInfo.skip(true, 'STAFF_EMAIL/STAFF_PASSWORD not configured. Add staff creds to test staff gates.');
      return;
    }
    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const allowedReports = [];
    for (const tab of STAFF_ALLOWED_TABS) {
      const route = await expectRouteHealthy(page, tab, { allowGate: true, expected: TAB_LABELS[tab], routeReadyTimeout: 55000, settleMs: 900 });
      const text = await bodyText(page, 16000);
      allowedReports.push({ tab, gated: route.gated, unavailable: route.unavailable, textStart: text.slice(0, 1800) });
      expect(text, `${tab} staff-facing route should not show fatal UI`).not.toMatch(fatalRe);
      expect(text, `${tab} should not show unlocked restricted pay/admin/backup controls to staff`).not.toMatch(STAFF_UNLOCKED_RESTRICTED_CONTENT_RE);
    }

    const restrictedReports = [];
    for (const tab of STAFF_RESTRICTED_TABS) {
      const route = await expectRouteHealthy(page, tab, { allowGate: true, expected: TAB_LABELS[tab], routeReadyTimeout: 55000, settleMs: 900 });
      const text = await bodyText(page, 16000);
      const gated = route.gated || route.unavailable || gateRe.test(text);
      restrictedReports.push({ tab, gated, routeGated: route.gated, unavailable: route.unavailable, textStart: text.slice(0, 1800) });
      expect(text, `${tab} restricted route should not fatal for staff`).not.toMatch(fatalRe);
      if (!gated) {
        expect(text, `${tab} should not expose unlocked restricted controls/content to staff`).not.toMatch(STAFF_VISIBLE_FORBIDDEN_RE);
        expect(text, `${tab} should not expose unlocked restricted actions to staff`).not.toMatch(STAFF_UNLOCKED_RESTRICTED_CONTENT_RE);
      }
    }

    await attachReport(testInfo, '04-staff-permission-sweep.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      allowedReports,
      restrictedReports,
      problems: summarizeProblems(problems),
    });

    expect(problems, 'Staff permission sweep should not create fatal browser/network problems').toEqual([]);
  });
});
