const { test, expect } = require('@playwright/test');
const {
  ownerLikeCreds,
  requireCreds,
  login,
  expectVersion,
  gotoTab,
  expectNoFatal,
  bodyText,
  dismissBlockingDialogs,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('Time Clock & Schedule, Request Off, and Schedule Builder render without the section recovery screen', async ({ page }) => {
  test.setTimeout(120_000);
  const account = ownerLikeCreds();
  requireCreds(account, 'owner-like account');

  await login(page, account.email, account.password, { tab: 'published' });
  await expectVersion(page, process.env.CHAOS_EXPECTED_VERSION || '17.0.29');
  await gotoTab(page, 'published', { settleMs: 700 });
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);

  let text = await bodyText(page, 30000);
  expect(text).not.toMatch(/This section hit a snag/i);
  await expectNoFatal(page, 'Time Clock & Schedule / My Schedule');
  await expect(page.getByRole('button', { name: /clock in|clock out/i }).first()).toBeVisible({ timeout: 15000 });

  const requestOff = page.getByRole('button', { name: /^Schedule Request Off$/i }).first();
  await expect(requestOff).toBeVisible({ timeout: 15000 });
  await requestOff.click();
  await page.waitForTimeout(700);
  text = await bodyText(page, 30000);
  expect(text).not.toMatch(/This section hit a snag/i);
  expect(text).toMatch(/Request Off/i);
  await expectNoFatal(page, 'Time Clock & Schedule / Request Off');

  const builder = page.getByRole('button', { name: /^Schedule Builder$/i }).first();
  await expect(builder).toBeVisible({ timeout: 15000 });
  await builder.click();
  await page.waitForTimeout(900);
  text = await bodyText(page, 30000);
  expect(text).not.toMatch(/This section hit a snag/i);
  await expectNoFatal(page, 'Time Clock & Schedule / Schedule Builder');
  await expect(page.locator('.schedule-builder-control-deck').first()).toBeVisible({ timeout: 15000 });
});
