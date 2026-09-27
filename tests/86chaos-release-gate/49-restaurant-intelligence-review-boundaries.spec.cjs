const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, watchForProblems } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('49 restaurant intelligence review boundaries', () => {
  test('Smart Prep graph reconciliation and history render as review-only features', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const account=ownerLikeCreds();requireCreds(account,'owner-like account');
    const problems=[];watchForProblems(page,problems);
    await login(page,account.email,account.password);
    await gotoTab(page,'today',{settleMs:1500});
    await expect(page.getByTestId('restaurant-intelligence-v17-0-39')).toBeVisible();
    await expect(page.getByTestId('smart-prep-production')).toContainText(/Review Only|Not enough data|Predicted zero|Review \d+/i);
    await expect(page.getByTestId('smart-prep-production')).toContainText(/No automatic ordering/i);
    await expect(page.getByTestId('connected-restaurant-graph')).toContainText(/Menu → recipe → inventory → vendor cost/i);
    await expect(page.getByTestId('purchase-reconciliation-readiness')).toContainText(/Never pays bills/i);
    await expect(page.getByTestId('operational-history-intelligence')).toContainText(/180-day bounded, tenant-filtered/i);
    await page.getByTestId('connected-restaurant-graph').getByRole('button',{name:/Review missing relationships/i}).click();
    await expect.poll(()=>new URL(page.url()).searchParams.get('tab')).toBe('menu-intelligence');
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
  });
});
