const { test, expect } = require('@playwright/test');
const { durationForShift, buildAuditScheduleFixture, expectedHoursFor, summarizeSchedule } = require('./utils/math-oracle.cjs');
const { attachJson, ownerLikeCreds, requireCreds, login, gotoTab, collectTextNear, readSeedReport, bodyText } = require('./utils/audit-helpers.cjs');


async function waitForScheduleSeedLabels(page, required = [], timeoutMs = 60000) {
  const labels = (Array.isArray(required) ? required : []).filter(Boolean);
  let sample = '';
  let missing = [...labels];
  await expect.poll(async () => {
    sample = await bodyText(page, 70000);
    missing = labels.filter(label => !sample.includes(label));
    return missing;
  }, {
    message: 'Schedule Builder should expose current-run seeded labels',
    timeout: timeoutMs,
    intervals: [100, 250, 500, 1000],
  }).toEqual([]).catch(() => {});
  return { ok: missing.length === 0, missing, sample };
}

function addUtcDays(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function showScheduleBuilderMonth(page, dateKey) {
  const targetMonth = String(dateKey || '').slice(0, 7);
  expect(targetMonth, 'Schedule seed date should identify a deterministic month').toMatch(/^\d{4}-\d{2}$/);
  const targetLabel = new Date(`${targetMonth}-01T12:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dateStrip = page.locator('.desktop-date-strip').first();
  const monthHeading = dateStrip.getByRole('heading').first();
  await expect(monthHeading, 'Schedule Builder date heading should remain discoverable').toBeVisible({ timeout: 15000 });
  if ((await monthHeading.innerText()).trim() !== targetLabel) {
    await monthHeading.click();
    const dateDialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /^Select Date$/i }) }).first();
    const monthInput = dateDialog.locator('input[type="month"]').first();
    await expect(monthInput, `Schedule Builder month control should be visible after opening Select Date for ${targetMonth}`).toBeVisible({ timeout: 15000 });
    await monthInput.fill(targetMonth);
    await expect(dateDialog).toBeHidden({ timeout: 5000 });
  }
  await expect(monthHeading).toHaveText(targetLabel, { timeout: 15000 });
  await expect(page.locator('.schedule-builder-desktop-table').first(), `Schedule Builder table should render for ${targetMonth}`).toBeVisible({ timeout: 15000 });
}

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
    test.setTimeout(4 * 60 * 1000);
    const seed = readSeedReport();
    if (!seed?.ok) test.skip(true, 'No successful fake restaurant seed report found. Run with -Mutation and a QA workspace to activate this UI truth check.');
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'schedule', { fullReload: true, settleMs: 0, maxText: 60000 });
    const required = seed.profile.expectations.mustAppearInScheduleBuilder || [];
    const eventDate = seed.ghostRequestOffConflictDate
      ? addUtcDays(seed.ghostRequestOffConflictDate, -1)
      : seed.profile?.scheduleTruth?.counted?.[0]?.date;
    const invalidDate = seed.profile?.scheduleTruth?.invalid?.find(row => row.startTime === '10p' && row.endTime === '3p')?.date
      || seed.profile?.scheduleTruth?.invalid?.[0]?.date;

    await showScheduleBuilderMonth(page, eventDate);
    let readiness = await waitForScheduleSeedLabels(page, required, 60000);
    if (!readiness.ok) {
      await attachJson(testInfo, '04-schedule-ui-seed-visibility-initial-miss.json', {
        required,
        missing: readiness.missing,
        eventDate,
        bodySample: readiness.sample.slice(0, 6000),
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await gotoTab(page, 'schedule', { force: true, settleMs: 0, timeout: 15000, maxText: 60000 });
      await showScheduleBuilderMonth(page, eventDate);
      readiness = await waitForScheduleSeedLabels(page, required, 60000);
    }
    const eventMonthText = readiness.sample || await bodyText(page, 70000);
    const missing = readiness.missing || required.filter(label => !eventMonthText.includes(label));
    expect(missing, 'Schedule Builder should hydrate current-run QA staff/events before seed visibility assertions run').toEqual([]);

    await showScheduleBuilderMonth(page, invalidDate);
    await expect(page.getByText(/INVALID TIME|Invalid time|CHECK TIME RANGE|Check time range/i).first(), 'Invalid seeded 10p-3p shift should be visibly flagged, not silently repaired').toBeVisible({ timeout: 60000 });
    const invalidMonthText = await bodyText(page, 70000);
    const text = `${eventMonthText}\n${invalidMonthText}`;
    const allenNear = await collectTextNear(page, 'Allen QA', 2000);
    await attachJson(testInfo, '04-schedule-ui-seed-visibility.json', { required, missing, eventDate, invalidDate, allenNear, eventMonthSample: eventMonthText.slice(0, 6000), invalidMonthSample: invalidMonthText.slice(0, 6000), seedScheduleTruth: seed.profile.scheduleTruth });
    expect(missing, 'Seeded QA staff/events should be visible in Schedule Builder').toEqual([]);
    expect(text, 'Invalid seeded 10p-3p shift should be visibly flagged, not silently repaired').toMatch(/INVALID TIME|Invalid time|CHECK TIME RANGE|Check time range/i);
    expect(invalidMonthText, 'Invalid shift warning should preserve the original seeded 10p-3p evidence').toMatch(/INVALID TIME[\s\S]{0,80}10p\s*[-–]\s*3p/i);
    const joined = allenNear.join('\n---\n');
    expect(joined, 'Allen QA vicinity should include a 28 hour truth marker or enough evidence for tracker audit').toMatch(/\b28(?:\.0)?\b|3p\s*[-–]\s*9p|10a\s*[-–]\s*9p/i);
    expect(await bodyText(page, 60000), 'Schedule page should not display 52 or 35 as Allen QA total when seeded truth is 28').not.toMatch(/Allen QA[\s\S]{0,800}\b(?:52|35)(?:\.0)?\b/i);
  });
});
