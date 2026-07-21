// 86 Chaos Financials + Back Office + Schedule Playwright checks
// Fixed: closes onboarding/tour modals before clicking page tools.
const { test, expect } = require('@playwright/test');
require('dotenv').config();

const APP_URL = String(
  process.env.APP_URL ||
    process.env.TEST_APP_URL ||
    process.env.PLAYWRIGHT_APP_URL ||
    'https://cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app'
).replace(/\/+$/, '');

const ALLOW_WRITES = String(process.env.PLAYWRIGHT_ALLOW_SAFE_WRITES || '').toLowerCase() === 'true';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function moneyLike(text) {
  return /\$\s*\d|\d+\.\d{2}|\d+%/i.test(String(text || ''));
}

function ignoreRequestFailure(url, failure) {
  const u = String(url || '');
  const f = String(failure || '');

  // Fast Playwright navigation cancels Firebase long-polling, Vercel internals,
  // images, and same-page tab requests. Those are not app crashes if the page renders.
  if (f === 'net::ERR_ABORTED') return true;
  if (u.includes('/.well-known/vercel/jwe')) return true;
  return false;
}

function ignoreConsoleNoise(text) {
  const t = String(text || '');
  if (/ResizeObserver loop completed with undelivered notifications/i.test(t)) return true;
  if (/Failed to load resource: the server responded with a status of 403/i.test(t)) return true;
  return false;
}

function ignoreHttpResponse(url, status) {
  const u = String(url || '');
  if (status === 403 && u.includes('/.well-known/vercel/jwe')) return true;
  if (status === 404 && /favicon\.(ico|png|svg)$/i.test(u)) return true;
  return false;
}

function isCriticalHttpUrl(url) {
  const u = String(url || '');
  return (
    u.includes('/api/') ||
    u.includes('identitytoolkit.googleapis.com') ||
    u.includes('securetoken.googleapis.com') ||
    u.includes('firestore.googleapis.com') ||
    u.includes('firebasestorage.googleapis.com')
  );
}

function watchForProblems(page, problems) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (ignoreConsoleNoise(text)) return;
    problems.push({ type: 'console-error', text, url: page.url() });
  });

  page.on('pageerror', (error) => {
    problems.push({ type: 'page-crash', text: error.message, url: page.url() });
  });

  page.on('requestfailed', (request) => {
    const requestUrl = request.url();
    const failure = request.failure()?.errorText || '';
    if (ignoreRequestFailure(requestUrl, failure)) return;
    problems.push({ type: 'request-failed', requestUrl, failure, pageUrl: page.url() });
  });

  page.on('response', (response) => {
    const status = response.status();
    const requestUrl = response.url();
    if (ignoreHttpResponse(requestUrl, status)) return;
    if (status >= 500 || (status >= 400 && isCriticalHttpUrl(requestUrl))) {
      problems.push({ type: 'http-error', status, requestUrl, pageUrl: page.url() });
    }
  });

  page.on('dialog', async (dialog) => {
    // Auto-cancel anything that would mutate data, such as Publish Schedule.
    problems.push({ type: 'dialog-blocked', message: dialog.message(), url: page.url() });
    await dialog.dismiss().catch(() => {});
  });
}

async function login(page, email, password) {
  await page.goto(`${APP_URL}/?tab=today`, { waitUntil: 'domcontentloaded' });

  const emailBox = page.getByRole('textbox', { name: /email address/i });
  if (await emailBox.isVisible({ timeout: 15000 }).catch(() => false)) {
    await emailBox.fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);
    await page.getByRole('button', { name: /unlock system/i }).click();

    const appShell = page.locator('main');
    const loginError = page.getByText(
      /firebase login timed out|firebase:\s*error|auth\/|wrong password|user not found|invalid credential|requests-from-referer|network-request-failed|permission-denied|workspace|membership/i
    );

    await expect(appShell.or(loginError).first()).toBeVisible({ timeout: 70000 });

    if (await loginError.isVisible().catch(() => false)) {
      throw new Error(`Login failed: ${await loginError.innerText()}`);
    }
  }

  await expect(page.locator('main')).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(750);
  await closeAnyModal(page);
}

async function gotoTab(page, tab) {
  await page.goto(`${APP_URL}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible({ timeout: 45000 });
  await page.waitForTimeout(1200);
  await closeAnyModal(page);
}

async function getBodyText(page) {
  return await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
}

async function assertAppPageAvailable(page, problems, label) {
  const bodyText = await getBodyText(page);
  if (/This page is not available/i.test(bodyText)) {
    problems.push({ type: 'unavailable-page', label, url: page.url(), text: bodyText.slice(0, 500) });
  }
  await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
}

async function expectAnyText(page, regexes, label, problems) {
  const bodyText = await getBodyText(page);
  const matched = regexes.some((regex) => regex.test(bodyText));
  if (!matched) {
    problems.push({
      type: 'expected-text-missing',
      label,
      expected: regexes.map((r) => String(r)),
      visibleTextStart: bodyText.slice(0, 800),
      url: page.url(),
    });
  }
}

async function clickMainButton(page, label, options = {}) {
  await closeAnyModal(page);
  const exact = options.exact !== false;
  const timeout = options.timeout || 7000;
  const re = exact ? new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`, 'i') : new RegExp(escapeRegExp(label), 'i');
  const button = page.locator('main').getByRole('button', { name: re }).first();
  await expect(button, `Button not found: ${label}`).toBeVisible({ timeout });
  await button.click({ timeout });
  await page.waitForTimeout(options.wait || 900);
}

async function clickVisibleTextButtonIfPresent(page, label, report) {
  await closeAnyModal(page);
  const re = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`, 'i');
  const button = page.locator('main').getByRole('button', { name: re }).first();
  const visible = await button.isVisible({ timeout: 2500 }).catch(() => false);
  if (!visible) {
    report.push({ label, clicked: false, reason: 'not visible or not available on this tier/permission' });
    return false;
  }
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await button.click({ timeout: 7000 });
  await page.waitForTimeout(900);
  report.push({ label, clicked: true, url: page.url() });
  return true;
}

async function closeAnyModal(page) {
  // The app can show onboarding/tour modals after login or route changes.
  // They are real UI, but they block clicks in automated tests. Close them
  // before interacting with page tools so tests measure the tool, not the tour.
  for (let attempt = 0; attempt < 6; attempt++) {
    const dialogVisible = await page.locator('[role="dialog"], .chaos-modal-backdrop').first().isVisible({ timeout: 500 }).catch(() => false);
    if (!dialogVisible) break;

    const closePatterns = [
      /Close Employee Quick Start/i,
      /Close Manager Quick Start/i,
      /Skip for now/i,
      /^Close$/i,
      /^Cancel$/i,
      /^Back$/i,
      /Hide/i,
    ];

    let clicked = false;
    for (const pattern of closePatterns) {
      const button = page.getByRole('button', { name: pattern }).first();
      if (await button.isVisible({ timeout: 500 }).catch(() => false)) {
        await button.click({ timeout: 2000, force: true }).catch(() => {});
        clicked = true;
        await page.waitForTimeout(350);
        break;
      }
    }

    if (!clicked) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(350);
    }
  }
}

async function assertDownloadFromButton(page, buttonName, problems, label) {
  await closeAnyModal(page);
  const button = page.locator('main').getByRole('button', { name: new RegExp(escapeRegExp(buttonName), 'i') }).first();
  const visible = await button.isVisible({ timeout: 2500 }).catch(() => false);
  if (!visible) return false;

  const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await button.click({ timeout: 7000 }).catch((error) => {
    problems.push({ type: 'button-click-failed', label, buttonName, message: error.message, url: page.url() });
  });
  const download = await downloadPromise;
  if (download) {
    const suggestedFilename = download.suggestedFilename();
    return { downloaded: true, suggestedFilename };
  }
  return { downloaded: false, reason: 'button clicked but no download event fired' };
}

const financialSubtabs = [
  { label: 'Overview', expects: [/Financial Center|Overview|Net Sales|Prime Cost|Estimated Profit|Labor/i] },
  { label: 'Daily Close', expects: [/Daily Close|Gross Sales|Net Sales|Cash Sales|Card Sales|Deposit|Manager/i] },
  { label: 'Sales', expects: [/Sales|Gross|Net|Cash|Card|Deposit|Food|Liquor|Beer/i] },
  { label: 'Labor & Payroll', expects: [/Labor & Payroll|Punch Fixer|Timesheet Review|Payroll|Hours|Tips/i] },
  { label: 'Tips', expects: [/Tips|Cash Tips|Credit Tips|Total Tips|Tip Report/i] },
  { label: 'COGS & Vendors', expects: [/COGS|Vendors|Invoice Spend|Food|Beverage|Unreviewed invoices/i] },
  { label: 'Expenses', expects: [/Expenses|Add Expense|Vendor|Payee|Category|Amount/i] },
  { label: 'P&L', expects: [/P&L|Gross Sales|Net Sales|Gross Profit|Net Profit|operational P&L/i] },
  { label: 'Targets', expects: [/Targets|Financial Targets|Labor %|Food %|Prime %|Warning Thresholds/i] },
  { label: 'Reports', expects: [/Reports|Owner Financial Report|Tip Report|Payroll Detail|Daily Close Review|COGS/i] },
];

const backOfficeSubtabs = [
  { label: 'Dashboard', expects: [/Back Office Suite|Net Sales|Deposits|Approvals|QuickBooks|Guardrails/i] },
  { label: 'Deposits', expects: [/Deposit|Cash Sales|Card Sales|Drawer|Variance|Closed By/i] },
  { label: 'Documents', expects: [/Document|Vault|License|Permit|Insurance|Expires/i] },
  { label: 'Approvals', expects: [/Approval|Queue|Pending|Reviewed|Approve|Dismiss/i] },
  { label: 'Alerts', expects: [/Alert|Admin|Owner|System Admin|Reviewed|Dismiss/i] },
  { label: 'QuickBooks', expects: [/QuickBooks|Bill Draft|Vendor Match|Vendor Credit|Sync Health|Mapping/i] },
  { label: 'Reports', expects: [/Owner Summary|Back Office CSV|QuickBooks Prep CSV|Financial Center/i] },
];

const scheduleDisplaySubtabs = [
  { label: 'My Schedule', expects: [/My Schedule|Next:|No upcoming shifts|Trade Board|Clock/i] },
  { label: 'Full Schedule', expects: [/Full Schedule|Published|Tap a day|Staff|Schedule/i] },
  { label: 'Month View', expects: [/Month View|Schedule|No shifts|Published/i] },
  { label: 'Request Off', expects: [/Request|Time Off|Request-Off|Needs Review|Availability/i] },
  { label: 'Availability', expects: [/Availability|weekly|effective|available|unavailable/i] },
  { label: 'Schedule Builder', expects: [/Schedule Builder|Select Staff|Assign|Auto-Fill|Publish|Schedule Publishing Window/i] },
];

test.describe('86 Chaos financial tools and schedule builder automated checks', () => {
  test('Financial Center opens every financial tool without crashes', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const problems = [];
    const visited = [];

    watchForProblems(page, problems);
    await login(page, requireEnv('TEST_EMAIL'), requireEnv('TEST_PASSWORD'));
    await gotoTab(page, 'financials');
    await assertAppPageAvailable(page, problems, 'Financials route');

    await expectAnyText(page, [/Financials|Financial Center|Daily Close|Labor|Reports/i], 'Financials shell', problems);

    for (const tab of financialSubtabs) {
      const clicked = await clickVisibleTextButtonIfPresent(page, tab.label, visited);
      if (!clicked) continue;
      await assertAppPageAvailable(page, problems, `Financials > ${tab.label}`);
      await expectAnyText(page, tab.expects, `Financials > ${tab.label}`, problems);
    }

    // Safe export checks. These do not save restaurant data.
    await clickVisibleTextButtonIfPresent(page, 'Reports', visited);
    const reportText = await getBodyText(page);
    if (/Owner Financial Report/i.test(reportText)) {
      const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
      await page.locator('main').getByRole('button', { name: /Owner Financial Report/i }).first().click({ timeout: 7000 }).catch((error) => {
        problems.push({ type: 'owner-report-click-failed', message: error.message, url: page.url() });
      });
      const popup = await popupPromise;
      if (popup) await popup.close().catch(() => {});
    }

    await testInfo.attach('86chaos-financial-center-report.json', {
      body: JSON.stringify({ visited, problems }, null, 2),
      contentType: 'application/json',
    });

    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });

  test('Back Office and QuickBooks owner tools load safely', async ({ page }, testInfo) => {
    test.setTimeout(220000);
    const problems = [];
    const visited = [];

    watchForProblems(page, problems);
    await login(page, requireEnv('TEST_EMAIL'), requireEnv('TEST_PASSWORD'));
    await gotoTab(page, 'back-office');
    await assertAppPageAvailable(page, problems, 'Back Office route');

    const bodyText = await getBodyText(page);
    if (/Upgrade|not included|Owner Pro|Locked/i.test(bodyText) && !/Back Office Suite/i.test(bodyText)) {
      await testInfo.attach('86chaos-back-office-locked.json', {
        body: JSON.stringify({ locked: true, text: bodyText.slice(0, 1000) }, null, 2),
        contentType: 'application/json',
      });
      test.skip(true, 'Back Office is locked for this test user/plan. Use an Owner Pro or Founder Beta owner/admin account.');
    }

    for (const tab of backOfficeSubtabs) {
      const clicked = await clickVisibleTextButtonIfPresent(page, tab.label, visited);
      if (!clicked) continue;
      await assertAppPageAvailable(page, problems, `Back Office > ${tab.label}`);
      await expectAnyText(page, tab.expects, `Back Office > ${tab.label}`, problems);
    }

    await clickVisibleTextButtonIfPresent(page, 'Reports', visited);
    const download = await assertDownloadFromButton(page, 'Back Office CSV', problems, 'Back Office CSV');
    if (download) visited.push({ label: 'Back Office CSV', download });

    await testInfo.attach('86chaos-back-office-quickbooks-report.json', {
      body: JSON.stringify({ visited, problems }, null, 2),
      contentType: 'application/json',
    });

    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });

  test('Schedule Builder and schedule views load without unsafe writes', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const problems = [];
    const visited = [];

    watchForProblems(page, problems);
    await login(page, requireEnv('TEST_EMAIL'), requireEnv('TEST_PASSWORD'));

    await gotoTab(page, 'schedule');
    await assertAppPageAvailable(page, problems, 'Schedule Builder route');
    await expectAnyText(page, [/Schedule Builder|Select Staff|Assign|Auto-Fill|Publish|Schedule Publishing Window/i], 'Schedule Builder shell', problems);

    // Verify basic controls exist, but do not publish or assign by default.
    const main = page.locator('main');
    const staffSelects = await main.locator('select').count();
    const timeInputs = await main.locator('input[type="time"]').count();
    const assignVisible = await main.getByRole('button', { name: /Assign/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const publishVisible = await main.getByRole('button', { name: /^Publish$/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    const autoFillVisible = await main.getByRole('button', { name: /Auto-Fill/i }).first().isVisible({ timeout: 3000 }).catch(() => false);

    visited.push({
      label: 'Schedule Builder controls',
      staffSelects,
      timeInputs,
      assignVisible,
      publishVisible,
      autoFillVisible,
    });

    if (staffSelects < 1) problems.push({ type: 'schedule-control-missing', control: 'staff select', url: page.url() });
    if (timeInputs < 2) problems.push({ type: 'schedule-control-missing', control: 'start/end time inputs', url: page.url() });
    if (!assignVisible) problems.push({ type: 'schedule-control-missing', control: 'Assign button', url: page.url() });
    if (!publishVisible) problems.push({ type: 'schedule-control-missing', control: 'Publish button', url: page.url() });
    if (!autoFillVisible) problems.push({ type: 'schedule-control-missing', control: 'Auto-Fill button', url: page.url() });

    // Open and close safe modals only. No saving, no publishing.
    if (autoFillVisible) {
      await closeAnyModal(page);
      await main.getByRole('button', { name: /Auto-Fill/i }).first().click({ timeout: 7000 });
      await expect(page.getByText(/Auto-Populate Schedule/i).first()).toBeVisible({ timeout: 7000 });
      await closeAnyModal(page);
      visited.push({ label: 'Auto-Fill modal', opened: true });
    }

    const editPresetsButton = main.locator('button[title="Edit Presets"]').first();
    if (await editPresetsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeAnyModal(page);
      await editPresetsButton.click({ timeout: 7000 });
      await expect(page.getByText(/Manage Custom Shifts/i).first()).toBeVisible({ timeout: 7000 });
      await closeAnyModal(page);
      visited.push({ label: 'Custom shift presets modal', opened: true });
    }

    // Published schedule screen, full schedule, month view, time off, availability.
    await gotoTab(page, 'published');
    await assertAppPageAvailable(page, problems, 'Published schedule route');
    for (const tab of scheduleDisplaySubtabs) {
      const clicked = await clickVisibleTextButtonIfPresent(page, tab.label, visited);
      if (!clicked) continue;
      await assertAppPageAvailable(page, problems, `Schedule > ${tab.label}`);
      await expectAnyText(page, tab.expects, `Schedule > ${tab.label}`, problems);
    }

    await testInfo.attach('86chaos-schedule-builder-report.json', {
      body: JSON.stringify({ visited, problems, allowWrites: ALLOW_WRITES }, null, 2),
      contentType: 'application/json',
    });

    const seriousProblems = problems.filter((p) => p.type !== 'dialog-blocked');
    expect(seriousProblems, JSON.stringify(seriousProblems, null, 2)).toEqual([]);
  });

  test('staff account cannot see owner/admin financial and schedule tools', async ({ page }, testInfo) => {
    test.setTimeout(160000);
    const staffEmail = process.env.STAFF_EMAIL;
    const staffPassword = process.env.STAFF_PASSWORD;
    test.skip(!staffEmail || !staffPassword, 'Skipped because STAFF_EMAIL and STAFF_PASSWORD are blank in .env');

    const problems = [];
    const checked = [];
    watchForProblems(page, problems);
    await login(page, staffEmail, staffPassword);

    await gotoTab(page, 'back-office');
    let text = await getBodyText(page);
    checked.push({ route: 'back-office', textStart: text.slice(0, 500) });
    expect(text).not.toMatch(/QuickBooks Integration Hub|Document Vault|Owner Summary|Back Office Suite/i);

    await gotoTab(page, 'schedule');
    text = await getBodyText(page);
    checked.push({ route: 'schedule', textStart: text.slice(0, 500) });
    expect(text).not.toMatch(/Schedule Builder|Auto-Fill|Publish|Assign \(/i);

    await gotoTab(page, 'financials');
    text = await getBodyText(page);
    checked.push({ route: 'financials', textStart: text.slice(0, 500) });
    expect(text).not.toMatch(/Financial Targets|P&L Snapshot|QuickBooks|Save Targets/i);

    await testInfo.attach('86chaos-staff-financial-schedule-permission-report.json', {
      body: JSON.stringify({ checked, problems }, null, 2),
      contentType: 'application/json',
    });

    const seriousProblems = problems.filter((p) => p.type !== 'unavailable-page');
    expect(seriousProblems, JSON.stringify(seriousProblems, null, 2)).toEqual([]);
  });
});
