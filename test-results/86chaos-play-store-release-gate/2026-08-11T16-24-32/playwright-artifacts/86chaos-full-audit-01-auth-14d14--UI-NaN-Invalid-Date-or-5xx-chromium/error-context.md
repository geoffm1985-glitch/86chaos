# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-full-audit\01-auth-route-health.spec.cjs >> 01 auth and every-route health >> owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx
- Location: tests\86chaos-full-audit\01-auth-route-health.spec.cjs:5:3

# Error details

```
Error: Schedule Builder should show expected route content

expect(received).toMatch(expected)

Expected pattern: /Schedule Builder|Auto-Fill|Assign|Publish|Coverage|Schedule/i
Received string:  ""
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const { ROUTE_SPECS, ownerLikeCreds, requireCreds, watchForProblems, summarizeProblems, login, expectVersion, gotoTab, expectNoFatal, attachJson, bodyText, PERMISSION_GATE_RE } = require('./utils/audit-helpers.cjs');
  3  | 
  4  | test.describe('01 auth and every-route health', () => {
  5  |   test('owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx', async ({ page }, testInfo) => {
  6  |     test.setTimeout(10 * 60 * 1000);
  7  |     const account = ownerLikeCreds();
  8  |     requireCreds(account, 'owner-like account');
  9  |     const problems = [];
  10 |     watchForProblems(page, problems);
  11 |     const loginText = await login(page, account.email, account.password);
  12 |     await expectVersion(page);
  13 |     expect(loginText).not.toMatch(/Application error|Unhandled Runtime Error|Invalid Date|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
  14 |     const results = [];
  15 |     for (const route of ROUTE_SPECS) {
  16 |       const text = await gotoTab(page, route.tab, { settleMs: 1200 });
  17 |       const gated = PERMISSION_GATE_RE.test(text);
  18 |       const matched = route.expect.test(text);
  19 |       results.push({ tab: route.tab, label: route.label, matched, gated, sample: text.slice(0, 1200) });
  20 |       await expectNoFatal(page, `${route.label} route`);
> 21 |       if (!route.optional && !gated) expect(text, `${route.label} should show expected route content`).toMatch(route.expect);
     |                                                                                                        ^ Error: Schedule Builder should show expected route content
  22 |     }
  23 |     await attachJson(testInfo, '01-route-results.json', { account: account.label, results, problems: summarizeProblems(problems) });
  24 |     expect(problems, 'Routes should not generate browser page errors or HTTP 5xx').toEqual([]);
  25 |   });
  26 | 
  27 |   test('no route shows unresolved placeholders or app-breaking empty states', async ({ page }, testInfo) => {
  28 |     test.setTimeout(10 * 60 * 1000);
  29 |     const account = ownerLikeCreds();
  30 |     requireCreds(account, 'owner-like account');
  31 |     await login(page, account.email, account.password);
  32 |     const findings = [];
  33 |     for (const route of ROUTE_SPECS) {
  34 |       await gotoTab(page, route.tab);
  35 |       const text = await bodyText(page, 35000);
  36 |       const bad = [...text.matchAll(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|Inactive -\d+ days|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/g)].map(m => m[0]);
  37 |       if (bad.length) findings.push({ route: route.tab, bad: [...new Set(bad)], sample: text.slice(0, 2500) });
  38 |     }
  39 |     await attachJson(testInfo, '01-placeholder-findings.json', { findings });
  40 |     expect(findings, 'No visible route should show Invalid Date, NaN, null null, undefined undefined, or negative inactive days').toEqual([]);
  41 |   });
  42 | });
  43 | 
```