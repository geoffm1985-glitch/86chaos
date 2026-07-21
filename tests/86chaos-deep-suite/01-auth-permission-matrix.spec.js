// 86 Chaos 15.0.95 Auth + Permission Matrix
// Checks owner/admin/staff/system-admin boundaries through the real UI.
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
  pageState,
  expectVersion,
  PERMISSION_GATE_RE,
  INTERNAL_ADMIN_DEBUG_RE,
  STAFF_VISIBLE_FORBIDDEN_RE,
  STAFF_UNLOCKED_RESTRICTED_CONTENT_RE,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const STAFF_RESTRICTED_TABS = new Set(['financials', 'sales', 'labor', 'back-office', 'schedule', 'godmode', 'audit']);
const STAFF_VISIBLE_TABS = ['today', 'published', 'inventory', 'team', 'settings', 'help', 'messages', 'prep', 'recipes', 'reminders'];

test.describe('86 Chaos Auth + Permission Matrix', () => {
  test('role visibility and forbidden-tools matrix', async ({ browser }, testInfo) => {
    test.setTimeout(360000);
    const accounts = [ownerLikeCreds()];
    for (const prefix of ['MANAGER', 'STAFF', 'SYSTEM_ADMIN', 'WRONG_WORKSPACE', 'DISABLED']) {
      if (hasCreds(prefix)) accounts.push(creds(prefix));
    }
    if (!accounts[0]?.email || !accounts[0]?.password) {
      throw new Error('Missing OWNER/TEST credentials. Tests will not silently skip anymore. Check your .env file and run 99-env-diagnostics.spec.js.');
    }

    const results = [];
    const allProblems = [];

    for (const account of accounts) {
      const page = await browser.newPage();
      const problems = [];
      watchForProblems(page, problems);
      const record = { account: account.label, email: account.email, pages: [], problems: [] };
      const isStaff = /STAFF/i.test(account.label);
      const isDeniedAccount = /DISABLED|WRONG_WORKSPACE/i.test(account.label);

      try {
        await login(page, account.email, account.password, { loginBoxTimeout: 25000 });

        if (!isDeniedAccount) {
          await expectVersion(page);
        }

        const tabsToCheck = isStaff
          ? [...STAFF_VISIBLE_TABS, ...STAFF_RESTRICTED_TABS]
          : ['today', 'financials', 'back-office', 'schedule', 'inventory', 'team', 'settings', 'help', 'godmode'];

        for (const tab of tabsToCheck) {
          await gotoTab(page, tab).catch((error) => {
            problems.push({ type: 'route-open-failed', tab, message: error.message, url: page.url() });
          });

          const text = await bodyText(page);
          const state = pageState(text);
          const pageRecord = {
            tab,
            url: page.url(),
            textStart: text.slice(0, 1000),
            unavailable: state.isUnavailable,
            permissionGate: state.isPermissionGate,
            internalAdminDebug: state.hasInternalAdminDebug,
          };
          record.pages.push(pageRecord);

          if (isStaff) {
            if (tab === 'godmode') {
              if (!state.isPermissionGate && !state.isUnavailable) {
                problems.push({ type: 'staff-godmode-not-gated', account: account.label, tab, url: page.url(), textStart: text.slice(0, 1500) });
              }
              if (INTERNAL_ADMIN_DEBUG_RE.test(text)) {
                problems.push({ type: 'staff-internal-admin-debug-leak', account: account.label, tab, url: page.url(), textStart: text.slice(0, 1500) });
              }
              continue;
            }

            if (STAFF_RESTRICTED_TABS.has(tab)) {
              // Correct behavior: STAFF may hit a restricted direct URL, but must land on a gate/denial.
              if (!state.isPermissionGate && !state.isUnavailable) {
                problems.push({ type: 'staff-restricted-route-not-gated', account: account.label, tab, url: page.url(), textStart: text.slice(0, 1500) });
              }

              // Only fail on usable restricted actions/content, not denied page headings.
              if (!state.isPermissionGate && STAFF_UNLOCKED_RESTRICTED_CONTENT_RE.test(text)) {
                problems.push({ type: 'staff-unlocked-restricted-content', account: account.label, tab, url: page.url(), textStart: text.slice(0, 1500) });
              }
              continue;
            }

            // Staff-visible pages should not advertise/admin-surface restricted tools.
            if (STAFF_VISIBLE_FORBIDDEN_RE.test(text)) {
              problems.push({ type: 'staff-visible-tool-leak', account: account.label, tab, forbidden: String(STAFF_VISIBLE_FORBIDDEN_RE), url: page.url(), textStart: text.slice(0, 1500) });
            }
          }
        }

        const combined = record.pages.map((p) => p.textStart).join('\n');

        if (/OWNER|TEST|ADMIN|MANAGER/i.test(account.label) && !/WRONG_WORKSPACE|DISABLED/i.test(account.label)) {
          const ownerSignal = /Today Home|Financial|Back Office|Schedule|Inventory|Settings|Team|Help Center/i;
          expect(ownerSignal.test(combined), `${account.label} should see at least one normal app tool`).toBeTruthy();
        }

        if (isDeniedAccount) {
          const text = await bodyText(page);
          if (!/not authorized|disabled|workspace|membership|permission|not available|missing in the database|login/i.test(text)) {
            problems.push({ type: 'unexpected-login-success-or-unclear-denial', account: account.label, textStart: text.slice(0, 1000), url: page.url() });
          }
        }
      } catch (error) {
        record.loginOrTestError = error.message;
        if (!isDeniedAccount) {
          problems.push({ type: 'account-test-error', account: account.label, message: error.message, url: page.url() });
        }
      }

      record.problems = problems;
      results.push(record);
      allProblems.push(...problems);
      await page.close().catch(() => {});
    }

    await attachReport(testInfo, '01-auth-permission-matrix-report.json', { runId: RUN_ID, results, allProblems });
    expect(allProblems, JSON.stringify(allProblems, null, 2)).toEqual([]);
  });
});
