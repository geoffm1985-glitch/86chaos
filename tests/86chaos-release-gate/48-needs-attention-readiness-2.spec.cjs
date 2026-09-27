const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, watchForProblems } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('48 shared needs-attention and readiness 2.0', () => {
  test('authenticated owner sees deterministic actionable attention on desktop and mobile projects', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);
    const account=ownerLikeCreds();requireCreds(account,'owner-like account');
    const problems=[];watchForProblems(page,problems);
    await login(page,account.email,account.password);
    await gotoTab(page,'today',{settleMs:1500});
    const shared=page.getByTestId('shared-needs-attention');
    await expect(shared).toBeVisible();
    await expect(shared).toContainText(/What needs attention today/i);
    const ids=await shared.locator('[data-attention-id]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-attention-id')));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    await expect(page.getByTestId('restaurant-readiness-command-center')).toContainText(/Inventory|Prep|Staffing/);
    // Inventory always produces either an actionable finding or an explicit
    // incomplete-data finding, so this proves the deterministic deep link
    // without depending on which severity happens to sort first today.
    await shared.locator('[data-attention-category="inventory"]').first().click();
    await expect.poll(()=>new URL(page.url()).searchParams.get('tab')).toBe('inventory');
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
    await testInfo.attach('48-attention-viewport.json',{body:JSON.stringify({project:testInfo.project.name,viewport:page.viewportSize(),ids},null,2),contentType:'application/json'});
  });
});
