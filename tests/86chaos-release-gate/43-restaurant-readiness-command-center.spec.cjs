const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('43 restaurant readiness command center', () => {
  test('Manager Brief exposes all eight readiness areas and explicit evidence coverage on desktop and mobile', async ({ browser }) => {
    test.setTimeout(8 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    for (const viewport of [{ name:'desktop', width:1440, height:900 }, { name:'mobile', width:390, height:844 }]) {
      const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height } });
      const page = await context.newPage();
      await login(page, account.email, account.password);
      await gotoTab(page, 'today', { settleMs:1200 });
      const center=page.getByTestId('restaurant-readiness-command-center');
      await expect(center, `${viewport.name} readiness command center`).toBeVisible();
      await expect(center).toContainText(/Restaurant Readiness/i);
      await expect(center).toContainText(/No automatic changes/i);
      for (const label of ['Inventory','Prep','Staffing','Maintenance','Food Safety','Financial','Operations','System']) await expect(center).toContainText(label);
      await expect(page.getByTestId('restaurant-readiness-coverage')).toBeVisible();
      await context.close();
    }
  });

  test('readiness cards are actionable review links rather than automatic mutations', async ({ page }) => {
    const account=ownerLikeCreds();
    requireCreds(account,'owner-like account');
    await login(page,account.email,account.password);
    await gotoTab(page,'today',{settleMs:1200});
    const inventory=page.locator('[data-readiness-category="inventory"]');
    await expect(inventory).toBeVisible();
    await expect(inventory).toContainText(/Review inventory/i);
    await inventory.click();
    await expect(page.locator('body')).toContainText(/Inventory/i);
  });
});
