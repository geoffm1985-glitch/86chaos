const { test, expect } = require('@playwright/test');
const { ROUTE_SPECS, ownerLikeCreds, requireCreds, watchForProblems, summarizeProblems, login, expectVersion, gotoTab, expectNoFatal, attachJson, bodyText, PERMISSION_GATE_RE } = require('./utils/audit-helpers.cjs');

test.describe('01 auth and every-route health', () => {
  test('owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const problems = [];
    watchForProblems(page, problems);
    const loginText = await login(page, account.email, account.password);
    await expectVersion(page);
    expect(loginText).not.toMatch(/Application error|Unhandled Runtime Error|Invalid Date|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
    const results = [];
    for (const route of ROUTE_SPECS) {
      const text = await gotoTab(page, route.tab, { settleMs: 1200 });
      const gated = PERMISSION_GATE_RE.test(text);
      const matched = route.expect.test(text);
      results.push({ tab: route.tab, label: route.label, matched, gated, sample: text.slice(0, 1200) });
      await expectNoFatal(page, `${route.label} route`);
      if (!route.optional && !gated) expect(text, `${route.label} should show expected route content`).toMatch(route.expect);
    }
    await attachJson(testInfo, '01-route-results.json', { account: account.label, results, problems: summarizeProblems(problems) });
    expect(problems, 'Routes should not generate browser page errors or HTTP 5xx').toEqual([]);
  });

  test('no route shows unresolved placeholders or app-breaking empty states', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const findings = [];
    for (const route of ROUTE_SPECS) {
      await gotoTab(page, route.tab);
      const text = await bodyText(page, 35000);
      const bad = [...text.matchAll(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|Inactive -\d+ days|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/g)].map(m => m[0]);
      if (bad.length) findings.push({ route: route.tab, bad: [...new Set(bad)], sample: text.slice(0, 2500) });
    }
    await attachJson(testInfo, '01-placeholder-findings.json', { findings });
    expect(findings, 'No visible route should show Invalid Date, NaN, null null, undefined undefined, or negative inactive days').toEqual([]);
  });
});
