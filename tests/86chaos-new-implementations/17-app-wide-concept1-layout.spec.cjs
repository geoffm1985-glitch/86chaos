'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.0 app-wide Concept 1 responsive shell', () => {
  test('shared desktop/mobile shell keeps real application content wide, touchable, and overflow-safe', async ({ page }) => {
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const account = creds('OWNER').email ? creds('OWNER') : ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'today', { settleMs: 1800, maxText: 50000 });

    await expect(page.getByTestId('concept17-command-header')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Orders & Tickets', { exact: true })).toHaveCount(0);

    const overflow = await page.evaluate(() => ({
      viewport: window.innerWidth,
      html: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(overflow.html).toBeLessThanOrEqual(overflow.viewport + 2);
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 2);

    if (mobile) {
      await expect(page.getByTestId('concept17-mobile-bottom-nav')).toBeVisible();
      await expect(page.getByTestId('concept17-desktop-sidebar')).toBeHidden();
      const navButtons = page.getByTestId('concept17-mobile-bottom-nav').locator('button');
      expect(await navButtons.count()).toBeGreaterThanOrEqual(3);
      for (let index = 0; index < Math.min(await navButtons.count(), 5); index += 1) {
        const box = await navButtons.nth(index).boundingBox();
        expect(box, `mobile nav button ${index + 1} should have a box`).toBeTruthy();
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const main = await page.locator('.app-content-shell').boundingBox();
      expect(main.width).toBeGreaterThan(360);
      expect(main.width).toBeLessThanOrEqual(392);
    } else {
      await expect(page.getByTestId('concept17-desktop-sidebar')).toBeVisible();
      await expect(page.getByTestId('concept17-mobile-bottom-nav')).toBeHidden();
      const [sidebar, header, main] = await Promise.all([
        page.getByTestId('concept17-desktop-sidebar').boundingBox(),
        page.getByTestId('concept17-command-header').boundingBox(),
        page.locator('.app-content-shell').boundingBox(),
      ]);
      expect(sidebar).toBeTruthy();
      expect(sidebar.width).toBeGreaterThan(200);
      expect(header).toBeTruthy();
      expect(header.width).toBeGreaterThan(1100);
      expect(main).toBeTruthy();
      expect(main.width).toBeGreaterThan(1100);
      expect(main.x).toBeGreaterThanOrEqual(215);
      await expect(page.locator('.concept17-header-search')).toBeVisible();
    }
  });
});
