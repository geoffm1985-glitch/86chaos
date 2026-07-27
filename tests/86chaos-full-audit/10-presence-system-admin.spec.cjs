const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab, bodyText, attachJson, watchForProblems, summarizeProblems } = require('./utils/audit-helpers.cjs');

test.describe('10 presence / Online Last Seen / System Administrator', () => {
  test('Online / Last Seen uses honest labels and never raw AppleWebKit/Mozilla soup or negative inactivity', async ({ page }, testInfo) => {
    const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
    requireCreds(account, 'system admin or owner-like account');
    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 2500, maxText: 70000 });
    const lower = text.toLowerCase();
    await attachJson(testInfo, '10-presence-system-admin.json', { sample: text.slice(0, 10000), problems: summarizeProblems(problems) });
    if (!/permission gate|not authorized|does not include/i.test(lower)) {
      expect(text, 'System Administrator should include Online/Last Seen or People Directory presence surface').toMatch(/Online|Last Seen|Recently Active|Active Today|People Directory/i);
      expect(text, 'Presence UI should not expose raw user-agent soup').not.toMatch(/Mozilla\/5\.0|AppleWebKit|KHTML, like Gecko/i);
      expect(text, 'Presence UI should never say Inactive -1 days or other negative day counts').not.toMatch(/Inactive -\d+ days/i);
      expect(text, 'Presence UI should split fresh online from stale activity').toMatch(/Online Now|Recently Active|Active Today|Last Seen/i);
      expect(text, 'RTDB 404 should be friendly fallback, not scary raw detail').not.toMatch(/RTDB REST 404|FirebaseError.*404/i);
    }
    expect(problems.filter(p => p.type === 'http-5xx'), 'Presence/System Admin should not produce API 500/504 responses').toEqual([]);
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
