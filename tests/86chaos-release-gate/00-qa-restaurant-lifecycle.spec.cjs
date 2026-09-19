const { test, expect } = require('@playwright/test');
const {
  readSeedReport,
  creds,
  requireCreds,
  login,
  gotoTab,
  bodyText,
  QA_WORKSPACE_NAME,
  ALLOW_MUTATION,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('disposable QA restaurant lifecycle', () => {
  test('creates the exact cleanup-compatible restaurant and attaches all release roles', async ({ page }) => {
    test.skip(!ALLOW_MUTATION, 'Mutation mode is required to create the disposable QA restaurant.');
    const seed = readSeedReport();
    expect(seed, 'global setup must produce a seed report').toBeTruthy();
    expect(seed.ok).toBe(true);
    expect(seed.restaurantName).toBe(QA_WORKSPACE_NAME);
    expect(seed.createdRestaurant).toBe(true);
    expect(seed.restaurantId).toBeTruthy();
    expect(seed.seedReportSchemaVersion, 'seed report schema version should be explicit').toBe(2);
    expect(Array.isArray(seed.roleAccounts)).toBe(true);
    const accountsByKey = Object.fromEntries(seed.roleAccounts.map(row => [row.key, row]));
    for (const key of ['systemAdmin', 'owner', 'manager', 'staff']) {
      expect(accountsByKey[key], `${key} role account exists`).toBeTruthy();
      expect(accountsByKey[key].uid, `${key} role account has uid`).toBeTruthy();
      expect(accountsByKey[key].role, `${key} role account has role identity`).toBeTruthy();
    }
    expect(seed.createdCounts?.workspaceMembers, 'workspace member count should cover attached role accounts').toBeGreaterThanOrEqual(4);
  });

  test('System Administrator exposes the matching Platform Operations cleanup tool', async ({ page }) => {
    const admin = creds('SYSTEM_ADMIN');
    requireCreds(admin, 'System Administrator');
    await login(page, admin.email, admin.password, { tab: 'godmode' });
    await gotoTab(page, 'godmode');
    const text = await bodyText(page, 30000);
    expect(text).toMatch(/System Administrator|Platform Operations/i);
    expect(text).toMatch(/Clean Full Audit QA Restaurants|Full Audit QA Restaurant/i);
  });
});
