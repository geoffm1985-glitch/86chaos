'use strict';

const { test, expect } = require('@playwright/test');
const {
  ownerLikeCreds,
  creds,
  requireCreds,
  login,
  gotoTab,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const ROUTES = [
  'today',
  'ops',
  'prep',
  'inventory',
  'recipes',
  'schedule',
  'published',
  'events',
  'financials',
  'sales',
  'labor',
  'back-office',
  'messages',
  'team',
  'hr-training',
  'maintenance',
  'settings',
  'help',
  'reminders',
  'ai-tools',
  'menu-intelligence',
  'godmode',
];

async function assertNoHorizontalOverflow(page, route) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.html, `${route}: html must not overflow the viewport`).toBeLessThanOrEqual(overflow.viewport + 2);
  expect(overflow.body, `${route}: body must not overflow the viewport`).toBeLessThanOrEqual(overflow.viewport + 2);
}

async function assertRouteFrame(page, route, mobile) {
  const frame = page.locator(`.concept17-route-page[data-concept-route="${route}"]`).first();
  await expect(frame, `${route}: Concept 1 route frame`).toBeVisible({ timeout: 15000 });
  const box = await frame.boundingBox();
  expect(box, `${route}: route frame should have geometry`).toBeTruthy();
  if (mobile) {
    expect(box.width, `${route}: mobile route should use the phone workspace`).toBeGreaterThan(350);
    expect(box.width, `${route}: mobile route should stay inside the phone workspace`).toBeLessThanOrEqual(392);
  } else {
    expect(box.width, `${route}: desktop route should not collapse into a phone-width column`).toBeGreaterThan(900);
  }
  await assertNoHorizontalOverflow(page, route);
}

test.describe('17.1.1 Concept 1 deep route migration', () => {
  test('every representative real tab keeps the redesigned route geometry on desktop and mobile', async ({ page }) => {
    test.setTimeout(240000);
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });

    const account = creds('OWNER').email ? creds('OWNER') : ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    for (const route of ROUTES) {
      await gotoTab(page, route, { settleMs: 650, maxText: 50000 });
      await assertRouteFrame(page, route, mobile);
      await expect(page.getByText('Orders & Tickets', { exact: true })).toHaveCount(0);
    }
  });

  test('deep controls retain Concept 1 tabs, forms and touch geometry', async ({ page }) => {
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });

    const account = creds('OWNER').email ? creds('OWNER') : ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    for (const route of ['inventory', 'schedule', 'financials', 'settings', 'team', 'help']) {
      await gotoTab(page, route, { settleMs: 800, maxText: 50000 });
      await assertRouteFrame(page, route, mobile);

      const controls = page.locator('.concept17-route-page .chaos-button:visible, .concept17-route-page .settings-tab-button:visible, .concept17-route-page .inventory-subtabs > button:visible, .concept17-route-page [role="tab"]:visible, .concept17-route-page select:visible');
      const count = Math.min(await controls.count(), 8);
      if (mobile && count > 0) {
        for (let index = 0; index < count; index += 1) {
          const box = await controls.nth(index).boundingBox();
          if (!box) continue;
          expect(box.height, `${route}: visible control ${index + 1} should remain touchable`).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });
});
