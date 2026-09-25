'use strict';

const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.17 footer version and copyright identity', () => {
  test('footer shows the current version together with the copyright on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const footer = page.getByTestId('app-version-copyright');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Version 17.1.17');
    await expect(footer).toContainText('© 2026 Chilton App Works LLC');
  });

  test('footer identity remains reachable on mobile above the fixed bottom toolbar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const footer = page.getByTestId('app-version-copyright');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Version 17.1.17');
    await expect(footer).toContainText('© 2026 Chilton App Works LLC');
    const nav = page.getByTestId('concept17-mobile-bottom-nav');
    await expect(nav).toBeVisible();
    const geometry = await page.evaluate(() => {
      const fEl = document.querySelector('[data-testid="app-version-copyright"]');
      const nEl = document.querySelector('[data-testid="concept17-mobile-bottom-nav"]');
      if (!fEl || !nEl) return null;
      const f = fEl.getBoundingClientRect(), n = nEl.getBoundingClientRect();
      return { footerBottom: f.bottom, navTop: n.top };
    });
    expect(geometry).not.toBeNull();
    expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.navTop + 1);
  });
});
