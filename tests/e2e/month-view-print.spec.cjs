const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, dismissBlockingDialogs } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

async function installPrintRecorder(context) {
  await context.addInitScript(() => {
    const realOpen = window.open;
    window.open = function patchedOpen(...args) {
      const popup = realOpen.apply(window, args);
      if (!popup) return popup;
      try {
        popup.__chaosPrintCalled = false;
        popup.print = function recordPrint() { popup.__chaosPrintCalled = true; };
      } catch (_) {}
      return popup;
    };
  });
}

async function openPublishedMonthView(page) {
  const account = ownerLikeCreds();
  requireCreds(account, 'manager/owner account');
  await login(page, account.email, account.password);
  await gotoTab(page, 'published', { settleMs: 1400, maxText: 60000 });
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);
  const monthButton = page.getByRole('button', { name: /Month View/i }).first();
  await expect(monthButton, 'Month View subtab should be available').toBeVisible({ timeout: 15000 });
  await monthButton.click();
}

async function setMonth(page, monthKey, monthLabel) {
  const body = page.locator('body');
  const monthHeading = page.locator('h2').filter({ hasText: /[A-Z][a-z]+\s+20\d{2}/ }).first();
  await expect(monthHeading, 'The app date header should open the real month selector').toBeVisible({ timeout: 15000 });
  await monthHeading.click();
  const monthInput = page.locator('input[type="month"]').first();
  await expect(monthInput, 'Month selector should use the real app date/month input').toBeVisible({ timeout: 10000 });
  await monthInput.evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, monthKey);
  await expect(body, `Month View should show ${monthLabel}`).toContainText(new RegExp(monthLabel.replace(/\s+/g, '\\s+'), 'i'), { timeout: 15000 });
}

async function printAndCapture(page) {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /Print Calendar/i }).click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.locator('#schedule-month-print-root')).toBeVisible({ timeout: 10000 });
  return popup;
}

async function expectPrintedMonth(popup, monthKey, monthLabel, days) {
  await expect(popup.locator(`#schedule-month-print-root[data-calendar-month="${monthKey}"]`)).toHaveCount(1);
  await expect(popup.locator('body')).toContainText(monthLabel);
  await expect(popup.locator('.day-cell')).toHaveCount(days);
  await expect(popup.locator('.day-cell[data-day-number="1"]')).toHaveCount(1);
  await expect(popup.locator(`.day-cell[data-day-number="${days}"]`)).toHaveCount(1);
}

test.describe('Month View Print', () => {
  test('Month View Print Calendar prints the currently selected month', async ({ page, context }) => {
    await installPrintRecorder(context);
    await openPublishedMonthView(page);

    await setMonth(page, '2026-07', 'July 2026');
    await expect(page.locator('body')).toContainText(/July\s+2026/i, { timeout: 15000 });
    const julyPrint = await printAndCapture(page);
    await expectPrintedMonth(julyPrint, '2026-07', 'July 2026', 31);
    await julyPrint.close();

    await setMonth(page, '2026-08', 'August 2026');
    await expect(page.locator('body')).toContainText(/August\s+2026/i, { timeout: 15000 });
    const augustPrint = await printAndCapture(page);
    await expectPrintedMonth(augustPrint, '2026-08', 'August 2026', 31);
    await expect(augustPrint.locator('body')).not.toContainText(/July\s+2026/i);
    await augustPrint.close();
  });
});
