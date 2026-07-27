const { test, expect } = require('@playwright/test');
const {
  creds,
  login,
  gotoTab,
  bodyText,
  attachJson,
  PERMISSION_GATE_RE,
  STAFF_FORBIDDEN_RE,
  STAFF_ACTION_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

function requiredAccount(prefix) {
  const account = creds(prefix);
  if (!account.email || !account.password) throw new Error(`Missing required ${prefix}_EMAIL/${prefix}_PASSWORD. Full release qualification cannot skip a role.`);
  return account;
}

async function freshPage(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  return page;
}

test.describe('23 mandatory owner manager staff and system-admin role journeys', () => {
  test('all four configured roles authenticate and receive the intended route boundaries', async ({ browser }, testInfo) => {
    test.setTimeout(20 * 60 * 1000);
    const accounts = {
      owner: requiredAccount('OWNER'),
      manager: requiredAccount('MANAGER'),
      staff: requiredAccount('STAFF'),
      systemAdmin: requiredAccount('SYSTEM_ADMIN'),
    };
    const roleEmails = [accounts.owner.email, accounts.manager.email, accounts.staff.email].map(x => x.toLowerCase());
    expect(new Set(roleEmails).size, 'Owner, manager, and staff must be distinct accounts for meaningful permission testing').toBe(3);

    const results = {};
    for (const [role, account] of Object.entries(accounts)) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
      const page = await freshPage(context);
      await login(page, account.email, account.password, { tab: 'today' });
      const today = await bodyText(page, 25000);
      const schedule = await gotoTab(page, 'schedule', { settleMs: 1000, maxText: 30000 });
      const systemAdmin = await gotoTab(page, 'godmode', { settleMs: 1000, maxText: 30000 });
      results[role] = {
        today: today.slice(0, 5000),
        schedule: schedule.slice(0, 5000),
        systemAdmin: systemAdmin.slice(0, 5000),
        systemAdminGated: PERMISSION_GATE_RE.test(systemAdmin),
      };
      await context.close();
    }

    expect(results.owner.today).not.toMatch(/Email Address\s*Password|Unlock System/i);
    expect(results.manager.today).not.toMatch(/Email Address\s*Password|Unlock System/i);
    expect(results.staff.today).not.toMatch(/Email Address\s*Password|Unlock System/i);
    expect(results.systemAdmin.today).not.toMatch(/Email Address\s*Password|Unlock System/i);

    expect(results.staff.systemAdminGated || !/System Administrator|Backup Center|Security Center|Forensics/i.test(results.staff.systemAdmin), 'Staff must not receive System Administrator content').toBe(true);
    expect(results.staff.systemAdmin, 'Staff must not see privileged actions').not.toMatch(STAFF_ACTION_RE);
    expect(results.staff.systemAdmin, 'Staff must not see privileged administrator surfaces').not.toMatch(STAFF_FORBIDDEN_RE);
    expect(results.systemAdmin.systemAdmin, 'Configured System Administrator must reach the system-administration surface').toMatch(/System Administrator|Backup|Security|Forensics|People Directory|System Operations/i);

    await attachJson(testInfo, '23-required-role-journeys.json', results);
  });
});
