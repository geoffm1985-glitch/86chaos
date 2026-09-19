const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS,
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  expectNoFatal,
  viewportAudit,
  attachJson,
  PERMISSION_GATE_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('cross-browser route, layout, and touch release gate', () => {
  test('core routes render without fatal errors or unintended page overflow', async ({ page }, testInfo) => {
    test.setTimeout(15 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const findings = [];
    const core = ROUTE_SPECS.filter(r => ['today', 'schedule', 'published', 'inventory', 'recipes', 'prep', 'messages', 'team', 'maintenance', 'settings', 'help'].includes(r.tab));
    for (const route of core) {
      const text = await gotoTab(page, route.tab, { settleMs: 900 });
      if (PERMISSION_GATE_RE.test(text)) continue;
      await expectNoFatal(page, `${route.tab} on ${testInfo.project.name}`);
      const layout = await viewportAudit(page);
      findings.push({ route: route.tab, layout });
    }
    const overflow = findings.filter(x => x.layout.horizontalOverflow && !['schedule'].includes(x.route));
    const tiny = findings.flatMap(x => x.layout.smallButtons.map(b => ({ route: x.route, ...b })));
    await attachJson(testInfo, `cross-browser-layout-${testInfo.project.name}.json`, { findings, overflow, tiny });
    expect(overflow, 'Normal app pages must not create global horizontal overflow').toEqual([]);
    expect(tiny, 'Visible buttons must meet release-gate touch target size').toEqual([]);
  });

  test('deep links survive refresh and browser back/forward navigation', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password, { tab: 'today' });
    await gotoTab(page, 'inventory', { settleMs: 900 });
    const inventoryUrl = page.url();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1300);
    await expectNoFatal(page, 'inventory deep-link refresh');
    expect(page.url()).toContain('tab=inventory');
    await gotoTab(page, 'recipes', { settleMs: 900 });
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(900);
    expect(page.url()).toBe(inventoryUrl);
    await page.goForward({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(900);
    expect(page.url()).toContain('tab=recipes');
  });
});
