# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-full-audit\06-request-off-events-integration.spec.cjs >> 06 request-off, availability, and scheduled events integration >> Ghost Mode Request Off as a legacy employee verifies conflict warning and cancellation workflow
- Location: tests\86chaos-full-audit\06-request-off-events-integration.spec.cjs:40:3

# Error details

```
Error: Request Off page should render in Ghost Mode without the unavailable toast

expect(received).toMatch(expected)

Expected pattern: /Request Off/i
Received string:  ""
```

# Test source

```ts
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
  115 |       })).catch(() => ({}));
  116 |       await attachState('06-ghost-request-off-target-candidate.json', { expectedDocId, expectedAuthUid, expectedEmail, expectedRestaurantId, expectedWorkspaceName, attrs, resultText });
  117 |       expect(resultText, 'Exact target row must be Allen QA, not another user').toMatch(/Allen QA/i);
  118 |       expect(resultText, 'Ghost target row must not be Alex or Unknown Location').not.toMatch(/Alex @ Unknown Location|Unknown Location/i);
  119 |       if (expectedDocId) expect(attrs.userId, 'Ghost target user document ID must match the current run seed').toBe(expectedDocId);
  120 |       if (expectedAuthUid) expect(attrs.authUid, 'Ghost target Auth UID must match the current run seed').toBe(expectedAuthUid);
  121 |       if (expectedEmail) expect(String(attrs.email || '').toLowerCase(), 'Ghost target email must match the current run seed').toBe(String(expectedEmail).toLowerCase());
  122 |       if (expectedRestaurantId) expect(attrs.workspaceId, 'Ghost target workspace must match current run restaurant').toBe(expectedRestaurantId);
  123 |       if (/2026-08-0[1-6]|15-57-57|Unknown Location|Alex/i.test(`${resultText} ${attrs.workspaceName || ''}`)) throw new Error('STALE QA GHOST TARGET SELECTED');
  124 |       const possess = expectedDocId
  125 |         ? result.locator(`[data-testid="system-admin-possess-${expectedDocId}"]`).first()
  126 |         : result.getByRole('button', { name: new RegExp(`Possess ${escapedTargetName}`, 'i') }).first();
  127 |       await expect(possess, `Possess control should be inside the ${targetName} row/card`).toBeVisible({ timeout: 12000 });
  128 |       await possess.click();
  129 |       await page.waitForTimeout(1800);
  130 |       await dismissBlockingDialogs(page);
  131 |       const ghostText = await bodyText(page, 40000);
  132 |       await attachState('06-ghost-request-off-after-possess.json', { targetName, ghostTextSample: ghostText.slice(0, 6000) });
  133 |       expect(ghostText, 'Ghost Mode must activate for the exact target before opening Request Off').toMatch(/Ghost Mode|Possessing|Allen QA/i);
  134 |       if (/Alex @ Unknown Location|Unknown Location|2026-08-04T15-57-57/i.test(ghostText)) throw new Error('STALE QA GHOST TARGET SELECTED');
  135 |     }
  136 |     async function openRequestOff() {
  137 |       await gotoTab(page, 'published', { settleMs: 1800, maxText: 70000 });
  138 |       const requestOffTab = page.getByRole('button', { name: /^Schedule Request Off$/i }).first();
  139 |       await expect(requestOffTab, 'Request Off tab should be reachable from Time Clock & Schedule').toBeVisible({ timeout: 15000 });
  140 |       await requestOffTab.click();
  141 |       await page.waitForTimeout(1600);
  142 |       await dismissBlockingDialogs(page);
  143 |       await neutralizeTestingPreviewOverlays(page, { reason: 'ghost-request-off-before-date-select' });
  144 |     }
  145 |     async function clickConflictDate({ accept }) {
  146 |       const conflictDate = seed.ghostRequestOffConflictDate || seed.profile?.ghostRequestOffConflictDate || seed.profile?.dates?.tomorrow || '';
  147 |       expect(conflictDate, 'QA seed must expose ghostRequestOffConflictDate for deterministic Request Off conflict testing').toMatch(/^\d{4}-\d{2}-\d{2}$/);
  148 |       const day = String(Number(conflictDate.slice(-2)));
  149 |       const dialogPromise = page.waitForEvent('dialog', { timeout: 6000 }).catch(() => null);
  150 |       const conflictResponsePromise = page.waitForResponse(response => isConflictResponseForDate(response, conflictDate), { timeout: 8000 }).catch(() => null);
  151 |       const cell = page.locator('div.cursor-pointer, button, [role="gridcell"]').filter({ hasText: new RegExp(`^${day}(?:\\s|$)`) }).first();
  152 |       await expect(cell, `Request Off conflict date cell for ${conflictDate} should be selectable`).toBeVisible({ timeout: 15000 });
  153 |       await cell.click();
  154 |       const conflictResponse = await conflictResponsePromise;
  155 |       let conflictBody = null;
  156 |       try { conflictBody = conflictResponse ? await conflictResponse.json() : null; } catch (_) {}
  157 |       const conflictRow = Array.isArray(conflictBody?.conflicts) ? conflictBody.conflicts.find(row => row.date === conflictDate) : null;
  158 |       await attachState('06-ghost-request-off-conflict-api.json', {
  159 |         conflictDate,
  160 |         status: conflictResponse?.status?.() || 0,
  161 |         ok: conflictResponse?.ok?.() || false,
  162 |         returnedDate: conflictRow?.date || '',
  163 |         conflictCount: Number(conflictRow?.count || 0),
  164 |         names: Array.isArray(conflictRow?.names) ? conflictRow.names.slice(0, 8) : []
  165 |       });
  166 |       expect(conflictResponse, 'Selecting the seeded conflict date should call the Request Off conflicts API').toBeTruthy();
  167 |       expect(conflictResponse.ok(), 'Request Off conflicts API should succeed before warning is evaluated').toBe(true);
  168 |       expect(conflictRow?.date, 'Conflict API response should include the seeded conflict date').toBe(conflictDate);
  169 |       expect(Number(conflictRow?.count || 0), 'Seeded Sara Request Off should count as at least one other-employee conflict').toBeGreaterThanOrEqual(1);
  170 |       const dialog = await dialogPromise;
  171 |       if (dialog) {
  172 |         const message = dialog.message();
  173 |         if (accept) await dialog.accept(); else await dialog.dismiss();
  174 |         return { conflictDate, dialogMessage: message, accepted: accept };
  175 |       }
  176 |       const modal = page.getByRole('dialog').filter({ hasText: /already been requested off|may not be available|availability/i }).first();
  177 |       await expect(modal, 'Conflict warning dialog should appear for seeded active Request Off conflict').toBeVisible({ timeout: 8000 });
  178 |       const message = await modal.innerText().catch(() => '');
  179 |       if (accept) await modal.getByRole('button', { name: /continue|yes|submit anyway/i }).first().click();
  180 |       else await modal.getByRole('button', { name: /cancel|no|go back/i }).first().click();
  181 |       await expect(modal).toBeHidden({ timeout: 8000 }).catch(() => {});
  182 |       return { conflictDate, dialogMessage: message, accepted: accept };
  183 |     }
  184 | 
  185 |     await login(page, account.email, account.password, { tab: 'godmode' });
  186 |     await dismissBlockingDialogs(page);
  187 |     await openPeopleAndPossess(seed.ghostTargetName || 'Allen QA');
  188 |     await openRequestOff();
  189 |     let text = await bodyText(page, 70000);
  190 |     await attachState('06-ghost-request-off-initial.json');
> 191 |     expect(text, 'Request Off page should render in Ghost Mode without the unavailable toast').toMatch(/Request Off/i);
      |                                                                                                ^ Error: Request Off page should render in Ghost Mode without the unavailable toast
  192 |     expect(text, 'User-level Ghost Mode Request Off should not expose manager approval controls').not.toMatch(/Master Override Log|Approve selected|Archive selected|Pending approval queue/i);
  193 |     expect(text, 'Valid Ghost Mode target should not show Request Off unavailable').not.toMatch(/Request Off unavailable|We could not verify Request Off availability/i);
  194 |     expect(text, 'Valid Ghost Mode target should not emit raw Firestore permission errors').not.toMatch(/Missing or insufficient permissions/i);
  195 | 
  196 |     const cancelWarning = await clickConflictDate({ accept: false });
  197 |     text = await bodyText(page, 70000);
  198 |     await attachState('06-ghost-request-off-warning-cancel.json', { cancelWarning });
  199 |     expect(cancelWarning.dialogMessage, 'Conflict warning must be shown before canceling date selection').toMatch(/already been requested off|available|conflict/i);
  200 |     expect(text, 'Canceling the warning should not reveal private request reasons or email addresses').not.toMatch(/reason|@86chaos\.test|@example\.test|phone|full request document/i);
  201 | 
  202 |     const continueWarning = await clickConflictDate({ accept: true });
  203 |     await page.waitForTimeout(800);
  204 |     text = await bodyText(page, 70000);
  205 |     await attachState('06-ghost-request-off-warning-continue.json', { continueWarning });
  206 |     expect(continueWarning.dialogMessage, 'Conflict warning should appear again before continuing').toMatch(/already been requested off|available|conflict/i);
  207 | 
  208 |     const submit = page.getByRole('button', { name: /submit/i }).first();
  209 |     await expect(submit, 'Continuing through the warning should enable the exact Request Off submit action').toBeEnabled({ timeout: 15000 });
  210 |     await submit.click();
  211 |     await page.waitForTimeout(3000);
  212 |     const createResponse = apiResponses.find(r => /ghost-create|time-off-request/i.test(JSON.stringify(r.body || {})) && r.ok) || apiResponses.find(r => r.ok && r.body?.ok === true);
  213 |     text = await bodyText(page, 70000);
  214 |     await attachState('06-ghost-request-off-after-submit.json', { createResponse });
  215 |     expect(createResponse, 'Ghost Mode Request Off submission should have an authoritative successful API response').toBeTruthy();
  216 |     expect(text, 'Ghost Mode Request Off submit should not show the unavailable toast').not.toMatch(/Request Off unavailable|Request not submitted|We could not verify Request Off availability/i);
  217 |     expect(text, 'Ghost Mode Request Off submit should not produce raw permission errors').not.toMatch(/Missing or insufficient permissions/i);
  218 | 
  219 |     await page.reload({ waitUntil: 'domcontentloaded' });
  220 |     await page.waitForTimeout(2200);
  221 |     await openRequestOff();
  222 |     text = await bodyText(page, 70000);
  223 |     await attachState('06-ghost-request-off-after-refresh.json');
  224 |     expect(text, 'Impersonated employee request should remain visible after refresh').toMatch(/Allen QA|Request-Off Workflow|Pending|Approved|Submitted|Request Off/i);
  225 |     expect(text, 'Request Off page should remain free of raw permission errors after refresh').not.toMatch(/Missing or insufficient permissions|Request Off unavailable/i);
  226 | 
  227 |     const cancelButton = page.getByRole('button', { name: /cancel request off|cancel request|cancel/i }).first();
  228 |     await expect(cancelButton, 'Exact created Request Off entry should expose a cancellation control').toBeVisible({ timeout: 12000 });
  229 |     const cancelDialogPromise = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
  230 |     await cancelButton.click();
  231 |     const cancelDialog = await cancelDialogPromise;
  232 |     if (cancelDialog) await cancelDialog.accept().catch(() => {});
  233 |     await page.waitForTimeout(1800);
  234 |     await attachState('06-ghost-request-off-after-cancel.json');
  235 |     expect(summarizeProblems(problems), 'Ghost Mode Request Off flow should not generate unhandled browser/runtime problems').toEqual([]);
  236 |   });
  237 | 
  238 | });
  239 | 
```