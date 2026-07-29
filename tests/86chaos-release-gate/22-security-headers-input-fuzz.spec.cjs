const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS,
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  attachJson,
  watchForProblems,
  summarizeProblems,
  bodyText,
  appUrl,
  PERMISSION_GATE_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const FUZZ = [
  `<img src=x onerror=window.__CHAOS_XSS__=1>`,
  `'; DROP TABLE restaurants; --`,
  `😀🍳 Café résumé 日本語 العربية`,
  'A'.repeat(10000),
];

test.describe('22 security headers, query abuse, and input robustness', () => {
  test('production shell exposes required browser security headers', async ({ request }, testInfo) => {
    const base = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL;
    const response = await request.get(base, { failOnStatusCode: false });
    const headers = response.headers();
    const checks = {
      contentSecurityPolicy: headers['content-security-policy'] || '',
      strictTransportSecurity: headers['strict-transport-security'] || '',
      contentTypeOptions: headers['x-content-type-options'] || '',
      frameOptions: headers['x-frame-options'] || '',
      referrerPolicy: headers['referrer-policy'] || '',
      permissionsPolicy: headers['permissions-policy'] || '',
    };
    await attachJson(testInfo, '22-security-headers.json', { status: response.status(), checks });
    expect(response.status()).toBeLessThan(500);
    expect(checks.contentSecurityPolicy).toBeTruthy();
    expect(checks.strictTransportSecurity).toMatch(/max-age=/i);
    expect(checks.contentTypeOptions).toMatch(/nosniff/i);
    expect(`${checks.frameOptions} ${checks.contentSecurityPolicy}`).toMatch(/deny|sameorigin|frame-ancestors/i);
    expect(checks.referrerPolicy).toBeTruthy();
    expect(checks.permissionsPolicy).toBeTruthy();
  });

  test('malicious route/query input never executes script or exposes a blank screen', async ({ page }, testInfo) => {
    await page.addInitScript(() => { window.__CHAOS_XSS__ = 0; });
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const payload = encodeURIComponent(`<img src=x onerror=window.__CHAOS_XSS__=1>`);
    await page.goto(`${appUrl('today')}&search=${payload}&focus=${payload}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const executed = await page.evaluate(() => window.__CHAOS_XSS__);
    const text = await bodyText(page, 10000);
    await attachJson(testInfo, '22-query-xss.json', { executed, sample: text.slice(0, 3000), url: page.url() });
    expect(executed).toBe(0);
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('visible non-password text fields tolerate Unicode, SQL-like text, XSS text, and long input without crashing before submit', async ({ page }, testInfo) => {
    test.setTimeout(20 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const problems = [];
    const problemWatch = watchForProblems(page, problems, { recordNonfatal4xx: true });
    await login(page, account.email, account.password);
    const results = [];

    for (const route of ROUTE_SPECS) {
      const text = await gotoTab(page, route.tab, { settleMs: 700 });
      if (PERMISSION_GATE_RE.test(text)) continue;
      const fields = page.locator('input:visible, textarea:visible');
      const count = Math.min(await fields.count().catch(() => 0), 12);
      for (let i = 0; i < count; i += 1) {
        const field = fields.nth(i);
        const type = (await field.getAttribute('type').catch(() => '')) || '';
        if (/password|file|date|time|number|checkbox|radio|hidden|email|tel/i.test(type)) continue;
        const readOnly = await field.isEditable().catch(() => false);
        if (!readOnly) continue;
        const label = await field.getAttribute('aria-label').catch(() => '') || await field.getAttribute('placeholder').catch(() => '') || `field-${i}`;
        for (const value of FUZZ) {
          await field.fill(value).catch(() => {});
          await page.waitForTimeout(80);
          const executed = await page.evaluate(() => window.__CHAOS_XSS__ || 0).catch(() => 0);
          results.push({ route: route.tab, label, valueKind: value.length > 1000 ? 'long' : value.slice(0, 30), executed });
          expect(executed, `Input ${label} on ${route.tab} must not execute HTML`).toBe(0);
        }
        await field.fill('').catch(() => {});
      }
    }

    await attachJson(testInfo, '22-input-fuzz.json', { results, problems: summarizeProblems(problems), nonfatal4xx: problemWatch.nonfatal4xx || [] });
    expect(problems, 'Typing hostile or unusual text must not crash the UI or generate unhandled 5xx responses').toEqual([]);
  });
});
