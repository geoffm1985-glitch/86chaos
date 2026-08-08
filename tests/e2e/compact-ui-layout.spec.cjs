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
    await expect(page.getByRole('button', { name: /^Unlock System$/i })).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => page.evaluate(() => {
      const labels = [/^Unlock System$/i, /^Forgot Password or Username\?$/i, /^Privacy Policy & Terms of Service$/i];
      const measured = labels.map(pattern => {
        const button = Array.from(document.querySelectorAll('button')).find(node => pattern.test((node.textContent || '').trim()));
        if (!button) return { text: String(pattern), height: 0, width: 0, found: false, ready: false };
        const rect = button.getBoundingClientRect();
        return { text: (button.textContent || '').trim(), height: rect.height, width: rect.width, found: true, ready: rect.height >= 42 && rect.width >= 42 };
      });
      return measured.every(row => row.ready) ? 'stable' : JSON.stringify(measured);
    }), {
      timeout: 10000,
      intervals: [100, 200, 400, 800],
      message: 'Login shell tap targets should be measured only after final CSS/layout has settled at >=42px'
    }).toBe('stable');
    const tooSmall = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter(button => {
      const rect = button.getBoundingClientRect();
      const style = window.getComputedStyle(button);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && rect.height < 42;
    }).map(button => ({ text: button.textContent.trim().slice(0, 80), height: button.getBoundingClientRect().height })));
    expect(tooSmall).toEqual([]);
  });
});
