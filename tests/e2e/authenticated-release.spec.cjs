const { test, expect } = require('@playwright/test');
const { expectedRoutesForRole } = require('../../scripts/86chaos-release-gate/route-access-matrix.cjs');
const { gotoTab, ROUTE_SPECS } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { loginIfNeeded, gotoAuthenticatedRoute } = require('./utils/release-login-helper.cjs');

const routeById = new Map(ROUTE_SPECS.map(route => [route.tab, route]));

const releaseGate = process.env.CHAOS_RELEASE_GATE === 'true';
const roles = [
  { role: 'system-admin', emailKey: 'SYSTEM_ADMIN_EMAIL', passwordKey: 'SYSTEM_ADMIN_PASSWORD' },
  { role: 'owner', emailKey: 'OWNER_EMAIL', passwordKey: 'OWNER_PASSWORD' },
  { role: 'manager', emailKey: 'MANAGER_EMAIL', passwordKey: 'MANAGER_PASSWORD' },
  { role: 'staff', emailKey: 'STAFF_EMAIL', passwordKey: 'STAFF_PASSWORD' }
].map(entry => ({
  ...entry,
  routeMatrix: expectedRoutesForRole(entry.role),
  get tabs() { return this.routeMatrix.filter(row => row.expectedVisible).map(row => row.route); },
  get deniedTabs() { return this.routeMatrix.filter(row => !row.directNavigationAllowed).map(row => row.route); }
}));

function credentials(entry) {
  const email = process.env[entry.emailKey] || (!releaseGate ? process.env.TEST_EMAIL : '');
  const password = process.env[entry.passwordKey] || (!releaseGate ? process.env.TEST_PASSWORD : '');
  if (!email || !password) {
    const message = `Missing required QA credentials for ${entry.role}: ${entry.emailKey}/${entry.passwordKey}`;
    if (releaseGate) throw new Error(message);
    test.skip(true, message);
  }
  return { email, password };
}

async function login(page, email, password) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page, email, password, { timeout: 30_000 });
}

async function openPermittedRoute(page, tab) {
  const spec = routeById.get(tab);
  expect(spec, `Canonical permitted route ${tab} must exist in the browser route inventory`).toBeTruthy();
  const text = await gotoTab(page, tab, { settleMs: 0, timeout: 8_000, maxText: 30_000, force: true });
  const activeTab = await page.evaluate(() => new URLSearchParams(window.location.search).get('tab') || 'today');
  expect(activeTab, `Permitted route ${tab} should become the active in-app route`).toBe(tab);
  expect(text, `Permitted route ${tab} should render its declared surface`).toMatch(spec.expect);
}

async function openDirectRoute(page, tab) {
  await gotoAuthenticatedRoute(page, tab, { timeout: 30_000 });
}

async function assertHealthyScreen(page, role, tab) {
  const body = page.locator('body');
  await expect(body).not.toContainText(/Something went wrong|React error boundary|Unhandled exception|ChunkLoadError/i);
  await expect(body).not.toContainText(/This page is not available|Page unavailable|access denied unexpectedly|section error|fatal error/i);
  const text = (await body.innerText()).trim();
  expect(text.length, `${role} ${tab} rendered meaningful content`).toBeGreaterThan(40);
  const layout = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
    visibleControls: document.querySelectorAll('button:not([hidden]),a:not([hidden]),input:not([hidden]),select:not([hidden]),textarea:not([hidden])').length
  }));
  expect(layout.html, `${role} ${tab} html overflow`).toBeLessThanOrEqual(1);
  expect(layout.body, `${role} ${tab} body overflow`).toBeLessThanOrEqual(1);
  expect(layout.visibleControls, `${role} ${tab} exposes controls`).toBeGreaterThan(0);
}

for (const entry of roles) {
  test.describe(`${entry.role} authenticated release surfaces`, () => {
    test('opens every permitted primary surface without runtime or layout failure', async ({ page }) => {
      const { email, password } = credentials(entry);
      await login(page, email, password);
      for (const tab of entry.tabs) {
        await openPermittedRoute(page, tab);
        await assertHealthyScreen(page, entry.role, tab);
      }
    });

    test('direct navigation follows the canonical denied-route matrix', async ({ page }) => {
      const deniedTabs = entry.deniedTabs.slice(0, releaseGate ? undefined : 6);
      test.skip(deniedTabs.length === 0, `${entry.role} has no denied primary routes in the canonical matrix`);
      const { email, password } = credentials(entry);
      await login(page, email, password);
      for (const tab of deniedTabs) {
        await openDirectRoute(page, tab);
        await expect(page.locator('body')).toContainText(/Plan & Permission Gate|Restricted Platform Tools|Your role does not include this (?:tool|area)|not-platform-admin|HTTP:\s*403/i);
      }
    });
  });
}
