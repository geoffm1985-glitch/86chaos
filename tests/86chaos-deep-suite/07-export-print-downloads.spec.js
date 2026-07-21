// 86 Chaos Export / Print / Download Deep Test
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  assertNoUnavailablePage,
  clickButtonIfPresent,
  closeBlockingModals,
  attachReport,
} = require('./utils/chaos-helpers');

async function testDownloadOrPrint(page, matcher, label, report, problems) {
  await closeBlockingModals(page);
  const button = page.locator('main').getByRole('button', { name: matcher }).first();
  const visible = await button.isVisible({ timeout: 2500 }).catch(() => false);
  if (!visible) {
    report.actions.push({ label, skipped: true, reason: 'button not visible' });
    return;
  }
  const downloadPromise = page.waitForEvent('download', { timeout: 9000 }).catch(() => null);
  await button.click({ timeout: 7000 }).catch((error) => {
    problems.push({ type: 'export-button-click-failed', label, message: error.message, url: page.url() });
  });
  const download = await downloadPromise;
  if (download) {
    report.actions.push({ label, downloaded: true, suggestedFilename: download.suggestedFilename() });
  } else {
    const text = await bodyText(page);
    report.actions.push({ label, downloaded: false, maybePrintOrWindowAction: true, textStart: text.slice(0, 500) });
  }
  await closeBlockingModals(page);
}

test.describe('86 Chaos Export / Print / Download Deep Test', () => {
  test('all major exports and print buttons respond safely', async ({ page }, testInfo) => {
    test.setTimeout(300000);
    const problems = [];
    const report = { runId: RUN_ID, actions: [] };
    watchForProblems(page, problems, { acceptDialogs: true });
    const account = ownerLikeCreds();
    await login(page, account.email, account.password);

    const checks = [
      { tab: 'financials', buttons: [/Print Report/i, /Export/i, /Download/i, /CSV/i, /PDF/i] },
      { tab: 'back-office', buttons: [/Print Owner Report/i, /Download CSV/i, /Accountant|Close Packet|Export/i] },
      { tab: 'published', buttons: [/Print|Export|Download|PDF/i] },
      { tab: 'inventory', buttons: [/Export|Download|CSV|PDF|Print/i] },
      { tab: 'team', buttons: [/Export|Download|CSV|PDF|Print/i] },
      { tab: 'godmode', buttons: [/Export|Download|Backup|Report/i] },
    ];

    for (const check of checks) {
      await gotoTab(page, check.tab).catch((error) => problems.push({ type: 'export-route-failed', tab: check.tab, message: error.message }));
      await assertNoUnavailablePage(page, problems, `Export ${check.tab}`);
      for (const button of check.buttons) {
        await testDownloadOrPrint(page, button, `${check.tab} ${button}`, report, problems);
      }
    }

    await attachReport(testInfo, 'export-print-downloads-report.json', { report, problems });
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
