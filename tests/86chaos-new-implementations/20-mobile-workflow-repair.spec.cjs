'use strict';

const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.1.3 mobile workflow repair', () => {
  test('mobile toolbar restores 86Voice as the first of six bottom-toolbar slots', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    await gotoTab(page, 'ai-tools', { settleMs: 800, maxText: 30000 });
    const nav = page.getByTestId('concept17-mobile-bottom-nav');
    await expect(nav).toBeVisible();
    await expect(nav.locator('.concept17-mobile-nav-item')).toHaveCount(6);
    const voice = page.getByTestId('concept17-mobile-voice-button');
    await expect(voice).toBeVisible();
    await expect(nav.locator('.concept17-mobile-nav-item').first()).toHaveAttribute('data-shell-action', 'voice');
    await expect(nav.locator('[data-shell-route]').first()).toHaveAttribute('data-shell-route', 'today');

    await nav.getByRole('button', { name: /more/i }).click();
    await expect(page.getByTestId('drawer-86voice-button')).toHaveCount(0);

    const badges = page.locator('.kitchen-tool-status-badge:visible');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const box = await badges.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height, `Kitchen Tools badge ${i + 1} must stay horizontal`).toBeLessThanOrEqual(34);
      expect(box.width, `Kitchen Tools badge ${i + 1} must have readable width`).toBeGreaterThanOrEqual(38);
    }
  });

  test('Schedule Builder day/date row remains pinned while employee rows scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'schedule', { settleMs: 900, maxText: 40000 });

    const grid = page.locator('.schedule-builder-grid-scroll').first();
    await expect(grid).toBeVisible({ timeout: 15000 });
    const header = page.locator('.schedule-builder-sticky-head th').nth(1);
    await expect(header).toBeVisible();
    const before = await header.boundingBox();
    await grid.evaluate(el => { el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, 360); });
    await page.waitForTimeout(150);
    const after = await header.boundingBox();
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(Math.abs(after.y - before.y), 'day/date header should stay pinned while staff rows scroll').toBeLessThanOrEqual(3);
  });

  test('Kitchen Command Center opens without the formatFullDate recovery crash', async ({ page }) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'ops', { settleMs: 900, maxText: 30000 });
    expect(text).toMatch(/Kitchen Command Center|Centro de Mando de Cocina|Shift Snapshot|Resumen de turno/i);
    expect(text).not.toMatch(/formatFullDate is not defined|This section hit a snag/i);
  });
});
