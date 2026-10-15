const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const {verifyHeaderTouchHandoff}=require('../fixtures/schedule-header-touch-scenario.cjs');

test.describe('57 Schedule Builder direct-touch sticky header handoff', () => {
  test('mobile direct-touch drag keeps day header below sticky control deck', async ({ page }, testInfo) => {
    test.skip(!/mobile/i.test(testInfo.project.name), 'Direct-touch regression is mobile-specific.');
    const account=ownerLikeCreds(); requireCreds(account,'owner-like account');
    await login(page,account.email,account.password);
    await gotoTab(page,'schedule',{ settleMs:1400,maxText:50000 });
    await page.getByRole('button',{name:'Monthly & advanced tools',exact:true}).click();
    const evidence=await verifyHeaderTouchHandoff(page);
    await attachJson(testInfo,'57-sticky-header-touch-handoff.json',{project:testInfo.project.name,...evidence});
  });
});
