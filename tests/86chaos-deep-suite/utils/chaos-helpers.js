// 86 Chaos Playwright helpers for app 16.0.2+
// Keep these tests UI-first and permission-aware. They should catch real leaks/crashes
// without failing just because a denied route correctly shows a gate.
const { expect } = require('@playwright/test');

// Load local env files for direct `npx playwright test ...` runs.
// This version is intentionally stubborn: it reads .env from the repo root,
// fills blank process.env values, supports APP_URL, and does NOT silently skip
// when credentials are missing. Missing env now fails with a clear error.
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
        if (value === undefined || value === '') continue;
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

function maskedEnvValue(name) {
  const value = process.env[name] || RAW_ENV[name] || '';
  if (!value) return '';
  if (/PASSWORD|PASS|SECRET|TOKEN|KEY/i.test(name)) return `***${String(value).slice(-2)}`;
  return value;
}

function envDebugSummary() {
  const names = [
    'APP_URL', 'CHAOS_BASE_URL', 'CHAOS_EXPECTED_VERSION', 'CHAOS_ALLOW_MUTATION',
    'TEST_EMAIL', 'TEST_PASSWORD', 'OWNER_EMAIL', 'OWNER_PASSWORD',
    'MANAGER_EMAIL', 'MANAGER_PASSWORD', 'STAFF_EMAIL', 'STAFF_PASSWORD',
    'SYSTEM_ADMIN_EMAIL', 'SYSTEM_ADMIN_PASSWORD', 'WRONG_WORKSPACE_EMAIL', 'DISABLED_EMAIL',
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
  process.env.CHAOS_BASE_URL ||
  process.env.APP_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BASE_URL ||
  DEFAULT_BASE_URL
).replace(/\/$/, '');
const EXPECTED_VERSION = process.env.CHAOS_EXPECTED_VERSION || '16.0.2';
const ALLOW_MUTATION = /^(1|true|yes)$/i.test(process.env.CHAOS_ALLOW_MUTATION || '');
const SAFE_TESTING_URL_RE = /localhost|127\.0\.0\.1|vercel\.app|testing|test|preview/i;

const TAB_LABELS = {
  today: /Today Home|Role Home|No urgent problems|Need Attention/i,
  published: /Schedule & Time Clock|My Schedule|Time Clock|Published Schedule|Clocked In/i,
  schedule: /Schedule Builder|Auto-Fill|Assign|Publish|Templates|Coverage/i,
  financials: /Financials|Financial Center|Daily Close|Sales|Labor|Tips|P&L|Reports/i,
  sales: /Sales|Daily Ledger|Sales Breakdown|Trends|Revenue/i,
  labor: /Labor|Timesheets|Payroll|Hours|Tips/i,
  'back-office': /Back Office|Owner Summary|QuickBooks|Accountant|Document Vault|Approval Queue/i,
  inventory: /Inventory|Vendor|Invoice|AI Ordering|Par|COGS|Burn Log/i,
  'menu-intelligence': /Menu Intelligence|Menu Scan|Menu Items|Ingredients|86 Impact/i,
  'ai-tools': /AI Tools|Ordering|Invoice|Menu|Suggested|Assistant/i,
  prep: /Prep|Open Prep|Prep List|Label|Task/i,
  recipes: /Recipe|Recipe Book|Ingredients|Method|Instructions/i,
  messages: /Message Board|Important Messages|posts|Reply|team need to know/i,
  reminders: /Reminder|Personal Reminders|Shared Reminders|Due|Schedule/i,
  team: /Team|Staff|Roster|Role|Permission|Pay|Employee|Bartender|Server|Cook|Dish|Phone/i,
  settings: /Settings|My Preferences|Preferences|Workspace|Branding|Roster Roles/i,
  help: /Help Center|Training Manual|Quick Start|Search/i,
  godmode: /System Administrator|Plan & Permission Gate|Your role does not include this tool|internal-only/i,
  audit: /Audit|Audit Logs|Admin Actions|Timeline/i,
  maintenance: /Maintenance|Equipment|Issue|Preventive|Repair/i,
  'hr-training': /HR|Training|Manual|Employee|Policy/i,
};

const PERMISSION_GATE_RE = /PLAN\s*&\s*PERMISSION\s*GATE|Your role does not include this tool|not authorized|permission|not available|internal-only/i;
const UNAVAILABLE_RE = /This page is not available|turned off for this workspace|old app link/i;
const FATAL_UI_RE = /Application error|Unhandled Runtime Error|Cannot read properties of undefined|Minified React error|Something went wrong/i;
const LOGIN_RE = /Email Address\s*Password|Unlock System|Forgot Password|CONTACTING FIREBASE AUTH|UNLOCKING/i;
const INTERNAL_ADMIN_DEBUG_RE = /SIGNED-IN EMAIL|FIREBASE UID|SERVER ADMIN CHECK|SERVER MASTER ENV|MASTER_ADMIN_EMAIL|MASTER_ADMIN_EMAILS|FIRESTORE\s*\/\s*CLAIM|custom claim/i;
const STAFF_VISIBLE_FORBIDDEN_RE = /System Administrator|Back Office Suite|QuickBooks Integration Hub|Python Automation|Backup Center|Security Center|Forensics|Pay Rates/i;
const STAFF_UNLOCKED_RESTRICTED_CONTENT_RE = /Connect QuickBooks|Approve\s*(?:&|and)?\s*Send|Send to QuickBooks|Post to QuickBooks|Create Bill Draft|Run Python|Run Automation|Backup Now|Restore Backup|Security Diagnostics|Forensics Timeline|Hourly Rate|Pay Rate/i;

function envValue(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
    if (RAW_ENV[name]) return RAW_ENV[name];
  }
  return '';
}

function hasCreds(prefix) {
  return Boolean(
    envValue(`${prefix}_EMAIL`, `CHAOS_${prefix}_EMAIL`, `${prefix}_USER`) &&
    envValue(`${prefix}_PASSWORD`, `CHAOS_${prefix}_PASSWORD`, `${prefix}_PASS`)
  );
}

function creds(prefix) {
  return {
    label: prefix,
    email: envValue(`${prefix}_EMAIL`, `CHAOS_${prefix}_EMAIL`, `${prefix}_USER`),
    password: envValue(`${prefix}_PASSWORD`, `CHAOS_${prefix}_PASSWORD`, `${prefix}_PASS`),
  };
}

function testCreds() {
  return {
    label: 'TEST',
    email: envValue('TEST_EMAIL', 'CHAOS_TEST_EMAIL', 'TEST_USER'),
    password: envValue('TEST_PASSWORD', 'CHAOS_TEST_PASSWORD', 'TEST_PASS'),
  };
}

function hasTestCreds() {
  const account = testCreds();
  return Boolean(account.email && account.password);
}

function ownerLikeCreds() {
  for (const prefix of ['OWNER', 'TEST_OWNER', 'ADMIN', 'MANAGER']) {
    if (hasCreds(prefix)) return creds(prefix);
  }
  if (hasTestCreds()) return testCreds();
  return creds('OWNER');
}

function staffCredsOrNull() {
  return hasCreds('STAFF') ? creds('STAFF') : null;
}

function managerCredsOrOwner() {
  if (hasCreds('MANAGER')) return creds('MANAGER');
  return ownerLikeCreds();
}

function requireCreds(_test, account, label = 'account') {
  if (account?.email && account?.password) return;
  throw new Error(
    `Missing ${label} email/password env vars. Tests will not silently skip anymore. ` +
    `Check .env in the repo root. Env debug: ${JSON.stringify(envDebugSummary(), null, 2)}`
  );
}

function isMutationAllowed() {
  return ALLOW_MUTATION && SAFE_TESTING_URL_RE.test(BASE_URL) && !/app\.86chaos\.com/i.test(BASE_URL);
}

function appUrl(tab = 'today') {
  const url = new URL(BASE_URL);
  if (tab) url.searchParams.set('tab', tab);
  return url.toString();
}

async function safeText(locator, max = 12000) {
  try {
    const text = await locator.innerText({ timeout: 5000 });
    return text.slice(0, max);
  } catch (_) {
    return '';
  }
}

async function bodyText(page, max = 20000) {
  return safeText(page.locator('body'), max);
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
    if (/favicon|ResizeObserver|Failed to load resource|net::ERR_ABORTED|401|403/i.test(text)) return;
    if (/TypeError|ReferenceError|FirebaseError|Unhandled|Cannot read|Minified React error/i.test(text)) {
      problems.push({ type: 'console-error', message: text.slice(0, 1000) });
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status < 500) return;
    if (/hot-update|sockjs|favicon/i.test(url)) return;
    problems.push({ type: 'http-5xx', status, url });
  });
}

async function login(page, email, password, options = {}) {
  const timeout = options.loginBoxTimeout || 25000;
  const afterLoginTimeout = options.afterLoginTimeout || 45000;
  const escapedVersion = EXPECTED_VERSION.replace(/\./g, '\\.');
  const versionRe = new RegExp(`VERSION\\s+${escapedVersion}`, 'i');

  await page.goto(appUrl('today'), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');

  const emailBox = page.getByPlaceholder(/email address/i).first();
  const passwordBox = page.getByPlaceholder(/^password$/i).first();
  await expect(emailBox, 'Login email box should be visible').toBeVisible({ timeout });
  await emailBox.fill(email);
  await passwordBox.fill(password);

  const loginButton = page.getByRole('button', { name: /unlock system|sign in|log in|login/i }).first();
  await loginButton.click();

  // Wait for the real app shell, not the temporary "CONTACTING FIREBASE AUTH / UNLOCKING" screen.
  // The old helper accepted any text containing "Firebase", which made tests continue too early.
  await page.waitForFunction((expectedVersion) => {
    const text = document.body?.innerText || '';
    const escaped = expectedVersion.replace(/\./g, '\\.');
    const versionRe = new RegExp(`VERSION\\s+${escaped}`, 'i');
    const hardLoginErrorRe = /invalid|wrong password|user-not-found|missing password|too many requests|auth\/|Login failed/i;
    return versionRe.test(text) || hardLoginErrorRe.test(text);
  }, EXPECTED_VERSION, { timeout: afterLoginTimeout });

  const text = await bodyText(page, 8000);
  if (!versionRe.test(text)) {
    throw new Error(`Login did not reach the app shell for ${email}. Text: ${text.slice(0, 1200)}`);
  }
  return text;
}

async function gotoTab(page, tab, options = {}) {
  await page.goto(appUrl(tab), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: options.timeout || 20000 });

  // React route chunks sometimes show the shell footer before the section finishes loading.
  // Wait for the temporary loader to clear so route assertions inspect the actual tab.
  await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    return !/CONTACTING FIREBASE AUTH|UNLOCKING|Loading section/i.test(text);
  }, null, { timeout: options.routeReadyTimeout || 30000 });

  await page.waitForTimeout(options.settleMs || 300);
  return bodyText(page);
}

function pageState(text) {
  return {
    textStart: text.slice(0, 1500),
    isLogin: LOGIN_RE.test(text),
    isPermissionGate: PERMISSION_GATE_RE.test(text),
    isUnavailable: UNAVAILABLE_RE.test(text),
    hasFatalUi: FATAL_UI_RE.test(text),
    hasInternalAdminDebug: INTERNAL_ADMIN_DEBUG_RE.test(text),
  };
}

async function expectNoFatalUi(page, label = 'page') {
  const text = await bodyText(page);
  const state = pageState(text);
  expect(state.isLogin, `${label} should not bounce back to login`).toBeFalsy();
  expect(state.hasFatalUi, `${label} should not show fatal UI. Text: ${state.textStart}`).toBeFalsy();
}

async function expectVersion(page, expected = EXPECTED_VERSION) {
  const escapedVersion = expected.replace(/\./g, '\\.');
  const versionRe = new RegExp(`VERSION\\s+${escapedVersion}`, 'i');
  await expect(
    page.locator('body'),
    `Deployed app should show VERSION ${expected}. If it shows an older version, redeploy the current app before judging these tests.`
  ).toContainText(versionRe, { timeout: 30000 });
}

async function expectRouteHealthy(page, tab, options = {}) {
  const text = await gotoTab(page, tab, options);
  const state = pageState(text);
  expect(state.isLogin, `${tab} should not return to login`).toBeFalsy();
  expect(state.hasFatalUi, `${tab} should not show fatal UI. Text: ${state.textStart}`).toBeFalsy();

  if (options.allowGate !== false && (state.isPermissionGate || state.isUnavailable)) {
    return { tab, gated: state.isPermissionGate, unavailable: state.isUnavailable, text };
  }

  const expected = options.expected || TAB_LABELS[tab] || /86|Chaos|TESTAURANT|PREVIEW/i;
  expect(text, `${tab} should render expected app content`).toMatch(expected);
  return { tab, gated: false, unavailable: false, text };
}

async function maybeClick(page, locator, options = {}) {
  const count = await locator.count().catch(() => 0);
  if (!count) return false;
  const target = locator.first();
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.click({ timeout: options.timeout || 5000 }).catch(() => {});
  await page.waitForTimeout(options.settleMs || 500);
  return true;
}

async function openMenu(page) {
  const menuButton = page.getByRole('button').filter({ hasText: /^$/ }).first();
  // Prefer visible buttons with common menu/svg structure, then fall back to any button near the header.
  const explicit = page.getByRole('button', { name: /menu|open menu/i }).first();
  if (await explicit.isVisible().catch(() => false)) {
    await explicit.click();
    return true;
  }
  const buttons = page.locator('button');
  const count = Math.min(await buttons.count().catch(() => 0), 12);
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const box = await btn.boundingBox().catch(() => null);
    if (box && box.width <= 80 && box.height <= 80 && box.y < 160) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
  }
  return maybeClick(page, menuButton);
}

async function closeTransientUi(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}

function summarizeProblems(problems) {
  return problems.map((p) => ({ ...p, message: p.message?.slice?.(0, 1000) || p.message }));
}

module.exports = {
  RUN_ID,
  BASE_URL,
  EXPECTED_VERSION,
  ALLOW_MUTATION,
  PERMISSION_GATE_RE,
  UNAVAILABLE_RE,
  FATAL_UI_RE,
  LOGIN_RE,
  INTERNAL_ADMIN_DEBUG_RE,
  STAFF_VISIBLE_FORBIDDEN_RE,
  STAFF_UNLOCKED_RESTRICTED_CONTENT_RE,
  TAB_LABELS,
  hasCreds,
  creds,
  ownerLikeCreds,
  staffCredsOrNull,
  managerCredsOrOwner,
  requireCreds,
  isMutationAllowed,
  appUrl,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  pageState,
  expectNoFatalUi,
  expectVersion,
  expectRouteHealthy,
  maybeClick,
  openMenu,
  closeTransientUi,
  attachReport,
  summarizeProblems,
  envDebugSummary,
};
