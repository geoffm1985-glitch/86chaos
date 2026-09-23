const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab, bodyText, attachJson, watchForProblems, summarizeProblems } = require('./utils/audit-helpers.cjs');

test.describe('10 System Administrator without online tracking', () => {
  test('System Administrator and Staff Roster do not expose online or last-seen status', async ({ page }, testInfo) => {
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    const adminText = await gotoTab(page, 'godmode', { settleMs: 2500, maxText: 70000 });
    await attachJson(testInfo, '10-system-admin-no-presence.json', { sample: adminText.slice(0, 10000), problems: summarizeProblems(problems) });
    if (!/permission gate|not authorized|does not include/i.test(adminText)) {
      expect(adminText).toMatch(/System Administrator|People Directory|Platform/i);
      expect(adminText).not.toMatch(/Online \/ Last Seen|Online now|Last online|Recently Active|Active Today|Refresh Online|Presence Snapshot|Current Session/i);
    }
    const teamText = await gotoTab(page, 'team', { settleMs: 1800, maxText: 50000 });
    expect(teamText).not.toMatch(/Online \/ Last Seen|Online now|Last online|Recently Active|Active Today|Presence Snapshot/i);
    expect(problems.filter(p => p.type === 'http-5xx'), 'System Admin and Staff Roster should not produce API 500/504 responses').toEqual([]);
  });

  test('System Administrator danger actions are protected by typed confirmation wording', async ({ page }, testInfo) => {
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
    await attachJson(testInfo, '10-system-admin-danger.json', { sample: text.slice(0, 9000) });
    if (!/permission gate|not authorized|does not include/i.test(text)) {
      expect(text, 'System Admin should not show Branding / Display nav label').not.toMatch(/Branding\s*\/\s*Display/i);
      expect(text, 'Dangerous admin actions should require typed confirmation or explicit confirmation language').toMatch(/confirm|type|LOG OUT USERS|danger|irreversible|Are you sure/i);
    }
  });
});
