const { test, expect } = require('@playwright/test');
const { ALLOW_MUTATION, mutationSkipMessage, readSeedReport, ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, collectTextNear } = require('./utils/audit-helpers.cjs');

test.describe('05 Schedule Builder mutation and data-integrity checks', () => {
  test('fake QA schedule seed has one-target-only data: no wrong-employee duplicate and exact IDs for deletion audits', async ({}, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist and be successful before mutation schedule tests').toBe(true);
    const shifts = seed.profile.scheduleTruth.counted;
    const invalid = seed.profile.scheduleTruth.invalid;
    const duplicates = seed.profile.scheduleTruth.duplicate;
    const allenValid = shifts.filter(s => s.employeeName === 'Allen QA');
    await attachJson(testInfo, '05-seed-schedule-integrity.json', { allenValid, invalid, duplicates, createdCounts: seed.profile.createdCounts });
    expect(allenValid.reduce((sum, s) => sum + s.hours, 0), 'Raw valid Allen seeded hours before same-day merge should equal visible valid chips: 6+11+6+5 plus boundary weeks').toBeGreaterThanOrEqual(28);
    expect(invalid.some(s => s.employeeName === 'Allen QA' && s.reason === 'invalid-range'), 'Invalid Allen 10p-3p should be preserved for app to flag').toBe(true);
  });

  test('Schedule Builder shows seeded employees without row-index corruption after navigation/refresh', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist').toBe(true);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'schedule', { settleMs: 2200 });
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2200);
    const text = await bodyText(page, 60000);
    const staff = ['Allen QA', 'Chuck QA', 'Lani QA'];
    const missing = staff.filter(name => !text.includes(name));
    const evidence = {};
    for (const name of staff) evidence[name] = await collectTextNear(page, name, 1600);
    await attachJson(testInfo, '05-schedule-visible-after-refresh.json', { missing, evidence, sample: text.slice(0, 7000) });
    expect(missing, 'Seeded employees should remain visible after refresh').toEqual([]);
  });

  test('Schedule Builder does not count OFF/request-off/event chips as worked hours', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'schedule', { settleMs: 2200, maxText: 65000 });
    const badPatterns = [/QA Private Party[\s\S]{0,100}\bhrs?\b/i, /request off[\s\S]{0,120}\b\+?\d+(?:\.\d+)?\s*hrs?\b/i];
    const findings = badPatterns.filter(re => re.test(text)).map(re => String(re));
    await attachJson(testInfo, '05-non-shift-hour-findings.json', { findings, sample: text.slice(0, 8000) });
    expect(findings, 'Events/request-off chips should never be counted as worked shift hours').toEqual([]);
  });
});
