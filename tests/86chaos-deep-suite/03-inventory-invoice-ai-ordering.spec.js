// 86 Chaos Inventory + Invoice + AI Ordering Deep Test
// Exercises Smart Kitchen flows. It may create test drafts/logs on testing URLs.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  assertNoUnavailablePage,
  expectAnyText,
  clickButtonIfPresent,
  fillFirstVisible,
  saveCurrentForm,
  closeBlockingModals,
  hardStopIfProduction,
  attachReport,
} = require('./utils/chaos-helpers');

test.describe('86 Chaos Inventory + Invoice + AI Ordering Deep Test', () => {
  test.beforeAll(async () => { await hardStopIfProduction(); });

  test('inventory tabs, invoice scan shell, AI order draft controls, burn log, and menu intelligence', async ({ page }, testInfo) => {
    test.setTimeout(360000);
    const problems = [];
    const report = { runId: RUN_ID, visited: [], actions: [], fields: [] };
    watchForProblems(page, problems, { acceptDialogs: true });

    const account = ownerLikeCreds();
    await login(page, account.email, account.password);

    await gotoTab(page, 'inventory');
    await assertNoUnavailablePage(page, problems, 'Inventory root');
    await expectAnyText(page, [/Inventory|AI Order|Invoices|Burn Log|Vendors|Manage|Count|Order/i], problems, 'Inventory root text');

    const inventoryButtons = [/count/i, /order/i, /AI Order/i, /manage/i, /vendors/i, /Invoices/i, /Burn Log/i];
    for (const button of inventoryButtons) {
      await clickButtonIfPresent(page, button, report.visited, `Inventory > ${button}`).catch((error) => {
        problems.push({ type: 'inventory-button-failed', button: String(button), message: error.message, url: page.url() });
      });
      await assertNoUnavailablePage(page, problems, `Inventory > ${button}`);
      await closeBlockingModals(page);
    }

    // AI order checks: Use Suggested Qty should not double-add if visible.
    await clickButtonIfPresent(page, /AI Order/i, report.visited, 'Inventory > AI Order').catch(() => {});
    const useQty = page.locator('main').getByRole('button', { name: /Use Suggested Qty|Use Qty|Suggested/i }).first();
    if (await useQty.isVisible({ timeout: 3000 }).catch(() => false)) {
      await useQty.click({ timeout: 7000 });
      await page.waitForTimeout(700);
      const labelAfterOne = await useQty.innerText().catch(() => '');
      await useQty.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(500);
      const body = await bodyText(page);
      report.actions.push({ action: 'use-suggested-qty-clicked', labelAfterOne, textStart: body.slice(0, 800) });
      if (!/Applied|Undo|Remove|Draft|Selected|Suggested/i.test(body)) {
        problems.push({ type: 'ai-order-apply-feedback-missing', bodyStart: body.slice(0, 900), url: page.url() });
      }
    } else {
      report.actions.push({ action: 'use-suggested-qty-not-visible', reason: 'No suggestions in current data' });
    }

    // Burn Log write attempt with record-only or harmless qty if visible.
    await clickButtonIfPresent(page, /Burn Log/i, report.visited, 'Inventory > Burn Log').catch(() => {});
    const body = await bodyText(page);
    if (/Log Waste|Deduct Stock|Burn/i.test(body)) {
      const select = page.locator('main select').first();
      if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
        const options = await select.locator('option').allTextContents().catch(() => []);
        const candidate = options.find((x) => !/Select Item/i.test(x) && x.trim().length > 2);
        if (candidate) await select.selectOption({ label: candidate }).catch(() => {});
      }
      await fillFirstVisible(page, [/qty|quantity|amount/i, /number/i], '1', report.fields, 'Burn Log qty').catch(() => {});
      if (/Record only/i.test(body)) {
        await page.locator('main select').filter({ hasText: /Record only/i }).first().selectOption({ label: /Record only/i }).catch(() => {});
      }
      await saveCurrentForm(page, report.actions, 'Burn Log record-only/write test').catch((error) => {
        report.actions.push({ action: 'burn-log-save-failed', error: error.message });
      });
    }

    // Menu intelligence should render impact/dependency language.
    await gotoTab(page, 'menu-intelligence');
    await assertNoUnavailablePage(page, problems, 'Menu Intelligence');
    await expectAnyText(page, [/Menu|Dependency|Ingredient|Unavailable|Impact|86|Recipe/i], problems, 'Menu Intelligence text');

    await testInfo.attach('inventory-invoice-ai-ordering-report.json', { body: JSON.stringify({ report, problems }, null, 2), contentType: 'application/json' });
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
