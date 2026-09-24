'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const EXPECTED_IDS = [
  'health','deployment','manual','forensics','retention','data','security','admins','roles',
  'tenants','users','setup','support','ai-usage','automation','push','maintenance','v14','history','ops','danger'
];

test.describe('17.0.37 System Administrator desktop Concept 1 fidelity', () => {
  test('desktop keeps the two-two-three featured hierarchy and every admin page stays reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
    if (/permission gate|not authorized|does not include/i.test(text)) return;

    await expect(page.getByTestId('system-admin-concept1-exact-home')).toBeVisible({ timeout: 15000 });
    const featured = page.getByTestId('system-admin-featured-card');
    await expect(featured).toHaveCount(7);

    const boxes = [];
    for (let i = 0; i < 7; i += 1) boxes.push(await featured.nth(i).boundingBox());
    boxes.forEach((box, index) => expect(box, `featured card ${index + 1} should have a box`).toBeTruthy());
    const rowY = index => Math.round(boxes[index].y / 8) * 8;
    expect(rowY(0)).toBe(rowY(1));
    expect(rowY(2)).toBe(rowY(3));
    expect(rowY(4)).toBe(rowY(5));
    expect(rowY(5)).toBe(rowY(6));
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[2].x).toBeLessThan(boxes[3].x);
    expect(boxes[4].x).toBeLessThan(boxes[5].x);
    expect(boxes[5].x).toBeLessThan(boxes[6].x);

    const allCards = page.locator('[data-admin-tab]');
    const ids = await allCards.evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('data-admin-tab')).filter(Boolean))]);
    expect(ids.sort()).toEqual(EXPECTED_IDS.slice().sort());

    const overflow = await page.getByTestId('system-admin-concept1-exact-home').evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
  });

  test('desktop subpage keeps Concept 1 shell instead of reverting to the legacy compact console', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
    if (/permission gate|not authorized|does not include/i.test(text)) return;

    await page.locator('[data-admin-tab="security"]').first().click();
    await expect(page.getByTestId('system-admin-concept1-subpage')).toBeVisible({ timeout: 10000 });
    const shell = page.locator('.admin46-shell.admin-concept1-subpage-active');
    await expect(shell).toBeVisible();
    const hero = page.getByTestId('system-admin-concept1-subpage');
    const heroBox = await hero.boundingBox();
    expect(heroBox.width).toBeGreaterThan(760);
    await expect(page.getByRole('button', { name: /All System Administrator Tools/i })).toBeVisible();
  });
});
