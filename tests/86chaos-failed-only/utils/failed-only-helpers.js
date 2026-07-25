// 86 Chaos failed-only regression helpers for 16.0.4+
// These helpers are intentionally narrower than the full production suite.
const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ENV_FILE_NAMES = ['.env', '.env.local'];
const ENV_SEARCH_ROOTS = [
  process.cwd(),
  path.resolve(__dirname, '..', '..', '..'),
  path.resolve(__dirname, '..', '..', '..', '..'),
];
const RAW_ENV = {};
const ENV_LOAD_REPORT = [];

function parseEnvText(text) {
  const parsed = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

for (const root of ENV_SEARCH_ROOTS) {
  for (const name of ENV_FILE_NAMES) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = parseEnvText(fs.readFileSync(filePath, 'utf8'));
      let filled = 0;
      for (const [key, value] of Object.entries(parsed)) {
        if (!value) continue;
        RAW_ENV[key] = value;
        if (!process.env[key]) {
          process.env[key] = value;
          filled += 1;
        }
      }
      ENV_LOAD_REPORT.push({ filePath, keys: Object.keys(parsed).length, filled });
    } catch (error) {
      ENV_LOAD_REPORT.push({ filePath, error: error.message });
    }
  }
}

function envValue(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
    if (RAW_ENV[name]) return RAW_ENV[name];
  }
  return '';
}

function maskedEnvValue(name) {
  const value = envValue(name);
  if (!value) return '';
  if (/PASSWORD|PASS|SECRET|TOKEN|KEY/i.test(name)) return `***${String(value).slice(-2)}`;
  return value;
}

function envDebugSummary() {
  const names = [
    'APP_URL', 'CHAOS_BASE_URL', 'CHAOS_EXPECTED_VERSION',
    'TEST_EMAIL', 'TEST_PASSWORD', 'OWNER_EMAIL', 'OWNER_PASSWORD',
    'MANAGER_EMAIL', 'MANAGER_PASSWORD', 'STAFF_EMAIL', 'STAFF_PASSWORD',
  ];
  return {
    cwd: process.cwd(),
    helperDir: __dirname,
    envFiles: ENV_LOAD_REPORT,
    values: Object.fromEntries(names.map((name) => [name, maskedEnvValue(name)])),
  };
}

const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const DEFAULT_BASE_URL = 'https://cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app';
const BASE_URL = (
  envValue('CHAOS_BASE_URL', 'APP_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL') || DEFAULT_BASE_URL
).replace(/\/$/, '');
const EXPECTED_VERSION = envValue('CHAOS_EXPECTED_VERSION') || '16.0.4';

const FATAL_UI_RE = /Application error|Unhandled Runtime Error|Cannot read properties of undefined|Minified React error|Something went wrong/i;
const BROKEN_VISIBLE_VALUE_RE = /\b(?:NaN|Infinity|Invalid Date|undefined undefined|null null)\b/i;
const LOGIN_RE = /Email Address\s*Password|Unlock System|Forgot Password|CONTACTING FIREBASE AUTH|UNLOCKING/i;
const PERMISSION_GATE_RE = /PLAN\s*&\s*PERMISSION\s*GATE|Your role does not include this tool|not authorized|permission|not available|internal-only/i;

const FAILED_ROUTE_EXPECTED = {
  financials: /Financials|Financial Center|Daily Close|Sales|Labor|Tips|P&L|Reports/i,
  'back-office': /Back Office|Owner Summary|QuickBooks|Accountant|Document Vault|Approval Queue/i,
  recipes: /Recipe|Recipe Book|Ingredients|Method|Instructions|Cost|New Spec|Upload File|Sauce\/Dressing|Entree|Yield/i,
  messages: /Message Board|Important Messages|posts|Reply|team need to know|86 Alert/i,
  team: /Team|Staff|Roster|Role|Permission|Employee|Online|Last seen/i,
  maintenance: /Maintenance|Equipment|Issue|Preventive|Repair|Work Order/i,
  help: /Help Center|Training Manual|Quick Start|Search|Manual/i,
  godmode: /System Administrator|Live Activity|Operations|Plan & Permission Gate|internal-only|Force Logout|Log Out Everyone/i,
};

function appUrl(tab = 'today') {
  const url = new URL(BASE_URL);
  if (tab) url.searchParams.set('tab', tab);
  return url.toString();
}

function ownerLikeCreds() {
  for (const prefix of ['OWNER', 'TEST_OWNER', 'ADMIN', 'MANAGER', 'TEST']) {
    const email = envValue(`${prefix}_EMAIL`, `CHAOS_${prefix}_EMAIL`, `${prefix}_USER`);
    const password = envValue(`${prefix}_PASSWORD`, `CHAOS_${prefix}_PASSWORD`, `${prefix}_PASS`);
    if (email && password) return { label: prefix, email, password };
  }
  return { label: 'OWNER', email: '', password: '' };
}

function requireCreds(account, label = 'account') {
  if (account?.email && account?.password) return;
  throw new Error(
    `Missing ${label} email/password env vars. Check .env in the repo root. Env debug: ${JSON.stringify(envDebugSummary(), null, 2)}`
  );
}

async function bodyText(page, max = 20000) {
  try {
    const text = await page.locator('body').innerText({ timeout: 10000 });
    return text.slice(0, max);
  } catch (_) {
    return '';
  }
}

async function attachReport(testInfo, filename, data) {
  await testInfo.attach(filename, {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  });
}

function watchForProblems(page, problems) {
  page.on('pageerror', (error) => {
    problems.push({ type: 'page-error', message: error.message, stack: error.stack });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|ResizeObserver|Failed to load resource|net::ERR_ABORTED|401|403|AbortError/i.test(text)) return;
    problems.push({ type: 'console-error', message: text.slice(0, 1200) });
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status < 500) return;
    if (/hot-update|sockjs|favicon/i.test(url)) return;
    problems.push({ type: 'http-5xx', status, url });
  });
}

async function clickIfVisible(page, locator, timeout = 900) {
  const visible = await locator.first().isVisible({ timeout }).catch(() => false);
  if (!visible) return false;
  await locator.first().click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(250);
  return true;
}

async function dismissBlockingModals(page) {
  // The failed run was mostly blocked by Employee Quick Start. Close it before route or button checks.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let acted = false;
    acted = await clickIfVisible(page, page.getByRole('button', { name: /close employee quick start/i }), 700) || acted;
    acted = await clickIfVisible(page, page.getByRole('button', { name: /skip for now/i }), 700) || acted;
    acted = await clickIfVisible(page, page.getByRole('button', { name: /close|dismiss|cancel/i }), 500) || acted;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
    const backdropCount = await page.locator('.chaos-modal-backdrop,[role="dialog"]').count().catch(() => 0);
    const quickStartVisible = await page.getByText(/Employee Quick Start/i).first().isVisible({ timeout: 250 }).catch(() => false);
    if (!quickStartVisible && backdropCount === 0) return;
    if (!acted) break;
  }
}

async function login(page, email, password) {
  await page.goto(appUrl('today'), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');

  const emailBox = page.getByPlaceholder(/email address/i).first();
  const passwordBox = page.getByPlaceholder(/^password$/i).first();
  await expect(emailBox, 'Login email box should be visible').toBeVisible({ timeout: 30000 });
  await emailBox.fill(email);
  await passwordBox.fill(password);

  const loginButton = page.getByRole('button', { name: /unlock system|sign in|log in|login/i }).first();
  await loginButton.click();

  await page.waitForFunction((expectedVersion) => {
    const text = document.body?.innerText || '';
    const escaped = expectedVersion.replace(/\./g, '\\.');
    const versionRe = new RegExp(`VERSION\\s+${escaped}`, 'i');
    const loginErrorRe = /invalid|wrong password|user-not-found|missing password|too many requests|auth\//i;
    return versionRe.test(text) || loginErrorRe.test(text);
  }, EXPECTED_VERSION, { timeout: 50000 });

  const text = await bodyText(page, 12000);
  const versionRe = new RegExp(`VERSION\\s+${EXPECTED_VERSION.replace(/\./g, '\\.')}`, 'i');
  if (!versionRe.test(text)) throw new Error(`Login did not reach VERSION ${EXPECTED_VERSION}. Text: ${text.slice(0, 1500)}`);
  await dismissBlockingModals(page);
  return text;
}

async function gotoTabClean(page, tab, options = {}) {
  await page.goto(appUrl(tab), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: options.timeout || 25000 });

  await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    return !/CONTACTING FIREBASE AUTH|UNLOCKING|Loading section/i.test(text);
  }, null, { timeout: options.routeReadyTimeout || 45000 });

  await dismissBlockingModals(page);
  await page.waitForTimeout(options.settleMs || 500);
  return bodyText(page, options.maxText || 22000);
}

async function expectRouteClean(page, tab, testInfo, options = {}) {
  const text = await gotoTabClean(page, tab, options);
  const textStart = text.slice(0, 2500);
  const gated = PERMISSION_GATE_RE.test(text);
  const expected = options.expected || FAILED_ROUTE_EXPECTED[tab] || /86|Chaos|PREVIEW/i;

  expect(LOGIN_RE.test(text), `${tab} should not bounce to login. Text: ${textStart}`).toBeFalsy();
  expect(FATAL_UI_RE.test(text), `${tab} should not show fatal UI. Text: ${textStart}`).toBeFalsy();
  expect(BROKEN_VISIBLE_VALUE_RE.test(text), `${tab} should not show broken visible calculated output. Text: ${textStart}`).toBeFalsy();

  if (options.allowGate && gated) {
    await attachReport(testInfo, `${tab}-gated-route.json`, { tab, gated, textStart });
    return { text, gated };
  }

  expect(text, `${tab} should render expected route content after quick-start modal is dismissed`).toMatch(expected);
  await attachReport(testInfo, `${tab}-route-clean.json`, { tab, gated, textStart });
  return { text, gated };
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0,
    innerWidth: window.innerWidth,
  }));
  expect(metrics.scrollWidth, `${label} should not have meaningful sideways overflow: ${JSON.stringify(metrics)}`)
    .toBeLessThanOrEqual(metrics.clientWidth + 14);
}

async function clickScheduleSubtab(page, nameRe, testInfo) {
  await dismissBlockingModals(page);
  const exact = page.getByRole('button', { name: nameRe }).first();
  if (await exact.isVisible({ timeout: 3000 }).catch(() => false)) {
    await exact.click({ timeout: 5000 });
    await dismissBlockingModals(page);
    await page.waitForTimeout(450);
    return true;
  }
  const fallback = page.locator('button').filter({ hasText: nameRe }).first();
  if (await fallback.isVisible({ timeout: 1500 }).catch(() => false)) {
    await fallback.click({ timeout: 5000 });
    await dismissBlockingModals(page);
    await page.waitForTimeout(450);
    return true;
  }
  await attachReport(testInfo, `missing-schedule-subtab-${String(nameRe).replace(/\W+/g, '-')}.json`, {
    name: String(nameRe),
    textStart: (await bodyText(page, 3000)),
  });
  return false;
}

async function visibleSafeButtons(page) {
  const unsafeRe = /delete|remove|archive|restore|publish|approve|deny|send|submit|save|upload|scan|clock in|clock out|force|logout everyone|log out everyone|reset|repair|import|export|connect quickbooks|draft|run python|backup|deploy/i;
  const buttons = page.locator('button');
  const count = Math.min(await buttons.count().catch(() => 0), 35);
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    const btn = buttons.nth(i);
    const visible = await btn.isVisible().catch(() => false);
    const enabled = await btn.isEnabled().catch(() => false);
    if (!visible || !enabled) continue;
    const label = ((await btn.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ');
    const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
    const name = `${label} ${aria}`.trim();
    if (!name || unsafeRe.test(name)) continue;
    const box = await btn.boundingBox().catch(() => null);
    if (!box || box.width < 12 || box.height < 12) continue;
    picked.push({ locator: btn, name: name.slice(0, 80), index: i });
  }
  return picked.slice(0, 14);
}

module.exports = {
  RUN_ID,
  BASE_URL,
  EXPECTED_VERSION,
  FAILED_ROUTE_EXPECTED,
  FATAL_UI_RE,
  BROKEN_VISIBLE_VALUE_RE,
  LOGIN_RE,
  PERMISSION_GATE_RE,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  bodyText,
  attachReport,
  dismissBlockingModals,
  gotoTabClean,
  expectRouteClean,
  assertNoHorizontalOverflow,
  clickScheduleSubtab,
  visibleSafeButtons,
  appUrl,
};
