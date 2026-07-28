const { test, expect } = require('@playwright/test');
const { CAPABILITIES, hasFeature, ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
test.describe('27 Restaurant AI Assistant capability gate', () => {
  test('AI assistant surfaces are review-first and never imply automatic orders, payroll, or destructive saves', async ({ page }, testInfo) => {
    test.skip(!(hasFeature('aiOrderAssistant') || hasFeature('restaurantAiAssistants') || hasFeature('voice')), 'Detected app version has no Restaurant AI Assistant feature.');
    const account=ownerLikeCreds(); requireCreds(account,'owner-like account'); await login(page,account.email,account.password);
    const samples={};
    for(const tab of ['inventory','today','help','ai-tools']) { const text=await gotoTab(page,tab,{settleMs:900,maxText:50000}); samples[tab]=text.slice(0,12000); }
    const combined=Object.values(samples).join('\n');
    expect(combined).toMatch(/assistant|86Voice|AI Order|recommend|intelligence|explain/i);
    expect(combined).not.toMatch(/order has been automatically sent|payroll automatically submitted|automatic destructive change completed/i);
    await attachJson(testInfo,'27-restaurant-ai-assistants.json',{capabilities:CAPABILITIES,samples});
  });
});
