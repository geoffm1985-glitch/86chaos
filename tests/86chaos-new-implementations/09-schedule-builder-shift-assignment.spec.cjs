'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.27 Schedule Builder shift assignment emergency repair', () => {
  test('manager can assign one future shift through Schedule Builder and remove the QA shift afterward', async ({ page }) => {
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
    let target = null;
    const count = Math.min(await cells.count(), 400);
    for (let i = 0; i < count; i += 1) {
      const cell = cells.nth(i);
      const date = await cell.getAttribute('data-date');
      if (!date || date < today) continue;
      if (await cell.locator('[data-chaos-workflow-id="schedule-delete-shift"]').count()) continue;
      if (await cell.locator('[title="Requested Off"], .schedule-builder-partial-off-chip').count()) continue;
      target = cell;
      break;
    }
    expect(target, 'QA Schedule Builder should expose at least one empty editable future cell').not.toBeNull();

    await target.click();
    await expect(assignButton).toBeEnabled({ timeout: 5000 });
    await assignButton.click();

    const createdShift = target.locator('[data-chaos-workflow-id="schedule-delete-shift"]');
    await expect(createdShift).toHaveCount(1, { timeout: 20000 });
    await expect(assignButton).toBeDisabled({ timeout: 5000 });

    await createdShift.click();
    await expect(createdShift).toHaveCount(0, { timeout: 20000 });
  });
});
