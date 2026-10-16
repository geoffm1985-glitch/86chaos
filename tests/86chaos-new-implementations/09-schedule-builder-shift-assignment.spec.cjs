'use strict';
const { test, expect } = require('../fixtures/emulator-navigation-test.cjs');
const { ownerLikeCreds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.27 Schedule Builder shift assignment emergency repair', () => {
  test('manager can assign one future shift through Schedule Builder and remove the QA shift afterward', async ({ page }) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner/admin-like');
    await login(page, account.email, account.password, { chooseWorkspace: true });
    await gotoTab(page, 'schedule', { fullReload: true });
    if (!await page.getByTestId('schedule-workspace').isVisible()) {
      await page.getByRole('button', { name: 'Schedule Builder', exact: true }).first().click();
    }
    await page.getByRole('button',{name:'Monthly & advanced tools',exact:true}).click();

    // Finish navigation's modal cleanup before installing the late-tour handler.
    // Otherwise its short close action can exhaust the handler's deadline.
    // The handler still protects every Schedule Builder grid action.
    await page.addLocatorHandler(page.getByRole('button', { name: "Skip and don't show again", exact: true }), async button => {
      await button.press('Enter', { timeout: 2500 });
      await expect(button).toBeHidden({ timeout: 2500 });
    });

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
      if (await cell.locator('[data-chaos-workflow-id="schedule-edit-shift"]').count()) continue;
      if (await cell.locator('[title="Requested Off"], .schedule-builder-partial-off-chip').count()) continue;
      target = cell;
      break;
    }
    expect(target, 'QA Schedule Builder should expose at least one empty editable future cell').not.toBeNull();

    await target.click();
    await expect(assignButton).toBeEnabled({ timeout: 5000 });
    await assignButton.click();

    const createdShift = target.locator('[data-chaos-workflow-id="schedule-edit-shift"]');
    await expect(createdShift).toHaveCount(1, { timeout: 20000 });
    await expect(assignButton).toBeDisabled({ timeout: 5000 });

    await createdShift.click();
    await expect(page.getByRole('dialog',{name:'Edit shift',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Delete shift',exact:true}).click();
    await page.getByTestId('schedule-confirm-preview').click();
    await expect(createdShift).toHaveCount(0, { timeout: 20000 });
  });
});
