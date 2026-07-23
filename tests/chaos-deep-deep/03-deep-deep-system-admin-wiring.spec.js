const { test, expect } = require('@playwright/test');
const {
  RUN_ID, ownerLikeCreds, systemAdminCredsOrNull, requireCreds, watchForProblems, login, expectVersion, gotoTab,
  bodyText, maybeClick, assertNoFatal, attachReport, summarizeProblems,
} = require('./utils/deep-helpers');

const ADMIN_SECTIONS = [
  { label: /Overview/i, expect: /Platform Health|Active Workspaces|System Summary|Live Issues/i },
  { label: /Workspaces|Clients/i, expect: /Workspace|Client|Active Workspaces|Client Roster|Restaurant/i },
  { label: /Global Users/i, expect: /Global Users|Users|Email|Role|Last Active/i },
  { label: /Security Center/i, expect: /Security Center|App Check|MFA|Rules|Suspicious|Environment/i },
  { label: /Backup Center/i, expect: /Backup Center|Backup|Restore|Integrity|Next Backup/i },
  { label: /Push Health/i, expect: /Push Health|Push|Delivery|Token|Vercel|Storage|Auth/i },
  { label: /Forensics/i, expect: /Forensics|Timeline|Audit|Suspicious|Admin/i },
  { label: /Automation/i, expect: /Automation|Ops Intelligence|Runs|Config|Drift|Permission/i },
  { label: /Support/i, expect: /Support|Diagnostics|Crash|Report|Issue/i },
  { label: /Retention/i, expect: /Retention|Data|Archive|Delete|Cleanup|Policy/i },
  { label: /Access Control/i, expect: /Access Control|Permission|Role|Grant|Admin|MFA/i },
  { label: /Deployment/i, expect: /Deployment|Build|Tests|Config|Readiness|Version/i },
  { label: /Operations/i, expect: /Operations|Uptime|Response|Logs|Data Storage|System/i },
];

const QUICK_ACTIONS = [
  { label: /Deploy Workspace/i, expect: /Workspace|Client|Deploy|Restaurant/i },
  { label: /Broadcast Alert/i, expect: /Support|Broadcast|Alert|Diagnostics|Issue/i },
  { label: /Global Refresh/i, expect: /System Administrator|Platform Health|Refreshed|Overview/i },
  { label: /Pause Automation/i, expect: /Automation|Ops Intelligence|Pause|Runs/i },
  { label: /Emergency Read-Only/i, expect: /Security|Read-Only|Emergency|Review/i },
  { label: /Open Audit Log/i, expect: /Audit|Log|Forensics|Timeline/i },
];

test.describe('86 Chaos DEEP DEEP System Administrator wiring', () => {
  test('System Administrator rail, quick actions, and exit controls are wired', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Admin rail is desktop-first; mobile permission coverage is separate.');
    test.setTimeout(360000);
    const account = systemAdminCredsOrNull() || ownerLikeCreds();
    requireCreds(test, account, 'SYSTEM_ADMIN or OWNER/TEST_OWNER with super-admin access');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);
    await gotoTab(page, 'godmode', { settleMs: 1200 });

    const openingText = await assertNoFatal(page, 'System Administrator');
    if (/does not include this tool|not authorized|permission|access denied/i.test(openingText)) {
      await attachReport(testInfo, '03-admin-gated.json', { runId: RUN_ID, account: account.label, openingText: openingText.slice(0, 1500), problems: summarizeProblems(problems) });
      test.skip(true, 'This account is not a configured System Administrator. Add SYSTEM_ADMIN_EMAIL/PASSWORD to run admin wiring.');
    }

    expect(openingText, 'System Administrator should render the platform console').toMatch(/System Administrator|Platform Health|Active Workspaces|Backup|Security/i);

    const sectionReports = [];
    for (const section of ADMIN_SECTIONS) {
      await maybeClick(page, page.getByRole('button', { name: section.label }).first(), { force: true, settleMs: 800 });
      const text = await assertNoFatal(page, `admin section ${section.label}`);
      expect(text, `Admin section ${section.label} did not show its own wired content`).toMatch(section.expect);
      sectionReports.push({ label: String(section.label), textStart: text.slice(0, 1200), url: page.url() });
    }

    const quickReports = [];
    await gotoTab(page, 'godmode', { settleMs: 600 });
    await maybeClick(page, page.getByRole('button', { name: /Overview/i }).first(), { force: true, settleMs: 400 });
    for (const action of QUICK_ACTIONS) {
      const found = await maybeClick(page, page.getByRole('button', { name: action.label }).first(), { force: true, settleMs: 900 });
      expect(found, `Quick action ${action.label} should exist and be clickable`).toBeTruthy();
      const text = await assertNoFatal(page, `admin quick action ${action.label}`);
      expect(text, `Quick action ${action.label} should route/open a meaningful admin view`).toMatch(action.expect);
      quickReports.push({ label: String(action.label), textStart: text.slice(0, 1200), url: page.url() });
      await gotoTab(page, 'godmode', { settleMs: 600 });
    }

    const exitClicked = await maybeClick(page, page.getByRole('button', { name: /Exit Admin|Exit to App/i }).first(), { force: true, settleMs: 1000 });
    expect(exitClicked, 'System Administrator should have an Exit Admin / Exit to App button').toBeTruthy();
    const exitText = await assertNoFatal(page, 'after exiting System Administrator');
    expect(exitText, 'Exit Admin should return to the restaurant app').toMatch(/Today|Sales Today|Schedule|Inventory|Manager Brief|86 Chaos/i);
    expect(exitText, 'Exit Admin should not leave the admin rail stuck onscreen').not.toMatch(/Global Users\s+Security Center\s+Backup Center\s+Push Health\s+Forensics/i);

    await attachReport(testInfo, '03-deep-deep-system-admin-wiring.json', { runId: RUN_ID, account: account.label, sectionReports, quickReports, exitTextStart: exitText.slice(0, 1200), problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
