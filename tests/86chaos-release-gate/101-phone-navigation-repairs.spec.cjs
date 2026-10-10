'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('drawer search clears after close and reopen so all navigation stays reachable', async ({ page }) => {
  const account = ownerLikeCreds(); requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password);
  await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  const search = page.getByRole('textbox', { name: 'Search menu, help, and tools', exact: true });
  await search.fill('Recipe Book');
  await expect(page.getByRole('button', { name: 'Recipe Book', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Staff Roster', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Open Staff Roster', exact: true })).toBeVisible();
});

test('standalone first close request warns after reload and leaves second request unblocked', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query === '(display-mode: standalone)' ? { ...original(query), matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : original(query);
    window.__qaCloseWatchers = [];
    class PlatformCloseWatcher extends EventTarget {
      constructor() { super(); this.active = true; window.__qaCloseWatchers.push(this); }
      destroy() { this.active = false; }
      requestClose() { if (this.active) { this.active = false; this.dispatchEvent(new Event('close')); } }
    }
    window.CloseWatcher = PlatformCloseWatcher;
  });
  const account = ownerLikeCreds(); requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password); await page.reload();
  await expect(page.getByRole('button', { name: 'Open navigation menu', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__qaCloseWatchers.filter(w => w.active).length)).toBe(1);
  await page.evaluate(() => window.__qaCloseWatchers.find(w => w.active).requestClose());
  await expect(page.getByText('Press back again to exit.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__qaCloseWatchers.some(w => w.active))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__qaCloseWatchers.filter(w => w.active).length), { timeout: 5000 }).toBe(1);
});

test('standalone close request dismisses the drawer before the app exit warning', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query === '(display-mode: standalone)' ? { ...original(query), matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : original(query);
  });
  const account = ownerLikeCreds(); requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password);
  await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toHaveCount(0);
  await expect(page.getByText('Press back again to exit.', { exact: true })).toHaveCount(0);
});
