'use strict';
const { test, expect } = require('@playwright/test');
const { creds, requireCreds, login, gotoTab, watchForProblems, summarizeProblems, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('17.0.51 System Administrator overview survives live data without App Recovery', async ({ page }, testInfo) => {
  const account = creds('SYSTEM_ADMIN');
  requireCreds(account, 'SYSTEM_ADMIN');
  const problems = [];
  watchForProblems(page, problems);
  await login(page, account.email, account.password);
  const text = await gotoTab(page, 'godmode', { settleMs: 2500, maxText: 70000 });
  await attachJson(testInfo, '64-system-admin-recovery-boundary-17-0-51.json', {
    sample: text.slice(0, 12000),
    problems: summarizeProblems(problems),
  });
  expect(text).not.toMatch(/86 CHAOS APP RECOVERY|This section hit a snag/i);
  expect(text).toMatch(/System Administrator|System Administration|Operations Console|People Directory|Online \/ Last Seen/i);
  expect(problems.filter(problem => problem.type === 'page-error')).toEqual([]);
});
