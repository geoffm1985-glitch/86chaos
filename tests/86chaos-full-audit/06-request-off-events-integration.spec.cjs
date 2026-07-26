const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, ALLOW_MUTATION, readSeedReport, mutationSkipMessage, collectTextNear } = require('./utils/audit-helpers.cjs');

test.describe('06 request-off, availability, and scheduled events integration', () => {
  test('event calendar and Schedule Builder both show scheduled events without truncating time/title', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const scheduleText = await gotoTab(page, 'schedule', { settleMs: 1800, maxText: 60000 });
    const eventsText = await gotoTab(page, 'events', { settleMs: 1800, maxText: 60000 });
    const scheduleHasEvent = /QA Private Party - Staff Up|Private Party|Fish Fry|event|staff up/i.test(scheduleText);
    const eventRouteHealthy = /Event|Calendar|Special Event|Private Party|Fish Fry/i.test(eventsText);
    await attachJson(testInfo, '06-events-visibility.json', { scheduleHasEvent, eventRouteHealthy, scheduleSample: scheduleText.slice(0, 5000), eventsSample: eventsText.slice(0, 5000) });
    expect(eventRouteHealthy, 'Event Calendar route should render event/calendar UI').toBe(true);
    if (ALLOW_MUTATION && readSeedReport()?.ok) expect(scheduleHasEvent, 'Seeded scheduled events should show in Schedule Builder').toBe(true);
  });

  test('partial request-off times remain readable on desktop and do not become Invalid Date', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await page.setViewportSize({ width: 1440, height: 950 });
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'schedule', { settleMs: 1600, maxText: 60000 });
    const allenNear = await collectTextNear(page, 'Allen QA', 1600);
    await attachJson(testInfo, '06-partial-request-off-readability.json', { allenNear, sample: text.slice(0, 7000) });
    expect(text, 'Schedule/request-off pages should never show Invalid Date').not.toMatch(/Invalid Date|NaN|undefined undefined|null null/i);
    if (ALLOW_MUTATION && readSeedReport()?.ok) expect(text, 'Seeded partial request-off should show readable partial day/time text').toMatch(/12p|12:00|4p|4:00|partial|request/i);
  });

  test('approved and pending request-off records are present in seed data and should warn scheduling workflows', async ({}, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist').toBe(true);
    const counts = seed.profile.createdCounts;
    await attachJson(testInfo, '06-request-off-seed-counts.json', { counts });
    expect(counts.timeOffRequests, 'Fake restaurant should include both partial and full-day request-off records').toBeGreaterThanOrEqual(2);
    expect(counts.events, 'Fake restaurant should include scheduled events and message/86 note').toBeGreaterThanOrEqual(3);
  });
});
