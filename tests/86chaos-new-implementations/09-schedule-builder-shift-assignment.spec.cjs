'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.27 Schedule Builder shift assignment emergency repair', () => {
  test('manager can assign one future shift through Schedule Builder and remove the QA shift afterward', async ({ page }) => {
    test.setTimeout(180000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner/admin-like');
    await login(page, account.email, account.password, { chooseWorkspace: true });
    await gotoTab(page, 'schedule', { fullReload: true });

    const assignButton = page.getByTestId('schedule-builder-assign');
    const cells = page.locator('td[data-testid="schedule-builder-cell"]');
    await expect(assignButton).toBeVisible({ timeout: 20000 });
    await expect(cells.first()).toBeVisible({ timeout: 20000 });

    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') await dialog.accept('Release-gate availability override');
      else await dialog.accept();
    });

    const today = new Date().toISOString().slice(0, 10);
    const candidate = await cells.evaluateAll((nodes, minDate) => {
      const cell = nodes.find(el => {
        const date = el.getAttribute('data-date') || '';
        if (!date || date < minDate) return false;
        if (el.querySelector('[data-chaos-workflow-id="schedule-delete-shift"]')) return false;
        if (el.querySelector('[title="Requested Off"], .schedule-builder-partial-off-chip')) return false;
        return true;
      });
      return cell ? { date: cell.getAttribute('data-date'), employeeId: cell.getAttribute('data-employee-id') } : null;
    }, today);
    expect(candidate, 'QA Schedule Builder should expose at least one empty editable future cell').not.toBeNull();

    const target = page.locator(`td[data-testid="schedule-builder-cell"][data-date="${candidate.date}"][data-employee-id="${candidate.employeeId}"]`).first();
    await target.scrollIntoViewIfNeeded();
    await target.click({ timeout: 15000 });
    await expect(assignButton).toBeEnabled({ timeout: 5000 });
    await assignButton.scrollIntoViewIfNeeded();
    await assignButton.click();

    const createdShift = target.locator('[data-chaos-workflow-id="schedule-delete-shift"]');
    await expect(createdShift).toHaveCount(1, { timeout: 20000 });
    await expect(assignButton).toBeDisabled({ timeout: 5000 });

    await createdShift.click();
    await expect(createdShift).toHaveCount(0, { timeout: 20000 });
  });
});
