const { test, expect } = require('@playwright/test');

test.describe('86 Chaos app shell health', () => {
  test('loads without a blank screen or unexpected horizontal overflow', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(20);

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4);
    expect(hasOverflow).toBe(false);
    expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
  });
});
