const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('Month Print Calendar generates a PDF viewer and never invokes direct window.print', async ({ page }) => {
  const account = ownerLikeCreds(); requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password, { chooseWorkspace: true }); await gotoTab(page, 'published');
  await page.getByRole('button', { name: /month view/i }).click();
  await page.evaluate(() => {
    window.__schedulePdfProbe = { printCalls: 0, href: '', opened: 0 };
    window.print = () => { window.__schedulePdfProbe.printCalls += 1; };
    window.open = () => { window.__schedulePdfProbe.opened += 1; return { location: { replace(value) { window.__schedulePdfProbe.href = String(value); } }, close() {} }; };
  });
  const button = page.getByRole('button', { name: /print calendar.*pdf/i }); await expect(button).toBeVisible(); await button.click();
  await expect(button).toBeEnabled({ timeout: 30000 });
  await expect.poll(() => page.evaluate(() => window.__schedulePdfProbe.href), { timeout: 30000 }).toMatch(/^blob:/);
  const probe = await page.evaluate(() => window.__schedulePdfProbe);
  expect(probe.printCalls).toBe(0); expect(probe.opened).toBe(1); expect(probe.href).toMatch(/^blob:/);
});

test('popup-blocked/mobile path downloads the actual PDF and generation errors are human-readable', async ({ page }, testInfo) => {
  const account = ownerLikeCreds(); requireCreds(account, 'owner-like account');
  await login(page, account.email, account.password, { chooseWorkspace: true }); await gotoTab(page, 'published'); await page.getByRole('button', { name: /month view/i }).click();
  await page.evaluate(() => {
    window.print = () => { throw new Error('direct print forbidden'); }; window.open = () => null;
  });
  const button = page.getByRole('button', { name: /print calendar.*pdf/i }); const downloadEvent = page.waitForEvent('download'); await button.click(); await expect(button).toBeEnabled({ timeout: 30000 });
  const download = await downloadEvent; const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-'); expect(bytes.length).toBeGreaterThan(1000); expect(download.suggestedFilename()).toMatch(/86chaos-schedule-.*\.pdf$/i);
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('fixture generation failure'); }; });
  await button.click(); await expect(page.getByRole('alert')).toContainText(/could not be generated.*no schedule data was changed/i);
  if (testInfo.project.name === 'mobile-chromium') await expect(button).toBeVisible();
});
