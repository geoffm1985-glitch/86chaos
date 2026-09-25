'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.16 navigation, logo, and toolbar fit repair', () => {
  test('experimental PWA install identity is selected before any generic manifest can be discovered', async () => {
    const root = path.resolve(__dirname, '..', '..');
    const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest-experimental.json'), 'utf8'));
    expect(manifest.name).toBe('86chaos experimental');
    expect(manifest.short_name).toBe('86chaos experimental');
    expect(manifest.id).toBe('/86-chaos-experimental-pwa');
    expect(index).toContain("else if (experimentalHost) manifest.setAttribute('href', '/manifest-experimental.json')");
    expect(index).not.toMatch(/<link[^>]+rel=["']manifest["'][^>]+href=["']%PUBLIC_URL%\/manifest\.json["']/i);
  });
  test('desktop uses the categorized legacy menu in the new sidebar and Message Board labels stay horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    const sidebar = page.getByTestId('concept17-desktop-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('.concept17-brand-logo')).toBeVisible();
    await expect(sidebar.locator('[data-shell-route]').first()).toHaveAttribute('data-shell-route', 'published');
    for (const label of ['People & Scheduling','Today','Kitchen Operations','Business & Financials','Tools & Automation','System & Support']) {
      await expect(sidebar.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.locator('.concept17-menu-drawer')).toBeHidden();

    await gotoTab(page, 'messages', { settleMs: 500, maxText: 30000 });
    const controls = page.locator('.message-board-composer-grid .message-board-control:visible');
    await expect(controls).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      const metrics = await controls.nth(i).evaluate(el => ({
        whiteSpace: getComputedStyle(el).whiteSpace,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        height: el.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(getComputedStyle(el).lineHeight || '0'),
      }));
      expect(metrics.whiteSpace).toBe('nowrap');
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      if (metrics.lineHeight > 0) expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight + 18);
    }
  });

  test('phone header has no hamburger and 86Voice is the first of six bottom-toolbar slots', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    await expect(page.locator('.concept17-mobile-menu-toggle')).toHaveCount(0);
    await expect(page.locator('.concept17-header-brand .concept17-brand-logo')).toBeVisible();
    const nav = page.getByTestId('concept17-mobile-bottom-nav');
    await expect(nav).toBeVisible();
    await expect(nav.locator('.concept17-mobile-nav-item')).toHaveCount(6);
    await expect(nav.locator('.concept17-mobile-nav-item').first()).toHaveAttribute('data-shell-action', 'voice');
    await expect(page.getByTestId('concept17-mobile-voice-button')).toBeVisible();

    await nav.getByRole('button', { name: /more/i }).click();
    await expect(page.locator('.concept17-menu-drawer-panel')).toBeVisible();
    await expect(page.getByTestId('drawer-86voice-button')).toHaveCount(0);
    const drawerText = await page.locator('.concept17-menu-drawer-panel').innerText();
    const checkpoints = ['PEOPLE & SCHEDULING','TIME CLOCK & SCHEDULE','STAFF ROSTER','HR & TRAINING','TODAY','MANAGER BRIEF','KITCHEN COMMAND CENTER','MY REMINDERS','EVENT CALENDAR','MESSAGE BOARD','KITCHEN OPERATIONS'];
    let prior = -1;
    for (const checkpoint of checkpoints) {
      const at = drawerText.toUpperCase().indexOf(checkpoint, prior + 1);
      expect(at, `${checkpoint} should retain legacy drawer order`).toBeGreaterThan(prior);
      prior = at;
    }
  });
});
