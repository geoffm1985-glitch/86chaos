const { test, expect } = require('@playwright/test');
const {
  creds,
  requireCreds,
  login,
  gotoTab,
  bodyText,
  expectNoFatal,
  attachJson,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

async function hardReloadAndCollect(page, tab) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
  await gotoTab(page, tab, { settleMs: 1200, timeout: 60_000 });
  await expectNoFatal(page, `hard refresh ${tab}`);
  return bodyText(page, 60_000);
}

test.describe('33 Refresh access regression', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'chromium-full', 'Refresh/role hydration runs once on the primary desktop release project.'));

  test('System Administrator keeps platform tools after hard refresh and direct route reload', async ({ page }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const account = creds('SYSTEM_ADMIN');
    requireCreds(account, 'System Administrator');
    await login(page, account.email, account.password);
    let text = await gotoTab(page, 'godmode', { settleMs: 1200, timeout: 60_000 });
    expect(text).toMatch(/System Administrator|Platform Operations|Security|Backup|People/i);

    text = await hardReloadAndCollect(page, 'godmode');
    expect(text).toMatch(/System Administrator|Platform Operations|Security|Backup|People/i);
    expect(text).not.toMatch(/Restricted Platform Tools|role does not include|access denied/i);

    await page.goto(new URL('/?tab=godmode', page.url()).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
    text = await bodyText(page, 60_000);
    expect(text).toMatch(/System Administrator|Platform Operations|Security|Backup|People/i);
    await attachJson(testInfo, 'system-admin-refresh-access.json', { sample: text.slice(0, 8000) });
  });

  test('owner and manager keep their permission surfaces after hard refresh without gaining System Administrator', async ({ page }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const rows = [];
    for (const [label, tab, expected] of [
      ['OWNER', 'schedule', /Schedule Builder|Publish|Auto-Fill|Schedule/i],
      ['MANAGER', 'schedule', /Schedule Builder|Publish|Auto-Fill|Schedule/i],
    ]) {
      const account = creds(label);
      requireCreds(account, label.toLowerCase());
      await login(page, account.email, account.password);
      let text = await hardReloadAndCollect(page, tab);
      expect(text).toMatch(expected);
      text = await gotoTab(page, 'godmode', { settleMs: 800, timeout: 45_000 });
      expect(text).toMatch(/Restricted Platform Tools|role does not include|not available|access denied/i);
      rows.push({ label, sample: text.slice(0, 3000) });
      await page.getByRole('button', { name: /log out/i }).first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
    await attachJson(testInfo, 'owner-manager-refresh-access.json', rows);
  });
});
