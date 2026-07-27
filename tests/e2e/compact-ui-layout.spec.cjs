const { test, expect } = require('@playwright/test');

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 }
];

test.describe('compact professional UI containment', () => {
  for (const viewport of viewports) {
    test(`does not create body-level horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const overflow = await page.evaluate(() => ({
        htmlScrollWidth: document.documentElement.scrollWidth,
        htmlClientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth
      }));
      expect(overflow.htmlScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.htmlClientWidth + 1);
      expect(overflow.bodyScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.bodyClientWidth + 1);
    });
  }

  test('keeps mobile tap targets usable on the login shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const tooSmall = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter(button => {
      const rect = button.getBoundingClientRect();
      const style = window.getComputedStyle(button);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && rect.height < 42;
    }).map(button => ({ text: button.textContent.trim().slice(0, 80), height: button.getBoundingClientRect().height })));
    expect(tooSmall).toEqual([]);
  });
});
