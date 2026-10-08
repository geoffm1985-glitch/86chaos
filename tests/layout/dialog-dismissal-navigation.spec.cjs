'use strict';
const { test, expect } = require('@playwright/test');
const { dismissBlockingDialogs } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('safe dialog dismissal verifies closure without waiting for a pending navigation', async ({ page }) => {
  let dialogClosed = false;
  await page.exposeFunction('recordDialogClosed', closed => { dialogClosed = closed; });
  await page.route('http://dialog-fixture.test/pending', async route => {
    // Keep navigation pending longer than the close click's 2.5-second budget.
    await new Promise(resolve => setTimeout(resolve, 4000));
    await route.fulfill({ contentType: 'text/html', body: '<body>Navigation complete</body>' });
  });
  await page.route('http://dialog-fixture.test/', route => route.fulfill({
    contentType: 'text/html',
    body: `<div role="dialog" aria-label="Manager Quick Start" class="chaos-modal-backdrop">
      <button aria-label="Close Manager Quick Start" onclick="this.parentElement.remove(); recordDialogClosed(!document.querySelector('[role=dialog]')); location.href='/pending'">Close</button>
    </div>`
  }));
  await page.goto('http://dialog-fixture.test/');
  const result = await dismissBlockingDialogs(page, { maxPasses: 1 });
  expect(result.ok).toBe(true);
  expect(result.dismissed).toEqual([{ title: 'Manager Quick Start', control: 'Close Manager Quick Start' }]);
  // Record real DOM removal before navigation replaces the fixture document.
  expect(dialogClosed).toBe(true);
  await expect(page).toHaveURL('http://dialog-fixture.test/pending');
});

test('a safe click that leaves the dialog visible still fails dismissal', async ({ page }) => {
  await page.setContent(`<div role="dialog" aria-label="Manager Quick Start" class="chaos-modal-backdrop">
    <button aria-label="Close Manager Quick Start">Close</button>
  </div>`);
  const result = await dismissBlockingDialogs(page, { maxPasses: 1 });
  expect(result.ok).toBe(false);
  expect(result.remainingDialogs).toHaveLength(1);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('dialog dismissal never clicks a destructive confirmation', async ({ page }) => {
  await page.setContent(`<div role="dialog" aria-label="Delete schedule" class="chaos-modal-backdrop">
    <button onclick="window.destructiveClicked=true">Delete</button>
  </div>`);
  const result = await dismissBlockingDialogs(page, { maxPasses: 1 });
  expect(result.ok).toBe(false);
  expect(await page.evaluate(() => Boolean(window.destructiveClicked))).toBe(false);
});
