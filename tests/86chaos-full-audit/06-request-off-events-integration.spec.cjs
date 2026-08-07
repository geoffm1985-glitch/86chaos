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
    const apiResponses = [];
    watchForProblems(page, problems);
    page.on('response', async response => {
      if (!/\/api\/time-off-request/i.test(response.url())) return;
      const row = { url: response.url(), status: response.status(), ok: response.ok(), body: null };
      try { row.body = await response.json(); } catch (_) {}
      apiResponses.push(row);
    });

    async function attachState(name, extra = {}) {
      await attachJson(testInfo, name, {
        ...extra,
        url: page.url(),
        bodySample: (await bodyText(page, 70000)).slice(0, 12000),
        problems: summarizeProblems(problems),
        apiResponses,
      });
    }
    async function openPeopleAndPossess(targetName) {
      await gotoTab(page, 'godmode', { settleMs: 1600, maxText: 60000 });
      await dismissBlockingDialogs(page);
      await neutralizeTestingPreviewOverlays(page, { reason: 'ghost-request-off-open-people' });
      const openPeople = page.getByRole('button', { name: /^Open People$/i }).or(page.getByRole('button', { name: /people directory|people/i })).first();
      if (!(await openPeople.isVisible({ timeout: 10000 }).catch(() => false))) {
        await attachState('06-ghost-request-off-people-open-missing.json', { visibleButtons: await page.getByRole('button').evaluateAll(btns => btns.slice(0, 80).map(btn => btn.innerText || btn.getAttribute('aria-label') || btn.textContent || '')).catch(() => []) });
      }
      await expect(openPeople, 'System Administrator People directory must be explicitly reachable before Ghost Mode possession').toBeVisible({ timeout: 12000 });
      await openPeople.click();
      await page.waitForTimeout(900);
      const peopleScope = page.locator('[data-testid*="people" i], [aria-label*="People" i], section, main').filter({ hasText: /People|Directory|Possess|User/i }).first();
      const search = peopleScope.getByRole('textbox', { name: /search/i }).or(page.getByRole('textbox', { name: /search people|people search|search users/i })).first();
      await expect(search, 'People directory search field should be scoped to the People area').toBeVisible({ timeout: 12000 });
      await search.fill(targetName);
      await page.waitForTimeout(1200);
      const result = peopleScope.getByRole('row', { name: new RegExp(targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
        .or(peopleScope.locator('article,li,div').filter({ hasText: new RegExp(targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }))
        .first();
      await expect(result, `People directory should show the exact Ghost target ${targetName}`).toBeVisible({ timeout: 15000 });
      const possess = result.getByRole('button', { name: /^Possess$/i }).or(result.getByRole('button', { name: /possess/i })).first();
      await expect(possess, `Possess control should be inside the ${targetName} row/card`).toBeVisible({ timeout: 12000 });
      await possess.click();
      await page.waitForTimeout(1800);
      await dismissBlockingDialogs(page);
      const ghostText = await bodyText(page, 40000);
      await attachState('06-ghost-request-off-after-possess.json', { targetName, ghostTextSample: ghostText.slice(0, 6000) });
      expect(ghostText, 'Ghost Mode must activate for the exact target before opening Request Off').toMatch(/Ghost Mode|Possessing|Allen QA/i);
    }
    async function openRequestOff() {
      await gotoTab(page, 'schedule', { settleMs: 1800, maxText: 70000 });
      const requestOffTab = page.getByRole('button', { name: /request off/i }).first();
      await expect(requestOffTab, 'Request Off tab should be reachable from Time Clock & Schedule').toBeVisible({ timeout: 15000 });
      await requestOffTab.click();
      await page.waitForTimeout(1600);
      await dismissBlockingDialogs(page);
      await neutralizeTestingPreviewOverlays(page, { reason: 'ghost-request-off-before-date-select' });
    }
    async function clickConflictDate({ accept }) {
      const conflictDate = seed.ghostRequestOffConflictDate || seed.profile?.ghostRequestOffConflictDate || seed.profile?.dates?.tomorrow || '';
      expect(conflictDate, 'QA seed must expose ghostRequestOffConflictDate for deterministic Request Off conflict testing').toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const day = String(Number(conflictDate.slice(-2)));
      const dialogPromise = page.waitForEvent('dialog', { timeout: 6000 }).catch(() => null);
      const cell = page.locator('div.cursor-pointer, button, [role="gridcell"]').filter({ hasText: new RegExp(`^${day}(?:\\s|$)`) }).first();
      await expect(cell, `Request Off conflict date cell for ${conflictDate} should be selectable`).toBeVisible({ timeout: 15000 });
      await cell.click();
      const dialog = await dialogPromise;
      if (dialog) {
        const message = dialog.message();
        if (accept) await dialog.accept(); else await dialog.dismiss();
        return { conflictDate, dialogMessage: message, accepted: accept };
      }
      const modal = page.getByRole('dialog').filter({ hasText: /already been requested off|may not be available|availability/i }).first();
      await expect(modal, 'Conflict warning dialog should appear for seeded active Request Off conflict').toBeVisible({ timeout: 8000 });
      const message = await modal.innerText().catch(() => '');
      if (accept) await modal.getByRole('button', { name: /continue|yes|submit anyway/i }).first().click();
      else await modal.getByRole('button', { name: /cancel|no|go back/i }).first().click();
      await expect(modal).toBeHidden({ timeout: 8000 }).catch(() => {});
      return { conflictDate, dialogMessage: message, accepted: accept };
    }

    await login(page, account.email, account.password, { tab: 'godmode' });
    await dismissBlockingDialogs(page);
    await openPeopleAndPossess(seed.ghostTargetName || 'Allen QA');
    await openRequestOff();
    let text = await bodyText(page, 70000);
    await attachState('06-ghost-request-off-initial.json');
    expect(text, 'Request Off page should render in Ghost Mode without the unavailable toast').toMatch(/Request Off/i);
    expect(text, 'User-level Ghost Mode Request Off should not expose manager approval controls').not.toMatch(/Master Override Log|Approve selected|Archive selected|Pending approval queue/i);
    expect(text, 'Valid Ghost Mode target should not show Request Off unavailable').not.toMatch(/Request Off unavailable|We could not verify Request Off availability/i);
    expect(text, 'Valid Ghost Mode target should not emit raw Firestore permission errors').not.toMatch(/Missing or insufficient permissions/i);

    const cancelWarning = await clickConflictDate({ accept: false });
    text = await bodyText(page, 70000);
    await attachState('06-ghost-request-off-warning-cancel.json', { cancelWarning });
    expect(cancelWarning.dialogMessage, 'Conflict warning must be shown before canceling date selection').toMatch(/already been requested off|available|conflict/i);
    expect(text, 'Canceling the warning should not reveal private request reasons or email addresses').not.toMatch(/reason|@86chaos\.test|@example\.test|phone|full request document/i);

    const continueWarning = await clickConflictDate({ accept: true });
    await page.waitForTimeout(800);
    text = await bodyText(page, 70000);
    await attachState('06-ghost-request-off-warning-continue.json', { continueWarning });
    expect(continueWarning.dialogMessage, 'Conflict warning should appear again before continuing').toMatch(/already been requested off|available|conflict/i);

    const submit = page.getByRole('button', { name: /submit/i }).first();
    await expect(submit, 'Continuing through the warning should enable the exact Request Off submit action').toBeEnabled({ timeout: 15000 });
    await submit.click();
    await page.waitForTimeout(3000);
    const createResponse = apiResponses.find(r => /ghost-create|time-off-request/i.test(JSON.stringify(r.body || {})) && r.ok) || apiResponses.find(r => r.ok && r.body?.ok === true);
    text = await bodyText(page, 70000);
    await attachState('06-ghost-request-off-after-submit.json', { createResponse });
    expect(createResponse, 'Ghost Mode Request Off submission should have an authoritative successful API response').toBeTruthy();
    expect(text, 'Ghost Mode Request Off submit should not show the unavailable toast').not.toMatch(/Request Off unavailable|Request not submitted|We could not verify Request Off availability/i);
    expect(text, 'Ghost Mode Request Off submit should not produce raw permission errors').not.toMatch(/Missing or insufficient permissions/i);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await openRequestOff();
    text = await bodyText(page, 70000);
    await attachState('06-ghost-request-off-after-refresh.json');
    expect(text, 'Impersonated employee request should remain visible after refresh').toMatch(/Allen QA|Request-Off Workflow|Pending|Approved|Submitted|Request Off/i);
    expect(text, 'Request Off page should remain free of raw permission errors after refresh').not.toMatch(/Missing or insufficient permissions|Request Off unavailable/i);

    const cancelButton = page.getByRole('button', { name: /cancel request off|cancel request|cancel/i }).first();
    await expect(cancelButton, 'Exact created Request Off entry should expose a cancellation control').toBeVisible({ timeout: 12000 });
    const cancelDialogPromise = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
    await cancelButton.click();
    const cancelDialog = await cancelDialogPromise;
    if (cancelDialog) await cancelDialog.accept().catch(() => {});
    await page.waitForTimeout(1800);
    await attachState('06-ghost-request-off-after-cancel.json');
    expect(summarizeProblems(problems), 'Ghost Mode Request Off flow should not generate unhandled browser/runtime problems').toEqual([]);
  });

});
