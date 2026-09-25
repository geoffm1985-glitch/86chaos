'use strict';

const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.5 mobile bottom navigation label fit', () => {
  test('all five bottom-toolbar labels stay on one line at narrow-phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    const nav = page.getByTestId('concept17-mobile-bottom-nav');
    await expect(nav).toBeVisible({ timeout: 15000 });

    const labels = nav.locator('.concept17-mobile-nav-label');
    await expect(labels).toHaveCount(5);

    for (let index = 0; index < 5; index += 1) {
      const metrics = await labels.nth(index).evaluate(el => {
        const style = getComputedStyle(el);
        return {
          whiteSpace: style.whiteSpace,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          height: el.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(style.lineHeight || '0'),
        };
      });
      expect(metrics.whiteSpace, `bottom-nav label ${index + 1} must not wrap`).toBe('nowrap');
      expect(metrics.scrollWidth, `bottom-nav label ${index + 1} text must fit its slot`).toBeLessThanOrEqual(metrics.clientWidth + 1);
      if (metrics.lineHeight > 0) {
        expect(metrics.height, `bottom-nav label ${index + 1} must remain one line`).toBeLessThanOrEqual(metrics.lineHeight + 2);
      }
    }
  });
});
