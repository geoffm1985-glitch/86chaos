// 86 Chaos Auth + Permission Matrix Deep Test
// Checks owner/admin/staff/system-admin access boundaries through the real UI.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  hasCreds,
  creds,
  ownerLikeCreds,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  attachReport,
} = require('./utils/chaos-helpers');

const PERMISSION_GATE_RE = /PLAN\s*&\s*PERMISSION\s*GATE|Your role does not include this tool|not authorized|permission|not available/i;

// These are routes STAFF is allowed to be denied from. Seeing a denied page title/header
// is not a permission leak. It only becomes a leak if the route opens usable restricted UI.
const STAFF_RESTRICTED_TABS = new Set(['financials', 'back-office', 'schedule', 'godmode']);

// Scan only staff-reachable surfaces for forbidden navigation/tools. Do not run this against
// permission-gated pages, because a blocked page is allowed to name the blocked feature.
const STAFF_VISIBLE_FORBIDDEN_RE = /System Administrator|Back Office Suite|QuickBooks Integration Hub|Python Automation|Backup Center|Security Center|Forensics|Pay Rates/i;

// Extra guard for direct-route checks. These are action/content signals, not just page names.
const STAFF_UNLOCKED_RESTRICTED_CONTENT_RE = /Connect QuickBooks|Approve\s*(?:&|and)?\s*Send|Send to QuickBooks|Post to QuickBooks|Create Bill Draft|Run Python|Run Automation|Backup Now|Restore Backup|Security Diagnostics|Forensics Timeline|Hourly Rate|Pay Rate/i;

test.describe('86 Chaos Auth + Permission Matrix', () => {
  test('role visibility and forbidden-tools matrix', async ({ browser }, testInfo) => {
    test.setTimeout(300000);
    const accounts = [ownerLikeCreds()];
    for (const prefix of ['MANAGER', 'STAFF', 'SYSTEM_ADMIN', 'WRONG_WORKSPACE', 'DISABLED']) {
      if (hasCreds(prefix)) accounts.push(creds(prefix));
    }

    const results = [];
    const allProblems = [];

    for (const account of accounts) {
      const page = await browser.newPage();
      const problems = [];
      watchForProblems(page, problems);
      const record = { account: account.label, email: account.email, pages: [], problems: [] };
      const isStaff = /STAFF/i.test(account.label);

      try {
        await login(page, account.email, account.password, { loginBoxTimeout: 20000 });
        for (const tab of ['today', 'financials', 'back-office', 'schedule', 'inventory', 'team', 'settings', 'godmode']) {
          await gotoTab(page, tab).catch((error) => {
            problems.push({ type: 'route-open-failed', tab, message: error.message, url: page.url() });
          });

          const text = await bodyText(page);
          const pageRecord = {
            tab,
            url: page.url(),
            textStart: text.slice(0, 1000),
            unavailable: /This page is not available/i.test(text),
            permissionGate: PERMISSION_GATE_RE.test(text),
          };
          record.pages.push(pageRecord);

          if (isStaff) {
            if (STAFF_RESTRICTED_TABS.has(tab)) {
              // Correct behavior: STAFF can hit a restricted route directly, but must land on a gate/denial.
              if (!pageRecord.permissionGate && !pageRecord.unavailable) {
                problems.push({
                  type: 'staff-restricted-route-not-gated',
                  account: account.label,
                  tab,
                  url: page.url(),
                  textStart: text.slice(0, 1500),
                });
              }

              // Do not fail on denied-page titles like BACK OFFICE. Only fail on usable restricted actions/content.
              if (!pageRecord.permissionGate && STAFF_UNLOCKED_RESTRICTED_CONTENT_RE.test(text)) {
                problems.push({
                  type: 'staff-unlocked-restricted-content',
                  account: account.label,
                  tab,
                  url: page.url(),
                  textStart: text.slice(0, 1500),
                });
              }

              continue;
            }

            // Staff-visible pages should not advertise/admin-surface restricted tools.
            if (STAFF_VISIBLE_FORBIDDEN_RE.test(text)) {
              problems.push({
                type: 'staff-visible-tool-leak',
                account: account.label,
                tab,
                forbidden: String(STAFF_VISIBLE_FORBIDDEN_RE),
                url: page.url(),
                textStart: text.slice(0, 1500),
              });
            }
          }
        }

        const combined = record.pages.map((p) => p.textStart).join('\n');

        if (/OWNER|TEST/i.test(account.label)) {
          const ownerSignal = /Financial Center|Back Office|Schedule Builder|Inventory|Settings|Owner Pro|QuickBooks|System Administrator/i;
          expect(ownerSignal.test(combined), 'Owner/test account should see at least one owner/manager tool').toBeTruthy();
        }

        if (/DISABLED|WRONG_WORKSPACE/i.test(account.label)) {
          const text = await bodyText(page);
          if (!/not authorized|disabled|workspace|membership|permission|not available/i.test(text)) {
            problems.push({ type: 'unexpected-login-success-or-unclear-denial', account: account.label, textStart: text.slice(0, 1000), url: page.url() });
          }
        }
      } catch (error) {
        record.loginOrTestError = error.message;
        if (!/DISABLED|WRONG_WORKSPACE/i.test(account.label)) {
          problems.push({ type: 'account-test-error', account: account.label, message: error.message, url: page.url() });
        }
      }

      record.problems = problems;
      results.push(record);
      allProblems.push(...problems);
      await page.close().catch(() => {});
    }

    await attachReport(testInfo, 'auth-permission-matrix-report.json', { runId: RUN_ID, results, allProblems });
    expect(allProblems, JSON.stringify(allProblems, null, 2)).toEqual([]);
  });
});
