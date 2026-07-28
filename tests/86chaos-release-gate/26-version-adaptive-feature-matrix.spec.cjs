const { test, expect } = require('@playwright/test');
const { CAPABILITIES, ROUTE_SPECS, ownerLikeCreds, requireCreds, login, gotoTab, bodyText, viewportAudit, attachJson, expectNoFatal } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
test.describe('26 version-adaptive feature matrix', () => {
  test('detected features render without fatal errors and absent optional features do not become release failures', async ({ page }, testInfo) => {
    const account=ownerLikeCreds(); requireCreds(account,'owner-like account'); await login(page,account.email,account.password);
    const results=[];
    for(const route of ROUTE_SPECS){ const text=await gotoTab(page,route.tab,{settleMs:700,maxText:20000}); await expectNoFatal(page,route.label); const layout=await viewportAudit(page); results.push({tab:route.tab,label:route.label,matched:route.expect.test(text),optional:Boolean(route.optional),horizontalOverflow:layout.horizontalOverflow,sample:text.slice(0,800)}); }
    await attachJson(testInfo,'26-version-adaptive-feature-matrix.json',{capabilities:CAPABILITIES,results});
    const required=results.filter(r=>!r.optional); expect(required.filter(r=>!r.matched), 'Every detected core route should display recognizable content').toEqual([]);
  });
});
