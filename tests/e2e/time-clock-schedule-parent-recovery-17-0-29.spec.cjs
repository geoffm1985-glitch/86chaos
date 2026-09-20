const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, dismissBlockingDialogs } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('17.0.29 deployed mobile Time Clock and Schedule route opens without the recovery screen', async ({ page }) => {
  const account = ownerLikeCreds();
  requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password);
  await gotoTab(page, 'published', { settleMs: 1800, maxText: 50000 });
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);

  const body = page.locator('body');
  await expect(body).not.toContainText(/This section hit a snag|86 CHAOS APP RECOVERY/i, { timeout: 15000 });
  await expect(body).toContainText(/My Schedule|Time Clock|Clock In|Clock Out|Full Schedule/i, { timeout: 15000 });
});
