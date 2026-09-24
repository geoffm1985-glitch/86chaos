'use strict';

const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const ROUTES = [
  'published','schedule','events','today','ops','prep','inventory','recipes','financials','sales','labor','messages','team',
  'hr-training','maintenance','settings','help','reminders','ai-tools','menu-intelligence','back-office','audit','godmode'
];

const SUBTAB_ROUTES = {
  published: ['My Schedule','Full Schedule','Month View','Trade Board','Request Off','Availability','Schedule Builder'],
  prep: ['Food Prep','Line Check','Daily Tasks','Weekly Tasks','Monthly Tasks'],
  inventory: ['count','order','Order Suggestions','manage','vendors','Invoices','waste'],
  financials: ['Overview','Daily Close','Sales','Labor & Payroll','Tips','COGS & Vendors','Expenses','P&L','Targets','Reports'],
  maintenance: ['Repair Board','Preventative Maintenance'],
  'hr-training': ['Overview','Manuals','Onboarding','Certifications','Performance'],
  settings: ['Profile','Account Security','Preferences','Alerts','Billing','Workspace','Branding','Integrations'],
  'back-office': ['Dashboard','Deposit Log','Approval Queue','Document Vault','Owner Reports','QuickBooks','Accountant Packet','Owner Rollup'],
};

async function assertNoPageOverflow(page, label) {
  const result = await page.evaluate(() => ({
    viewport: innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(result.html, `${label} html overflow`).toBeLessThanOrEqual(result.viewport + 2);
  expect(result.body, `${label} body overflow`).toBeLessThanOrEqual(result.viewport + 2);
}

async function assertConceptGeometry(page, route, mobile) {
  const routePage = page.locator(`.concept17-route-page[data-concept-route="${route}"]`).first();
  await expect(routePage).toBeVisible({ timeout: 15000 });
  const frame = page.locator(`.concept17-route-frame[data-route-frame="${route}"]`).first();
  await expect(frame).toBeVisible({ timeout: 15000 });
  const body = frame.getByTestId('concept17-route-body');
  await expect(body).toBeVisible();
  const bodyBox = await body.boundingBox();
  expect(bodyBox).toBeTruthy();
  if (mobile) {
    expect(bodyBox.width, `${route} uses phone width`).toBeGreaterThan(350);
    expect(bodyBox.width, `${route} stays inside phone width`).toBeLessThanOrEqual(392);
  } else {
    expect(bodyBox.width, `${route} is true desktop width`).toBeGreaterThan(900);
  }
  if (route !== 'today') {
    const heading = frame.getByTestId('concept17-route-heading');
    await expect(heading).toBeVisible();
    const style = await heading.evaluate(el => ({
      radius: getComputedStyle(el).borderRadius,
      border: getComputedStyle(el).borderTopColor,
      background: getComputedStyle(el).backgroundImage,
    }));
    expect(parseFloat(style.radius), `${route} Concept 1 heading radius`).toBeGreaterThanOrEqual(12);
    expect(style.background, `${route} Concept 1 heading gradient`).toContain('gradient');
  }
  await expect(page.getByText('Orders & Tickets', { exact: true })).toHaveCount(0);
  await assertNoPageOverflow(page, route);
}

async function findRequiredSubtabButton(page, route, label) {
  const exact = page.getByRole('button', { name: label, exact: true });
  if (await exact.count()) return exact.first();
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const contains = page.getByRole('button', { name: new RegExp(escaped, 'i') });
  await expect(contains.first(), `${route} must expose the ${label} subtab`).toBeVisible({ timeout: 10000 });
  return contains.first();
}

async function clickRequiredSubtabs(page, route, labels, mobile) {
  for (const label of labels) {
    const button = await findRequiredSubtabButton(page, route, label);
    await expect(button, `${route}/${label} subtab is visible`).toBeVisible();
    const boxBefore = await button.boundingBox().catch(() => null);
    if (mobile && boxBefore) expect(boxBefore.height, `${route}/${label} touch target`).toBeGreaterThanOrEqual(40);
    await button.click();
    await page.waitForTimeout(240);
    await assertConceptGeometry(page, route, mobile);
    const statefulSurface = page.locator('[data-concept-subtab]').first();
    await expect(statefulSurface, `${route}/${label} exposes an explicit redesigned subtab surface`).toBeVisible();
    const stateName = await statefulSurface.getAttribute('data-concept-subtab');
    expect(stateName, `${route}/${label} exposes an explicit redesigned subtab state`).toBeTruthy();
  }
}

test.describe('17.1.2 complete Concept 1 route and subtab fidelity', () => {
  test('Time Clock & Schedule is the first primary tab on desktop and mobile', async ({ page }) => {
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const account = creds('OWNER').email ? creds('OWNER') : ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    if (mobile) {
      const first = page.locator('[data-testid="concept17-mobile-bottom-nav"] [data-shell-route]').first();
      await expect(first).toHaveAttribute('data-shell-route', 'published');
    } else {
      const first = page.locator('[data-testid="concept17-desktop-sidebar"] [data-shell-route]').first();
      await expect(first).toHaveAttribute('data-shell-route', 'published');
    }
  });

  test('every real routed page uses the complete Concept 1 frame and desktop/mobile geometry', async ({ page }) => {
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const account = creds('OWNER').email ? creds('OWNER') : ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    for (const route of ROUTES) {
      const text = await gotoTab(page, route, { settleMs: 450, maxText: 60000 });
      if (route === 'godmode' && /permission gate|not authorized|does not include/i.test(text)) continue;
      await assertConceptGeometry(page, route, mobile);
    }
  });

  test('representative real subtabs retain the Concept 1 frame after navigation', async ({ page }) => {
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const account = creds('OWNER').email ? creds('OWNER') : ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    for (const [route, labels] of Object.entries(SUBTAB_ROUTES)) {
      await gotoTab(page, route, { settleMs: 550, maxText: 60000 });
      await assertConceptGeometry(page, route, mobile);
      await clickRequiredSubtabs(page, route, labels, mobile);
    }
  });

  test('nested Labor & Payroll subtabs keep the Concept 1 command surface', async ({ page }) => {
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const account = creds('OWNER').email ? creds('OWNER') : ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'financials', { settleMs: 550, maxText: 60000 });
    const labor = page.getByRole('button', { name: 'Labor & Payroll', exact: true }).first();
    await expect(labor, 'Financials must expose Labor & Payroll').toBeVisible();
    await labor.click();
    for (const label of ['Punch Fixer','Add Punch','Timesheet Review','Tips','Export']) {
      const button = page.getByRole('button', { name: label, exact: true }).first();
      await expect(button, `Labor & Payroll must expose ${label}`).toBeVisible();
      await button.click();
      await expect(page.locator('[data-concept-subtab^="labor-"]').first()).toBeVisible();
      await assertNoPageOverflow(page, `labor/${label}`);
    }
  });

  test('System Administrator exposes exactly 21 canonical directory cards and featured shortcuts do not duplicate identities', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 1500, maxText: 70000 });
    if (/permission gate|not authorized|does not include/i.test(text)) return;
    await expect(page.getByTestId('system-admin-directory-card')).toHaveCount(21);
    await expect(page.getByTestId('system-admin-featured-card')).toHaveCount(7);
    const canonicalTabs = ['roles','push','security','forensics','deployment','support','health','manual','retention','data','admins','tenants','users','setup','ai-usage','automation','maintenance','v14','history','ops','danger'];
    for (const tab of canonicalTabs) {
      const card = page.locator(`[data-admin-tab="${tab}"]`);
      await expect(card).toHaveCount(1);
      await card.click();
      await expect(page.getByTestId('system-admin-concept1-subpage'), `System Administrator/${tab} keeps the Concept 1 subpage shell`).toBeVisible({ timeout: 10000 });
      await assertNoPageOverflow(page, `System Administrator/${tab}`);
      const back = page.getByTestId('system-admin-subpage-back').first();
      if (await back.count()) {
        await back.click();
      } else {
        await gotoTab(page, 'godmode', { settleMs: 500, maxText: 70000 });
      }
      await expect(page.getByTestId('system-admin-complete-directory')).toBeVisible();
    }
  });
});
