# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-full-audit\05-schedule-builder-mutation.spec.cjs >> 05 Schedule Builder mutation and data-integrity checks >> Schedule Builder shows seeded employees without row-index corruption after navigation/refresh
- Location: tests\86chaos-full-audit\05-schedule-builder-mutation.spec.cjs:18:3

# Error details

```
Error: Schedule Builder table should remain visible after refresh

expect(locator).toBeVisible() failed

Locator: locator('.schedule-builder-desktop-table').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Schedule Builder table should remain visible after refresh with timeout 15000ms
  - waiting for locator('.schedule-builder-desktop-table').first()

```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const { ALLOW_MUTATION, mutationSkipMessage, readSeedReport, ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, collectTextNear } = require('./utils/audit-helpers.cjs');
  3  | 
  4  | test.describe('05 Schedule Builder mutation and data-integrity checks', () => {
  5  |   test('fake QA schedule seed has one-target-only data: no wrong-employee duplicate and exact IDs for deletion audits', async ({}, testInfo) => {
  6  |     if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
  7  |     const seed = readSeedReport();
  8  |     expect(seed?.ok, 'Seed report should exist and be successful before mutation schedule tests').toBe(true);
  9  |     const shifts = seed.profile.scheduleTruth.counted;
  10 |     const invalid = seed.profile.scheduleTruth.invalid;
  11 |     const duplicates = seed.profile.scheduleTruth.duplicate;
  12 |     const allenValid = shifts.filter(s => s.employeeName === 'Allen QA');
  13 |     await attachJson(testInfo, '05-seed-schedule-integrity.json', { allenValid, invalid, duplicates, createdCounts: seed.profile.createdCounts });
  14 |     expect(allenValid.reduce((sum, s) => sum + s.hours, 0), 'Raw valid Allen seeded hours before same-day merge should equal visible valid chips: 6+11+6+5 plus boundary weeks').toBeGreaterThanOrEqual(28);
  15 |     expect(invalid.some(s => s.employeeName === 'Allen QA' && s.reason === 'invalid-range'), 'Invalid Allen 10p-3p should be preserved for app to flag').toBe(true);
  16 |   });
  17 | 
  18 |   test('Schedule Builder shows seeded employees without row-index corruption after navigation/refresh', async ({ page }, testInfo) => {
  19 |     if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
  20 |     const seed = readSeedReport();
  21 |     expect(seed?.ok, 'Seed report should exist').toBe(true);
  22 |     const account = ownerLikeCreds();
  23 |     requireCreds(account, 'owner-like account');
  24 |     await login(page, account.email, account.password);
  25 |     await gotoTab(page, 'schedule', { settleMs: 2200 });
  26 |     const builderButtons = page.getByRole('button', { name: /schedule builder/i });
  27 |     if (await builderButtons.count().catch(() => 0)) await builderButtons.first().click().catch(() => {});
  28 |     await expect(page.locator('.schedule-builder-desktop-table').first(), 'Schedule Builder table should render before refresh').toBeVisible({ timeout: 15000 });
  29 |     await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  30 |     await page.waitForTimeout(2200);
  31 |     if (await builderButtons.count().catch(() => 0)) await builderButtons.first().click().catch(() => {});
  32 |     const table = page.locator('.schedule-builder-desktop-table').first();
> 33 |     await expect(table, 'Schedule Builder table should remain visible after refresh').toBeVisible({ timeout: 15000 });
     |                                                                                       ^ Error: Schedule Builder table should remain visible after refresh
  34 |     const staff = ['Allen QA', 'Chuck QA', 'Lani QA'];
  35 |     const diagnostics = {};
  36 |     const missing = [];
  37 |     const tableText = await table.innerText({ timeout: 5000 }).catch(() => '');
  38 |     for (const name of staff) {
  39 |       const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  40 |       const exactCell = table.getByRole('cell', { name: new RegExp(`^${escapedName}$`, 'i') });
  41 |       const rowMatch = table.getByRole('row', { name: new RegExp(`\\b${escapedName}\\b`, 'i') });
  42 |       const exactCellCount = await exactCell.count().catch(() => 0);
  43 |       const rowCount = await rowMatch.count().catch(() => 0);
  44 |       const visibleCells = [];
  45 |       for (let i = 0; i < Math.min(exactCellCount, 5); i += 1) {
  46 |         const cell = exactCell.nth(i);
  47 |         if (await cell.isVisible().catch(() => false)) visibleCells.push(await cell.innerText().catch(() => ''));
  48 |       }
  49 |       const rowVisible = rowCount > 0 ? await rowMatch.first().isVisible().catch(() => false) : false;
  50 |       diagnostics[name] = { exactCellCount, rowCount, visibleCellCount: visibleCells.length, rowVisible, visibleCells };
  51 |       if (!visibleCells.length && !rowVisible) missing.push(name);
  52 |     }
  53 |     await attachJson(testInfo, '05-schedule-builder-deterministic-table-visibility.json', {
  54 |       missing,
  55 |       diagnostics,
  56 |       currentUrl: page.url(),
  57 |       tableTextSample: tableText.slice(0, 6000),
  58 |       note: 'Assertions are scoped to .schedule-builder-desktop-table so hidden selector options cannot create false positives or false negatives.',
  59 |     });
  60 |     expect(missing, 'Seeded employees should remain visible inside the real Schedule Builder table after refresh').toEqual([]);
  61 |   });
  62 | 
  63 |   test('Schedule Builder does not count OFF/request-off/event chips as worked hours', async ({ page }, testInfo) => {
  64 |     if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
  65 |     const account = ownerLikeCreds();
  66 |     requireCreds(account, 'owner-like account');
  67 |     await login(page, account.email, account.password);
  68 |     const text = await gotoTab(page, 'schedule', { settleMs: 2200, maxText: 65000 });
  69 |     const badPatterns = [/QA Private Party[\s\S]{0,100}\bhrs?\b/i, /request off[\s\S]{0,120}\b\+?\d+(?:\.\d+)?\s*hrs?\b/i];
  70 |     const findings = badPatterns.filter(re => re.test(text)).map(re => String(re));
  71 |     await attachJson(testInfo, '05-non-shift-hour-findings.json', { findings, sample: text.slice(0, 8000) });
  72 |     expect(findings, 'Events/request-off chips should never be counted as worked shift hours').toEqual([]);
  73 |   });
  74 | });
  75 | 
```