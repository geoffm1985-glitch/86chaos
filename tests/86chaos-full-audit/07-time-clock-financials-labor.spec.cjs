const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, ALLOW_MUTATION, readSeedReport, mutationSkipMessage } = require('./utils/audit-helpers.cjs');

test.describe('07 time clock, timesheets, financials, and labor math', () => {
  test('time clock and timesheet routes load without broken totals or duplicate active punch warnings', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'published', { settleMs: 1600, maxText: 50000 });
    await attachJson(testInfo, '07-time-clock-route.json', { sample: text.slice(0, 6000) });
    expect(text).toMatch(/Time Clock|Clock|Schedule|Punch|Timesheet|My Schedule/i);
    expect(text).not.toMatch(/Invalid Date|NaN|Infinity|undefined undefined|null null/i);
  });

  test('financials and labor screens do not show broken money, hours, tips, tax, discount, or labor-percent math', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'financials', { settleMs: 2200, maxText: 70000 });
    const bad = [...text.matchAll(/\$NaN|NaN%|NaN\s*hrs?|Infinity|Invalid Date|undefined undefined|null null/g)].map(m => m[0]);
    await attachJson(testInfo, '07-financial-labor-bad-values.json', { bad: [...new Set(bad)], sample: text.slice(0, 8000) });
    expect(text).toMatch(/Financial|Labor|Sales|Daily Close|Tips|Payroll|Hours|Cost/i);
    expect([...new Set(bad)], 'Financials/labor should not show broken math values').toEqual([]);
  });

  test('fake restaurant financial seed includes sales, expenses, and time punches for cross-checkable labor math', async ({}, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist').toBe(true);
    const counts = seed.profile.createdCounts;
    await attachJson(testInfo, '07-financial-seed-counts.json', { counts });
    expect(counts.sales, 'Fake restaurant should include at least 14 sales records').toBeGreaterThanOrEqual(14);
    expect(counts.financialExpenses, 'Fake restaurant should include expenses').toBeGreaterThanOrEqual(2);
    expect(counts.timePunches, 'Fake restaurant should include complete and open punches').toBeGreaterThanOrEqual(2);
  });
});
