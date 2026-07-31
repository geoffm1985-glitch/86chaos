const { test, expect } = require('@playwright/test');
const {
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  expectNoFatal,
  attachJson,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('31 Performance, resource, and network sanity budgets', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'chromium-full', 'Performance budget runs on the primary Chromium desktop project.'));

  test('initial authenticated boot stays within generous release-safety budgets', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like');
    const responses = [];
    page.on('response', response => {
      const request = response.request();
      responses.push({ url: response.url().split('?')[0], status: response.status(), type: request.resourceType(), method: request.method() });
    });
    const startedAt = Date.now();
    await login(page, account.email, account.password);
    const elapsedMs = Date.now() - startedAt;
    await expectNoFatal(page, 'authenticated performance boot');
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      return {
        domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : 0,
        loadEventMs: nav ? nav.loadEventEnd : 0,
        transferBytes: resources.reduce((sum, row) => sum + Number(row.transferSize || 0), 0),
        encodedBytes: resources.reduce((sum, row) => sum + Number(row.encodedBodySize || 0), 0),
        resourceCount: resources.length,
        largestResources: resources.map(row => ({ name: row.name.split('?')[0], transferSize: row.transferSize || 0, duration: row.duration || 0, initiatorType: row.initiatorType })).sort((a, b) => b.transferSize - a.transferSize).slice(0, 20),
      };
    });
    expect(elapsedMs, 'Authenticated boot should complete within 45 seconds').toBeLessThan(45_000);
    expect(timing.resourceCount, 'Initial boot should not create an extreme request storm').toBeLessThan(350);
    expect(timing.transferBytes, 'Initial boot transfer should remain below an extreme 30 MB safety ceiling').toBeLessThan(30 * 1024 * 1024);
    expect(responses.filter(row => row.status >= 500), 'Initial boot should not receive 5xx responses').toEqual([]);
    await attachJson(testInfo, 'authenticated-boot-performance.json', { elapsedMs, timing, responses: responses.slice(0, 500) });
  });

  test('in-app route changes remain responsive and avoid full-document reloads', async ({ page }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like');
    await login(page, account.email, account.password);
    const routes = ['today', 'published', 'schedule', 'financials', 'inventory', 'prep', 'recipes', 'messages', 'team', 'settings', 'help'];
    let documentRequests = 0;
    page.on('request', request => { if (request.resourceType() === 'document') documentRequests += 1; });
    const rows = [];
    for (const route of routes) {
      const beforeDocuments = documentRequests;
      const startedAt = Date.now();
      await gotoTab(page, route, { settleMs: 300, timeout: 45_000 });
      const elapsedMs = Date.now() - startedAt;
      const newDocuments = documentRequests - beforeDocuments;
      rows.push({ route, elapsedMs, newDocuments });
      expect(elapsedMs, `${route} in-app navigation should settle within 12 seconds`).toBeLessThan(12_000);
      expect(newDocuments, `${route} should not require a new full document request`).toBe(0);
      await expectNoFatal(page, `${route} performance navigation`);
    }
    await attachJson(testInfo, 'route-navigation-performance.json', rows);
  });
});
