const { test, expect } = require('@playwright/test');
const {
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  bodyText,
  attachJson,
  readSeedReport,
  ALLOW_MUTATION,
  mutationSkipMessage,
  dismissBlockingDialogs,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

function scheduleFixtureDateFromSeed(seed = {}) {
  const fixture = seed?.profile?.expectations?.fixture || seed?.profile?.fixture || {};
  const overCoverageDate = (fixture.shifts || []).find(row => row?.employeeName === 'Chuck QA' && row?.role === 'Bartender' && String(row?.startTime || '').toLowerCase() === '10a')?.date;
  return overCoverageDate || fixture.currentWeekStart || fixture.anchor || seed?.ghostRequestOffConflictDate || '2026-08-04';
}

async function installSeededScheduleClock(page, seed = {}) {
  const fixtureDate = scheduleFixtureDateFromSeed(seed);
  await page.addInitScript(({ fixtureDate }) => {
    const RealDate = Date;
    const fixedNow = new RealDate(`${fixtureDate}T12:00:00`);
    class ChaosFixedDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow.getTime()]));
      }
      static now() { return fixedNow.getTime(); }
      static parse(value) { return RealDate.parse(value); }
      static UTC(...args) { return RealDate.UTC(...args); }
    }
    Object.setPrototypeOf(ChaosFixedDate, RealDate);
    ChaosFixedDate.prototype = RealDate.prototype;
    window.Date = ChaosFixedDate;
    window.__CHAOS_QA_FIXED_SCHEDULE_DATE__ = fixtureDate;
  }, { fixtureDate });
}

async function openSchedule(page, seed = {}) {
  await installSeededScheduleClock(page, seed);
  const account = ownerLikeCreds();
  requireCreds(account, 'manager/owner account');
  await login(page, account.email, account.password);
  await gotoTab(page, 'schedule', { settleMs: 1400, maxText: 60000 });
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);
  await expect(page.locator('body'), 'Schedule Builder should render before opening warning tools').toContainText(/Schedule Builder|Coverage|Auto-Fill|Publish/i, { timeout: 15000 });
}

async function openWarnings(page) {
  const warningsButton = page.getByRole('button', { name: /^Open Warnings$/i }).or(page.getByRole('button', { name: /^Warnings$/i })).first();
  if (!await warningsButton.isVisible().catch(() => false)) {
    const openCopilot = page.getByRole('button', { name: /^Open Copilot Tools$/i }).first();
    await expect(openCopilot, 'Schedule Copilot should already be open or expose Open Copilot Tools').toBeVisible({ timeout: 10000 });
    await openCopilot.click();
    await page.waitForTimeout(400);
  }
  await expect(warningsButton, 'Warnings tool button should use the current accessible control name').toBeVisible({ timeout: 10000 });
  await warningsButton.click();
  await page.waitForTimeout(500);
}

async function openManagerRequestOff(page, seed = {}) {
  await installSeededScheduleClock(page, seed);
  const account = ownerLikeCreds();
  requireCreds(account, 'manager/owner account');
  await login(page, account.email, account.password);
  await gotoTab(page, 'published', { settleMs: 1400, maxText: 60000 });
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);
  const requestOffTab = page.getByRole('button', { name: /^Schedule Request Off$/i }).first();
  await expect(requestOffTab, 'Request Off subtab should be visible inside Time Clock & Schedule').toBeVisible({ timeout: 15000 });
  await requestOffTab.click();
  await expect(page.locator('body'), 'Request-Off Workflow should render before manager Request Off assertions').toContainText(/Request-Off Workflow/i, { timeout: 15000 });
  await expect(page.getByLabel(/Filter Request Off by employee/i).or(page.getByPlaceholder(/Filter by employee/i)).first(), 'Manager Request Off employee filter should be ready').toBeVisible({ timeout: 10000 });
}

async function openRequestOffView(page, label) {
  await page.getByRole('button', { name: new RegExp(`^Open ${label}$`, 'i') }).or(page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).first().click();
}

async function waitForRequestOffEmployee(page, employeeName, message) {
  await expect(page.locator('body'), message || `${employeeName} Request Off row should be visible before filtering or bulk actions`).toContainText(new RegExp(employeeName.replace(/\s+/g, '\\s+'), 'i'), { timeout: 15000 });
  await expect(page.locator('body'), `${employeeName} readiness should not be the empty Request Off state`).not.toContainText(/No requests here/i, { timeout: 1000 });
}

async function ensureSeeded(testInfo) {
  if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
  const seed = readSeedReport();
  await attachJson(testInfo, '16-0-153-seed-state.json', { seedPresent: Boolean(seed), ok: seed?.ok, counts: seed?.profile?.createdCounts || seed?.profile?.collections || seed?.profile?.created || {} });
  expect(seed?.ok, '16.0.153 focused feature tests need current-run seeded QA data').toBe(true);
  return seed;
}

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
    await openSchedule(page, seed);
    await openWarnings(page);
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
    const text = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-153-coverage-warning-text.json', { text: text.slice(0, 12000) });
    expect(text, 'Under-target coverage warnings should remain visible').toMatch(/needs \d+ more/i);
    expect(text, 'Over-target coverage warnings should show the inverse condition').toMatch(/has \d+ more .* than the coverage target/i);
    expect(text, 'Coverage warning math should show Existing and Target values').toMatch(/Existing:\s*\d+\s*•\s*Target:\s*\d+/i);
  });

  test('Schedule Builder warning dismissal hides only the warning', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    await openSchedule(page, seed);
    await openWarnings(page);
    const before = await bodyText(page, 60000);
    const dismiss = page.getByRole('button', { name: /^Dismiss warning$/i }).first();
    await expect(dismiss, 'At least one warning should expose an accessible dismiss control').toBeVisible({ timeout: 10000 });
    await dismiss.click();
    await page.waitForTimeout(500);
    const after = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-153-dismiss-warning-state.json', { before: before.slice(0, 8000), after: after.slice(0, 8000) });
    expect(after, 'Dismiss should hide a warning without deleting Schedule Builder or Request Off data').toMatch(/Schedule Builder|Coverage|Warnings/i);
    expect(after, 'Dismiss control should not collapse the Schedule Builder route').not.toMatch(/86 CHAOS RUNTIME RECOVERY|This section hit a snag/i);
    expect(after, 'Dismiss control should leave operational schedule data visible').toMatch(/Allen QA|Chuck QA|Coverage targets|Scheduled Hours Tracker/i);
  });

  test('Request Off employee filter narrows and clears manager-visible requests', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    await openManagerRequestOff(page, seed);
    await waitForRequestOffEmployee(page, 'Sara QA', 'Seeded Sara QA pending request should be visible before employee filtering');
    const filter = page.getByLabel(/Filter Request Off by employee/i).or(page.getByPlaceholder(/Filter by employee/i)).first();
    await expect(filter, 'Managers should see an employee filter for Request Off workflow').toBeVisible({ timeout: 10000 });
    const unfiltered = await bodyText(page, 60000);
    await filter.fill('Sara');
    await expect(page.locator('body'), 'Filtered Request Off workflow should show Sara QA after listener readiness').toContainText(/Sara QA/i, { timeout: 15000 });
    await expect(page.locator('body'), 'Filtered Request Off workflow should not show the empty state for seeded Sara QA').not.toContainText(/No requests here/i, { timeout: 1000 });
    const filtered = await bodyText(page, 60000);
    await page.getByRole('button', { name: /^Open All Employees$/i }).or(page.getByRole('button', { name: /^All Employees$/i })).first().click();
    await page.waitForTimeout(500);
    const cleared = await bodyText(page, 60000);
    await attachJson(testInfo, '16-0-153-request-off-filter-state.json', { unfiltered: unfiltered.slice(0, 8000), filtered: filtered.slice(0, 8000), cleared: cleared.slice(0, 8000) });
    expect(filtered, 'Employee filter should narrow to the searched employee').toMatch(/Sara QA/i);
    expect(cleared, 'Clearing should restore the all-employee Request Off workflow').toMatch(/Request-Off Workflow|Request Off/i);
    expect(cleared.length, 'Cleared filter should restore visible workflow content').toBeGreaterThan(filtered.length - 2000);
  });

  test('Approve All Visible updates only filtered visible pending requests', async ({ page }, testInfo) => {
    const seed = await ensureSeeded(testInfo);
    await openManagerRequestOff(page, seed);
    await openRequestOffView(page, 'Needs Review');
    await waitForRequestOffEmployee(page, 'Sara QA', 'Seeded Sara QA pending request should be visible before bulk approve');
    const filter = page.getByLabel(/Filter Request Off by employee/i).or(page.getByPlaceholder(/Filter by employee/i)).first();
    await expect(filter).toBeVisible({ timeout: 10000 });
    await filter.fill('Sara');
    await expect(page.locator('body'), 'Sara QA should remain visible after applying the Sara employee filter').toContainText(/Sara QA/i, { timeout: 15000 });
    page.once('dialog', async dialog => {
      expect(dialog.message(), 'Bulk approval confirmation should state visible pending count and active employee filter').toMatch(/Approve \d+ visible pending Request Off requests? for Sara\?/i);
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
    await openManagerRequestOff(page, seed);
    await openRequestOffView(page, 'Upcoming Approved');
    await waitForRequestOffEmployee(page, 'Allen QA', 'Seeded Allen QA approved request should be visible before bulk archive');
    const filter = page.getByLabel(/Filter Request Off by employee/i).or(page.getByPlaceholder(/Filter by employee/i)).first();
    await expect(filter).toBeVisible({ timeout: 10000 });
    await filter.fill('Allen');
    await expect(page.locator('body'), 'Allen QA should remain visible after applying the Allen employee filter').toContainText(/Allen QA/i, { timeout: 15000 });
    page.once('dialog', async dialog => {
      expect(dialog.message(), 'Bulk archive confirmation should state visible count and active employee filter').toMatch(/Archive \d+ visible Request Off requests? for Allen\?/i);
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
