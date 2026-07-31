const { test, expect } = require('@playwright/test');
const {
  creds,
  requireCreds,
  login,
  gotoTab,
  bodyText,
  expectNoFatal,
  attachJson,
  PERMISSION_GATE_RE,
  STAFF_FORBIDDEN_RE,
  STAFF_ACTION_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const routeMatrix = [
  'today', 'published', 'schedule', 'events', 'ops', 'back-office', 'financials', 'sales', 'labor',
  'inventory', 'menu-intelligence', 'ai-tools', 'prep', 'recipes', 'messages', 'reminders', 'team',
  'hr-training', 'maintenance', 'settings', 'help', 'audit', 'godmode',
];

async function inspectRoutes(page, routes, roleLabel) {
  const rows = [];
  for (const tab of routes) {
    const text = await gotoTab(page, tab, { settleMs: 350, timeout: 45_000 });
    await expectNoFatal(page, `${roleLabel} ${tab}`);
    rows.push({ tab, restricted: PERMISSION_GATE_RE.test(text), sample: text.slice(0, 1000) });
  }
  return rows;
}

test.describe('28 Complete role and route boundary matrix', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-full', 'Full role matrix runs once on the primary desktop release project.');
  });

  test('staff can use staff surfaces but cannot enter owner, wage, audit, or System Administrator tools', async ({ page }, testInfo) => {
    test.setTimeout(20 * 60 * 1000);
    const account = creds('STAFF');
    requireCreds(account, 'staff');
    await login(page, account.email, account.password);
    const rows = await inspectRoutes(page, routeMatrix, 'staff');
    const restrictedAdminText = rows.filter(row => ['godmode','audit','back-office','financials','labor'].includes(row.tab)).map(row => row.sample).join('\n');
    expect(restrictedAdminText).not.toMatch(/Backup Now|Restore Backup|Delete User|Log Out Everyone|Run Python|Send to QuickBooks/i);
    expect(rows.find(row => row.tab === 'godmode')?.restricted, 'Staff direct System Administrator route must be restricted').toBeTruthy();
    expect(rows.find(row => row.tab === 'audit')?.restricted, 'Staff audit route must be restricted').toBeTruthy();
    await attachJson(testInfo, 'role-matrix-staff.json', rows);
  });

  test('manager can manage operations but cannot become System Administrator by direct URL', async ({ page }, testInfo) => {
    test.setTimeout(20 * 60 * 1000);
    const account = creds('MANAGER');
    requireCreds(account, 'manager');
    await login(page, account.email, account.password);
    const rows = await inspectRoutes(page, routeMatrix, 'manager');
    expect(rows.find(row => row.tab === 'godmode')?.restricted, 'Manager direct System Administrator route must be restricted').toBeTruthy();
    const adminText = rows.find(row => row.tab === 'godmode')?.sample || '';
    expect(adminText).toMatch(/Restricted Platform Tools|role does not include|not available|access denied/i);
    await attachJson(testInfo, 'role-matrix-manager.json', rows);
  });

  test('owner retains owner surfaces but cannot inherit System Administrator from workspace ownership', async ({ page }, testInfo) => {
    test.setTimeout(20 * 60 * 1000);
    const account = creds('OWNER');
    requireCreds(account, 'owner');
    await login(page, account.email, account.password);
    const rows = await inspectRoutes(page, routeMatrix, 'owner');
    expect(rows.find(row => row.tab === 'godmode')?.restricted, 'Workspace ownership alone must not grant System Administrator').toBeTruthy();
    const usefulOwnerRoutes = ['today', 'schedule', 'financials', 'inventory', 'team', 'settings'];
    expect(rows.filter(row => usefulOwnerRoutes.includes(row.tab) && !row.restricted).length).toBeGreaterThanOrEqual(4);
    await attachJson(testInfo, 'role-matrix-owner.json', rows);
  });

  test('server-verified System Administrator can enter platform tools while ordinary restaurant routes still render', async ({ page }, testInfo) => {
    test.setTimeout(20 * 60 * 1000);
    const account = creds('SYSTEM_ADMIN');
    requireCreds(account, 'System Administrator');
    await login(page, account.email, account.password);
    const rows = await inspectRoutes(page, routeMatrix, 'system-admin');
    const god = rows.find(row => row.tab === 'godmode');
    expect(god?.restricted, 'System Administrator route should not be restricted').toBeFalsy();
    expect(god?.sample || '').toMatch(/System Administrator|Platform Operations|Backup|Security|Workspaces|People/i);
    await attachJson(testInfo, 'role-matrix-system-admin.json', rows);
  });
});
