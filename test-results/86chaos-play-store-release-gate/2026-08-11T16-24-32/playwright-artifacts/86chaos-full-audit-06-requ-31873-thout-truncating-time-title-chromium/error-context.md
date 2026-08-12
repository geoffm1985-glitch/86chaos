# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-full-audit\06-request-off-events-integration.spec.cjs >> 06 request-off, availability, and scheduled events integration >> event calendar and Schedule Builder both show scheduled events without truncating time/title
- Location: tests\86chaos-full-audit\06-request-off-events-integration.spec.cjs:5:3

# Error details

```
Error: Event Calendar route should render event/calendar UI

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | const { ownerLikeCreds, creds, requireCreds, login, gotoTab, bodyText, attachJson, watchForProblems, summarizeProblems, dismissBlockingDialogs, neutralizeTestingPreviewOverlays, ALLOW_MUTATION, readSeedReport, mutationSkipMessage, collectTextNear } = require('./utils/audit-helpers.cjs');
  3   | 
  4   | test.describe('06 request-off, availability, and scheduled events integration', () => {
  5   |   test('event calendar and Schedule Builder both show scheduled events without truncating time/title', async ({ page }, testInfo) => {
  6   |     const account = ownerLikeCreds();
  7   |     requireCreds(account, 'owner-like account');
  8   |     await login(page, account.email, account.password);
  9   |     const scheduleText = await gotoTab(page, 'schedule', { settleMs: 1800, maxText: 60000 });
  10  |     const eventsText = await gotoTab(page, 'events', { settleMs: 1800, maxText: 60000 });
  11  |     const scheduleHasEvent = /QA Private Party - Staff Up|Private Party|Fish Fry|event|staff up/i.test(scheduleText);
  12  |     const eventRouteHealthy = /Event|Calendar|Special Event|Private Party|Fish Fry/i.test(eventsText);
  13  |     await attachJson(testInfo, '06-events-visibility.json', { scheduleHasEvent, eventRouteHealthy, scheduleSample: scheduleText.slice(0, 5000), eventsSample: eventsText.slice(0, 5000) });
> 14  |     expect(eventRouteHealthy, 'Event Calendar route should render event/calendar UI').toBe(true);
      |                                                                                       ^ Error: Event Calendar route should render event/calendar UI
  15  |     if (ALLOW_MUTATION && readSeedReport()?.ok) expect(scheduleHasEvent, 'Seeded scheduled events should show in Schedule Builder').toBe(true);
  16  |   });
  17  | 
  18  |   test('partial request-off times remain readable on desktop and do not become Invalid Date', async ({ page }, testInfo) => {
  19  |     const account = ownerLikeCreds();
  20  |     requireCreds(account, 'owner-like account');
  21  |     await page.setViewportSize({ width: 1440, height: 950 });
  22  |     await login(page, account.email, account.password);
  23  |     const text = await gotoTab(page, 'schedule', { settleMs: 1600, maxText: 60000 });
  24  |     const allenNear = await collectTextNear(page, 'Allen QA', 1600);
  25  |     await attachJson(testInfo, '06-partial-request-off-readability.json', { allenNear, sample: text.slice(0, 7000) });
  26  |     expect(text, 'Schedule/request-off pages should never show Invalid Date').not.toMatch(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
  27  |     if (ALLOW_MUTATION && readSeedReport()?.ok) expect(text, 'Seeded partial request-off should show readable partial day/time text').toMatch(/12p|12:00|4p|4:00|partial|request/i);
  28  |   });
  29  | 
  30  |   test('approved and pending request-off records are present in seed data and should warn scheduling workflows', async ({}, testInfo) => {
  31  |     if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
  32  |     const seed = readSeedReport();
  33  |     expect(seed?.ok, 'Seed report should exist').toBe(true);
  34  |     const counts = seed.profile.createdCounts;
  35  |     await attachJson(testInfo, '06-request-off-seed-counts.json', { counts });
  36  |     expect(counts.timeOffRequests, 'Fake restaurant should include both partial and full-day request-off records').toBeGreaterThanOrEqual(2);
  37  |     expect(counts.events, 'Fake restaurant should include scheduled events and message/86 note').toBeGreaterThanOrEqual(3);
  38  |   });
  39  | 
  40  |   test('Ghost Mode Request Off as a legacy employee verifies conflict warning and cancellation workflow', async ({ page }, testInfo) => {
  41  |     if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
  42  |     const seed = readSeedReport();
  43  |     expect(seed?.ok, 'Seed report should exist before Ghost Mode Request Off browser verification').toBe(true);
  44  |     const account = creds('SYSTEM_ADMIN');
  45  |     requireCreds(account, 'System Administrator account');
  46  |     const problems = [];
  47  |     const apiResponses = [];
  48  |     watchForProblems(page, problems);
  49  |     page.on('response', async response => {
  50  |       if (!/\/api\/time-off-request/i.test(response.url())) return;
  51  |       const row = { url: response.url(), status: response.status(), ok: response.ok(), body: null };
  52  |       try { row.body = await response.json(); } catch (_) {}
  53  |       apiResponses.push(row);
  54  |     });
  55  | 
  56  |     async function attachState(name, extra = {}) {
  57  |       await attachJson(testInfo, name, {
  58  |         ...extra,
  59  |         url: page.url(),
  60  |         bodySample: (await bodyText(page, 70000)).slice(0, 12000),
  61  |         problems: summarizeProblems(problems),
  62  |         apiResponses,
  63  |       });
  64  |     }
  65  | 
  66  |     function isConflictResponseForDate(response, conflictDate) {
  67  |       let url;
  68  |       try { url = new URL(response.url()); } catch (_) { return false; }
  69  |       if (!/\/api\/time-off-request$/i.test(url.pathname)) return false;
  70  |       const request = response.request();
  71  |       if (request.method().toUpperCase() !== 'POST') return false;
  72  |       let body = null;
  73  |       try { body = request.postDataJSON(); } catch (_) { return false; }
  74  |       const dates = Array.isArray(body?.dates) ? body.dates.map(String) : [];
  75  |       const action = String(body?.action || '');
  76  |       return action === 'conflicts' && dates.includes(conflictDate);
  77  |     }
  78  |     async function openPeopleAndPossess(targetName) {
  79  |       await gotoTab(page, 'godmode', { settleMs: 1600, maxText: 60000 });
  80  |       await dismissBlockingDialogs(page);
  81  |       await neutralizeTestingPreviewOverlays(page, { reason: 'ghost-request-off-open-people' });
  82  |       const openPeople = page.locator('[data-testid="system-admin-open-people"]').or(page.getByRole('button', { name: /^Open People$/i })).first();
  83  |       if (!(await openPeople.isVisible({ timeout: 10000 }).catch(() => false))) {
  84  |         await attachState('06-ghost-request-off-people-open-missing.json', { visibleButtons: await page.getByRole('button').evaluateAll(btns => btns.slice(0, 80).map(btn => btn.innerText || btn.getAttribute('aria-label') || btn.textContent || '')).catch(() => []) });
  85  |       }
  86  |       await expect(openPeople, 'System Administrator People directory must be explicitly reachable before Ghost Mode possession').toBeVisible({ timeout: 12000 });
  87  |       await openPeople.click();
  88  |       await page.waitForTimeout(900);
  89  |       await dismissBlockingDialogs(page, { maxPasses: 4 });
  90  |       const peopleScope = page.locator('[data-testid="system-admin-people-directory"]').first();
  91  |       await expect(peopleScope, 'People Directory root should be visible before target search').toBeVisible({ timeout: 12000 });
  92  |       const search = peopleScope.locator('[data-testid="system-admin-people-search"]').or(peopleScope.getByRole('textbox', { name: /^Search People Directory$/i })).first();
  93  |       await expect(search, 'People directory search field should be scoped to the People area').toBeVisible({ timeout: 12000 });
  94  |       const expectedDocId = seed.ghostTargetUserId || seed.profile?.ghostTargetUserId || seed.ghostTargetDocumentId || seed.profile?.users?.find?.(u => u.idKey === 'allen')?.id || '';
  95  |       const expectedAuthUid = seed.ghostTargetAuthUid || seed.profile?.ghostTargetAuthUid || seed.ghostTargetAuth?.uid || seed.profile?.ghostTargetAuth?.uid || '';
  96  |       const expectedEmail = seed.ghostTargetEmail || seed.profile?.ghostTargetAuth?.email || seed.ghostTargetAuth?.email || '';
  97  |       const expectedRestaurantId = seed.profile?.restaurantId || seed.restaurantId || '';
  98  |       const expectedWorkspaceName = seed.profile?.restaurantName || seed.qaWorkspaceName || process.env.CHAOS_QA_WORKSPACE_NAME || '';
  99  |       await search.fill(expectedEmail || expectedAuthUid || targetName);
  100 |       await page.waitForTimeout(1200);
  101 |       const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
  102 |       const escapedTargetName = escapeRegex(targetName);
  103 |       const result = expectedDocId
  104 |         ? peopleScope.locator(`[data-testid="system-admin-person-${expectedDocId}"]`).first()
  105 |         : peopleScope.locator('[data-testid^="system-admin-person-"]').filter({ hasText: expectedEmail ? new RegExp(escapeRegex(expectedEmail), 'i') : new RegExp(escapedTargetName, 'i') }).first();
  106 |       await expect(result, `People directory should show the exact current-run Ghost target ${targetName}`).toBeVisible({ timeout: 15000 });
  107 |       const resultText = await result.innerText().catch(() => '');
  108 |       const attrs = await result.evaluate(el => ({
  109 |         userId: el.getAttribute('data-user-id') || '',
  110 |         authUid: el.getAttribute('data-auth-uid') || '',
  111 |         email: el.getAttribute('data-user-email') || '',
  112 |         workspaceId: el.getAttribute('data-workspace-id') || '',
  113 |         workspaceName: el.getAttribute('data-workspace-name') || '',
  114 |         text: el.innerText || ''
```