const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS,
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  expectNoFatal,
  viewportAudit,
  bodyText,
  attachJson,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('27 Responsive readability matrix', () => {
  test('authenticated core routes stay inside the viewport with readable controls', async ({ page }, testInfo) => {
    test.setTimeout(15 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like');
    await login(page, account.email, account.password);

    const selectedRoutes = ROUTE_SPECS.filter(route => ['today', 'published', 'schedule', 'inventory', 'prep', 'recipes', 'messages', 'team', 'settings', 'help'].includes(route.tab));
    const evidence = [];
    for (const route of selectedRoutes) {
      const text = await gotoTab(page, route.tab, { settleMs: 500, timeout: 45_000 });
      await expectNoFatal(page, `${testInfo.project.name} ${route.label}`);
      const layout = await viewportAudit(page);
      const metrics = await page.evaluate(() => {
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const controls = Array.from(document.querySelectorAll('button,input,select,textarea,a[href]')).filter(visible).map(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            name: (element.getAttribute('aria-label') || element.innerText || element.getAttribute('placeholder') || element.getAttribute('title') || '').trim().slice(0, 90),
            tag: element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fontSize: Number.parseFloat(style.fontSize || '0'),
            clippedRight: rect.right > innerWidth + 3,
            clippedLeft: rect.left < -3,
          };
        });
        return { controls };
      });
      expect(layout.horizontalOverflow, `${route.label} should not create body-level horizontal overflow. Offenders: ${JSON.stringify(layout.offenders)}`).toBeFalsy();
      expect(metrics.controls.some(control => control.name), `${route.label} should expose named controls`).toBeTruthy();
      expect(metrics.controls.filter(control => control.clippedLeft || control.clippedRight), `${route.label} has clipped interactive controls`).toEqual([]);
      if (testInfo.project.name.includes('mobile')) {
        const zoomRisk = metrics.controls.filter(control => ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tag) && control.fontSize > 0 && control.fontSize < 16);
        expect(zoomRisk, `${route.label} has mobile input text smaller than 16px`).toEqual([]);
      }
      evidence.push({ route, bodySample: text.slice(0, 800), layout, metrics });
    }
    await attachJson(testInfo, 'responsive-route-matrix.json', { project: testInfo.project.name, evidence });
  });

  test('Schedule Builder times and numeric labels remain horizontal, complete, and readable', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like');
    await login(page, account.email, account.password);
    await gotoTab(page, 'schedule', { settleMs: 1000, timeout: 60_000 });
    await expectNoFatal(page, `${testInfo.project.name} Schedule Builder`);

    const evidence = await page.evaluate(() => {
      const timeRe = /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b/i;
      const numberRe = /(?:\$?\d+(?:\.\d+)?%?|\d+(?:\.\d+)?\s*(?:hrs?|hours?|shifts?))/i;
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const rows = [];
      for (const element of Array.from(document.querySelectorAll('span,div,p,button,td,th'))) {
        if (!visible(element)) continue;
        const text = (element.innerText || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 100 || (!timeRe.test(text) && !numberRe.test(text))) continue;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        rows.push({
          text,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontSize: Number.parseFloat(style.fontSize || '0'),
          writingMode: style.writingMode,
          wordBreak: style.wordBreak,
          overflow: style.overflow,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          clipped: element.scrollWidth > element.clientWidth + 2,
          verticalShape: rect.height > rect.width * 2.75 && text.length >= 4,
        });
        if (rows.length >= 180) break;
      }
      return rows;
    });
    expect(evidence.length, 'Schedule Builder should expose visible time or numeric labels').toBeGreaterThan(0);
    const vertical = evidence.filter(row => /vertical/i.test(row.writingMode || '') || row.verticalShape);
    const clipped = evidence.filter(row => row.clipped && /\d/.test(row.text));
    const unreadable = evidence.filter(row => row.fontSize > 0 && row.fontSize < 10);
    expect(vertical, `Time/number labels should not turn vertical: ${JSON.stringify(vertical.slice(0, 20))}`).toEqual([]);
    expect(clipped, `Time/number labels should not be clipped: ${JSON.stringify(clipped.slice(0, 20))}`).toEqual([]);
    expect(unreadable, `Time/number labels should remain readable: ${JSON.stringify(unreadable.slice(0, 20))}`).toEqual([]);
    const text = await bodyText(page, 30_000);
    expect(text).not.toMatch(/\b\d\s*\n\s*:\s*\n\s*\d/i);
    await attachJson(testInfo, 'schedule-time-number-readability.json', { project: testInfo.project.name, evidence, vertical, clipped, unreadable });
  });
});
