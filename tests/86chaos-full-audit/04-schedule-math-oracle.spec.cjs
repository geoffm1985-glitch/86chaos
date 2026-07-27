const { test, expect } = require('@playwright/test');
const { durationForShift, buildAuditScheduleFixture, expectedHoursFor, summarizeSchedule } = require('./utils/math-oracle.cjs');
const { hasFeature, attachJson, ownerLikeCreds, requireCreds, login, gotoTab, collectTextNear, readSeedReport, bodyText } = require('./utils/audit-helpers.cjs');

test.skip(!hasFeature('schedule'), 'Feature schedule is not present in this app version.');
test.describe('04 schedule hours math truth oracle', () => {
  test('independent shift duration oracle catches valid, overnight, invalid, duplicate, and overlap cases', async ({}, testInfo) => {
    const cases = [
      ['3p', '9p', 6, true], ['4p', '9p', 5, true], ['10a', '4p', 6, true], ['10a', '9p', 11, true], ['9a', '3p', 6, true], ['2p', '10p', 8, true], ['11a', '2p', 3, true], ['11a', '9p', 10, true],
      ['10p', '3a', 5, true], ['11p', '2a', 3, true], ['8p', '1a', 5, true], ['12a', '8a', 8, true], ['12p', '8p', 8, true],
      ['10p', '3p', 0, false], ['9p', '4p', 0, false], ['4p', '10a', 0, false], ['abc', '9p', 0, false], ['', '9p', 0, false], ['10a', '', 0, false], ['9p', '9p', 0, false],
    ];
    const results = cases.map(([start, end, expectedHours, shouldBeValid]) => {
      const result = durationForShift(start, end);
      return { start, end, expectedHours, shouldBeValid, actualValid: result.ok, actualHours: result.hours, reason: result.reason };
    });
    await attachJson(testInfo, '04-duration-cases.json', { results });
    for (const row of results) {
      expect(row.actualValid, `${row.start}-${row.end} validity`).toBe(row.shouldBeValid);
      if (row.shouldBeValid) expect(row.actualHours, `${row.start}-${row.end} hours`).toBe(row.expectedHours);
    }
  });

  test('Allen-style weekly totals equal visible valid chips and ignore invalid 10p-3p', async ({}, testInfo) => {
    const fixture = buildAuditScheduleFixture(new Date());
    const summary = fixture.expected;
    const allenHours = expectedHoursFor(summary, 'Allen QA', fixture.currentWeekStart);
    const chuckHours = expectedHoursFor(summary, 'Chuck QA', fixture.currentWeekStart);
    const laniHours = expectedHoursFor(summary, 'Lani QA', fixture.currentWeekStart);
    await attachJson(testInfo, '04-schedule-fixture-truth.json', { fixture, allenHours, chuckHours, laniHours });
    expect(allenHours, 'Allen QA current week must be 28: 6 + 11 + 6 + invalid 0 + 5').toBe(28);
    expect(chuckHours, 'Chuck QA duplicate plus overlap must count 14: duplicate 6 once + merged 8').toBe(14);
    expect(laniHours, 'Lani QA 10p-3a must count as 5').toBe(5);
    expect(summary.invalid.some(x => x.employeeName === 'Allen QA' && x.startTime === '10p' && x.endTime === '3p'), 'Allen invalid 10p-3p should be flagged').toBe(true);
  });

  test('if fake restaurant seed exists, visible Schedule Builder text must expose seeded staff/events and not hide invalid-time evidence', async ({ page }, testInfo) => {
    const seed = readSeedReport();
    if (!seed?.ok) test.skip(true, 'No successful fake restaurant seed report found. Run with -Mutation and a QA workspace to activate this UI truth check.');
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'schedule', { settleMs: 2500, maxText: 60000 });
    const required = seed.profile.expectations.mustAppearInScheduleBuilder || [];
    const missing = required.filter(label => !text.includes(label));
    const allenNear = await collectTextNear(page, 'Allen QA', 2000);
    await attachJson(testInfo, '04-schedule-ui-seed-visibility.json', { required, missing, allenNear, bodySample: text.slice(0, 6000), seedScheduleTruth: seed.profile.scheduleTruth });
    expect(missing, 'Seeded QA staff/events should be visible in Schedule Builder').toEqual([]);
    expect(text, 'Invalid seeded 10p-3p shift should be visibly flagged, not silently repaired').toMatch(/INVALID TIME|Invalid time|CHECK TIME RANGE|Check time range/i);
    const joined = allenNear.join('\n---\n');
    expect(joined, 'Allen QA vicinity should include a 28 hour truth marker or enough evidence for tracker audit').toMatch(/\b28(?:\.0)?\b|3p\s*[-–]\s*9p|10a\s*[-–]\s*9p/i);
    expect(await bodyText(page, 60000), 'Schedule page should not display 52 or 35 as Allen QA total when seeded truth is 28').not.toMatch(/Allen QA[\s\S]{0,800}\b(?:52|35)(?:\.0)?\b/i);
  });
});
