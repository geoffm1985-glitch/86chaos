'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.38 System Administrator desktop full-width repair', () => {
  test('desktop System Administrator occupies the desktop workspace instead of the retired 232px navigation rail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
    if (/permission gate|not authorized|does not include/i.test(text)) return;

    const shell = page.locator('.admin46-shell');
    const layout = page.locator('.admin46-layout');
    const content = page.locator('.admin46-content');
    const home = page.getByTestId('system-admin-concept1-exact-home');
    await expect(home).toBeVisible({ timeout: 15000 });

    const [shellBox, layoutBox, contentBox, homeBox] = await Promise.all([
      shell.boundingBox(), layout.boundingBox(), content.boundingBox(), home.boundingBox()
    ]);
    for (const [name, box] of [['shell', shellBox], ['layout', layoutBox], ['content', contentBox], ['home', homeBox]]) {
      expect(box, `${name} should have a desktop bounding box`).toBeTruthy();
      expect(box.width, `${name} must not be trapped in the retired 232px rail`).toBeGreaterThan(900);
    }
    expect(Math.abs(layoutBox.width - contentBox.width)).toBeLessThan(8);

    const featured = page.getByTestId('system-admin-featured-card');
    await expect(featured).toHaveCount(7);
    const first = await featured.nth(0).boundingBox();
    const second = await featured.nth(1).boundingBox();
    expect(first.width).toBeGreaterThan(350);
    expect(second.width).toBeGreaterThan(350);
    expect(first.x).toBeLessThan(second.x);
  });
});
