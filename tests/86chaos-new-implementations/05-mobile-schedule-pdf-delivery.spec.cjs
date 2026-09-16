const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('real-device regression: Print Calendar never uses about:blank and mobile receives a PDF file', async ({ page }, testInfo) => {
  const account = ownerLikeCreds(); requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password, { chooseWorkspace: true }); await gotoTab(page, 'published');
  await page.getByRole('button', { name: /month view/i }).click();
  await page.evaluate(() => {
    window.__mobilePdfRegression = { opens: [] };
    window.open = (url, target) => { window.__mobilePdfRegression.opens.push({ url: String(url), target: String(target) }); return {}; };
    window.print = () => { throw new Error('legacy browser print forbidden'); };
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); } catch (_) {}
    try { Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined }); } catch (_) {}
  });

  const button = page.getByRole('button', { name: /print calendar.*pdf/i });
  await expect(button).toBeVisible();

  if (testInfo.project.name === 'mobile-chromium') {
    const downloadEvent = page.waitForEvent('download');
    await button.click();
    const download = await downloadEvent;
    await expect(button).toBeEnabled({ timeout: 30000 });
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const opens = await page.evaluate(() => window.__mobilePdfRegression.opens);
    expect(opens).toEqual([]);
  } else {
    await button.click();
    await expect(button).toBeEnabled({ timeout: 30000 });
    const opens = await page.evaluate(() => window.__mobilePdfRegression.opens);
    expect(opens).toHaveLength(1);
    expect(opens[0].url).toMatch(/^blob:/);
    expect(opens[0].url).not.toBe('about:blank');
  }
});
