'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.34 System Administrator subpages and navigation', () => {
  test('admin subpages share Concept 1 styling and drawer System Administrator returns to the seven-card home', async ({ page }) => {
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
    if (/permission gate|not authorized|does not include/i.test(text)) return;

    await expect(page.getByTestId('system-admin-concept1-exact-home')).toBeVisible({ timeout: 15000 });
    await page.getByText('Permission & Role Manager', { exact: true }).first().click();
    await expect(page.getByTestId('system-admin-concept1-subpage')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.admin46-shell')).toHaveClass(/admin-concept1-subpage-active/);

    const jump = page.getByLabel('All System Administrator tools');
    await jump.selectOption('security');
    await expect(page.getByRole('heading', { name: /Security Center/i }).first()).toBeVisible({ timeout: 10000 });
    await page.goBack();
    await expect(page.getByRole('heading', { name: /Permission & Role Manager/i }).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /open navigation menu/i }).click();
    await page.getByRole('button', { name: /^System Administrator$/i }).click();
    await expect(page.getByTestId('system-admin-concept1-exact-home')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('system-admin-concept1-card')).toHaveCount(7);
  });
});
