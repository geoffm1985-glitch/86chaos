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

    function isConflictResponseForDate(response, conflictDate) {
      let url;
      try { url = new URL(response.url()); } catch (_) { return false; }
      if (!/\/api\/time-off-request$/i.test(url.pathname)) return false;
      const request = response.request();
      if (request.method().toUpperCase() !== 'POST') return false;
      let body = null;
      try { body = request.postDataJSON(); } catch (_) { return false; }
      const dates = Array.isArray(body?.dates) ? body.dates.map(String) : [];
      const action = String(body?.action || '');
      return action === 'conflicts' && dates.includes(conflictDate);
    }

    function isTimeOffResponseAction(response, expectedAction) {
      let url;
      try { url = new URL(response.url()); } catch (_) { return false; }
      if (!/\/api\/time-off-request$/i.test(url.pathname)) return false;
      const request = response.request();
      if (request.method().toUpperCase() !== 'POST') return false;
      try { return String(request.postDataJSON()?.action || '') === expectedAction; }
      catch (_) { return false; }
    }
    const confirmedConflictRowsByDate = new Map();

    async function openPeopleAndPossess(targetName) {
      await gotoTab(page, 'godmode', { settleMs: 1600, maxText: 60000 });
      await dismissBlockingDialogs(page);
      await neutralizeTestingPreviewOverlays(page, { reason: 'ghost-request-off-open-people' });
      const openPeople = page.locator('[data-testid="system-admin-open-people"]').or(page.getByRole('button', { name: /^Open People$/i })).first();
      if (!(await openPeople.isVisible({ timeout: 10000 }).catch(() => false))) {
        await attachState('06-ghost-request-off-people-open-missing.json', { visibleButtons: await page.getByRole('button').evaluateAll(btns => btns.slice(0, 80).map(btn => btn.innerText || btn.getAttribute('aria-label') || btn.textContent || '')).catch(() => []) });
      }
      await expect(openPeople, 'System Administrator People directory must be explicitly reachable before Ghost Mode possession').toBeVisible({ timeout: 12000 });
      await openPeople.click();
      await page.waitForTimeout(900);
      await dismissBlockingDialogs(page, { maxPasses: 4 });
      const peopleScope = page.locator('[data-testid="system-admin-people-directory"]').first();
      await expect(peopleScope, 'People Directory root should be visible before target search').toBeVisible({ timeout: 12000 });
      const search = peopleScope.locator('[data-testid="system-admin-people-search"]').or(peopleScope.getByRole('textbox', { name: /^Search People Directory$/i })).first();
      await expect(search, 'People directory search field should be scoped to the People area').toBeVisible({ timeout: 12000 });
      const expectedDocId = seed.ghostTargetUserId || seed.profile?.ghostTargetUserId || seed.ghostTargetDocumentId || seed.profile?.users?.find?.(u => u.idKey === 'allen')?.id || '';
      const expectedAuthUid = seed.ghostTargetAuthUid || seed.profile?.ghostTargetAuthUid || seed.ghostTargetAuth?.uid || seed.profile?.ghostTargetAuth?.uid || '';
      const expectedEmail = seed.ghostTargetEmail || seed.profile?.ghostTargetAuth?.email || seed.ghostTargetAuth?.email || '';
      const expectedRestaurantId = seed.profile?.restaurantId || seed.restaurantId || '';
      const expectedWorkspaceName = seed.profile?.restaurantName || seed.qaWorkspaceName || process.env.CHAOS_QA_WORKSPACE_NAME || '';
      await search.fill(expectedEmail || expectedAuthUid || targetName);
      await page.waitForTimeout(1200);
      const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
      const escapedTargetName = escapeRegex(targetName);
      const result = expectedDocId
        ? peopleScope.locator(`[data-testid="system-admin-person-${expectedDocId}"]`).first()
        : peopleScope.locator('[data-testid^="system-admin-person-"]').filter({ hasText: expectedEmail ? new RegExp(escapeRegex(expectedEmail), 'i') : new RegExp(escapedTargetName, 'i') }).first();
      await expect(result, `People directory should show the exact current-run Ghost target ${targetName}`).toBeVisible({ timeout: 15000 });
      const resultText = await result.innerText().catch(() => '');
      const attrs = await result.evaluate(el => ({
        userId: el.getAttribute('data-user-id') || '',
        authUid: el.getAttribute('data-auth-uid') || '',
        email: el.getAttribute('data-user-email') || '',
        workspaceId: el.getAttribute('data-workspace-id') || '',
        workspaceName: el.getAttribute('data-workspace-name') || '',
        text: el.innerText || ''
      })).catch(() => ({}));
      await attachState('06-ghost-request-off-target-candidate.json', { expectedDocId, expectedAuthUid, expectedEmail, expectedRestaurantId, expectedWorkspaceName, attrs, resultText });
      expect(resultText, 'Exact target row must be Allen QA, not another user').toMatch(/Allen QA/i);
      expect(resultText, 'Ghost target row must not be Alex or Unknown Location').not.toMatch(/Alex @ Unknown Location|Unknown Location/i);
      if (expectedDocId) expect(attrs.userId, 'Ghost target user document ID must match the current run seed').toBe(expectedDocId);
      if (expectedAuthUid) expect(attrs.authUid, 'Ghost target Auth UID must match the current run seed').toBe(expectedAuthUid);
      if (expectedEmail) expect(String(attrs.email || '').toLowerCase(), 'Ghost target email must match the current run seed').toBe(String(expectedEmail).toLowerCase());
      if (expectedRestaurantId) expect(attrs.workspaceId, 'Ghost target workspace must match current run restaurant').toBe(expectedRestaurantId);
      if (/2026-08-0[1-6]|15-57-57|Unknown Location|Alex/i.test(`${resultText} ${attrs.workspaceName || ''}`)) throw new Error('STALE QA GHOST TARGET SELECTED');
      const possess = expectedDocId
        ? result.locator(`[data-testid="system-admin-possess-${expectedDocId}"]`).first()
        : result.getByRole('button', { name: new RegExp(`Possess ${escapedTargetName}`, 'i') }).first();
      await expect(possess, `Possess control should be inside the ${targetName} row/card`).toBeVisible({ timeout: 12000 });
      await possess.click();
      await page.waitForTimeout(1800);
      await dismissBlockingDialogs(page);
      const ghostText = await bodyText(page, 40000);
      await attachState('06-ghost-request-off-after-possess.json', { targetName, ghostTextSample: ghostText.slice(0, 6000) });
      expect(ghostText, 'Ghost Mode must activate for the exact target before opening Request Off').toMatch(/Ghost Mode|Possessing|Allen QA/i);
      if (/Alex @ Unknown Location|Unknown Location|2026-08-04T15-57-57/i.test(ghostText)) throw new Error('STALE QA GHOST TARGET SELECTED');
    }
    async function openRequestOff() {
      await gotoTab(page, 'published', { settleMs: 1800, maxText: 70000 });
      const requestOffTab = page.getByRole('button', { name: /^Schedule Request Off$/i }).first();
      await expect(requestOffTab, 'Request Off tab should be reachable from Time Clock & Schedule').toBeVisible({ timeout: 15000 });
      const ghostListResponsePromise = page
        .waitForResponse(response => isTimeOffResponseAction(response, 'ghost-list'), { timeout: 15000 })
        .then(async response => ({ response, body: await response.json().catch(() => null) }))
        .catch(() => null);
      await requestOffTab.click();
      const ghostListResponse = await ghostListResponsePromise;
      expect(ghostListResponse?.response, 'Ghost Mode Request Off should load the possessed employee records before date interaction').toBeTruthy();
      expect(ghostListResponse.response.ok(), 'Ghost Mode Request Off ghost-list response should succeed before date interaction').toBe(true);
      expect(ghostListResponse.body?.action, 'Ghost Mode Request Off initialization response should be ghost-list').toBe('ghost-list');
      await dismissBlockingDialogs(page);
      await neutralizeTestingPreviewOverlays(page, { reason: 'ghost-request-off-before-date-select' });
      return ghostListResponse.body;
    }
    async function findRequestOffDateCell(conflictDate) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const targetYear = Number(conflictDate.slice(0, 4));
      const targetMonthIndex = Number(conflictDate.slice(5, 7)) - 1;
      const monthHeading = page.getByRole('heading', { name: /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/ }).first();
      await expect(monthHeading, 'Request Off calendar month heading should be visible').toBeVisible({ timeout: 15000 });
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const headingText = (await monthHeading.innerText()).trim();
        const match = headingText.match(/^([A-Za-z]+)\s+(\d{4})$/);
        const currentMonthIndex = match ? monthNames.indexOf(match[1]) : -1;
        const currentYear = match ? Number(match[2]) : NaN;
        if (currentYear === targetYear && currentMonthIndex === targetMonthIndex) break;
        expect(currentMonthIndex, `Request Off calendar heading should expose a recognized month: ${headingText}`).toBeGreaterThanOrEqual(0);
        const currentOrdinal = currentYear * 12 + currentMonthIndex;
        const targetOrdinal = targetYear * 12 + targetMonthIndex;
        const headerButtons = monthHeading.locator('..').getByRole('button');
        await expect(headerButtons, 'Request Off calendar should expose previous and next month controls').toHaveCount(2);
        const direction = targetOrdinal > currentOrdinal ? headerButtons.last() : headerButtons.first();
        await direction.click();
        await expect.poll(() => monthHeading.innerText(), { timeout: 3000, intervals: [50, 100, 200] }).not.toBe(headingText);
        if (attempt === 119) throw new Error(`Request Off calendar could not navigate to ${conflictDate.slice(0, 7)}`);
      }
      const day = String(Number(conflictDate.slice(-2)));
      const cell = page
        .locator(`xpath=//main//span[normalize-space(.)="${day}"]/ancestor::div[contains(concat(" ", normalize-space(@class), " "), " cursor-pointer ")][1]`)
        .first();
      await expect(cell, `Request Off conflict date cell for ${conflictDate} should be selectable`).toBeVisible({ timeout: 15000 });
      await cell.scrollIntoViewIfNeeded().catch(() => {});
      return cell;
    }

    async function clickConflictDate({ accept }) {
      const conflictDate = seed.ghostRequestOffConflictDate || seed.profile?.ghostRequestOffConflictDate || seed.profile?.dates?.tomorrow || '';
      expect(conflictDate, 'QA seed must expose ghostRequestOffConflictDate for deterministic Request Off conflict testing').toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const dialogPromise = page
        .waitForEvent('dialog', { timeout: 6000 })
        .then(async dialog => {
          const message = dialog.message();
          if (accept) await dialog.accept();
          else await dialog.dismiss();
          return { message, accepted: accept };
        })
        .catch(() => null);
      const hadConfirmedConflictRow = confirmedConflictRowsByDate.has(conflictDate);
      const conflictResponsePromise = page.waitForResponse(response => isConflictResponseForDate(response, conflictDate), { timeout: 8000 }).catch(() => null);
      const cell = await findRequestOffDateCell(conflictDate);
      await cell.click();
      const [conflictResponse, nativeDialog] = await Promise.all([conflictResponsePromise, dialogPromise]);
      let conflictBody = null;
      try { conflictBody = conflictResponse ? await conflictResponse.json() : null; } catch (_) {}
      const freshConflictRow = Array.isArray(conflictBody?.conflicts) ? conflictBody.conflicts.find(row => row.date === conflictDate) : null;
      if (freshConflictRow) confirmedConflictRowsByDate.set(conflictDate, freshConflictRow);
      const conflictRow = freshConflictRow || confirmedConflictRowsByDate.get(conflictDate) || null;
      await attachState('06-ghost-request-off-conflict-api.json', {
        conflictDate,
        usedCachedConflictRow: !freshConflictRow && !!conflictRow,
        hadConfirmedConflictRow,
        status: conflictResponse?.status?.() || 0,
        ok: conflictResponse?.ok?.() || false,
        returnedDate: conflictRow?.date || '',
        conflictCount: Number(conflictRow?.count || 0),
        names: Array.isArray(conflictRow?.names) ? conflictRow.names.slice(0, 8) : [],
        nativeDialog
      });
      if (!hadConfirmedConflictRow) {
        expect(conflictResponse, 'First seeded conflict-date selection should call the Request Off conflicts API').toBeTruthy();
        expect(conflictResponse.ok(), 'Request Off conflicts API should succeed before warning is evaluated').toBe(true);
      } else if (conflictResponse) {
        expect(conflictResponse.ok(), 'Request Off conflicts API should succeed when the app refreshes cached conflict data').toBe(true);
      }
      expect(conflictRow?.date, 'Conflict warning should be backed by the seeded conflict date from a fresh or cached conflict response').toBe(conflictDate);
      expect(Number(conflictRow?.count || 0), 'Seeded Sara Request Off should count as at least one other-employee conflict').toBeGreaterThanOrEqual(1);
      if (nativeDialog) return { conflictDate, dialogMessage: nativeDialog.message, accepted: accept, conflictRow };
      const modal = page.getByRole('dialog').filter({ hasText: /already been requested off|may not be available|availability/i }).first();
      await expect(modal, 'Conflict warning dialog should appear for seeded active Request Off conflict').toBeVisible({ timeout: 8000 });
      const message = await modal.innerText().catch(() => '');
      if (accept) await modal.getByRole('button', { name: /continue|yes|submit anyway/i }).first().click();
      else await modal.getByRole('button', { name: /cancel|no|go back/i }).first().click();
      await expect(modal).toBeHidden({ timeout: 8000 }).catch(() => {});
      return { conflictDate, dialogMessage: message, accepted: accept, conflictRow };
    }


    await login(page, account.email, account.password, { tab: 'godmode' });
    await dismissBlockingDialogs(page);
    await openPeopleAndPossess(seed.ghostTargetName || 'Allen QA');
    const conflictDate = seed.ghostRequestOffConflictDate || seed.profile?.ghostRequestOffConflictDate || seed.profile?.dates?.tomorrow || '';
    expect(conflictDate, 'QA seed must expose ghostRequestOffConflictDate for deterministic Request Off conflict testing').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ghostListBody = await openRequestOff();
    const ownConflictDateRequest = (Array.isArray(ghostListBody?.requests) ? ghostListBody.requests : []).find(row => {
      const status = String(row?.status || '').toLowerCase();
      return row?.date === conflictDate && ['pending', 'approved'].includes(status) && row?.archived !== true && row?.processed !== true;
    });
    expect(ownConflictDateRequest, 'QA fixture must leave the Ghost conflict date free of Allen QA active Request Off records').toBeFalsy();
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
    const conflictPrivacySurface = [
      cancelWarning.dialogMessage || '',
      JSON.stringify(cancelWarning.conflictRow || {})
    ].join('\n');
    expect(conflictPrivacySurface, 'Conflict warning and conflict response should not reveal private request reasons, emails, phone numbers, or full request documents').not.toMatch(/reason|@86chaos\.test|@example\.test|phone|full request document/i);

    const continueWarning = await clickConflictDate({ accept: true });
    await page.waitForTimeout(800);
    text = await bodyText(page, 70000);
    await attachState('06-ghost-request-off-warning-continue.json', { continueWarning });
    expect(continueWarning.dialogMessage, 'Conflict warning should appear again before continuing').toMatch(/already been requested off|available|conflict/i);

    const submit = page.getByRole('button', { name: /submit/i }).first();
    await expect(submit, 'Continuing through the warning should enable the exact Request Off submit action').toBeEnabled({ timeout: 15000 });
    const createResponsePromise = page
      .waitForResponse(response => isTimeOffResponseAction(response, 'ghost-create'), { timeout: 15000 })
      .then(async response => ({ response, body: await response.json().catch(() => null) }))
      .catch(() => null);
    await submit.click();
    const createResponse = await createResponsePromise;
    text = await bodyText(page, 70000);
    const createdRequestId = createResponse?.body?.requestIds?.[0] || '';
    await attachState('06-ghost-request-off-after-submit.json', { createResponse: createResponse?.body || null, createdRequestId });
    expect(createResponse?.response, 'Ghost Mode Request Off submission should have an authoritative ghost-create API response').toBeTruthy();
    expect(createResponse.response.ok(), 'Ghost Mode Request Off creation response should be successful').toBe(true);
    expect(createResponse.body?.ok, 'Ghost Mode Request Off creation response should be ok').toBe(true);
    expect(createResponse.body?.action, 'Ghost Mode Request Off creation response should be specifically ghost-create').toBe('ghost-create');
    expect(createdRequestId, 'Ghost Mode Request Off creation should return the created request ID').toBeTruthy();
    expect(text, 'Ghost Mode Request Off submit should not show the unavailable toast').not.toMatch(/Request Off unavailable|Request not submitted|We could not verify Request Off availability/i);
    expect(text, 'Ghost Mode Request Off submit should not produce raw permission errors').not.toMatch(/Missing or insufficient permissions/i);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);

    // A full browser reload intentionally resets in-memory Ghost Mode.
    // Re-enter possession of the exact current-run employee before verifying
    // that the created Request Off persisted server-side and can be canceled.
    await openPeopleAndPossess(seed.ghostTargetName || 'Allen QA');
    const refreshedGhostListBody = await openRequestOff();
    const createdRequestAfterRefresh = (Array.isArray(refreshedGhostListBody?.requests) ? refreshedGhostListBody.requests : [])
      .find(row => row?.id === createdRequestId);
    expect(createdRequestAfterRefresh, 'The exact Ghost Mode Request Off created before refresh must still exist after re-entering possession').toBeTruthy();
    expect(String(createdRequestAfterRefresh?.status || '').toLowerCase(), 'The exact refreshed Request Off must remain active before cancellation').toMatch(/pending|approved/);
    text = await bodyText(page, 70000);
    await attachState('06-ghost-request-off-after-refresh.json', { createdRequestId, refreshedRequest: createdRequestAfterRefresh || null });
    expect(text, 'Impersonated employee request should remain visible after refresh and re-possession').toMatch(/Allen QA|Request-Off Workflow|Pending|Approved|Submitted|Request Off/i);
    expect(text, 'Request Off page should remain free of raw permission errors after refresh').not.toMatch(/Missing or insufficient permissions|Request Off unavailable/i);

    const cancelButton = page.getByTestId(`request-off-cancel-${createdRequestId}`);
    await expect(cancelButton, 'Exact created Request Off entry should expose a cancellation control').toBeVisible({ timeout: 12000 });
    const cancelDialogPromise = page
      .waitForEvent('dialog', { timeout: 5000 })
      .then(async dialog => {
        const message = dialog.message();
        await dialog.accept();
        return message;
      })
      .catch(() => null);
    const cancelResponsePromise = page
      .waitForResponse(response => isTimeOffResponseAction(response, 'ghost-cancel'), { timeout: 15000 })
      .then(async response => ({ response, body: await response.json().catch(() => null) }))
      .catch(() => null);
    await cancelButton.click();
    const cancelDialogMessage = await cancelDialogPromise;
    if (!cancelDialogMessage) {
      const modal = page.getByRole('dialog').filter({ hasText: /cancel this request-off|cancel request/i }).first();
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await modal.getByRole('button', { name: /yes|confirm|cancel request|continue/i }).first().click();
      }
    }
    const cancelResponse = await cancelResponsePromise;
    await page.waitForTimeout(1200);
    await attachState('06-ghost-request-off-after-cancel.json', { createdRequestId, cancelDialogMessage, cancelResponse: cancelResponse?.body || null });
    expect(cancelResponse?.response, 'Ghost Mode Request Off cancellation should call the ghost-cancel API').toBeTruthy();
    expect(cancelResponse.response.ok(), 'Ghost Mode Request Off cancellation response should be successful').toBe(true);
    expect(cancelResponse.body?.ok, 'Ghost Mode Request Off cancellation response should be ok').toBe(true);
    expect(cancelResponse.body?.action, 'Ghost Mode Request Off cancellation response should be specifically ghost-cancel').toBe('ghost-cancel');
    expect(summarizeProblems(problems), 'Ghost Mode Request Off flow should not generate unhandled browser/runtime problems').toEqual([]);
  });

});
