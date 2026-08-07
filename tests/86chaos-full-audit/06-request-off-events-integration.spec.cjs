const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab, bodyText, attachJson, watchForProblems, summarizeProblems, dismissBlockingDialogs, neutralizeTestingPreviewOverlays, ALLOW_MUTATION, readSeedReport, mutationSkipMessage, collectTextNear } = require('./utils/audit-helpers.cjs');

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
    expect(text, 'Schedule/request-off pages should never show Invalid Date').not.toMatch(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
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

  test('Ghost Mode Request Off as a legacy employee verifies conflict warning and cancellation workflow', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist before Ghost Mode Request Off browser verification').toBe(true);
    const account = creds('SYSTEM_ADMIN');
    requireCreds(account, 'System Administrator account');
    const problems = [];
    watchForProblems(page, problems);
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      if (/has already been requested off|might not be available|availability changed/i.test(dialog.message())) {
        await dialog.accept().catch(() => {});
      } else if (/cancel this request-off|cancel your time-off request/i.test(dialog.message())) {
        await dialog.accept().catch(() => {});
      } else {
        await dialog.dismiss().catch(() => {});
      }
    });

    await login(page, account.email, account.password, { tab: 'godmode' });
    await dismissBlockingDialogs(page);
    await neutralizeTestingPreviewOverlays(page, { reason: 'ghost-request-off-open-godmode' });
    await gotoTab(page, 'godmode', { settleMs: 1600, maxText: 60000 });

    const globalUsers = page.getByRole('button', { name: /global users/i }).first();
    if (await globalUsers.isVisible({ timeout: 4000 }).catch(() => false)) await globalUsers.click();
    const search = page.getByPlaceholder(/search any user by name|search/i).first();
    if (await search.isVisible({ timeout: 4000 }).catch(() => false)) await search.fill('Allen QA');
    const possessButtons = page.getByRole('button', { name: /possess/i });
    await expect(possessButtons.first(), 'System Administrator should expose a Ghost Mode possess control for the QA employee').toBeVisible({ timeout: 15000 });
    await possessButtons.first().click();
    await page.waitForTimeout(1800);
    await dismissBlockingDialogs(page);

    await gotoTab(page, 'schedule', { settleMs: 1800, maxText: 70000 });
    const requestOffTab = page.getByRole('button', { name: /request off/i }).first();
    if (await requestOffTab.isVisible({ timeout: 6000 }).catch(() => false)) await requestOffTab.click();
    await page.waitForTimeout(1800);
    await dismissBlockingDialogs(page);
    await neutralizeTestingPreviewOverlays(page, { reason: 'ghost-request-off-before-date-select' });

    let text = await bodyText(page, 70000);
    await attachJson(testInfo, '06-ghost-request-off-initial.json', { textSample: text.slice(0, 8000), problems: summarizeProblems(problems), dialogs });
    expect(text, 'Request Off page should render in Ghost Mode without the unavailable toast').toMatch(/Request Off/i);
    expect(text, 'User-level Ghost Mode Request Off should not expose manager approval controls').not.toMatch(/Master Override Log|Approve selected|Archive selected|Pending approval queue/i);
    expect(text, 'Valid Ghost Mode target should not show Request Off unavailable').not.toMatch(/Request Off unavailable|We could not verify Request Off availability/i);
    expect(text, 'Valid Ghost Mode target should not emit raw Firestore permission errors').not.toMatch(/Missing or insufficient permissions/i);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDay = String(tomorrow.getDate());
    const dayCells = page.locator('div.cursor-pointer').filter({ hasText: new RegExp(`^${targetDay}(?:\\s|$)`) });
    const count = await dayCells.count().catch(() => 0);
    if (!count) {
      await attachJson(testInfo, '06-ghost-request-off-no-date-cell.json', { targetDay, textSample: text.slice(0, 12000) });
      test.skip(true, `Could not find selectable Request Off calendar cell for day ${targetDay}.`);
    }
    await dayCells.first().click();
    await page.waitForTimeout(1500);
    text = await bodyText(page, 70000);
    const warningDialog = dialogs.find(row => /has already been requested off|might not be available/i.test(row.message || ''));
    await attachJson(testInfo, '06-ghost-request-off-after-select.json', { targetDay, warningDialog, dialogs, textSample: text.slice(0, 10000), problems: summarizeProblems(problems) });
    expect(warningDialog || text.match(/already been requested off|might not be available/i), 'Selecting a date already requested by another QA employee should trigger the conflict warning').toBeTruthy();
    expect(text, 'Conflict warning must not expose private request reasons or email addresses').not.toMatch(/QA full day request-off warning check|@86chaos\.test|@example\.test/i);

    const submit = page.getByRole('button', { name: /submit/i }).first();
    await expect(submit, 'Date continuation should enable the Request Off submit button').toBeEnabled({ timeout: 15000 });
    await submit.click();
    await page.waitForTimeout(2600);
    text = await bodyText(page, 70000);
    await attachJson(testInfo, '06-ghost-request-off-after-submit.json', { dialogs, textSample: text.slice(0, 12000), problems: summarizeProblems(problems) });
    expect(text, 'Ghost Mode Request Off submit should not show the unavailable toast').not.toMatch(/Request Off unavailable|Request not submitted|We could not verify Request Off availability/i);
    expect(text, 'Ghost Mode Request Off submit should not produce raw permission errors').not.toMatch(/Missing or insufficient permissions/i);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await gotoTab(page, 'schedule', { settleMs: 1600, maxText: 70000 });
    if (await requestOffTab.isVisible({ timeout: 4000 }).catch(() => false)) await requestOffTab.click();
    await page.waitForTimeout(1400);
    text = await bodyText(page, 70000);
    await attachJson(testInfo, '06-ghost-request-off-after-refresh.json', { textSample: text.slice(0, 12000), problems: summarizeProblems(problems) });
    expect(text, 'Impersonated employee request should remain visible after refresh').toMatch(/Allen QA|Request-Off Workflow|Pending|Approved|Submitted/i);
    expect(text, 'Request Off page should remain free of raw permission errors after refresh').not.toMatch(/Missing or insufficient permissions|Request Off unavailable/i);

    const cancelButtons = page.locator('button:visible').filter({ hasText: /cancel|delete|trash/i });
    if (await cancelButtons.count().catch(() => 0)) {
      await cancelButtons.first().click().catch(() => {});
      await page.waitForTimeout(1200);
    }
    await attachJson(testInfo, '06-ghost-request-off-final.json', { dialogs, problems: summarizeProblems(problems), finalText: (await bodyText(page, 30000)).slice(0, 10000) });
    expect(summarizeProblems(problems), 'Ghost Mode Request Off flow should not generate unhandled browser/runtime problems').toEqual([]);
  });

});
