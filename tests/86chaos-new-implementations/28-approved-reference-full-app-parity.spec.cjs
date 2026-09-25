'use strict';

const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const REPRESENTATIVE_ROUTES = ['today','ops','prep','inventory','recipes','team','published','financials','messages','settings','help','godmode'];

async function noViewportOverflow(page, label) {
  const metric = await page.evaluate(() => ({ width: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(metric.html, `${label} html width`).toBeLessThanOrEqual(metric.width + 2);
  expect(metric.body, `${label} body width`).toBeLessThanOrEqual(metric.width + 2);
}

test.describe('17.1.13 approved-reference full-app visual parity', () => {
  test('desktop shell matches approved reference hierarchy without duplicate top-right menus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    const sidebar = page.getByTestId('concept17-desktop-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('[data-shell-route]').first()).toHaveAttribute('data-shell-route', 'published');
    await expect(page.getByTestId('concept17-command-header')).toBeVisible();
    await expect(page.locator('.concept17-header-search')).toBeVisible();
    await expect(page.locator('.concept17-workspace-header')).toBeVisible();
    await expect(page.locator('.concept17-header-bell')).toBeVisible();
    await expect(page.locator('.concept17-header-avatar')).toBeVisible();
    await expect(page.locator('.concept17-mobile-menu-toggle')).toHaveCount(0);
    await noViewportOverflow(page, 'desktop shell');
  });

  test('mobile shell uses the restored six-slot bottom bar with visible 86Voice and clean header', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    const nav = page.getByTestId('concept17-mobile-bottom-nav');
    await expect(nav).toBeVisible();
    await expect(nav.locator('.concept17-mobile-nav-item')).toHaveCount(6);
    await expect(nav.locator('.concept17-mobile-nav-item').first()).toHaveAttribute('data-shell-action', 'voice');
    await expect(page.getByTestId('concept17-mobile-voice-button')).toBeVisible();
    await expect(nav.locator('[data-shell-route]').first()).toHaveAttribute('data-shell-route', 'today');
    await expect(page.locator('.concept17-mobile-menu-toggle')).toHaveCount(0);
    await nav.getByRole('button', { name: /more/i }).click();
    await expect(page.getByTestId('drawer-86voice-button')).toHaveCount(0);
    await noViewportOverflow(page, 'mobile shell');
  });

  test('representative routes and nested pages retain the approved visual frame', async ({ page }) => {
    test.setTimeout(240000);
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    for (const route of REPRESENTATIVE_ROUTES) {
      const text = await gotoTab(page, route, { settleMs: 500, maxText: 50000 });
      if (route === 'godmode' && /not authorized|permission gate|does not include/i.test(text)) continue;
      const frame = page.locator(`.concept17-route-frame[data-route-frame="${route}"]`).first();
      await expect(frame).toBeVisible();
      if (route !== 'today') {
        const heading = frame.getByTestId('concept17-route-heading');
        await expect(heading).toBeVisible();
        const bg = await heading.evaluate(el => getComputedStyle(el).backgroundImage);
        expect(bg).toMatch(/concept17-kitchen-reference|linear-gradient/i);
      }
      await expect(page.getByText('Orders & Tickets', { exact: true })).toHaveCount(0);
      await noViewportOverflow(page, route);
    }
  });
});
