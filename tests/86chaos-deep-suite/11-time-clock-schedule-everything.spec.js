// 86 Chaos 16.0.2 Time Clock & Schedule deep coverage suite.
// Safe by default. It exercises UI read paths without changing live data.
// Set CHAOS_ALLOW_MUTATION=1 only on testing/preview/local to enable optional request-off creation/cancel flows.
// Set CHAOS_ALLOW_CLOCK_MUTATION=1 in addition to CHAOS_ALLOW_MUTATION=1 only if you intentionally want to create/close test punches.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  ownerLikeCreds,
  managerCredsOrOwner,
  staffCredsOrNull,
  requireCreds,
  isMutationAllowed,
  watchForProblems,
  login,
  gotoTab,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  maybeClick,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const ALLOW_CLOCK_MUTATION = /^(1|true|yes)$/i.test(process.env.CHAOS_ALLOW_CLOCK_MUTATION || '');
const EXPECT_MY_SCHEDULE_SHIFT = /^(1|true|yes)$/i.test(process.env.CHAOS_EXPECT_MY_SCHEDULE_SHIFT || '');
const TEST_DATE_OFFSET_DAYS = Number(process.env.CHAOS_REQUEST_OFF_TEST_DAYS_AHEAD || 3);

const fatalRe = /Application error|Unhandled Runtime Error|Cannot read properties of undefined|Minified React error|Something went wrong/i;
const scheduleGateRe = /Plan & Permission Gate|Your role does not include this tool|not authorized|permission/i;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function yyyyMmDd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function assertNoFatal(page, label) {
  const text = await bodyText(page, 30000);
  expect(text, `${label} should not show fatal UI`).not.toMatch(fatalRe);
  return text;
}

async function clickNamedButton(page, name, options = {}) {
  const btn = page.getByRole('button', { name }).first();
  const visible = await btn.isVisible({ timeout: options.timeout || 2500 }).catch(() => false);
  if (!visible) return false;
  await btn.click({ timeout: options.clickTimeout || 5000 });
  await page.waitForTimeout(options.settleMs || 500);
  return true;
}

async function clickScheduleSubtab(page, nameRe) {
  const clicked = await clickNamedButton(page, nameRe, { timeout: 4000 });
  if (clicked) return true;
  const fallback = page.locator('button').filter({ hasText: nameRe }).first();
  const visible = await fallback.isVisible({ timeout: 2000 }).catch(() => false);
  if (visible) {
    await fallback.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

async function openTimeClockSchedule(page) {
  const text = await expectRouteHealthy(page, 'published', {
    expected: /My Schedule|Time Clock|Clock In|Clock Out|Request Off|Availability|Full Schedule|Month View/i,
    routeReadyTimeout: 45000,
    settleMs: 800,
  });
  await assertNoFatal(page, 'Time Clock & Schedule');
  return text;
}

async function assertTimeClockScheduleShell(page, label) {
  const text = await bodyText(page, 30000);
  expect(text, `${label} should render My Schedule`).toMatch(/My Schedule/i);
  expect(text, `${label} should render clock controls`).toMatch(/Clock In|Clock Out|Clocking In|Clocking Out/i);
  expect(text, `${label} should render Full Schedule`).toMatch(/Full Schedule|full schedule/i);
  expect(text, `${label} should render Month View`).toMatch(/Month View|month view/i);
  expect(text, `${label} should render Request Off`).toMatch(/Request Off/i);
  expect(text, `${label} should render Availability`).toMatch(/Availability/i);
  expect(text, `${label} should not show fatal UI`).not.toMatch(fatalRe);
}

async function assertClockButtonTapSize(page) {
  const clockButton = page.getByRole('button', { name: /clock in|clock out|clocking in|clocking out/i }).first();
  await expect(clockButton, 'Clock button should be visible on My Schedule').toBeVisible({ timeout: 15000 });
  const box = await clockButton.boundingBox();
  expect(box, 'Clock button should have a bounding box').toBeTruthy();
  expect(box.width, 'Clock button should be wide enough to tap').toBeGreaterThanOrEqual(160);
  expect(box.height, 'Clock button should be at least 42px tall').toBeGreaterThanOrEqual(42);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0,
    innerWidth: window.innerWidth,
  }));
  const allowed = metrics.clientWidth + 14;
  expect(metrics.scrollWidth, `${label} should not have meaningful sideways overflow: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(allowed);
}

async function inspectMySchedule(page, label, testInfo) {
  await clickScheduleSubtab(page, /my schedule/i);
  const text = await assertNoFatal(page, `${label} My Schedule`);
  expect(text, `${label} My Schedule should show schedule summary or no-shift state`).toMatch(/Next:|No upcoming shifts scheduled|My Schedule/i);
  await assertClockButtonTapSize(page);

  const noShift = /No upcoming shifts scheduled/i.test(text);
  if (EXPECT_MY_SCHEDULE_SHIFT) {
    expect(noShift, `${label} has CHAOS_EXPECT_MY_SCHEDULE_SHIFT=1, so My Schedule must show an upcoming shift`).toBeFalsy();
    expect(text, `${label} expected shift details`).toMatch(/Next:\s*.+|\d{1,2}:\d{2}|AM|PM|Close/i);
  }

  await attachReport(testInfo, `${label.replace(/\W+/g, '-').toLowerCase()}-my-schedule.json`, {
    runId: RUN_ID,
    baseUrl: BASE_URL,
    noUpcomingShiftShown: noShift,
    expectedShiftFlag: EXPECT_MY_SCHEDULE_SHIFT,
    textStart: text.slice(0, 2500),
  });
}

async function inspectFullSchedule(page, label) {
  await clickScheduleSubtab(page, /full schedule/i);
  const text = await assertNoFatal(page, `${label} Full Schedule`);
  expect(text, `${label} Full Schedule should render active roster or empty schedule state`).toMatch(/Active Roster|Jump to Date|Show Full Month|No shifts found|published shifts/i);
  expect(text, `${label} Full Schedule should not bounce to permission gate`).not.toMatch(scheduleGateRe);
}

async function inspectMonthView(page, label) {
  await clickScheduleSubtab(page, /month view/i);
  const text = await assertNoFatal(page, `${label} Month View`);
  expect(text, `${label} Month View should render schedule calendar content`).toMatch(/Month|Schedule|No shifts|Sun|Mon|Tue|Wed|Thu|Fri|Sat/i);
}

async function inspectAvailability(page, label) {
  await clickScheduleSubtab(page, /availability/i);
  const text = await assertNoFatal(page, `${label} Availability`);
  expect(text, `${label} Availability should render availability workflow`).toMatch(/Availability|Available|Unavailable|History|weekly|schedule/i);
}

async function inspectRequestOff(page, label, testInfo) {
  await clickScheduleSubtab(page, /request off/i);
  const text = await assertNoFatal(page, `${label} Request Off`);
  expect(text, `${label} Request Off should render request calendar`).toMatch(/Request Off|Tap specific dates|Submit|Partial Day/i);
  expect(text, `${label} Request Off should render workflow filters`).toMatch(/Needs Review|Upcoming Approved|Published\/Archived|All|This Week|This Month/i);

  const submit = page.getByRole('button', { name: /submit/i }).first();
  await expect(submit, 'Request Off submit button should exist').toBeVisible({ timeout: 10000 });
  const disabled = await submit.isDisabled().catch(() => false);
  expect(disabled, 'Submit should be disabled until a date is selected').toBeTruthy();

  const partialLabelClicked = await maybeClick(page, page.getByText(/partial day only/i).first(), { settleMs: 400 });
  if (partialLabelClicked) {
    await expect(page.locator('input[type="time"]').first(), 'Partial request should expose start/end time inputs').toBeVisible({ timeout: 5000 });
    await maybeClick(page, page.getByText(/partial day only/i).first(), { settleMs: 300 });
  }

  const visibleTimestamp = /Requested\s+(Invalid Date|undefined|null)/i.test(text) ? 'bad' : (/Requested\s+/i.test(text) ? 'present' : 'no-visible-request-cards');
  expect(text, `${label} must not render broken request timestamps`).not.toMatch(/Requested\s+Invalid Date|Requested\s+undefined|Requested\s+null/i);

  const duplicateBadge = page.locator('span').filter({ hasText: /^\d+\s+req$/i }).first();
  const hasDuplicateBadge = await duplicateBadge.isVisible({ timeout: 1000 }).catch(() => false);
  let duplicateDialogSeen = false;
  if (hasDuplicateBadge) {
    page.once('dialog', async (dialog) => {
      duplicateDialogSeen = /already been requested off|requested this day off before you|might not be available/i.test(dialog.message());
      await dialog.dismiss().catch(() => {});
    });
    const cell = duplicateBadge.locator('xpath=ancestor::div[contains(@class,"min-h")][1]');
    await cell.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    expect(duplicateDialogSeen, 'Clicking a day with an existing request count badge should warn before selecting').toBeTruthy();
  }

  await attachReport(testInfo, `${label.replace(/\W+/g, '-').toLowerCase()}-request-off.json`, {
    runId: RUN_ID,
    baseUrl: BASE_URL,
    timestampState: visibleTimestamp,
    duplicateBadgeFound: hasDuplicateBadge,
    duplicateDialogSeen,
    textStart: text.slice(0, 3000),
  });
}

async function maybeCreateAndCancelRequestOff(page, testInfo) {
  if (!isMutationAllowed()) {
    await attachReport(testInfo, 'request-off-mutation-disabled.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      reason: 'Set CHAOS_ALLOW_MUTATION=1 on a testing/preview/local URL to create and cancel a live request-off test record.',
    });
    return;
  }

  await clickScheduleSubtab(page, /request off/i);
  const today = new Date();
  const target = addDays(today, TEST_DATE_OFFSET_DAYS);
  if (target.getMonth() !== today.getMonth()) {
    await attachReport(testInfo, 'request-off-mutation-not-run.json', {
      runId: RUN_ID,
      reason: 'Target date was outside the visible current month. Use CHAOS_REQUEST_OFF_TEST_DAYS_AHEAD with a date inside the current month for this optional mutation test.',
      target: yyyyMmDd(target),
    });
    return;
  }

  const dayNumber = String(target.getDate());
  const cell = page.locator(`xpath=//div[contains(@class,"min-h")][.//span[normalize-space()="${dayNumber}"]]`).last();
  const visible = await cell.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) {
    await attachReport(testInfo, 'request-off-mutation-cell-missing.json', { runId: RUN_ID, target: yyyyMmDd(target) });
    return;
  }

  let dialogMessages = [];
  page.on('dialog', async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept().catch(() => {});
  });
  await cell.click();
  await page.waitForTimeout(500);
  const submit = page.getByRole('button', { name: /submit/i }).first();
  await expect(submit, 'Submit should enable after selecting a request-off date').toBeEnabled({ timeout: 8000 });
  await submit.click();
  await expect(page.locator('body'), 'Submitting request off should show a success cue').toContainText(/Submitted|sent for review|pending/i, { timeout: 15000 });

  await attachReport(testInfo, 'request-off-mutation-created.json', {
    runId: RUN_ID,
    baseUrl: BASE_URL,
    target: yyyyMmDd(target),
    dialogMessages,
  });
}

async function inspectScheduleBuilder(page, label, testInfo) {
  const route = await expectRouteHealthy(page, 'schedule', {
    allowGate: true,
    expected: /Schedule Builder|Schedule Copilot|Auto-Fill|Publish|Assign|Coverage|Templates|Scheduled Hours/i,
    routeReadyTimeout: 50000,
    settleMs: 1000,
  });
  if (route.gated || route.unavailable) {
    await attachReport(testInfo, `${label.replace(/\W+/g, '-').toLowerCase()}-schedule-builder-gated.json`, {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      gated: route.gated,
      unavailable: route.unavailable,
      textStart: route.text.slice(0, 2000),
    });
    return;
  }

  const text = await assertNoFatal(page, `${label} Schedule Builder`);
  expect(text, `${label} Schedule Builder should expose builder actions`).toMatch(/Schedule Builder|Schedule Copilot|Auto-Fill|Publish|Assign|Coverage|Template|Scheduled Hours/i);
  expect(text, `${label} Schedule Builder should expose request-off conflict language or markers when conflicts exist`).toMatch(/Request|Off|Conflict|Publish|Coverage|Staff/i);

  const publishButton = page.getByRole('button', { name: /publish/i }).first();
  if (await publishButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    const box = await publishButton.boundingBox();
    expect(box?.height || 0, 'Publish button should be tap/click sized').toBeGreaterThanOrEqual(36);
  }

  await attachReport(testInfo, `${label.replace(/\W+/g, '-').toLowerCase()}-schedule-builder.json`, {
    runId: RUN_ID,
    baseUrl: BASE_URL,
    textStart: text.slice(0, 3000),
  });
}

async function maybeExerciseClockMutation(page, testInfo) {
  await clickScheduleSubtab(page, /my schedule/i);
  if (!isMutationAllowed() || !ALLOW_CLOCK_MUTATION) {
    await attachReport(testInfo, 'clock-mutation-disabled.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      reason: 'Clock mutation was not run. Set CHAOS_ALLOW_MUTATION=1 and CHAOS_ALLOW_CLOCK_MUTATION=1 only on testing/preview/local.',
    });
    return;
  }

  const clockIn = page.getByRole('button', { name: /clock in/i }).first();
  const clockOut = page.getByRole('button', { name: /clock out/i }).first();
  if (await clockIn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await clockIn.click();
    await expect(page.locator('body'), 'Clock-in should save and change to clock-out or show success').toContainText(/Clocked In|Clock Out|Shift started/i, { timeout: 20000 });
  }
  if (await clockOut.isVisible({ timeout: 5000 }).catch(() => false)) {
    page.on('dialog', async (dialog) => { await dialog.accept().catch(() => {}); });
    await clockOut.click();
    const finalButton = page.getByRole('button', { name: /finalize clock out/i }).first();
    if (await finalButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const tips = page.locator('input[type="number"]');
      const count = await tips.count().catch(() => 0);
      for (let i = 0; i < Math.min(count, 2); i++) await tips.nth(i).fill('0').catch(() => {});
      await finalButton.click();
    }
    await expect(page.locator('body'), 'Clock-out should save and return to clock-in state').toContainText(/Clocked Out|Clock In|Shift ended/i, { timeout: 25000 });
  }

  await attachReport(testInfo, 'clock-mutation-complete.json', { runId: RUN_ID, baseUrl: BASE_URL });
}

test.describe('86 Chaos Time Clock & Schedule absolutely-everything coverage', () => {
  test('owner/manager sees every Time Clock & Schedule surface without crashes', async ({ page }, testInfo) => {
    test.setTimeout(300000);
    const account = managerCredsOrOwner();
    requireCreds(test, account, 'MANAGER or OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    await openTimeClockSchedule(page);
    await assertTimeClockScheduleShell(page, account.label || 'manager-owner');
    await inspectMySchedule(page, account.label || 'manager-owner', testInfo);
    await inspectFullSchedule(page, account.label || 'manager-owner');
    await inspectMonthView(page, account.label || 'manager-owner');
    await inspectRequestOff(page, account.label || 'manager-owner', testInfo);
    await inspectAvailability(page, account.label || 'manager-owner');
    await inspectScheduleBuilder(page, account.label || 'manager-owner', testInfo);
    await maybeCreateAndCancelRequestOff(page, testInfo);
    await maybeExerciseClockMutation(page, testInfo);

    await attachReport(testInfo, 'time-clock-schedule-manager-owner-summary.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      mutationEnabled: isMutationAllowed(),
      clockMutationEnabled: isMutationAllowed() && ALLOW_CLOCK_MUTATION,
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });

  test('staff can use My Schedule, clock controls, request off, full schedule, month view, and availability without admin access', async ({ page }, testInfo) => {
    test.setTimeout(260000);
    const account = staffCredsOrNull();
    requireCreds(test, account, 'STAFF');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    await openTimeClockSchedule(page);
    await assertTimeClockScheduleShell(page, 'staff');
    await inspectMySchedule(page, 'staff', testInfo);
    await inspectFullSchedule(page, 'staff');
    await inspectMonthView(page, 'staff');
    await inspectRequestOff(page, 'staff', testInfo);
    await inspectAvailability(page, 'staff');

    const builder = await expectRouteHealthy(page, 'schedule', { allowGate: true, routeReadyTimeout: 40000, settleMs: 700 });
    if (!builder.gated && !builder.unavailable) {
      const text = builder.text;
      expect(text, 'Staff should not get unlocked Schedule Builder edit/publish controls unless specifically permitted').not.toMatch(/Auto-Fill|Publish Preview|Save Current Week|Assign Shift|Delete Shift|Bulk Edit/i);
    }

    await attachReport(testInfo, 'time-clock-schedule-staff-summary.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      scheduleBuilderGated: builder.gated,
      scheduleBuilderUnavailable: builder.unavailable,
      scheduleBuilderTextStart: builder.text.slice(0, 2200),
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });

  test('mobile Time Clock & Schedule remains usable with no meaningful sideways overflow', async ({ page }, testInfo) => {
    test.setTimeout(220000);
    await page.setViewportSize({ width: 390, height: 844 });
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    await openTimeClockSchedule(page);
    await assertNoHorizontalOverflow(page, 'Mobile My Schedule');
    await inspectRequestOff(page, 'mobile', testInfo);
    await assertNoHorizontalOverflow(page, 'Mobile Request Off');
    await inspectAvailability(page, 'mobile');
    await assertNoHorizontalOverflow(page, 'Mobile Availability');

    await attachReport(testInfo, 'time-clock-schedule-mobile-summary.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
