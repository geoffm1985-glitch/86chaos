const { expect } = require('@playwright/test');
require('dotenv').config();

const APP_URL = String(
  process.env.APP_URL ||
    process.env.TEST_APP_URL ||
    process.env.PLAYWRIGHT_APP_URL ||
    'https://cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app'
).replace(/\/+$/, '');

const RUN_ID = `PW-DEEP-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const TEST_MONTH = TODAY.slice(0, 7);
const MUTATION_OK_URL = /localhost|127\.0\.0\.1|vercel\.app|preview|testing|test|chaos-test/i.test(APP_URL);
const ALLOW_PROD_MUTATIONS = String(process.env.PLAYWRIGHT_ALLOW_PROD_MUTATIONS || '').toLowerCase() === 'true';

const DEFAULT_TABS = [
  'today',
  'financials',
  'back-office',
  'schedule',
  'published',
  'inventory',
  'ai-tools',
  'menu-intelligence',
  'reminders',
  'messages',
  'team',
  'maintenance',
  'settings',
  'help',
  'godmode',
];

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasCreds(prefix) {
  return !!(process.env[`${prefix}_EMAIL`] && process.env[`${prefix}_PASSWORD`]);
}

function creds(prefix) {
  return {
    label: prefix,
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  };
}

function ownerLikeCreds() {
  if (hasCreds('OWNER')) return creds('OWNER');
  return { label: 'TEST', email: requireEnv('TEST_EMAIL'), password: requireEnv('TEST_PASSWORD') };
}

function isCriticalUrl(url) {
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
  const isStaticAsset = /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|css|map)(?:\?|$)/i.test(u);
  if (f === 'net::ERR_ABORTED') return true;
  if (u.includes('/.well-known/vercel/jwe')) return true;
  if (u.includes('/google.firestore.v1.Firestore/Listen/channel')) return true;
  if (u.includes('/google.firestore.v1.Firestore/Write/channel') && f === 'net::ERR_ABORTED') return true;
  if (/google\.com\/images\/cleardot\.gif/i.test(u) && (f === 'net::ERR_ABORTED' || f === 'csp')) return true;
  if (isStaticAsset && /ERR_CONNECTION_RESET|ERR_ABORTED|ERR_NETWORK_CHANGED|ERR_TIMED_OUT|ERR_FAILED/i.test(f)) return true;
  return false;
}

function ignoreConsoleNoise(text) {
  const t = String(text || '');
  if (/ResizeObserver loop/i.test(t)) return true;
  if (/Failed to load resource:\s*net::ERR_CONNECTION_RESET/i.test(t)) return true;
  if (/\.well-known\/vercel\/jwe/i.test(t)) return true;
  if (/google\.com\/images\/cleardot\.gif/i.test(t)) return true;
  if (/Content Security Policy.*cleardot\.gif/i.test(t)) return true;
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
  const failOnAllConsoleErrors = options.failOnAllConsoleErrors === true;

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!failOnAllConsoleErrors && ignoreConsoleNoise(text)) return;
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
    if (status >= 500 || (status >= 400 && isCriticalUrl(requestUrl))) {
      problems.push({ type: 'http-error', status, requestUrl, pageUrl: page.url() });
    }
  });

  page.on('dialog', async (dialog) => {
    problems.push({ type: acceptDialogs ? 'dialog-accepted' : 'dialog-dismissed', message: dialog.message(), url: page.url() });
    if (acceptDialogs) await dialog.accept().catch(() => {});
    else await dialog.dismiss().catch(() => {});
  });
}

async function installTestFlags(page) {
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
      '86chaos_skip_onboarding',
    ];
    for (const key of keys) localStorage.setItem(key, 'true');
  });
}

async function closeBlockingModals(page) {
  for (let i = 0; i < 6; i++) {
    const dialog = page.getByRole('dialog').first();
    const visible = await dialog.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) break;

    const named = page.getByRole('button', {
      name: /close employee quick start|close manager quick start|skip for now|close|cancel|back|hide|done|got it|not now/i,
    }).first();
    const clicked = await named.click({ timeout: 1200 }).then(() => true).catch(() => false);
    if (!clicked) await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(350);
  }
}

async function login(page, email, password, options = {}) {
  await installTestFlags(page);
  await page.goto(`${APP_URL}/?tab=today`, { waitUntil: 'domcontentloaded' });

  const emailBox = page.getByRole('textbox', { name: /email address/i });
  if (await emailBox.isVisible({ timeout: options.loginBoxTimeout || 15000 }).catch(() => false)) {
    await emailBox.fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);
    await page.getByRole('button', { name: /unlock system|sign in|login/i }).click();

    const appShell = page.locator('main');
    const loginError = page.getByText(
      /firebase login timed out|firebase:\s*error|auth\/|wrong password|user not found|invalid credential|requests-from-referer|network-request-failed|permission-denied|workspace|membership|disabled/i
    );

    await expect(appShell.or(loginError).first()).toBeVisible({ timeout: 70000 });
    if (await loginError.isVisible().catch(() => false)) {
      throw new Error(`Login failed: ${await loginError.innerText().catch(() => 'unknown error')}`);
    }
  }

  await expect(page.locator('main')).toBeVisible({ timeout: 60000 });
  await closeBlockingModals(page);
  await page.waitForTimeout(500);
}

async function logoutIfPossible(page) {
  await closeBlockingModals(page);
  const profile = page.getByRole('button', { name: /Geoff|Owner|Admin|Manager|Staff|user|@/i }).first();
  await profile.click({ timeout: 1500 }).catch(() => {});
  await page.getByRole('button', { name: /log out|sign out/i }).first().click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function gotoTab(page, tab, options = {}) {
  await page.goto(`${APP_URL}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible({ timeout: options.timeout || 45000 });
  await closeBlockingModals(page);
  await page.waitForTimeout(options.wait || 900);
}

async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
}

async function assertNoUnavailablePage(page, problems, label) {
  const text = await bodyText(page);
  if (/This page is not available/i.test(text)) {
    problems.push({ type: 'unavailable-page', label, url: page.url(), textStart: text.slice(0, 700) });
  }
  await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
}

async function expectAnyText(page, patterns, problems, label) {
  const text = await bodyText(page);
  if (!patterns.some((pattern) => pattern.test(text))) {
    problems.push({ type: 'expected-text-missing', label, expected: patterns.map(String), url: page.url(), textStart: text.slice(0, 900) });
  }
}

async function clickButtonIfPresent(page, matcher, report = [], label = String(matcher), options = {}) {
  await closeBlockingModals(page);
  const button = page.locator('main').getByRole('button', { name: matcher }).first();
  const visible = await button.isVisible({ timeout: options.timeout || 2500 }).catch(() => false);
  if (!visible) {
    report.push({ label, clicked: false, reason: 'not visible' });
    return false;
  }
  if (await button.isDisabled().catch(() => false)) {
    report.push({ label, clicked: false, reason: 'disabled' });
    return false;
  }
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await button.click({ timeout: options.clickTimeout || 7000 });
  await page.waitForTimeout(options.wait || 700);
  await closeBlockingModals(page);
  report.push({ label, clicked: true, url: page.url() });
  return true;
}

async function fillFirstVisible(page, matchers, value, report = [], label = 'field') {
  for (const matcher of matchers) {
    const loc = page.locator('input, textarea').filter({ hasText: matcher instanceof RegExp ? matcher : undefined });
    // Prefer accessible labels/placeholders first.
    const candidates = [
      page.getByLabel(matcher).first(),
      page.getByPlaceholder(matcher).first(),
      page.getByRole('textbox', { name: matcher }).first(),
      page.getByRole('spinbutton', { name: matcher }).first(),
    ];
    for (const candidate of candidates) {
      const visible = await candidate.isVisible({ timeout: 500 }).catch(() => false);
      if (!visible) continue;
      await candidate.fill(String(value)).catch(async () => {
        await candidate.click({ timeout: 1000 });
        await candidate.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await candidate.type(String(value));
      });
      report.push({ label, matcher: String(matcher), filled: true });
      return true;
    }
  }
  report.push({ label, filled: false, reason: 'no matching visible input' });
  return false;
}

async function saveCurrentForm(page, report = [], label = 'save') {
  const saveMatchers = [/save/i, /add/i, /create/i, /submit/i, /record/i, /log/i];
  for (const matcher of saveMatchers) {
    const button = page.locator('main').getByRole('button', { name: matcher }).first();
    const visible = await button.isVisible({ timeout: 900 }).catch(() => false);
    const disabled = visible ? await button.isDisabled().catch(() => false) : true;
    if (!visible || disabled) continue;
    await button.click({ timeout: 6000 });
    await page.waitForTimeout(1000);
    await closeBlockingModals(page);
    report.push({ label, savedWith: String(matcher), url: page.url() });
    return true;
  }
  report.push({ label, saved: false, reason: 'no enabled save/add/create/record/log button found', url: page.url() });
  return false;
}

async function hardStopIfProduction() {
  if (MUTATION_OK_URL || ALLOW_PROD_MUTATIONS) return;
  throw new Error(`Refusing to run mutating test against APP_URL=${APP_URL}. Use testing/preview/local or set PLAYWRIGHT_ALLOW_PROD_MUTATIONS=true.`);
}

async function attachReport(testInfo, name, data) {
  await testInfo.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}

function findNumbers(text) {
  return String(text || '').match(/-?\$?\s*\d[\d,]*(?:\.\d+)?\s*%?/g) || [];
}

module.exports = {
  APP_URL,
  RUN_ID,
  TODAY,
  TEST_MONTH,
  DEFAULT_TABS,
  env,
  requireEnv,
  hasCreds,
  creds,
  ownerLikeCreds,
  watchForProblems,
  login,
  logoutIfPossible,
  gotoTab,
  bodyText,
  assertNoUnavailablePage,
  expectAnyText,
  clickButtonIfPresent,
  fillFirstVisible,
  saveCurrentForm,
  closeBlockingModals,
  hardStopIfProduction,
  attachReport,
  findNumbers,
};
