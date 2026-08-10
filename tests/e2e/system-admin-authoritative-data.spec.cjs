const { test, expect } = require('@playwright/test');
const { loginIfNeeded, gotoAuthenticatedRoute } = require('./utils/release-login-helper.cjs');

async function loginSystemAdmin(page) {
  const email = process.env.SYSTEM_ADMIN_EMAIL || process.env.CHAOS_SYSTEM_ADMIN_EMAIL;
  const password = process.env.SYSTEM_ADMIN_PASSWORD || process.env.CHAOS_SYSTEM_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('SYSTEM_ADMIN_EMAIL and SYSTEM_ADMIN_PASSWORD are required.');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page, email, password, { timeout: 30000 });
}
async function openGodMode(page, tabName) {
  await gotoAuthenticatedRoute(page, 'godmode', { timeout: 30000 });
  if (tabName) {
    const button = page.getByRole('button', { name: tabName }).first();
    if (await button.count()) await button.click();
  }
}

test.describe('System Administrator authoritative data', () => {
  test('People Directory loads authoritative global roster without visiting Push or Workspaces first', async ({ page }) => {
    await loginSystemAdmin(page);
    await openGodMode(page, /People Directory|Users/i);
    await expect(page.getByText(/Authoritative server roster/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Missing or insufficient permissions/i)).toHaveCount(0);
  });

  test('People Directory roster is independent of current restaurant membership', async ({ page }) => {
    await loginSystemAdmin(page);
    await openGodMode(page, /People Directory|Users/i);
    await expect(page.getByText(/Authoritative server roster/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Authoritative platform user roster could not load/i)).toHaveCount(0);
  });

  test('Workspaces / Clients shows users from another workspace through canonical workspace membership', async ({ page }) => {
    await loginSystemAdmin(page);
    await openGodMode(page, /Workspaces|Clients/i);
    await expect(page.getByText(/Workspace|Client|Users/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Missing or insufficient permissions/i)).toHaveCount(0);
  });

  test('Push Control Center shows users from multiple workspaces', async ({ page }) => {
    await loginSystemAdmin(page);
    await openGodMode(page, /Push Control Center|Push/i);
    await expect(page.getByText(/Device|Push|Recipient/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Missing or insufficient permissions/i)).toHaveCount(0);
  });

  test('Backup Health refresh uses server authority instead of client Firestore backupStatus', async ({ page }) => {
    await loginSystemAdmin(page);
    await openGodMode(page, /Health|Backup/i);
    const refresh = page.getByRole('button', { name: /Refresh Health/i }).first();
    if (await refresh.count()) await refresh.click();
    await expect(page.getByText(/Missing or insufficient permissions/i)).toHaveCount(0);
  });

  test('System Administrator platform data surfaces load through server authority', async ({ page }) => {
    await loginSystemAdmin(page);
    await openGodMode(page, null);
    for (const name of [/Forensics/i, /Operations|Ops/i, /Security/i]) {
      const button = page.getByRole('button', { name }).first();
      if (await button.count()) await button.click();
      await expect(page.getByText(/Missing or insufficient permissions|PERMISSION_DENIED/i)).toHaveCount(0);
    }
  });
});
