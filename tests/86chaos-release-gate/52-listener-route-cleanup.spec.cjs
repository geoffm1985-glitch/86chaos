const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, watchForProblems } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('52 Firebase listener lifecycle browser evidence', () => {
  test('route changes clean abandoned listeners without runtime errors or amplification', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const account=ownerLikeCreds();requireCreds(account,'owner-like account');const problems=[];watchForProblems(page,problems);
    await login(page,account.email,account.password);await gotoTab(page,'today',{settleMs:1000});await gotoTab(page,'inventory',{settleMs:1000});await gotoTab(page,'today',{settleMs:1200});
    const diagnostics=await page.evaluate(()=>window.__chaosFirestoreDiagnostics || {});
    expect(diagnostics.lastRouteCleanup).toBeTruthy();
    expect(Number(diagnostics.activeListeners||0)).toBeLessThan(80);
    const active=Object.values(diagnostics.listeners||{}).filter(row=>Number(row.subscriberCount||0)>0&&!row.releasedAt);
    expect(active.filter(row=>Number(row.listenerCreationCount||0)>1).length).toBe(0);
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
  });
});
