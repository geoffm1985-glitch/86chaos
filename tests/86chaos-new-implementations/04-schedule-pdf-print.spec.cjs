const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('Month Print Calendar generates a PDF viewer directly and never invokes direct window.print', async ({ page }) => {
  const account = ownerLikeCreds(); requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password, { chooseWorkspace: true }); await gotoTab(page, 'published');
  await page.getByRole('button', { name: /month view/i }).click();
  await page.evaluate(() => {
    window.__schedulePdfProbe = { printCalls: 0, opened: [] };
    window.print = () => { window.__schedulePdfProbe.printCalls += 1; };
    window.open = (url, target) => { window.__schedulePdfProbe.opened.push({ url: String(url), target: String(target) }); return {}; };
  });
  const button = page.getByRole('button', { name: /print calendar.*pdf/i }); await expect(button).toBeVisible(); await button.click();
  await expect(button).toBeEnabled({ timeout: 30000 });
  const probe = await page.evaluate(() => window.__schedulePdfProbe);
  expect(probe.printCalls).toBe(0);
  if (test.info().project.name === 'mobile-chromium') {
    expect(probe.opened).toEqual([]);
  } else {
    expect(probe.opened).toHaveLength(1);
    expect(probe.opened[0].url).toMatch(/^blob:/);
    expect(probe.opened[0].url).not.toBe('about:blank');
  }
});

test('popup-blocked/file-delivery path downloads the actual PDF and delivery errors are human-readable', async ({ page }, testInfo) => {
  const account = ownerLikeCreds(); requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password, { chooseWorkspace: true }); await gotoTab(page, 'published'); await page.getByRole('button', { name: /month view/i }).click();
  await page.evaluate(() => {
    window.print = () => { throw new Error('direct print forbidden'); };
    window.open = () => null;
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); } catch (_) {}
    try { Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined }); } catch (_) {}
  });
  const button = page.getByRole('button', { name: /print calendar.*pdf/i }); const downloadEvent = page.waitForEvent('download'); await button.click(); await expect(button).toBeEnabled({ timeout: 30000 });
  const download = await downloadEvent; const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-'); expect(bytes.length).toBeGreaterThan(1000); expect(download.suggestedFilename()).toMatch(/86chaos-schedule-.*\.pdf$/i);
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('fixture delivery failure'); }; });
  await button.click(); await expect(page.getByRole('alert')).toContainText(/created but could not be opened or downloaded.*no schedule data was changed/i);
  if (testInfo.project.name === 'mobile-chromium') await expect(button).toBeVisible();
});
