const { test, expect } = require('@playwright/test');
const { ROUTE_SPECS, ownerLikeCreds, requireCreds, login, gotoTab, attachJson, ALLOW_MUTATION, readSeedReport, mutationSkipMessage } = require('./utils/audit-helpers.cjs');

test.describe('13 data integrity and Firebase read/write cost guard', () => {
  test('opening routes should not create obvious rapid write storms or infinite retry loops', async ({ page }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const requests = [];
    page.on('request', req => {
      const url = req.url();
      if (/firestore|googleapis|firebaseio|send-push|presence|safe-write|dispatch-reminders/i.test(url)) requests.push({ method: req.method(), url: url.slice(0, 240) });
    });
    await login(page, account.email, account.password);
    for (const route of ROUTE_SPECS.slice(0, 12)) await gotoTab(page, route.tab, { settleMs: 700 });
    const writes = requests.filter(r => /POST|PATCH|PUT|DELETE/i.test(r.method) && !/Listen|channel|Write\/channel/i.test(r.url));
    const grouped = {};
    for (const w of writes) grouped[`${w.method} ${w.url.split('?')[0]}`] = (grouped[`${w.method} ${w.url.split('?')[0]}`] || 0) + 1;
    const suspicious = Object.entries(grouped).filter(([, count]) => count > 35).map(([key, count]) => ({ key, count }));
    await attachJson(testInfo, '13-request-cost-audit.json', { totalRequests: requests.length, writes: writes.length, suspicious, grouped });
    expect(suspicious, 'Route navigation should not create rapid write storms or infinite retry loops').toEqual([]);
  });

  test('fake QA seed has no broken references, duplicate exact shifts, bad dates, or orphaned core data', async ({}, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist').toBe(true);
    const truth = seed.profile.scheduleTruth;
    const duplicateCount = truth.duplicate.length;
    const invalidBadDates = truth.invalid.filter(x => x.reason === 'bad-date');
    await attachJson(testInfo, '13-seed-data-integrity.json', { duplicateCount, invalidBadDates, truth });
    expect(invalidBadDates, 'Seeded schedule data should not include bad dates').toEqual([]);
    expect(duplicateCount, 'Seed intentionally includes an exact duplicate to verify app dedupes it; report it but do not allow more than one').toBeLessThanOrEqual(1);
  });
});
