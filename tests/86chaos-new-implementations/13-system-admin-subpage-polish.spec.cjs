'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.35 System Administrator subpage polish', () => {
  test('admin tools use readable Concept 1 subpages and mobile metrics no longer collapse into cramped two-column tiles', async ({ page }) => {
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
    if (/permission gate|not authorized|does not include/i.test(text)) return;

    await expect(page.getByTestId('system-admin-concept1-exact-home')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-admin-tab="push"]').click();
    await expect(page.getByTestId('system-admin-concept1-subpage')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.admin46-shell')).toHaveClass(/admin-concept1-subpage-active/);

    const metricGrid = page.locator('.admin-concept1-metric-grid').first();
    await expect(metricGrid).toBeVisible({ timeout: 10000 });
    await expect(metricGrid.getByText('Connected Devices', { exact: true })).toBeVisible();
    await expect(metricGrid.getByText('Stale Tokens', { exact: true })).toBeVisible();

    const viewport = page.viewportSize() || { width: 1200 };
    const gridEvidence = await metricGrid.evaluate(el => ({
      columns: getComputedStyle(el).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    if (viewport.width <= 767) expect(gridEvidence.columns).toBe(1);
    else expect(gridEvidence.columns).toBeGreaterThanOrEqual(2);
    expect(gridEvidence.scrollWidth).toBeLessThanOrEqual(gridEvidence.clientWidth + 2);

    for (const target of ['support', 'forensics', 'health']) {
      await page.getByRole('button', { name: /All System Administrator Tools/i }).click();
      await page.locator(`[data-admin-tab="${target}"]`).click();
      await expect(page.getByTestId('system-admin-concept1-subpage')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.admin-concept1-subpage-hero-icon svg')).toBeVisible();
    }
  });
});
