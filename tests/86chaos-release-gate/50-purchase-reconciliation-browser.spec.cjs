const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, watchForProblems } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('50 purchase receiving invoice reconciliation browser flow', () => {
  test('owner opens the real invoice review from reconciliation readiness', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const account=ownerLikeCreds();requireCreds(account,'owner-like account');
    const problems=[];watchForProblems(page,problems);
    await login(page,account.email,account.password);
    await gotoTab(page,'today',{settleMs:1500});
    const card=page.getByTestId('purchase-reconciliation-readiness');
    await expect(card).toContainText(/quantity, pack, price, substitution, backorder/i);
    await card.getByRole('button',{name:/Open invoice review/i}).click();
    await expect.poll(()=>new URL(page.url()).searchParams.get('tab')).toBe('inventory');
    await expect(page.locator('body')).toContainText(/Invoice|Receiving|Inventory/i);
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
  });
});
