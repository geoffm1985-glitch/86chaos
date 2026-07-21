// 86 Chaos Multi-Workspace / Multi-Location Deep Test
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
  attachReport,
  closeBlockingModals,
} = require('./utils/chaos-helpers');

test.describe('86 Chaos Multi-Workspace Deep Test', () => {
  test('workspace picker, current workspace display, and workspace-specific owner surfaces', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const problems = [];
    const report = { runId: RUN_ID, workspaces: [], pages: [] };
    watchForProblems(page, problems);
    const account = ownerLikeCreds();
    await login(page, account.email, account.password);

    for (const tab of ['today', 'back-office', 'financials', 'inventory']) {
      await gotoTab(page, tab);
      await assertNoUnavailablePage(page, problems, `workspace page ${tab}`);
      report.pages.push({ tab, textStart: (await bodyText(page)).slice(0, 700), url: page.url() });
    }

    // Open workspace switcher if present.
    const workspaceButton = page.getByRole('button', { name: /Active workspace|workspace|restaurant|switch/i }).first();
    const visible = await workspaceButton.isVisible({ timeout: 2500 }).catch(() => false);
    if (visible) {
      await workspaceButton.click({ timeout: 5000 }).catch((error) => problems.push({ type: 'workspace-switcher-open-failed', message: error.message, url: page.url() }));
      await page.waitForTimeout(700);
      const text = await bodyText(page);
      report.switcherTextStart = text.slice(0, 1200);
      const candidates = await page.getByRole('button').allTextContents().catch(() => []);
      report.workspaces = candidates.filter((x) => /Cheers|Restaurant|Kitchen|Workspace|Bobby|Countryside|Chef/i.test(x)).slice(0, 12);
      await closeBlockingModals(page);
    } else {
      report.workspaceSwitcher = 'No explicit workspace switcher button visible for this account.';
    }

    // Owner Pro multi-location rollup should live in Back Office if enabled.
    await gotoTab(page, 'back-office');
    const bo = await bodyText(page);
    report.backOfficeTextStart = bo.slice(0, 1200);
    if (/multi-location|location rollup|Owner Summary|Open Alerts|QB Drafts|Back Office/i.test(bo)) {
      report.ownerRollupSurface = true;
    } else {
      problems.push({ type: 'owner-rollup-surface-missing', textStart: bo.slice(0, 900), url: page.url() });
    }

    await attachReport(testInfo, 'multi-workspace-report.json', { report, problems });
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
