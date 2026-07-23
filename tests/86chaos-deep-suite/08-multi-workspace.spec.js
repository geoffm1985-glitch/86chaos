// 86 Chaos 15.1.10 multi-workspace/multi-location safety checks.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  openMenu,
  closeTransientUi,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

test.describe('86 Chaos Multi-Workspace / Multi-Location', () => {
  test('workspace identity is visible and switching surfaces do not break current workspace', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const today = await expectRouteHealthy(page, 'today');
    expect(today.text, 'Today should show current workspace/app context').toMatch(/TESTAURANT|PREVIEW|Cheers|Restaurant|Workspace|Today|Kitchen|Sales Today/i);

    await expectRouteHealthy(page, 'settings');
    const settingsText = await bodyText(page);
    expect(settingsText, 'Settings should not expose another workspace as active without user action').not.toMatch(/ghost tenant|impersonating workspace without audit/i);

    await openMenu(page);
    const menuText = await bodyText(page);
    const hasWorkspaceLabel = /TESTAURANT|PREVIEW|Current Restaurant|workspace|restaurant|Cheers/i.test(menuText);
    await closeTransientUi(page);

    await expectRouteHealthy(page, 'today');
    const afterText = await bodyText(page);
    expect(afterText, 'Current workspace should still render after menu/workspace surface check').toMatch(/Today|Role Home|No urgent problems|Need Attention|Sales Today|Kitchen Command|86 Alerts/i);

    await attachReport(testInfo, '08-multi-workspace-report.json', {
      runId: RUN_ID,
      hasWorkspaceLabel,
      todayText: today.text.slice(0, 1200),
      settingsText: settingsText.slice(0, 1200),
      menuText: menuText.slice(0, 1200),
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
