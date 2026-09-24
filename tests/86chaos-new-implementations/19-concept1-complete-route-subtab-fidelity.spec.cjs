'use strict';

const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const ROUTES = [
  'published','schedule','events','today','ops','prep','inventory','recipes','financials','sales','labor','messages','team',
  'hr-training','maintenance','settings','help','reminders','ai-tools','menu-intelligence','back-office','audit','godmode'
];


const STABLE_SUBTAB_IDS = {
  published: {
    'My Schedule': 'my-schedule',
    'Full Schedule': 'full-schedule',
    'Month View': 'month-view',
    'Trade Board': 'trade-board',
    'Request Off': 'time-off',
    'Availability': 'availability',
    'Schedule Builder': 'schedule-builder',
  },
  financials: {
    'Overview': 'overview',
    'Daily Close': 'daily-close',
    'Sales': 'sales',
    'Labor & Payroll': 'labor',
    'Tips': 'tips',
    'COGS & Vendors': 'cogs',
    'Expenses': 'expenses',
    'P&L': 'pnl',
    'Targets': 'targets',
    'Reports': 'reports',
  },
  prep: {
    'Food Prep': 'prep',
    'Line Check': 'line-check',
    'Daily Tasks': 'daily',
    'Weekly Tasks': 'weekly',
    'Monthly Tasks': 'monthly',
  },
  inventory: {
    'count': 'count', 'order': 'order', 'Order Suggestions': 'ai-order', 'manage': 'manage',
    'vendors': 'vendors', 'Invoices': 'invoices', 'waste': 'waste',
  },
  maintenance: { 'Repair Board': 'issues', 'Preventative Maintenance': 'pm' },
  'hr-training': {
    'Overview': 'overview', 'Manuals': 'manuals', 'Onboarding': 'onboarding',
    'Certifications': 'certifications', 'Performance': 'performance',
  },
  settings: {
    'Profile': 'profile', 'Account Security': 'accountSecurity', 'Preferences': 'preferences',
    'Alerts': 'alerts', 'Billing': 'billing', 'Workspace': 'workspace', 'Branding': 'branding', 'Integrations': 'integrations',
  },
  'back-office': {
    'Dashboard': 'dashboard', 'Deposit Log': 'deposits', 'Approval Queue': 'approvals', 'Document Vault': 'documents',
    'Owner Reports': 'reports', 'QuickBooks': 'quickbooks', 'Accountant Packet': 'accountant-packet', 'Owner Rollup': 'owner-rollup',
  },
};

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
  const stableId = STABLE_SUBTAB_IDS[route]?.[label];
  if (stableId) {
    const stable = page.locator(`[data-concept-subtab-button="${stableId}"]`).first();
    await expect(stable, `${route} must expose the ${label} subtab`).toBeVisible({ timeout: 10000 });
    return stable;
  }
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
    test.setTimeout(240000);
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
    test.setTimeout(240000);
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
    test.setTimeout(180000);
    const mobile = test.info().project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const account = creds('OWNER').email ? creds('OWNER') : ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'financials', { settleMs: 550, maxText: 60000 });
    const labor = page.locator('[data-concept-subtab-button="labor"]').first();
    await expect(labor, 'Financials must expose Labor & Payroll').toBeVisible();
    await labor.click();
    const laborSubtabs = [['fixer','Punch Fixer'],['editor','Add Punch'],['review','Timesheet Review'],['tips','Tips'],['export','Export']];
    for (const [id, label] of laborSubtabs) {
      const button = page.locator(`[data-concept-subtab-button="labor-${id}"]`).first();
      await expect(button, `Labor & Payroll must expose ${label}`).toBeVisible();
      await button.click();
      await expect(page.locator('[data-concept-subtab^="labor-"]').first()).toBeVisible();
      await assertNoPageOverflow(page, `labor/${label}`);
    }
  });

  test('System Administrator exposes exactly 21 canonical directory cards and featured shortcuts do not duplicate identities', async ({ page }) => {
    test.setTimeout(240000);
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
