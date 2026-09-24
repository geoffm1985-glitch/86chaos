'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.28 browser-safe i18n bootstrap repair', () => {
  test('application boots through the i18n provider without a translation runtime crash', async ({ page }) => {
    const bootstrapErrors = [];
    page.on('pageerror', error => {
      const message = String(error?.message || error || '');
      if (/normalizeAppLanguage|translate|i18n|localeForLanguage|is not a function/i.test(message)) bootstrapErrors.push(message);
    });

    const account = ownerLikeCreds();
    requireCreds(account, 'owner/admin-like');
    await login(page, account.email, account.password, { chooseWorkspace: true });

    await expect(page.locator('html')).toHaveAttribute('lang', /^(en|es)$/i, { timeout: 20000 });
    await expect(page.getByText(/Version 17\.0\.38/i)).toBeAttached({ timeout: 20000 });
    expect(bootstrapErrors, `translation/bootstrap page errors: ${bootstrapErrors.join(' | ')}`).toEqual([]);
  });
});
