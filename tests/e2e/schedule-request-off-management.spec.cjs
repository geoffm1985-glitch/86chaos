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
  BASE_URL,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { readFirebaseConfig, readConfiguredAccounts, signInAccount, buildFirebaseAuthFetchOptions } = require('../../scripts/86chaos-release-gate/verify-role-accounts.cjs');

const QA_TEST_PROJECT_ID = 'chaos-test-d1601';

let qaRequestOffResetAuthPromise = null;
async function getQaRequestOffResetAuth() {
  if (qaRequestOffResetAuthPromise) return qaRequestOffResetAuthPromise;
  const promise = (async () => {
    const config = readFirebaseConfig();
    if (config?.projectId !== QA_TEST_PROJECT_ID) throw new Error(`Refusing QA Request Off reset auth outside ${QA_TEST_PROJECT_ID}: ${config?.projectId || 'unknown'}`);
    const systemAdminAccount = readConfiguredAccounts().find(account => account.key === 'systemAdmin');
    if (!systemAdminAccount?.email || !systemAdminAccount?.password) throw new Error('System Administrator QA account credentials are required for Request Off fixture reset.');
    const signed = await signInAccount(systemAdminAccount, config);
    if (!signed?.idToken) throw new Error('System Administrator QA account did not return an ID token.');
    if (signed.firebaseProjectId !== QA_TEST_PROJECT_ID) throw new Error(`System Administrator token is for ${signed.firebaseProjectId || 'unknown'}, expected ${QA_TEST_PROJECT_ID}.`);
    return { idToken: signed.idToken, uid: signed.uid, projectId: signed.firebaseProjectId };
  })();
  qaRequestOffResetAuthPromise = promise.catch(error => {
    qaRequestOffResetAuthPromise = null;
    throw error;
  });
  return qaRequestOffResetAuthPromise;
}

function scheduleFixtureDateFromSeed(seed = {}) {
  const fixture = seed?.profile?.expectations?.fixture || seed?.profile?.fixture || {};
  const overCoverageDate = (fixture.shifts || []).find(row => row?.employeeName === 'Chuck QA' && row?.role === 'Bartender' && String(row?.startTime || '').toLowerCase() === '10a')?.date;
  return fixture.anchor || fixture.currentWeekStart || overCoverageDate || seed?.ghostRequestOffConflictDate || '2026-08-04';
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
  if (seed?.ok) {
    await expect(page.locator('body'), 'Schedule Builder must hydrate seeded QA staff before warning assertions run').toContainText(/Allen QA|Chuck QA|Lani QA/i, { timeout: 45000 });
  }
}

async function openWarnings(page) {
  const warningsControl = page
    .getByRole('tab', { name: /^Warnings$/i })
    .or(page.getByRole('button', { name: /^Open Warnings$/i }))
    .or(page.getByRole('button', { name: /^Warnings$/i }))
    .first();
  if (!await warningsControl.isVisible().catch(() => false)) {
    const openCopilot = page.getByRole('button', { name: /^Open Copilot Tools$/i }).first();
    await expect(openCopilot, 'Schedule Copilot should already be open or expose Open Copilot Tools').toBeVisible({ timeout: 10000 });
    await openCopilot.click();
    await page.waitForTimeout(400);
  }
  await expect(warningsControl, 'Warnings tool control should use the current accessible tab/button name').toBeVisible({ timeout: 10000 });
  await warningsControl.click();
  await expect(page.locator('body'), 'Warnings panel should open after activating the current Warnings control').toContainText(/Warnings|scheduled on requested-off date|coverage target|needs \d+ more|has \d+ more/i, { timeout: 15000 });
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
  await expect(page.getByLabel(/Filter Request Off by employee/i).first(), 'Manager Request Off employee filter should be ready').toBeVisible({ timeout: 10000 });
}

async function openRequestOffView(page, label) {
  await page.getByRole('button', { name: new RegExp(`^Open ${label}$`, 'i') }).or(page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).first().click();
}

async function waitForRequestOffEmployee(page, employeeName, message) {
  const escapedEmployeeName = employeeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const requestRowLabel = page.locator('.request-off-workflow-panel div.font-black.text-white.text-sm').filter({ hasText: new RegExp(`^\\s*${escapedEmployeeName}\\s*$`, 'i') }).first();
  await expect(requestRowLabel, message || `${employeeName} Request Off row should be visible before filtering or bulk actions`).toBeVisible({ timeout: 15000 });
  await expect(page.locator('body'), `${employeeName} readiness should not be the empty Request Off state`).not.toContainText(/No requests here/i, { timeout: 1000 });
}

async function selectRequestOffEmployee(page, employeeName) {
  const filter = page.getByLabel(/Filter Request Off by employee/i).first();
  await expect(filter, 'Managers should see an employee dropdown for Request Off workflow').toBeVisible({ timeout: 10000 });
  const option = filter.locator('option').filter({ hasText: new RegExp(employeeName.replace(/\s+/g, '\\s+'), 'i') });
  await expect(option, `Request Off employee dropdown should include ${employeeName}`).toHaveCount(1, { timeout: 15000 });
  const selectedOption = await option.first().evaluate(node => ({ value: node.value, label: node.label || node.textContent || '' }));
  await filter.selectOption(selectedOption.value);
  const selectedOptionLabel = selectedOption.label.trim();
  expect(selectedOptionLabel, `Request Off employee dropdown should select ${employeeName}`).toMatch(new RegExp(employeeName.replace(/\s+/g, '\\s+'), 'i'));
  return { filter, selectedOptionLabel };
}


async function clearRequestOffEmployee(page) {
  const filter = page.getByLabel(/Filter Request Off by employee/i).first();
  await filter.selectOption('');
}

async function ensureSeeded(testInfo) {
  if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
  const seed = readSeedReport();
  await attachJson(testInfo, '16-0-153-seed-state.json', { seedPresent: Boolean(seed), ok: seed?.ok, counts: seed?.profile?.createdCounts || seed?.profile?.collections || seed?.profile?.created || {} });
  expect(seed?.ok, '16.0.153 focused feature tests need current-run seeded QA data').toBe(true);
  return seed;
}

function requireSafeRequestOffResetSeed(seed = {}) {
  expect(seed?.ok, 'Request Off fixture reset requires a successful current QA seed').toBe(true);
  expect(seed?.firebaseProjectId, 'Request Off fixture reset must use testing Firebase only').toBe(QA_TEST_PROJECT_ID);
  expect(String(seed?.runId || ''), 'Request Off fixture reset requires a nonempty run id').not.toBe('');
  expect(seed?.restaurantId, 'Request Off fixture reset must target the current QA restaurant').toBe(`qa_${seed.runId}`);
}

function findSeededRequestOffDoc(seed = {}, employeeKey = '') {
  const suffix = employeeKey === 'allen' ? '_Allen_QA' : employeeKey === 'sara' ? '_Sara_QA' : '';
  if (!suffix) throw new Error(`Unsupported Request Off reset employee key: ${employeeKey}`);
  const match = (seed.seededDocuments || []).find(row => row?.collection === 'timeOffRequests' && String(row?.id || '').endsWith(suffix));
  if (!match?.id) throw new Error(`Could not resolve current-run seeded Request Off document for ${employeeKey}.`);
  if (!String(match.id).includes(seed.runId)) throw new Error(`Refusing Request Off reset for non-current-run document: ${match.id}`);
  return match;
}

async function resetSeededRequestOffFixture(seed = {}, employeeKey = '') {
  requireSafeRequestOffResetSeed(seed);
  const target = findSeededRequestOffDoc(seed, employeeKey);
  const expectedUserId = seed?.profile?.ids?.userIdsByKey?.[employeeKey] || '';
  if (!expectedUserId) throw new Error(`Request Off reset expected user id is missing for ${employeeKey}.`);
  if (!BASE_URL) throw new Error('BASE_URL is required for the safe QA Request Off reset endpoint.');
  const expectedStatus = employeeKey === 'allen' ? 'approved' : employeeKey === 'sara' ? 'pending' : '';
  if (!expectedStatus) throw new Error(`Unsupported Request Off reset employee key: ${employeeKey}`);
  const { idToken } = await getQaRequestOffResetAuth();
  const resetUrl = `${BASE_URL.replace(/\/+$/, '')}/api/full-audit-qa-seed`;
  const response = await fetch(resetUrl, buildFirebaseAuthFetchOptions({
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      action: 'reset-request-off-fixture',
      expectedProjectId: QA_TEST_PROJECT_ID,
      runId: seed.runId,
      restaurantId: seed.restaurantId,
      workspaceName: `86 Chaos Release Gate QA ${seed.runId}`,
      documentId: target.id,
      employeeKey,
      expectedUserId,
    }),
  }));
  let data = null;
  try { data = await response.json(); } catch (_) { data = null; }
  if (!response.ok || data?.ok !== true || data?.action !== 'reset-request-off-fixture' || data?.projectId !== QA_TEST_PROJECT_ID || data?.runId !== seed.runId || data?.restaurantId !== seed.restaurantId || data?.documentId !== target.id || data?.employeeKey !== employeeKey || data?.status !== expectedStatus) {
    const safeError = String(data?.error || response.statusText || 'Request Off reset failed').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]').slice(0, 400);
    throw new Error(`Request Off fixture reset failed (${response.status}): ${safeError}`);
  }
  return data;
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
    await resetSeededRequestOffFixture(seed, 'allen');
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
    await openRequestOffView(page, 'Upcoming Approved');
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
