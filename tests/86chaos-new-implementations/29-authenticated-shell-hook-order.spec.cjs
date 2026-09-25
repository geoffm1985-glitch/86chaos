'use strict';

const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.15 authenticated shell hook-order repair', () => {
  test('login and session hydration reach the real app shell without a React hook-order crash', async ({ page }) => {
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');

    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error?.message || error || '')));
    await login(page, account.email, account.password);

    if (mobile) await expect(page.getByTestId('concept17-mobile-bottom-nav')).toBeVisible({ timeout: 20000 });
    else await expect(page.getByTestId('concept17-desktop-sidebar')).toBeVisible({ timeout: 20000 });

    expect(pageErrors.filter(message => /rendered more hooks|rendered fewer hooks|change in the order of hooks/i.test(message))).toEqual([]);
    await expect(page.locator('body')).not.toContainText(/Rendered more hooks|Rendered fewer hooks|change in the order of Hooks/i);
  });
});
