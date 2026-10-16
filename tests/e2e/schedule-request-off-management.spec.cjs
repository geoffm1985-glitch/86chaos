const { test, expect } = require('../fixtures/emulator-navigation-test.cjs');
const { bodyText, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { scheduleRequestOffConflictAnchorFromSeed } = require('./utils/schedule-request-off-fixture-anchor.cjs');
const { ensureSeeded, resetSeededRequestOffFixture, openSchedule, openWarnings, openManagerRequestOff, openRequestOffView, waitForRequestOffEmployee, selectRequestOffEmployee, clearRequestOffEmployee, verifyWarningDismissalIsolation } = require('../fixtures/schedule-request-off-management.cjs');

test.describe('16.0.153 Schedule warnings and Request Off management', () => {
  test('Schedule Builder warning runtime renders without Runtime Recovery or TypeError', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    const runtimeErrors = [];
    page.on('pageerror', error => runtimeErrors.push({ message: String(error?.message || ''), stack: String(error?.stack || '') }));
    await openSchedule(page, seed);
    await openWarnings(page);
    const text = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-156-schedule-runtime-warning-render.json', {
      runtimeErrors,
      text: text.slice(0, 12000),
    });
    expect(text, 'Schedule route should not fall into the app runtime recovery surface').not.toMatch(/86 CHAOS RUNTIME RECOVERY|This section hit a snag/i);
    expect(text, 'Schedule warning/coverage surface should render after opening Warnings').toMatch(/Warnings|Coverage|coverage target|scheduled on requested-off date|needs \d+ more|has \d+ more/i);
    expect(runtimeErrors.filter(error => /is not a function|TypeError/i.test(`${error.message}\n${error.stack}`)), 'Schedule render should not throw TypeError while loading warning helpers').toEqual([]);
  });

  test('Schedule Builder requested-off warning shows employee name and never Someone', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    await resetSeededRequestOffFixture(seed, 'allen');
    await openSchedule(page, seed, scheduleRequestOffConflictAnchorFromSeed(seed));
    await openWarnings(page);
    await expect(page.locator('body'), 'Seeded Request Off conflict must hydrate before identity assertions run').toContainText(/(?:Allen QA|Sara QA).*scheduled on requested-off date/i, { timeout: 45_000 });
    const text = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-153-request-off-warning-text.json', { text: text.slice(0, 12000) });
    expect(text, 'Requested-off warning must not use the old unresolved fallback').not.toMatch(/Someone is scheduled on requested-off date/i);
    expect(text, 'Seeded Request Off conflict should identify the actual employee').toMatch(/Allen QA|Sara QA/i);
    expect(text, 'Requested-off warning should still mention requested-off date context').toMatch(/scheduled on requested-off date/i);
  });

  test('Schedule Builder coverage warnings show under and over target math', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    await openSchedule(page, seed);
    await openWarnings(page);
    await expect(page.locator('body'), 'Coverage target hydration should expose the seeded under-target warning').toContainText(/needs \d+ more/i, { timeout: 15000 });
    await expect(page.locator('body'), 'Coverage target hydration should expose the seeded over-target warning').toContainText(/has \d+ more .* than the coverage target/i, { timeout: 15000 });
    const text = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-153-coverage-warning-text.json', { text: text.slice(0, 12000) });
    expect(text, 'Under-target coverage warnings should remain visible').toMatch(/needs \d+ more/i);
    expect(text, 'Over-target coverage warnings should show the inverse condition').toMatch(/has \d+ more .* than the coverage target/i);
    expect(text, 'Coverage warning math should show Existing and Target values').toMatch(/Existing:\s*\d+\s*•\s*Target:\s*\d+/i);
  });

  test('Schedule Builder warning dismissal hides only the warning', verifyWarningDismissalIsolation);

  test('Request Off employee filter narrows and clears manager-visible requests', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    await resetSeededRequestOffFixture(seed, 'sara');
    await openManagerRequestOff(page, seed);
    await waitForRequestOffEmployee(page, 'Sara QA', 'Seeded Sara QA pending request should be visible before employee filtering');
    const unfiltered = await bodyText(page, 60000);
    await selectRequestOffEmployee(page, 'Sara QA');
    await expect(page.locator('body'), 'Filtered Request Off workflow should show Sara QA after listener readiness').toContainText(/Sara QA/i, { timeout: 15000 });
    await expect(page.locator('body'), 'Filtered Request Off workflow should not show the empty state for seeded Sara QA').not.toContainText(/No requests here/i, { timeout: 1000 });
    const filtered = await bodyText(page, 60000);
    await clearRequestOffEmployee(page);
    await page.waitForTimeout(500);
    const cleared = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-153-request-off-filter-state.json', { unfiltered: unfiltered.slice(0, 8000), filtered: filtered.slice(0, 8000), cleared: cleared.slice(0, 8000) });
    expect(filtered, 'Employee filter should narrow to the searched employee').toMatch(/Sara QA/i);
    expect(cleared, 'Clearing should restore the all-employee Request Off workflow').toMatch(/Request-Off Workflow|Request Off/i);
    expect(cleared.length, 'Cleared filter should restore visible workflow content').toBeGreaterThan(filtered.length - 2000);
  });

  test('Approve All Visible updates only filtered visible pending requests', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    await resetSeededRequestOffFixture(seed, 'sara');
    await openManagerRequestOff(page, seed);
    await openRequestOffView(page, 'Needs Review');
    await waitForRequestOffEmployee(page, 'Sara QA', 'Seeded Sara QA pending request should be visible before bulk approve');
    const { selectedOptionLabel: selectedSaraLabel } = await selectRequestOffEmployee(page, 'Sara QA');
    await expect(page.locator('body'), 'Sara QA should remain visible after applying the Sara employee filter').toContainText(/Sara QA/i, { timeout: 15000 });
    const escapedSaraLabel = selectedSaraLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    page.once('dialog', async dialog => {
      expect(dialog.message(), 'Bulk approval confirmation should state visible pending count and active employee filter').toMatch(new RegExp(`Approve \\d+ visible pending Request Off requests? for ${escapedSaraLabel}\\?`, 'i'));
      await dialog.accept();
    });
    await page.getByRole('button', { name: /^Approve All Visible$/i }).click();
    await expect(page.locator('body'), 'Bulk approve should show one final summary toast').toContainText(/Approved \d+ request/i, { timeout: 15000 });
    const text = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-153-approve-visible-state.json', { text: text.slice(0, 12000) });
    expect(text, 'Filtered workflow should remain scoped to Sara after bulk approve').toMatch(/Sara QA|All Employees/i);
  });

  test('Archive All Visible archives only filtered visible eligible requests', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    await resetSeededRequestOffFixture(seed, 'allen');
    await openManagerRequestOff(page, seed);
    await openRequestOffView(page, 'All');
    await waitForRequestOffEmployee(page, 'Allen QA', 'Seeded Allen QA approved request should be visible before bulk archive');
    const { selectedOptionLabel: selectedAllenLabel } = await selectRequestOffEmployee(page, 'Allen QA');
    await waitForRequestOffEmployee(page, 'Allen QA', 'Allen QA should remain visible after applying the Allen employee filter');
    const escapedAllenLabel = selectedAllenLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    page.once('dialog', async dialog => {
      expect(dialog.message(), 'Bulk archive confirmation should state visible count and active employee filter').toMatch(new RegExp(`Archive \\d+ visible Request Off requests? for ${escapedAllenLabel}\\?`, 'i'));
      await dialog.accept();
    });
    await page.getByRole('button', { name: /^Archive All Visible$/i }).click();
    await expect(page.locator('body'), 'Bulk archive should show one final summary toast').toContainText(/Archived \d+ request/i, { timeout: 15000 });
    await page.getByRole('button', { name: /^Open Published\/Archived$/i }).or(page.getByRole('button', { name: /^Published\/Archived$/i })).first().click();
    await page.waitForTimeout(500);
    const history = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-153-archive-visible-history.json', { history: history.slice(0, 12000) });
    expect(history, 'Archived visible requests should remain in history with restore available').toMatch(/Restore|History record|archived/i);
  });
});
