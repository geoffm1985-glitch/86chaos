const { test, expect } = require('@playwright/test');
const { creds, requireCreds, login, gotoTab, bodyText } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('16.0.234 Shift4 connection UI', () => {
  test('System Administrator sees read-only Dine controls and sanitized connection states', async ({ page }) => {
    const account = creds('SYSTEM_ADMIN'); requireCreds(account, 'System Administrator');
    await page.route('**/api/shift4-status**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, configured: true, state: 'authorization_required', provider: 'shift4', providerProduct: 'shift4-dine', readOnly: true, webhooks: 'deferred' }) }));
    await login(page, account.email, account.password, { chooseWorkspace: true });
    await gotoTab(page, 'settings');
    const integrations = page.getByRole('button', { name: /integrations/i }).first(); await expect(integrations).toBeVisible({ timeout: 15000 }); await integrations.click();
    await page.getByLabel('POS Provider').selectOption('shift4');
    await expect(page.getByTestId('shift4-controls')).toBeVisible();
    const text = await bodyText(page);
    expect(text).toMatch(/read-only shift4 dine bridge/i); expect(text).toMatch(/does not automatically change inventory/i); expect(text).toMatch(/webhook automation is deferred/i);
    expect(text).not.toMatch(/access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|4111111111111111/i);
  });
});
