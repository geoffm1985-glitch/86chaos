const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const ENV_FILE_NAMES = ['.env.test.local', '.env.test', '.env.local', '.env'];
const ENV_SEARCH_ROOTS = [process.cwd(), path.resolve(__dirname, '..', '..', '..')];
const RAW_ENV = {};
const ENV_LOAD_REPORT = [];

function parseEnvText(text) {
  const parsed = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
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
        RAW_ENV[key] = value;
        if (!process.env[key] && value) {
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

function boolEnv(...names) {
  return /^(1|true|yes|y)$/i.test(envValue(...names));
}

function maskedEnvValue(name) {
  const value = envValue(name);
  if (!value) return '';
  if (/PASSWORD|PASS|SECRET|TOKEN|KEY|CREDENTIAL/i.test(name)) return `***${String(value).slice(-3)}`;
  return value;
}

const RUN_ID = envValue('CHAOS_FULL_AUDIT_RUN_ID') || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const BASE_URL = envValue('APP_URL', 'CHAOS_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL').replace(/\/$/, '');
const EXPECTED_VERSION = envValue('CHAOS_EXPECTED_VERSION') || readVersionFromDisk() || '16.0.19';
const SAFE_TESTING_URL_RE = /localhost|127\.0\.0\.1|vercel\.app|testing|test|preview/i;
const PRODUCTION_URL_RE = /(^|\.)app\.86chaos\.com|(^|\.)86chaos\.com/i;
const ALLOW_MUTATION = boolEnv('CHAOS_ALLOW_MUTATION') && SAFE_TESTING_URL_RE.test(BASE_URL) && !PRODUCTION_URL_RE.test(BASE_URL);

function readVersionFromDisk() {
  try {
    const versionPath = path.join(process.cwd(), 'public', 'version.json');
    if (!fs.existsSync(versionPath)) return '';
    return JSON.parse(fs.readFileSync(versionPath, 'utf8')).version || '';
  } catch (_) {
    return '';
  }
}

function appUrl(tab = 'today') {
  const url = new URL(BASE_URL);
  if (tab) url.searchParams.set('tab', tab);
  return url.toString();
}

const ROUTE_SPECS = [
  { tab: 'today', label: 'Today / Manager Brief', expect: /Today|Manager Brief|Need Attention|Role Home|Kitchen/i },
  { tab: 'kitchen', label: 'Kitchen Command Center', expect: /Kitchen Command|Command Center|Kitchen/i, optional: true },
  { tab: 'schedule', label: 'Schedule Builder', expect: /Schedule Builder|Auto-Fill|Assign|Publish|Coverage|Schedule/i },
  { tab: 'published', label: 'Time Clock / Published Schedule', expect: /Time Clock|My Schedule|Published Schedule|Clock/i },
  { tab: 'events', label: 'Event Calendar', expect: /Event|Calendar|Special Event|Add Event/i, optional: true },
  { tab: 'financials', label: 'Financials', expect: /Financial|Daily Close|Sales|Labor|Tips|Payroll/i },
  { tab: 'sales', label: 'Sales Import / Ledger', expect: /Sales|Import|Ledger|Daily Close|Revenue/i, optional: true },
  { tab: 'back-office', label: 'Back Office', expect: /Back Office|QuickBooks|Owner|Accountant|Records/i, optional: true },
  { tab: 'inventory', label: 'Inventory', expect: /Inventory|Vendor|Invoice|Par|Burn|Order/i },
  { tab: 'menu-intelligence', label: 'Menu Intelligence', expect: /Menu Intelligence|Menu Scan|Menu Items|86 Impact|Ingredient/i, optional: true },
  { tab: 'ai-tools', label: 'AI Tools / 86Voice', expect: /AI Tools|86Voice|Voice|Assistant|Ordering/i, optional: true },
  { tab: 'prep', label: 'Prep / Tasks / Labels', expect: /Prep|Task|Checklist|Label/i },
  { tab: 'recipes', label: 'Recipes', expect: /Recipe|Ingredients|Instructions|Yield/i },
  { tab: 'messages', label: 'Message Board / 86 Alerts', expect: /Message|86 Alert|Board|Post|Reply/i },
  { tab: 'reminders', label: 'Reminders', expect: /Reminder|Personal|Shared|Due/i, optional: true },
  { tab: 'team', label: 'Staff Roster / Team', expect: /Team|Staff|Roster|Employee|Role|Wage/i },
  { tab: 'maintenance', label: 'Maintenance', expect: /Maintenance|Equipment|Preventive|Repair|Issue/i },
  { tab: 'hr-training', label: 'HR / Training', expect: /HR|Training|Manual|Policy|Employee/i, optional: true },
  { tab: 'settings', label: 'Settings', expect: /Settings|Preferences|Workspace|Profile|Security/i },
  { tab: 'help', label: 'Help Center', expect: /Help|Manual|Quick Start|Search/i },
  { tab: 'audit', label: 'Audit', expect: /Audit|Log|Timeline|History/i, optional: true },
  { tab: 'godmode', label: 'System Administrator', expect: /System Administrator|People Directory|Online|Backup|Security|Permission/i, optional: true },
];

const FATAL_TEXT_RE = /Application error|Unhandled Runtime Error|Minified React error|Cannot read properties of undefined|Cannot read property|undefined is not a function|ReferenceError|TypeError:|Something went wrong|White screen/i;
const BAD_VALUE_RE = /Invalid Date|NaN|Infinity|undefined undefined|null null|Inactive -\d+ days|\$NaN|NaN%/i;
const PERMISSION_GATE_RE = /permission gate|not authorized|not available|Your role does not include|internal-only|access denied/i;
const LOGIN_RE = /Email Address\s*Password|Unlock System|Sign In|Log In|Forgot Password/i;
const STAFF_FORBIDDEN_RE = /System Administrator|Backup Center|Security Center|Forensics|QuickBooks Integration Hub|Python Automation|Pay Rate|Hourly Rate|Owner Pro/i;
const STAFF_ACTION_RE = /Backup Now|Restore Backup|Security Diagnostics|Delete User|Log Out Everyone|Run Python|Approve & Send|Send to QuickBooks|Post to QuickBooks/i;
const DANGEROUS_BUTTON_RE = /delete|remove|archive|nuke|obliterate|restore|reset|send push|send schedule|publish|log out everyone|approve|deny|resolve|reopen|clock in|clock out|submit|save|create|add|send|upload|import|export|sync|connect quickbooks|run|generate|scan/i;
const SAFE_CLICK_EXCLUDE_RE = /delete|remove|archive|nuke|obliterate|restore|reset|send push|send schedule|publish|log out everyone|approve|deny|resolve|reopen|clock in|clock out|submit|save|create|add|send|upload|import|sync|connect quickbooks|run automation|run python|backup now|fix|repair|notify|test push/i;

function ownerLikeCreds() {
  for (const prefix of ['OWNER', 'TEST_OWNER', 'ADMIN', 'MANAGER', 'TEST']) {
    const email = envValue(`${prefix}_EMAIL`, `CHAOS_${prefix}_EMAIL`, `${prefix}_USER`);
    const password = envValue(`${prefix}_PASSWORD`, `CHAOS_${prefix}_PASSWORD`, `${prefix}_PASS`);
    if (email && password) return { label: prefix, email, password };
  }
  return { label: 'OWNER', email: '', password: '' };
}

function creds(prefix) {
  return {
    label: prefix,
    email: envValue(`${prefix}_EMAIL`, `CHAOS_${prefix}_EMAIL`, `${prefix}_USER`),
    password: envValue(`${prefix}_PASSWORD`, `CHAOS_${prefix}_PASSWORD`, `${prefix}_PASS`),
  };
}

function requireCreds(account, label = 'account') {
  if (account && account.email && account.password) return;
  throw new Error(`Missing ${label} email/password env vars. Need OWNER_EMAIL/OWNER_PASSWORD at minimum. Env summary: ${JSON.stringify(envDebugSummary(), null, 2)}`);
}

function envDebugSummary() {
  const keys = ['APP_URL', 'CHAOS_EXPECTED_VERSION', 'CHAOS_ALLOW_MUTATION', 'CHAOS_QA_RESTAURANT_ID', 'CHAOS_QA_CREATE_RESTAURANT', 'OWNER_EMAIL', 'MANAGER_EMAIL', 'STAFF_EMAIL', 'SYSTEM_ADMIN_EMAIL'];
  return { cwd: process.cwd(), baseUrl: BASE_URL, expectedVersion: EXPECTED_VERSION, envFiles: ENV_LOAD_REPORT, values: Object.fromEntries(keys.map(k => [k, maskedEnvValue(k)])) };
}

async function bodyText(page, max = 30000) {
  try { return (await page.locator('body').innerText({ timeout: 8000 })).slice(0, max); }
  catch (_) { return ''; }
}

async function attachJson(testInfo, filename, data) {
  await testInfo.attach(filename, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}

function watchForProblems(page, problems) {
  page.on('pageerror', (error) => problems.push({ type: 'page-error', message: error.message, stack: String(error.stack || '').slice(0, 2500) }));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() !== 'error') return;
    if (/favicon|ResizeObserver|ERR_ABORTED|401|403|net::ERR_BLOCKED_BY_CLIENT|analytics/i.test(text)) return;
    problems.push({ type: 'console-error', message: text.slice(0, 1600) });
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status < 500) return;
    if (/hot-update|sockjs|favicon/i.test(url)) return;
    problems.push({ type: 'http-5xx', status, url });
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText || '';
    if (/favicon|hot-update|sockjs|jwe|ERR_ABORTED/i.test(`${url} ${failure}`)) return;
    problems.push({ type: 'requestfailed', url, failure });
  });
}

function summarizeProblems(problems) {
  return problems.slice(0, 50).map(p => ({ ...p, message: p.message ? String(p.message).slice(0, 1000) : undefined }));
}

async function dismissNoise(page) {
  const closeNames = [/skip and don't show again/i, /skip/i, /got it/i, /close/i, /not now/i, /maybe later/i, /×/i];
  for (const name of closeNames) {
    try {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible({ timeout: 700 }).catch(() => false)) await btn.click({ timeout: 1500 }).catch(() => {});
    } catch (_) {}
  }
  try { await page.keyboard.press('Escape'); } catch (_) {}
}

async function login(page, email, password, options = {}) {
  await page.goto(appUrl(options.tab || 'today'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('domcontentloaded');
  let text = await bodyText(page, 8000);
  if (!LOGIN_RE.test(text)) {
    await dismissNoise(page);
    return text;
  }
  const emailBox = page.getByPlaceholder(/email/i).first();
  const passwordBox = page.getByPlaceholder(/password/i).first();
  await expect(emailBox, 'Login email box should be visible').toBeVisible({ timeout: 30000 });
  await emailBox.fill(email);
  await passwordBox.fill(password);
  const loginButton = page.getByRole('button', { name: /unlock system|sign in|log in|login|unlock/i }).first();
  await loginButton.click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2500);
  await dismissNoise(page);
  text = await bodyText(page, 16000);
  if (LOGIN_RE.test(text) && /invalid|wrong|error|failed|not attached/i.test(text)) {
    throw new Error(`Login appears to have failed. Body: ${text.slice(0, 2000)}`);
  }
  return text;
}

async function expectVersion(page, expected = EXPECTED_VERSION) {
  if (!expected) return;
  const re = new RegExp(`(?:VERSION|v|Version)\\s*${expected.replace(/\./g, '\\.')}`, 'i');
  const text = await bodyText(page, 12000);
  expect(text, `App should display expected version ${expected}`).toMatch(re);
}

async function gotoTab(page, tab, options = {}) {
  await page.goto(appUrl(tab), { waitUntil: 'domcontentloaded', timeout: options.timeout || 45000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(options.settleMs || 900);
  await dismissNoise(page);
  return bodyText(page, options.maxText || 30000);
}

async function expectNoFatal(page, context = 'page') {
  const text = await bodyText(page, 35000);
  expect(text, `${context} should not show fatal React/runtime text`).not.toMatch(FATAL_TEXT_RE);
  expect(text, `${context} should not show broken display values`).not.toMatch(BAD_VALUE_RE);
}

async function collectVisibleButtonInfo(page, limit = 80) {
  return page.locator('button:visible').evaluateAll((buttons, max) => buttons.slice(0, max).map((button, index) => {
    const rect = button.getBoundingClientRect();
    return { index, text: (button.innerText || button.getAttribute('aria-label') || '').trim().slice(0, 120), width: Math.round(rect.width), height: Math.round(rect.height), disabled: button.disabled };
  }), limit).catch(() => []);
}

async function clickSafeButtons(page, testInfo, { maxButtons = 18, tab = 'unknown' } = {}) {
  const before = await collectVisibleButtonInfo(page, 120);
  const candidates = before.filter(b => b.text && !b.disabled && !SAFE_CLICK_EXCLUDE_RE.test(b.text)).slice(0, maxButtons);
  const clicked = [];
  for (const candidate of candidates) {
    const buttons = page.locator('button:visible');
    const count = await buttons.count().catch(() => 0);
    if (candidate.index >= count) continue;
    const button = buttons.nth(candidate.index);
    const label = candidate.text || `button-${candidate.index}`;
    await button.scrollIntoViewIfNeeded().catch(() => {});
    await button.click({ timeout: 5000 }).catch(err => clicked.push({ label, error: err.message }));
    await page.waitForTimeout(350);
    await dismissNoise(page);
    const text = await bodyText(page, 20000);
    if (FATAL_TEXT_RE.test(text) || BAD_VALUE_RE.test(text)) {
      await testInfo.attach(`bad-after-click-${tab}-${candidate.index}.txt`, { body: text.slice(0, 5000), contentType: 'text/plain' });
      throw new Error(`Safe click produced fatal/bad UI on ${tab}: ${label}`);
    }
    clicked.push({ label, ok: true });
  }
  await attachJson(testInfo, `safe-clicks-${tab}.json`, { before, candidates, clicked });
  return clicked;
}

async function viewportAudit(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const offenders = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (rect.right > viewportWidth + 8 || rect.left < -8) {
        offenders.push({ tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 120), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), className: String(el.className || '').slice(0, 120) });
      }
      if (offenders.length >= 25) break;
    }
    const smallButtons = Array.from(document.querySelectorAll('button')).map(el => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.getAttribute('aria-label') || '').trim();
      return { text, width: rect.width, height: rect.height };
    }).filter(b => b.text && b.width > 0 && b.height > 0 && (b.width < 38 || b.height < 34)).slice(0, 40);
    return { viewportWidth, viewportHeight, scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth), scrollHeight: Math.max(doc.scrollHeight, body.scrollHeight), horizontalOverflow: Math.max(doc.scrollWidth, body.scrollWidth) > viewportWidth + 8, offenders, smallButtons };
  });
}

async function collectTextNear(page, needle, radius = 1200) {
  return page.evaluate(({ needle, radius }) => {
    const terms = String(needle).toLowerCase().split(/\s+/).filter(Boolean);
    const results = [];
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!isVisible(el)) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < terms.join(' ').length) continue;
      const lower = text.toLowerCase();
      if (terms.every(t => lower.includes(t))) results.push(text.slice(0, radius));
      if (results.length >= 20) break;
    }
    return results;
  }, { needle, radius });
}

function seedReportPath() {
  return path.join(process.cwd(), 'test-results', '86chaos-full-audit-seed-report.json');
}

function readSeedReport() {
  const p = seedReportPath();
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function mutationSkipMessage() {
  return `Mutation/fake restaurant tests require safe preview/local APP_URL and CHAOS_ALLOW_MUTATION=true. Current mutation allowed: ${ALLOW_MUTATION}. Base URL: ${BASE_URL}`;
}

module.exports = {
  RUN_ID,
  BASE_URL,
  EXPECTED_VERSION,
  ALLOW_MUTATION,
  ROUTE_SPECS,
  FATAL_TEXT_RE,
  BAD_VALUE_RE,
  PERMISSION_GATE_RE,
  STAFF_FORBIDDEN_RE,
  STAFF_ACTION_RE,
  DANGEROUS_BUTTON_RE,
  ownerLikeCreds,
  creds,
  requireCreds,
  envValue,
  boolEnv,
  envDebugSummary,
  appUrl,
  bodyText,
  attachJson,
  watchForProblems,
  summarizeProblems,
  login,
  expectVersion,
  gotoTab,
  expectNoFatal,
  clickSafeButtons,
  viewportAudit,
  collectTextNear,
  readSeedReport,
  seedReportPath,
  mutationSkipMessage,
};
