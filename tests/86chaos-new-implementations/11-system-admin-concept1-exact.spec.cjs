'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.33 System Administrator Concept 1 exact home', () => {
  test('System Administrator home uses the complete Concept 1 directory and removes the attention dashboard', async ({ page }) => {
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
    if (/permission gate|not authorized|does not include/i.test(text)) return;

    await expect(page.getByTestId('system-admin-concept1-exact-home')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('system-admin-complete-directory')).toBeVisible();
    await expect(page.getByTestId('system-admin-directory-card')).toHaveCount(21);
    for (const tab of ['roles','push','security','forensics','deployment','support','health','manual','retention','data','admins','tenants','users','setup','ai-usage','automation','maintenance','v14','history','ops','danger']) {
      await expect(page.locator(`[data-admin-tab="${tab}"]`)).toHaveCount(1);
    }
    await expect(page.getByText('What needs your attention?', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Quick work', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Next actions', { exact: true })).toHaveCount(0);
  });
});
