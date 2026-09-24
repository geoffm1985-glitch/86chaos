'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.36 System Administrator complete directory and desktop repair', () => {
  test('main page exposes every internal admin page and subpages never use the native all-tools selector', async ({ page }) => {
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
    if (/permission gate|not authorized|does not include/i.test(text)) return;

    const featured = page.getByTestId('system-admin-featured-card');
    const cards = page.getByTestId('system-admin-directory-card');
    await expect(featured).toHaveCount(7, { timeout: 15000 });
    await expect(cards).toHaveCount(14, { timeout: 15000 });

    const homeOverflow = await page.getByTestId('system-admin-complete-directory').evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(homeOverflow.scrollWidth).toBeLessThanOrEqual(homeOverflow.clientWidth + 2);

    for (const target of ['health','forensics','security','users','support','push','danger']) {
      await page.locator(`[data-admin-tab="${target}"]`).click();
      await expect(page.getByTestId('system-admin-concept1-subpage')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#system-admin-tool-jump')).toHaveCount(0);
      await expect(page.locator('.admin-concept1-subpage-location')).toBeVisible();
      await page.getByRole('button', { name: /All System Administrator Tools/i }).click();
      await expect(page.getByTestId('system-admin-complete-directory')).toBeVisible({ timeout: 10000 });
    }
  });
});
