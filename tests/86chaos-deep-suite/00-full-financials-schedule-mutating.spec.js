// 86 Chaos FULL Financials + Back Office + Schedule Builder test (fixed schedule selection + static asset noise)
// WARNING: This spec MUTATES TEST DATA. It creates/saves test records and attempts schedule assign/publish flows.
// Use only on testing/preview/local environments, never production.
// Run:
//   npx.cmd playwright test tests/86chaos-full-financials-schedule-mutating.spec.js --project=chromium --headed --workers=1

const { test, expect } = require('@playwright/test');
require('dotenv').config();

const APP_URL = String(
  process.env.APP_URL ||
    process.env.TEST_APP_URL ||
    process.env.PLAYWRIGHT_APP_URL ||
    'https://cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app'
).replace(/\/+$/, '');

const RUN_ID = `PW-FULL-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const TEST_MONTH = TODAY.slice(0, 7);
const IS_MUTATION_ALLOWED_URL = /localhost|127\.0\.0\.1|vercel\.app|preview|testing|test|chaos-test/i.test(APP_URL);
const ALLOW_PROD_MUTATIONS = String(process.env.PLAYWRIGHT_ALLOW_PROD_MUTATIONS || '').toLowerCase() === 'true';

// Deterministic numbers used for math checks. Keep them weird enough that they are easy to spot.
const FINANCIAL_FIXTURE = {
  grossSales: 1846.25,
  discounts: 46.25,
  refunds: 0,
  comps: 25,
  netSales: 1775.00,
  cashSales: 431.25,
  cardSales: 1343.75,
  cashTips: 32.50,
  creditTips: 147.50,
  laborCost: 486.25,
  foodCost: 568.00,
  beverageCost: 212.50,
  supplyCost: 87.25,
  otherExpenses: 144.00,
  expectedCashDrawer: 431.25,
  actualCashDrawer: 430.25,
  depositAmount: 430.25,
};
FINANCIAL_FIXTURE.primeCost = round2(FINANCIAL_FIXTURE.laborCost + FINANCIAL_FIXTURE.foodCost + FINANCIAL_FIXTURE.beverageCost);
FINANCIAL_FIXTURE.laborPct = pct(FINANCIAL_FIXTURE.laborCost, FINANCIAL_FIXTURE.netSales);
FINANCIAL_FIXTURE.foodPct = pct(FINANCIAL_FIXTURE.foodCost, FINANCIAL_FIXTURE.netSales);
FINANCIAL_FIXTURE.primePct = pct(FINANCIAL_FIXTURE.primeCost, FINANCIAL_FIXTURE.netSales);
FINANCIAL_FIXTURE.cashVariance = round2(FINANCIAL_FIXTURE.actualCashDrawer - FINANCIAL_FIXTURE.expectedCashDrawer);
FINANCIAL_FIXTURE.estimatedProfit = round2(
  FINANCIAL_FIXTURE.netSales -
    FINANCIAL_FIXTURE.primeCost -
    FINANCIAL_FIXTURE.supplyCost -
    FINANCIAL_FIXTURE.otherExpenses
);

const SCHEDULE_FIXTURE = {
  startTime: '15:15',
  endTime: '20:45',
  expectedHours: 5.5,
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function pct(part, whole) {
  if (!Number(whole)) return 0;
  return round2((Number(part) / Number(whole)) * 100);
}

function money(value) {
  const n = Number(value);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function moneyNoCents(value) {
  const n = Number(value);
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function parseMoney(value) {
  const match = String(value || '').match(/-?\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/);
  if (!match) return null;
  const sign = /^\s*-/.test(String(value || '')) ? -1 : 1;
  return sign * Number(match[1].replace(/,/g, ''));
}

function parsePercent(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?\s*%/);
  if (!match) return null;
  return Number(match[0].replace('%', ''));
}

function approx(actual, expected, tolerance = 0.75) {
  if (actual == null || Number.isNaN(actual)) return false;
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function safeRegexText(parts) {
  return new RegExp(parts.map((p) => String(p)).join('|'), 'i');
}

function criticalUrl(url) {
  const u = String(url || '');
  return (
    u.includes('/api/') ||
    u.includes('identitytoolkit.googleapis.com') ||
    u.includes('securetoken.googleapis.com') ||
    u.includes('firestore.googleapis.com') ||
    u.includes('firebasestorage.googleapis.com')
  );
}

function ignoreRequestFailure(url, failure) {
  const u = String(url || '');
  const f = String(failure || '');
  const isStaticAsset = /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)(?:\?|$)/i.test(u);
  if (f === 'net::ERR_ABORTED') return true;
  if (u.includes('/.well-known/vercel/jwe')) return true;
  if (u.includes('/google.firestore.v1.Firestore/Listen/channel')) return true;
  if (u.includes('/google.firestore.v1.Firestore/Write/channel') && f === 'net::ERR_ABORTED') return true;
  if (/google\.com\/images\/cleardot\.gif/i.test(u) && (f === 'net::ERR_ABORTED' || f === 'csp')) return true;
  // Static image/font hiccups should not fail a business-logic audit. API/Auth/Firestore failures still fail.
  if (isStaticAsset && /ERR_CONNECTION_RESET|ERR_ABORTED|ERR_NETWORK_CHANGED|ERR_TIMED_OUT/i.test(f)) return true;
  return false;
}

function ignoreConsoleNoise(text) {
  const t = String(text || '');
  if (/ResizeObserver loop/i.test(t)) return true;
  if (/Failed to load resource: the server responded with a status of 403/i.test(t)) return true;
  if (/Failed to load resource:\s*net::ERR_CONNECTION_RESET/i.test(t)) return true;
  if (/\.well-known\/vercel\/jwe/i.test(t)) return true;
  return false;
}

function ignoreHttpResponse(url, status) {
  const u = String(url || '');
  if (status === 403 && u.includes('/.well-known/vercel/jwe')) return true;
  if (status === 404 && /favicon\.(ico|png|svg)$/i.test(u)) return true;
  return false;
}

function watchForProblems(page, problems, options = {}) {
  const acceptDialogs = options.acceptDialogs === true;

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
    if (status >= 500 || (status >= 400 && criticalUrl(requestUrl))) {
      problems.push({ type: 'http-error', status, requestUrl, pageUrl: page.url() });
    }
  });

  page.on('dialog', async (dialog) => {
    problems.push({
      type: acceptDialogs ? 'dialog-accepted' : 'dialog-dismissed',
      message: dialog.message(),
      url: page.url(),
    });
    if (acceptDialogs) {
      await dialog.accept().catch(() => {});
    } else {
      await dialog.dismiss().catch(() => {});
    }
  });
}

async function hardStopIfProduction() {
  if (IS_MUTATION_ALLOWED_URL || ALLOW_PROD_MUTATIONS) return;
  throw new Error(
    `Refusing to run mutating full tests against APP_URL=${APP_URL}. ` +
      'Use a testing/preview/local URL, or set PLAYWRIGHT_ALLOW_PROD_MUTATIONS=true only if you absolutely mean it.'
  );
}

async function installTestLocalStorageFlags(page) {
  await page.addInitScript(() => {
    const keys = [
      '86chaos_employee_quick_start_seen',
      '86chaos_manager_quick_start_seen',
      'employeeQuickStartComplete',
      'managerQuickStartComplete',
      'employeeQuickStartDismissed',
      'managerQuickStartDismissed',
      'quickStartDismissed',
      'guidedTourComplete',
    ];
    for (const key of keys) localStorage.setItem(key, 'true');
  });
}

async function closeAnyModal(page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const dialogVisible = await page
      .locator('[role="dialog"], .chaos-modal-backdrop')
      .first()
      .isVisible({ timeout: 350 })
      .catch(() => false);
    if (!dialogVisible) break;

    const closePatterns = [
      /Close Employee Quick Start/i,
      /Close Manager Quick Start/i,
      /Skip for now/i,
      /^Close$/i,
      /^Cancel$/i,
      /^Back$/i,
      /Hide/i,
      /Not now/i,
      /Dismiss/i,
    ];

    let clicked = false;
    for (const pattern of closePatterns) {
      const button = page.getByRole('button', { name: pattern }).first();
      if (await button.isVisible({ timeout: 350 }).catch(() => false)) {
        await button.click({ timeout: 2000, force: true }).catch(() => {});
        clicked = true;
        await page.waitForTimeout(250);
        break;
      }
    }

    if (!clicked) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(250);
    }
  }
}

async function login(page, email, password) {
  await installTestLocalStorageFlags(page);
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

    await expect(appShell.or(loginError).first()).toBeVisible({ timeout: 75000 });
    if (await loginError.isVisible().catch(() => false)) {
      throw new Error(`Login failed: ${await loginError.innerText()}`);
    }
  }

  await expect(page.locator('main')).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(800);
  await closeAnyModal(page);
}

async function gotoTab(page, tab) {
  await page.goto(`${APP_URL}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible({ timeout: 45000 });
  await page.waitForTimeout(900);
  await closeAnyModal(page);
}

async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
}

async function mainText(page) {
  return page.locator('main').innerText({ timeout: 15000 }).catch(() => '');
}

async function assertAvailable(page, problems, label) {
  const text = await bodyText(page);
  if (/This page is not available/i.test(text)) {
    problems.push({ type: 'unavailable-page', label, url: page.url(), text: text.slice(0, 700) });
  }
  await expect(page.locator('main'), label).toBeVisible({ timeout: 30000 });
}

async function expectText(page, regexes, problems, label) {
  const text = await bodyText(page);
  if (!regexes.some((regex) => regex.test(text))) {
    problems.push({
      type: 'expected-text-missing',
      label,
      expected: regexes.map(String),
      url: page.url(),
      visibleTextStart: text.slice(0, 900),
    });
  }
}

async function clickButton(page, pattern, options = {}) {
  await closeAnyModal(page);
  const exact = options.exact === true;
  const name = pattern instanceof RegExp ? pattern : exact ? new RegExp(`^\\s*${escapeRegExp(pattern)}\\s*$`, 'i') : new RegExp(escapeRegExp(pattern), 'i');
  const scope = options.scope || page.locator('main');
  const button = scope.getByRole('button', { name }).first();
  await expect(button, `Button not found: ${name}`).toBeVisible({ timeout: options.timeout || 8000 });
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await closeAnyModal(page);
  await button.click({ timeout: options.timeout || 8000, force: options.force === true });
  await page.waitForTimeout(options.wait || 900);
  return true;
}

async function clickButtonIfPresent(page, pattern, report, label = String(pattern), options = {}) {
  await closeAnyModal(page);
  const name = pattern instanceof RegExp ? pattern : new RegExp(escapeRegExp(pattern), 'i');
  const scope = options.scope || page.locator('main');
  const button = scope.getByRole('button', { name }).first();
  const visible = await button.isVisible({ timeout: options.timeout || 2500 }).catch(() => false);
  if (!visible) {
    report.push({ label, clicked: false, reason: 'button not visible', url: page.url() });
    return false;
  }
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await closeAnyModal(page);
  await button.click({ timeout: 8000, force: options.force === true }).catch(async (error) => {
    report.push({ label, clicked: false, reason: error.message, url: page.url() });
    throw error;
  });
  await page.waitForTimeout(options.wait || 900);
  report.push({ label, clicked: true, url: page.url() });
  return true;
}

async function clickButtonMaybeMutating(page, pattern, report, label = String(pattern)) {
  return clickButtonIfPresent(page, pattern, report, label, { force: false, wait: 1200 });
}

async function setFirstVisibleInput(locator, value) {
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, 10); i++) {
    const input = locator.nth(i);
    if (!(await input.isVisible({ timeout: 500 }).catch(() => false))) continue;
    if (!(await input.isEnabled({ timeout: 500 }).catch(() => false))) continue;
    await input.fill(String(value), { timeout: 5000 });
    return true;
  }
  return false;
}

async function fillField(page, labels, value, report, options = {}) {
  await closeAnyModal(page);
  const main = page.locator('main');
  const patterns = labels.map((label) => (label instanceof RegExp ? label : new RegExp(escapeRegExp(label), 'i')));
  const valueText = String(value);

  for (const pattern of patterns) {
    const directLocators = [
      main.getByLabel(pattern),
      main.getByPlaceholder(pattern),
      main.locator('input, textarea').filter({ hasText: pattern }),
    ];

    for (const candidate of directLocators) {
      if (await setFirstVisibleInput(candidate, valueText).catch(() => false)) {
        report.push({ field: labels.map(String), value, filled: true, method: 'direct' });
        return true;
      }
    }

    const blocks = main.locator('label, div, section, article, fieldset, tr').filter({ hasText: pattern });
    const count = Math.min(await blocks.count().catch(() => 0), 30);
    for (let i = 0; i < count; i++) {
      const block = blocks.nth(i);
      const input = block.locator('input:not([type="hidden"]), textarea').first();
      if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
        await input.fill(valueText, { timeout: 5000 }).catch(() => null);
        const current = await input.inputValue().catch(() => '');
        if (String(current) === valueText || String(current).replace(/,/g, '') === valueText) {
          report.push({ field: labels.map(String), value, filled: true, method: 'near-text' });
          return true;
        }
      }
    }
  }

  if (options.required !== false) {
    report.push({ field: labels.map(String), value, filled: false, reason: 'field not found' });
  }
  return false;
}

async function selectFirstRealOption(selectLocator, ignored = /select|choose|custom|template|preset/i) {
  const options = await selectLocator.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({ value: node.value, label: (node.textContent || '').trim(), disabled: node.disabled }))
  );
  const choice = options.find((opt) => opt.label && !opt.disabled && !ignored.test(opt.label));
  if (!choice) return null;
  if (choice.value) await selectLocator.selectOption(choice.value);
  else await selectLocator.selectOption({ label: choice.label });
  return choice;
}

async function fillFinancialFixture(page, report) {
  const f = FINANCIAL_FIXTURE;
  const fields = [
    [[/date/i, /close date/i], TODAY],
    [[/month/i], TEST_MONTH],
    [[/gross sales/i, /total sales/i], f.grossSales],
    [[/discounts/i], f.discounts],
    [[/refunds/i], f.refunds],
    [[/comps/i, /comped/i], f.comps],
    [[/net sales/i], f.netSales],
    [[/cash sales/i, /cash/i], f.cashSales],
    [[/card sales/i, /credit card/i], f.cardSales],
    [[/cash tips/i], f.cashTips],
    [[/credit tips/i, /card tips/i], f.creditTips],
    [[/labor cost/i, /labor/i], f.laborCost],
    [[/food cost/i, /food/i], f.foodCost],
    [[/beverage cost/i, /bar cost/i, /beer.*liquor/i, /beverage/i], f.beverageCost],
    [[/supplies/i, /supply/i], f.supplyCost],
    [[/other expenses/i, /expense/i], f.otherExpenses],
    [[/expected cash/i, /expected drawer/i], f.expectedCashDrawer],
    [[/actual cash/i, /actual drawer/i, /drawer total/i], f.actualCashDrawer],
    [[/deposit/i, /bank deposit/i], f.depositAmount],
    [[/notes/i, /memo/i, /description/i], `${RUN_ID} automated full financial math test`],
  ];

  for (const [labels, value] of fields) {
    await fillField(page, labels, value, report, { required: false });
  }
}

async function saveCurrentForm(page, report, label) {
  const buttons = [
    /^Save$/i,
    /Save Daily Close/i,
    /Record Daily Close/i,
    /Add Daily Close/i,
    /Save Close/i,
    /Create/i,
    /Add/i,
    /Submit/i,
    /Record/i,
  ];

  for (const pattern of buttons) {
    const btn = page.locator('main').getByRole('button', { name: pattern }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ timeout: 8000 }).catch(async (error) => {
        report.push({ label, saved: false, button: String(pattern), error: error.message });
        throw error;
      });
      await page.waitForTimeout(1500);
      report.push({ label, saved: true, button: String(pattern) });
      return true;
    }
  }
  report.push({ label, saved: false, reason: 'No save/record/create button found' });
  return false;
}

function extractValueNearLabel(text, labelRegex, valueType = 'money') {
  const source = String(text || '').replace(/\s+/g, ' ');
  const labelMatch = source.match(labelRegex);
  if (!labelMatch) return null;
  const start = Math.max(0, labelMatch.index || 0);
  const slice = source.slice(start, start + 220);
  if (valueType === 'percent') return parsePercent(slice);
  return parseMoney(slice);
}

function auditVisibleFinancialMath(text, report, problems, label) {
  const checks = [];
  const netSales = extractValueNearLabel(text, /Net Sales/i);
  const laborCost = extractValueNearLabel(text, /Labor(?: Cost)?/i);
  const foodCost = extractValueNearLabel(text, /Food/i);
  const beverageCost = extractValueNearLabel(text, /Beverage|Bar/i);
  const primeCost = extractValueNearLabel(text, /Prime Cost/i);
  const laborPct = extractValueNearLabel(text, /Labor/i, 'percent');
  const foodPct = extractValueNearLabel(text, /Food/i, 'percent');
  const primePct = extractValueNearLabel(text, /Prime/i, 'percent');
  const estimatedProfit = extractValueNearLabel(text, /Estimated Profit|Net Profit/i);
  const cashVariance = extractValueNearLabel(text, /Cash Variance|Variance/i);

  function addCheck(name, actual, expected, tolerance) {
    const pass = approx(actual, expected, tolerance);
    checks.push({ name, actual, expected, tolerance, pass });
    if (!pass) problems.push({ type: 'math-mismatch', label, name, actual, expected, tolerance });
  }

  // These checks are only enforced if the needed numbers are visible on the current page.
  if (netSales != null && laborCost != null && laborPct != null && netSales > 0) {
    addCheck('Labor % = Labor Cost / Net Sales', laborPct, pct(laborCost, netSales), 1.25);
  }
  if (netSales != null && foodCost != null && foodPct != null && netSales > 0) {
    addCheck('Food % = Food Cost / Net Sales', foodPct, pct(foodCost, netSales), 1.25);
  }
  if (laborCost != null && foodCost != null && beverageCost != null && primeCost != null) {
    addCheck('Prime Cost = Labor + Food + Beverage', primeCost, round2(laborCost + foodCost + beverageCost), 2.00);
  }
  if (netSales != null && primeCost != null && primePct != null && netSales > 0) {
    addCheck('Prime % = Prime Cost / Net Sales', primePct, pct(primeCost, netSales), 1.25);
  }
  if (cashVariance != null) {
    // Just verify visible variance is a reasonable currency number. Exact source labels vary by screen.
    checks.push({ name: 'Cash variance visible currency sanity', actual: cashVariance, pass: Math.abs(cashVariance) < 100000 });
  }
  if (estimatedProfit != null && netSales != null && primeCost != null) {
    checks.push({
      name: 'Estimated/Net profit visible sanity',
      estimatedProfit,
      netSales,
      primeCost,
      pass: estimatedProfit <= netSales && estimatedProfit > -100000,
    });
  }

  report.push({ label, extracted: { netSales, laborCost, foodCost, beverageCost, primeCost, laborPct, foodPct, primePct, estimatedProfit, cashVariance }, checks });
}

async function fullFinancialCenterTest(page, problems, report) {
  await gotoTab(page, 'financials');
  await assertAvailable(page, problems, 'Financials route');
  await expectText(page, [/Financial Center|Daily Close|Labor|Reports|Financials/i], problems, 'Financials shell');

  // Create or attempt a daily close using deterministic inputs.
  await clickButtonIfPresent(page, /^Daily Close$/i, report.visited, 'Financials > Daily Close');
  await fillFinancialFixture(page, report.fields);
  await saveCurrentForm(page, report.actions, 'Daily Close write test');
  await closeAnyModal(page);

  // Verify every subtool opens and run math sanity on pages where the numbers exist.
  const tabs = [
    { label: 'Overview', expects: [/Net Sales|Prime Cost|Estimated Profit|Labor/i] },
    { label: 'Daily Close', expects: [/Daily Close|Gross Sales|Cash Sales|Card Sales|Deposit/i] },
    { label: 'Sales', expects: [/Sales|Gross|Net|Cash|Card|Food|Liquor|Beer/i] },
    { label: 'Labor & Payroll', expects: [/Labor|Payroll|Timesheet|Hours|Tips/i] },
    { label: 'Tips', expects: [/Tips|Cash Tips|Credit Tips|Total Tips/i] },
    { label: 'COGS & Vendors', expects: [/COGS|Vendors|Invoice Spend|Food|Beverage/i] },
    { label: 'Expenses', expects: [/Expenses|Add Expense|Vendor|Payee|Category|Amount/i] },
    { label: 'P&L', expects: [/P&L|Gross Sales|Net Sales|Gross Profit|Net Profit/i] },
    { label: 'Targets', expects: [/Targets|Labor %|Food %|Prime %|Warning/i] },
    { label: 'Reports', expects: [/Reports|Owner Financial Report|Payroll|Daily Close|COGS/i] },
  ];

  for (const tab of tabs) {
    await clickButtonIfPresent(page, new RegExp(`^\\s*${escapeRegExp(tab.label)}\\s*$`, 'i'), report.visited, `Financials > ${tab.label}`);
    await assertAvailable(page, problems, `Financials > ${tab.label}`);
    await expectText(page, tab.expects, problems, `Financials > ${tab.label}`);
    auditVisibleFinancialMath(await mainText(page), report.math, problems, `Financials > ${tab.label}`);
  }

  // Export/print buttons are intentionally clicked because this is a full test.
  await clickButtonIfPresent(page, /Print Report/i, report.visited, 'Financials > Print Report').catch((error) => {
    problems.push({ type: 'print-click-failed', area: 'Financials', message: error.message, url: page.url() });
  });
  await closeAnyModal(page);
}

async function fullBackOfficeQuickBooksTest(page, problems, report) {
  await gotoTab(page, 'back-office');
  await assertAvailable(page, problems, 'Back Office route');
  await expectText(page, [/Back Office|Owner Pro|QuickBooks|Deposit|Approval|Document/i], problems, 'Back Office shell');

  const tabs = ['Dashboard', 'Deposit Log', 'Approval Queue', 'Document Vault', 'Owner Reports', 'QuickBooks', 'Reports'];
  for (const tab of tabs) {
    await clickButtonIfPresent(page, new RegExp(tab, 'i'), report.visited, `Back Office > ${tab}`);
    await assertAvailable(page, problems, `Back Office > ${tab}`);
    await expectText(page, [new RegExp(tab.replace(/ Queue| Log| Vault/g, ''), 'i'), /Back Office|QuickBooks|Owner|Deposit|Approval|Document|Reports/i], problems, `Back Office > ${tab}`);
  }

  // Attempt review-first, non-external accounting flows. These may create test drafts in Firestore,
  // but should not post to real QuickBooks without credentials and owner approval.
  await clickButtonIfPresent(page, /QuickBooks/i, report.visited, 'Back Office > QuickBooks');
  const qbButtons = [
    /Create Bill Draft/i,
    /Create Vendor Credit/i,
    /Run Preflight/i,
    /Check Sync Health/i,
    /Repair/i,
    /Generate Accountant Packet/i,
    /Download CSV/i,
    /QuickBooks Prep CSV/i,
  ];
  for (const button of qbButtons) {
    await clickButtonIfPresent(page, button, report.visited, `QuickBooks action ${button}`).catch((error) => {
      report.actions.push({ action: String(button), clicked: false, error: error.message });
    });
    await closeAnyModal(page);
  }

  auditVisibleFinancialMath(await mainText(page), report.math, problems, 'Back Office / QuickBooks visible math');
}

async function pickFirstStaff(page, report) {
  const main = page.locator('main');
  const selects = main.locator('select');
  const count = await selects.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    const options = await select.locator('option').evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.value, label: (node.textContent || '').trim(), disabled: node.disabled }))
    );

    const isStaffSelect = options.some((opt) => /select staff|staff/i.test(opt.label));
    if (!isStaffSelect) continue;

    const realOptions = options.filter((opt) => {
      const label = opt.label || '';
      return label && !opt.disabled && !/select|choose|custom|template|preset/i.test(label);
    });

    // Prefer a real named staff account over a one-letter/test stub. One-letter names can match group/header rows.
    const choice =
      realOptions.find((opt) => /geoff|owner|manager|admin/i.test(opt.label) && opt.label.length >= 3) ||
      realOptions.find((opt) => opt.label.length >= 3) ||
      realOptions[0];

    if (!choice) continue;

    await select.selectOption(choice.value || { label: choice.label }).catch(async () => {
      await select.selectOption({ label: choice.label });
    });
    report.actions.push({ action: 'selected staff', staff: choice.label, value: choice.value });
    await page.waitForTimeout(700);
    return choice.label;
  }
  return null;
}

async function setScheduleTimes(page, report) {
  const main = page.locator('main');
  const timeInputs = main.locator('input[type="time"]');
  const count = await timeInputs.count().catch(() => 0);
  if (count >= 2) {
    await timeInputs.nth(0).fill(SCHEDULE_FIXTURE.startTime);
    await timeInputs.nth(1).fill(SCHEDULE_FIXTURE.endTime);
    report.actions.push({ action: 'set time inputs', start: SCHEDULE_FIXTURE.startTime, end: SCHEDULE_FIXTURE.endTime });
    return true;
  }

  const inputs = main.locator('input');
  if ((await inputs.count().catch(() => 0)) >= 2) {
    await fillField(page, [/In/i, /Start/i], SCHEDULE_FIXTURE.startTime, report.actions, { required: false });
    await fillField(page, [/Out/i, /End/i], SCHEDULE_FIXTURE.endTime, report.actions, { required: false });
    return true;
  }
  return false;
}

async function assignButtonState(page) {
  const assign = page.locator('main').getByRole('button', { name: /Assign/i }).first();
  const visible = await assign.isVisible({ timeout: 1500 }).catch(() => false);
  if (!visible) return { visible: false, enabled: false, text: '' };
  const text = await assign.innerText().catch(() => '');
  const enabled = await assign.isEnabled({ timeout: 500 }).catch(() => false);
  const countMatch = text.match(/Assign\s*\((\d+)\)/i);
  return { visible: true, enabled, text, count: countMatch ? Number(countMatch[1]) : null };
}

async function clickScheduleCellLikeUser(page, cell) {
  await cell.scrollIntoViewIfNeeded().catch(() => {});
  const box = await cell.boundingBox().catch(() => null);
  if (!box || box.width < 4 || box.height < 4) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);
  return true;
}

async function selectScheduleCells(page, staffName, report) {
  const main = page.locator('main');
  const rows = main.locator('table tbody tr');
  const rowCount = await rows.count().catch(() => 0);
  const wanted = String(staffName || '').trim();
  const candidates = [];

  for (let i = 0; i < Math.min(rowCount, 60); i++) {
    const row = rows.nth(i);
    const text = (await row.innerText().catch(() => '')).trim();
    if (!text || /Proj\. Cost|Month Total|Scheduled Hours Tracker|Employee\s+Wk/i.test(text)) continue;

    const cells = row.locator('td, [role="gridcell"]');
    const cellCount = await cells.count().catch(() => 0);
    if (cellCount < 3) continue;

    const firstCellText = (await cells.nth(0).innerText().catch(() => '')).trim();
    const score =
      wanted && new RegExp(`^\\s*${escapeRegExp(wanted)}\\s*$`, 'i').test(firstCellText) ? 100 :
      wanted && firstCellText && wanted.toLowerCase().includes(firstCellText.toLowerCase()) ? 80 :
      wanted && text.toLowerCase().includes(wanted.toLowerCase()) ? 60 :
      firstCellText.length >= 3 ? 20 :
      5;
    candidates.push({ row, text, cells, cellCount, firstCellText, score });
  }

  candidates.sort((a, b) => b.score - a.score || b.cellCount - a.cellCount);
  let clicked = 0;
  let finalState = await assignButtonState(page);

  for (const candidate of candidates.slice(0, 6)) {
    // Try several empty/selectable-looking day cells. Existing shift cells are okay too, but empty cells are preferred.
    const cellsToTry = [];
    for (let i = 1; i < Math.min(candidate.cellCount, 18); i++) {
      const cell = candidate.cells.nth(i);
      const txt = (await cell.innerText().catch(() => '')).trim();
      cellsToTry.push({ index: i, cell, txt, empty: !txt });
    }
    cellsToTry.sort((a, b) => Number(b.empty) - Number(a.empty));

    for (const item of cellsToTry.slice(0, 8)) {
      const visible = await item.cell.isVisible({ timeout: 500 }).catch(() => false);
      if (!visible) continue;
      const didClick = await clickScheduleCellLikeUser(page, item.cell).catch(() => false);
      if (!didClick) continue;
      clicked += 1;
      finalState = await assignButtonState(page);
      if (finalState.enabled || (finalState.count != null && finalState.count > 0)) {
        report.actions.push({
          action: 'selected schedule cells',
          staffName,
          rowFirstCell: candidate.firstCellText,
          clicked,
          assignState: finalState,
        });
        return clicked;
      }
    }
  }

  report.actions.push({
    action: 'selected schedule cells',
    staffName,
    clicked,
    assignState: finalState,
    candidateRows: candidates.slice(0, 5).map((c) => ({ firstCellText: c.firstCellText, score: c.score, textStart: c.text.slice(0, 120) })),
  });
  return clicked;
}

async function fullScheduleBuilderTest(page, problems, report) {
  await gotoTab(page, 'schedule');
  await assertAvailable(page, problems, 'Schedule route');
  await expectText(page, [/Schedule Builder|Select Staff|Assign|Auto-Fill|Publish|Schedule/i], problems, 'Schedule shell');

  await clickButtonIfPresent(page, /schedule builder/i, report.visited, 'Schedule Builder tab');
  await closeAnyModal(page);

  const staffName = await pickFirstStaff(page, report);
  if (!staffName) problems.push({ type: 'schedule-write-blocked', reason: 'Could not find a staff option to assign', url: page.url() });

  const timesSet = await setScheduleTimes(page, report);
  if (!timesSet) problems.push({ type: 'schedule-control-missing', control: 'time inputs', url: page.url() });

  const selectedCells = await selectScheduleCells(page, staffName, report);
  if (selectedCells < 1) problems.push({ type: 'schedule-write-blocked', reason: 'Could not select schedule cells', staffName, url: page.url() });

  const assignStateBeforeClick = await assignButtonState(page);
  report.actions.push({ action: 'assign button state before click', state: assignStateBeforeClick });
  if (assignStateBeforeClick.enabled || (assignStateBeforeClick.count != null && assignStateBeforeClick.count > 0)) {
    await clickButtonMaybeMutating(page, /Assign/i, report.visited, 'Schedule > Assign shift').catch((error) => {
      problems.push({ type: 'schedule-assign-failed', message: error.message, url: page.url() });
    });
  } else {
    problems.push({
      type: 'schedule-assign-not-enabled',
      message: 'Staff and/or schedule cells did not enable Assign. This usually means the Schedule Builder selection UI did not register any selected day cells.',
      staffName,
      selectedCells,
      assignState: assignStateBeforeClick,
      url: page.url(),
    });
  }
  await closeAnyModal(page);

  const scheduleAfterAssign = await mainText(page);
  const shiftVisible = /3:15|15:15|20:45|8:45|5\.5|5\.50|4p-9p/i.test(scheduleAfterAssign);
  report.math.push({ label: 'Schedule assigned shift visible sanity', shiftVisible, expectedHours: SCHEDULE_FIXTURE.expectedHours });
  if (!shiftVisible) {
    problems.push({ type: 'schedule-shift-not-visible-after-assign', expected: SCHEDULE_FIXTURE, textStart: scheduleAfterAssign.slice(0, 1200), url: page.url() });
  }

  // Test Auto-Fill flow. This may create draft/test shifts if the modal has a run/apply button.
  await clickButtonIfPresent(page, /Auto-Fill/i, report.visited, 'Schedule > Auto-Fill').catch((error) => {
    problems.push({ type: 'schedule-autofill-open-failed', message: error.message, url: page.url() });
  });
  const autoFillText = await bodyText(page);
  if (/Auto|Populate|Fill|Copilot/i.test(autoFillText)) {
    for (const action of [/Generate/i, /Run/i, /Apply/i, /Fill/i, /Create Draft/i]) {
      const clicked = await clickButtonIfPresent(page, action, report.visited, `Auto-Fill action ${action}`).catch(() => false);
      if (clicked) break;
    }
  }
  await closeAnyModal(page);

  // Test custom shift preset modal.
  const editPresetsButton = page.locator('main button[title="Edit Presets"]').first();
  if (await editPresetsButton.isVisible({ timeout: 2500 }).catch(() => false)) {
    await editPresetsButton.click({ timeout: 7000 });
    await page.waitForTimeout(700);
    await expectText(page, [/Manage Custom Shifts|Preset|Custom Shift/i], problems, 'Custom shift preset modal');
    await closeAnyModal(page);
    report.visited.push({ label: 'Custom shift presets', opened: true });
  }

  // Test Event modal/creation if available.
  const eventClicked = await clickButtonIfPresent(page, /^Event$/i, report.visited, 'Schedule > Event').catch(() => false);
  if (eventClicked) {
    await fillField(page, [/title/i, /event/i, /name/i], `${RUN_ID} Test Event`, report.actions, { required: false });
    await fillField(page, [/date/i], TODAY, report.actions, { required: false });
    await fillField(page, [/start/i], SCHEDULE_FIXTURE.startTime, report.actions, { required: false });
    await fillField(page, [/end/i], SCHEDULE_FIXTURE.endTime, report.actions, { required: false });
    await saveCurrentForm(page, report.actions, 'Schedule event write test').catch((error) => {
      report.actions.push({ action: 'schedule event save failed', error: error.message });
    });
    await closeAnyModal(page);
  }

  // Publish schedule on testing. Dialogs are accepted by watcher for this suite.
  await clickButtonMaybeMutating(page, /^Publish$/i, report.visited, 'Schedule > Publish').catch((error) => {
    problems.push({ type: 'schedule-publish-failed', message: error.message, url: page.url() });
  });
  await page.waitForTimeout(1500);
  await closeAnyModal(page);

  // Verify published/current schedule views after publish.
  await gotoTab(page, 'published');
  const scheduleViewButtons = [/My Schedule/i, /Full Schedule/i, /Month View/i, /Request Off/i, /Availability/i, /Schedule Builder/i];
  for (const button of scheduleViewButtons) {
    await clickButtonIfPresent(page, button, report.visited, `Published schedule view ${button}`).catch((error) => {
      problems.push({ type: 'schedule-view-click-failed', button: String(button), message: error.message, url: page.url() });
    });
    await assertAvailable(page, problems, `Published schedule view ${button}`);
    await expectText(page, [/Schedule|Availability|Request|Published|Month|Builder/i], problems, `Published schedule view ${button}`);
  }
}

async function fullPermissionAudit(page, problems, report) {
  const staffEmail = process.env.STAFF_EMAIL;
  const staffPassword = process.env.STAFF_PASSWORD;
  if (!staffEmail || !staffPassword) {
    report.permissionSkipped = 'STAFF_EMAIL and STAFF_PASSWORD are blank in .env';
    return;
  }

  await login(page, staffEmail, staffPassword);
  const forbiddenChecks = [
    { tab: 'back-office', forbidden: /QuickBooks Integration Hub|Document Vault|Owner Summary|Back Office Suite|Owner Pro/i },
    { tab: 'schedule', forbidden: /Auto-Fill|Publish|Assign \(|Schedule Builder/i },
    { tab: 'financials', forbidden: /QuickBooks|Save Targets|P&L Snapshot|Financial Targets/i },
  ];

  for (const check of forbiddenChecks) {
    await gotoTab(page, check.tab);
    const text = await bodyText(page);
    const failed = check.forbidden.test(text);
    report.permissions.push({ tab: check.tab, passed: !failed, textStart: text.slice(0, 600) });
    if (failed) problems.push({ type: 'staff-permission-leak', tab: check.tab, forbidden: String(check.forbidden), textStart: text.slice(0, 900) });
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('86 Chaos FULL MUTATING financial + schedule + back-office automated audit', () => {
  test.beforeAll(async () => {
    await hardStopIfProduction();
  });

  test('FULL financial math, Back Office/QuickBooks, Schedule Builder assign/publish, and permissions', async ({ page, browser }, testInfo) => {
    test.setTimeout(600000);

    const ownerProblems = [];
    const report = {
      runId: RUN_ID,
      appUrl: APP_URL,
      today: TODAY,
      testMonth: TEST_MONTH,
      fixture: FINANCIAL_FIXTURE,
      scheduleFixture: SCHEDULE_FIXTURE,
      visited: [],
      fields: [],
      actions: [],
      math: [],
      permissions: [],
    };

    watchForProblems(page, ownerProblems, { acceptDialogs: true });
    await login(page, requireEnv('TEST_EMAIL'), requireEnv('TEST_PASSWORD'));

    await fullFinancialCenterTest(page, ownerProblems, report);
    await fullBackOfficeQuickBooksTest(page, ownerProblems, report);
    await fullScheduleBuilderTest(page, ownerProblems, report);

    // Permission audit uses a fresh page so the owner session does not contaminate staff checks.
    const staffPage = await browser.newPage();
    const staffProblems = [];
    watchForProblems(staffPage, staffProblems, { acceptDialogs: false });
    await fullPermissionAudit(staffPage, staffProblems, report).catch((error) => {
      staffProblems.push({ type: 'staff-permission-test-error', message: error.message, url: staffPage.url() });
    });
    await staffPage.close().catch(() => {});

    const allProblems = [...ownerProblems, ...staffProblems].filter((problem) => {
      // Dialog accepted/dismissed records are useful logs, not failures in this mutating test.
      return !['dialog-accepted', 'dialog-dismissed'].includes(problem.type);
    });

    await testInfo.attach('86chaos-full-mutating-financial-schedule-report.json', {
      body: JSON.stringify({ report, ownerProblems, staffProblems, allProblems }, null, 2),
      contentType: 'application/json',
    });

    expect(allProblems, JSON.stringify(allProblems, null, 2)).toEqual([]);
  });
});
