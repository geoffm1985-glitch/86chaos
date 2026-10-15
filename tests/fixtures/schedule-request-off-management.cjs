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
const { expectedFirebaseProject } = require('../../scripts/86chaos-firebase-target.cjs');
const { scheduleFixtureDateFromSeed, scheduleRequestOffConflictAnchorFromSeed } = require('../e2e/utils/schedule-request-off-fixture-anchor.cjs');

const QA_TEST_PROJECT_ID = expectedFirebaseProject(process.env);

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

async function installSeededScheduleClock(page, seed = {}, fixtureDateOverride = '') {
  const fixtureDate = fixtureDateOverride || scheduleFixtureDateFromSeed(seed);
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

async function openSchedule(page, seed = {}, fixtureDateOverride = '') {
  await installSeededScheduleClock(page, seed, fixtureDateOverride);
  const account = ownerLikeCreds();
  requireCreds(account, 'manager/owner account');
  await login(page, account.email, account.password);
  await gotoTab(page, 'schedule', { settleMs: 1400, maxText: 60000 });
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);
  await page.addLocatorHandler(page.getByRole('button', { name: "Skip and don't show again", exact: true }), async button => {
    for (let pass = 0; pass < 2 && await button.isVisible(); pass++) await button.press('Enter', { timeout: 2500 });
    await expect(button).toBeHidden({ timeout: 2500 });
  });
  await expect(page.locator('body'), 'Schedule Builder should render before opening warning tools').toContainText(/Schedule Builder|Coverage|Auto-Fill|Publish/i, { timeout: 15000 });
  if (seed?.ok) {
    await expect(page.locator('body'), 'Schedule Builder must hydrate seeded QA staff before warning assertions run').toContainText(/Allen QA|Chuck QA|Lani QA/i, { timeout: 45000 });
  }
}

async function openWarnings(page) {
  const warningsControl = page.getByTestId('schedule-copilot-warnings-tab');
  if (!await warningsControl.isVisible().catch(() => false)) {
    await page.getByRole('button',{name:'Smart Schedule',exact:true}).click();
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
  const requestOffTab = page.getByTestId('schedule-request-off-tab');
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


async function readWarningBusinessState(page, seed) {
  const { idToken } = await getQaRequestOffResetAuth();
  const headers = { authorization: `Bearer ${idToken}` };
  const { postScheduleQa } = require('./schedule-qa-request.cjs');
  const { workspaceWeek, shiftDateBy } = require('../../src/core/scheduleWorkspace.shared.js');
  const weekStart = workspaceWeek(scheduleRequestOffConflictAnchorFromSeed(seed))[0];
  const shiftsResponse = await postScheduleQa(page.request, `${BASE_URL}/api/schedule-workspace`, {
    headers, data: { action: 'read-week', restaurantId: seed.restaurantId, weekStart },
  });
  expect(shiftsResponse.status(), 'Independent scheduling read must be authorized').toBe(200);
  const shifts = await shiftsResponse.json();
  expect(shifts.authoritative).toBe(true);
  expect(shifts.restaurantId).toBe(seed.restaurantId);
  const offResponse = await page.request.post(`${BASE_URL}/api/time-off-request`, {
    headers, data: { action: 'workflow-list', restaurantId: seed.restaurantId, startDate: weekStart, endDate: shiftDateBy(weekStart, 6) }, maxRetries: 0,
  });
  expect(offResponse.status(), 'Independent Request Off read must be authorized').toBe(200);
  const off = await offResponse.json();
  expect(off.ok).toBe(true);expect(off.restaurantId).toBe(seed.restaurantId);
  const request = off.requests.find(row => row.id === findSeededRequestOffDoc(seed, 'allen').id);
  expect(request?.status, 'Allen approved fixture must remain active').toBe('approved');
  const pairedShifts = shifts.shifts.filter(row => row.employeeId === seed.profile.ids.userIdsByKey.allen && row.date === request.date);
  expect(pairedShifts.length, 'The approved request must have a real conflicting shift').toBeGreaterThan(0);
  return { request, shifts: pairedShifts };
}

async function verifyWarningDismissalIsolation({ page }, testInfo) {
  const { observeSchedulingRuntime } = require('./webkit-navigation-evidence.cjs');
  const runtime = await observeSchedulingRuntime(page);
  const seed = await ensureSeeded(testInfo);
  await resetSeededRequestOffFixture(seed, 'allen');
  const businessBefore = await readWarningBusinessState(page, seed);
  await openSchedule(page, seed, scheduleRequestOffConflictAnchorFromSeed(seed));
  await openWarnings(page);
  // Warning sources hydrate independently. Never let the first available button
  // choose a time-off conflict and persist its dismissal into the next project.
  const cards = page.locator('.schedule-warning-dismiss').locator('..').locator('..');
  const conflict = cards.filter({ hasText: /Allen QA.*scheduled on requested-off date/i });
  await expect(conflict).toHaveCount(1, { timeout: 45000 });
  const coverage = cards.filter({ hasText: /needs \d+ more|has \d+ more .* than the coverage target/i }).first();
  await expect(coverage).toBeVisible({ timeout: 15000 });
  const selectedText = await coverage.innerText();
  const selected = cards.filter({ has: page.getByText(selectedText.split('\n')[0], { exact: true }) });
  await coverage.getByRole('button', { name: 'Dismiss warning', exact: true }).click();
  await expect(selected, 'Only the reviewed coverage warning is dismissed').toHaveCount(0);
  await expect(conflict, 'Coverage dismissal must preserve the employee time-off conflict').toBeVisible();
  const businessAfter = await readWarningBusinessState(page, seed);
  expect(businessAfter, 'Warning dismissal must not change approved leave or assigned shifts').toEqual(businessBefore);
  await runtime.reload();
  await dismissBlockingDialogs(page, { maxPasses: 4 });
  await openWarnings(page);
  await expect(selected, 'The selected dismissal must persist across reload').toHaveCount(0);
  await expect(conflict, 'A different conflict must remain visible across reload').toBeVisible({ timeout: 45000 });
  expect(await bodyText(page, 60000)).not.toMatch(/86 CHAOS RUNTIME RECOVERY|This section hit a snag/i);
  expect((await runtime.finish(testInfo)).fatalErrors, 'Unknown application/runtime errors remain fatal').toEqual([]);
  await attachJson(testInfo, 'schedule-warning-dismissal-isolation.json', { selectedText, persisted: true, conflictPreserved: true, businessUnchanged: true });
}
module.exports = { ensureSeeded, resetSeededRequestOffFixture, openSchedule, openWarnings, openManagerRequestOff, openRequestOffView, waitForRequestOffEmployee, selectRequestOffEmployee, clearRequestOffEmployee, verifyWarningDismissalIsolation };
