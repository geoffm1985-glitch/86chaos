'use strict';
const { test, expect } = require('@playwright/test');
const { creds, requireCreds, login, gotoTab, watchForProblems, summarizeProblems, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('17.0.52 System Administrator renders Firebase cost observability without the not-a-function recovery crash', async ({ page }, testInfo) => {
  const account = creds('SYSTEM_ADMIN');
  requireCreds(account, 'SYSTEM_ADMIN');
  const problems = [];
  watchForProblems(page, problems);
  await login(page, account.email, account.password);
  const text = await gotoTab(page, 'godmode', { settleMs: 2500, maxText: 70000 });
  expect(text).not.toMatch(/86 CHAOS APP RECOVERY|This section hit a snag/i);

  let securityButton = page.getByRole('button', { name: /^(?:Open\s+)?Security Center$/i }).first();
  if (!(await securityButton.isVisible().catch(() => false))) {
    const directoryButton = page.getByRole('button', { name: /Show directory/i }).first();
    if (await directoryButton.isVisible().catch(() => false)) await directoryButton.click();
    securityButton = page.getByRole('button', { name: /^(?:Open\s+)?Security Center$/i }).first();
  }
  await expect(securityButton).toBeVisible({ timeout: 15000 });
  await securityButton.click();
  await expect(page.getByTestId('firebase-cost-observability')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Firebase / RTDB Cost Observability', { exact: true })).toBeVisible();

  const runtimeFailures = problems.filter(problem => problem.type === 'page-error' || problem.type === 'console-error')
    .filter(problem => /ut is not a function|buildFirebaseCostDiagnostics|not a function/i.test(String(problem.message || problem.text || '')));
  await attachJson(testInfo, '65-system-admin-firebase-cost-runtime-17-0-52.json', {
    sample: (await page.locator('body').innerText()).slice(0, 12000),
    problems: summarizeProblems(problems),
    runtimeFailures,
  });
  expect(runtimeFailures).toEqual([]);
});
