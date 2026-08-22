const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
let runContext = null;
try { runContext = require('../../../scripts/86chaos-release-gate/run-context.cjs'); } catch (_) { runContext = null; }

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


function readCapabilitiesFromDisk() {
  const runId = process.env.CHAOS_RELEASE_GATE_RUN_ID || process.env.CHAOS_FULL_AUDIT_RUN_ID || '';
  const runDir = runContext?.getRunDir?.(runId) || '';
  const filePath = runDir ? path.join(runDir, 'app-capabilities.json') : '';
  try {
    if (!filePath || !fs.existsSync(filePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

const CAPABILITIES = readCapabilitiesFromDisk();
function hasFeature(featureKey) {
  const features = CAPABILITIES.features || {};
  return Boolean(features && features[featureKey] === true);
}

const RUN_ID = envValue('CHAOS_FULL_AUDIT_RUN_ID') || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const BASE_URL = envValue('APP_URL', 'CHAOS_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL').replace(/\/$/, '');
const EXPECTED_VERSION = envValue('CHAOS_EXPECTED_VERSION') || readVersionFromDisk() || '16.0.32';
const QA_WORKSPACE_NAME = process.env.CHAOS_QA_WORKSPACE_NAME || `86 Chaos Release Gate QA ${RUN_ID}`;
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
  { tab: 'ops', label: 'Kitchen Command Center', expect: /Kitchen Command|Command Center|Kitchen/i, optional: true },
  { tab: 'schedule', label: 'Schedule Builder', expect: /Schedule Builder|Auto-Fill|Assign|Publish|Coverage|Schedule/i },
  { tab: 'published', label: 'Time Clock / Published Schedule', expect: /Time Clock|My Schedule|Published Schedule|Clock/i },
  { tab: 'events', label: 'Event Calendar', expect: /Event|Calendar|Special Event|Add Event/i, optional: true },
  { tab: 'financials', label: 'Financials', expect: /Financial|Daily Close|Sales|Labor|Tips|Payroll/i },
  { tab: 'sales', label: 'Sales Import / Ledger', expect: /Sales|Import|Ledger|Daily Close|Revenue/i, optional: true },
  { tab: 'labor', label: 'Labor & Payroll', expect: /Labor|Payroll|Timesheet|Punch|Tips|Hours/i, optional: true },
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
const BAD_VALUE_RE = /\bInvalid Date\b(?!s)|Infinity|undefined undefined|null null|Inactive -\d+ days|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i;
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

function isControlledValidationResponse(response) {
  const status = response.status();
  if (status !== 400 && status !== 404) return false;
  const url = response.url();
  const contentType = response.headers()['content-type'] || '';
  const expectedReject = /\/api\/(report-bug|scan|scan-menu|scan-invoice|voice-command|send-push|safe-write|notification-receipt|brand-logo|quickbooks|personal-reminder|alerts|login-bootstrap|whoami|admin|full-audit-qa-cleanup)/i.test(url);
  return expectedReject && /json|text\/plain|application\/problem/i.test(contentType || 'application/json');
}

function isIgnorableStaticAssetFailure(text = '') {
  return /ERR_ABORTED|ERR_CONNECTION_RESET|net::ERR_FAILED/i.test(text) && /\/(6136|6139|6240|wisco|app-icon|notification-badge)\.(jpg|png|webp|ico)/i.test(text);
}

function watchForProblems(page, problems, options = {}) {
  const nonfatal4xx = [];
  const seen = new Set();
  const pushProblem = (row) => {
    const key = `${row.type}|${row.status || ''}|${row.url || ''}|${row.message || row.failure || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push(row);
  };
  page.on('pageerror', (error) => pushProblem({ type: 'page-error', message: error.message, stack: String(error.stack || '').slice(0, 2500) }));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() !== 'error') return;
    if (/favicon|ResizeObserver|ERR_ABORTED|401|403|net::ERR_BLOCKED_BY_CLIENT|analytics/i.test(text)) return;
    if (/Failed to load resource:.*status of (400|404)/i.test(text)) return;
    if (isIgnorableStaticAssetFailure(text)) return;
    pushProblem({ type: 'console-error', message: text.slice(0, 1600) });
  });
  page.on('response', async (response) => {
    const status = response.status();
    const url = response.url();
    if (/hot-update|sockjs|favicon/i.test(url)) return;
    if (status === 400 || status === 404) {
      const controlled = isControlledValidationResponse(response);
      const row = { type: 'controlled-4xx', method: response.request().method(), status, url: url.split('?')[0].slice(0, 260), contentType: response.headers()['content-type'] || '', controlled };
      if (controlled) {
        nonfatal4xx.push(row);
        if (options.recordNonfatal4xx) problems.nonfatal4xx = nonfatal4xx;
        return;
      }
      if (/\/(6136|6139|6240|wisco|app-icon|notification-badge)\.(jpg|png|webp|ico)/i.test(url)) return;
    }
    if (status >= 500) pushProblem({ type: 'http-5xx', method: response.request().method(), status, url: url.split('?')[0].slice(0, 260), contentType: response.headers()['content-type'] || '' });
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText || '';
    if (/favicon|hot-update|sockjs|jwe|ERR_ABORTED/i.test(`${failure} ${url}`)) return;
    if (isIgnorableStaticAssetFailure(`${failure} ${url}`)) return;
    pushProblem({ type: 'requestfailed', url: url.split('?')[0].slice(0, 260), failure });
  });
  return { nonfatal4xx };
}

function summarizeProblems(problems) {
  return problems.slice(0, 50).map(p => ({ ...p, message: p.message ? String(p.message).slice(0, 1000) : undefined }));
}

async function chooseQaWorkspace(page) {
  const preferred = envValue('CHAOS_QA_WORKSPACE_NAME', 'CHAOS_QA_WORKSPACE') || QA_WORKSPACE_NAME;
  const currentText = await bodyText(page, 12000);
  if (currentText.includes(preferred) && !/choose workspace|select workspace|select restaurant|choose restaurant/i.test(currentText)) return false;
  const openChooser = async () => {
    const chooserText = await bodyText(page, 12000);
    if (/choose workspace|select workspace|select restaurant|choose restaurant/i.test(chooserText)) return true;
    const switchers = [
      page.getByTitle(/switch workspace/i).first(),
      page.getByRole('button', { name: /switch workspace|switch restaurant|switch$/i }).first(),
      page.getByText(/\bSwitch\b/i).first()
    ];
    for (const candidate of switchers) {
      if (await candidate.isVisible({ timeout: 1200 }).catch(() => false)) {
        await candidate.click({ timeout: 2500 }).catch(() => {});
        await page.waitForTimeout(900);
        const nextText = await bodyText(page, 12000);
        if (/choose workspace|select workspace|select restaurant|choose restaurant/i.test(nextText) || nextText.includes(preferred)) return true;
      }
    }
    return false;
  };

  const chooserOpen = await openChooser();
  if (!chooserOpen) return false;
  const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const preferredRe = new RegExp(`^Open\\s+${escapeRegex(preferred)}(?:\\s|$)`, 'i');
  const directButton = page.getByRole('button', { name: preferredRe }).first();
  const exact = page.getByText(preferred, { exact: true }).first();
  const partial = page.getByText(preferred, { exact: false }).first();
  let button = null;
  if (await directButton.isVisible({ timeout: 5000 }).catch(() => false)) button = directButton;
  else {
    let target = null;
    if (await exact.isVisible({ timeout: 3500 }).catch(() => false)) target = exact;
    else if (await partial.isVisible({ timeout: 2500 }).catch(() => false)) target = partial;
    if (!target) throw new Error(`The disposable QA workspace "${preferred}" was not available in the workspace chooser.`);
    button = target.locator('xpath=ancestor-or-self::button[1]').first();
  }
  if (!(await button?.count?.().catch(() => 0))) throw new Error(`The disposable QA workspace "${preferred}" did not resolve to a clickable workspace button.`);
  await button.click({ timeout: 5000 }).catch(async (err) => {
    const message = String(err?.message || err || '');
    if (!/intercepts pointer events|not stable|receives pointer events|timeout/i.test(message)) throw err;
    await button.evaluate((el) => el.click());
  });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1200);
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);
  return true;
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


async function visibleDialogSnapshot(page) {
  return page.locator('[role="dialog"]:visible').evaluateAll((dialogs) => dialogs.map((dialog, index) => {
    const labelledBy = dialog.getAttribute('aria-labelledby') || '';
    const labelledNode = labelledBy ? document.getElementById(labelledBy) : null;
    const heading = dialog.querySelector('h1,h2,h3,[data-dialog-title]');
    const title = (dialog.getAttribute('aria-label') || labelledNode?.innerText || heading?.innerText || dialog.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    return { index, title, text: (dialog.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 260) };
  })).catch(() => []);
}

async function dismissBlockingDialogs(page, options = {}) {
  const maxPasses = options.maxPasses || 4;
  const dismissed = [];
  const dangerous = /delete|remove|archive|reset|restore|publish|approve|deny|confirm|yes|ok delete|permanently/i;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const dialogs = await visibleDialogSnapshot(page);
    const backdropCount = await page.locator('.chaos-modal-backdrop:visible').count().catch(() => 0);
    if (!dialogs.length && backdropCount === 0) return { ok: true, dismissed, remainingDialogs: [], backdropCount: 0 };
    const dialog = dialogs[0] || { title: 'modal backdrop', text: '' };
    const title = dialog.title || 'dialog';
    const candidates = [];
    if (title && title !== 'dialog' && title !== 'modal backdrop') candidates.push({ label: `Close ${title}`, exact: true });
    candidates.push(
      { label: "Skip and don't show again", exact: true },
      { label: 'Skip and don\'t show again', exact: true },
      { label: 'Got it', exact: true },
      { label: 'I understand', exact: true },
      { label: 'Done', exact: true },
      { label: 'Not now', exact: true },
      { label: 'Maybe later', exact: true },
      { label: 'Close', exact: true },
      { label: '×', exact: true }
    );
    let used = null;
    for (const candidate of candidates) {
      if (dangerous.test(candidate.label)) continue;
      const locator = page.getByRole('button', { name: candidate.label, exact: candidate.exact }).first();
      if (await locator.isVisible({ timeout: 650 }).catch(() => false)) {
        await locator.click({ timeout: 2500 });
        used = candidate.label;
        break;
      }
    }
    if (!used) {
      return { ok: false, dismissed, remainingDialogs: await visibleDialogSnapshot(page), backdropCount: await page.locator('.chaos-modal-backdrop:visible').count().catch(() => 0), failure: `Visible dialog could not be safely dismissed: ${title}` };
    }
    await page.waitForTimeout(400);
    await page.locator('.chaos-modal-backdrop:visible').first().waitFor({ state: 'hidden', timeout: 3500 }).catch(() => {});
    dismissed.push({ title, control: used });
  }
  const remainingDialogs = await visibleDialogSnapshot(page);
  const backdropCount = await page.locator('.chaos-modal-backdrop:visible').count().catch(() => 0);
  if (remainingDialogs.length || backdropCount) {
    return { ok: false, dismissed, remainingDialogs, backdropCount, failure: `Blocking dialogs remained after ${maxPasses} dismiss attempts.` };
  }
  return { ok: true, dismissed, remainingDialogs: [], backdropCount: 0 };
}

async function login(page, email, password, options = {}) {
  await page.goto(appUrl(options.tab || 'today'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('domcontentloaded');
  let text = await bodyText(page, 8000);
  if (!LOGIN_RE.test(text)) {
    await dismissNoise(page);
    return text;
  }
  await dismissBlockingDialogs(page, { maxPasses: 6 }).catch(() => null);
  const emailBox = page.getByRole('textbox', { name: /^Email Address$/i }).first();
  const passwordBox = page.locator('input[type="password"][autocomplete="current-password"], input[type="password"][aria-label="Password"]').first();
  await expect(emailBox, 'Login email box should be visible').toBeVisible({ timeout: 30000 });
  await emailBox.fill(email);
  await passwordBox.fill(password);
  const loginButton = page.getByRole('button', { name: /unlock system|sign in|log in|login|unlock/i }).first();
  await loginButton.click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2500);
  await dismissBlockingDialogs(page, { maxPasses: 6 }).catch(() => null);
  await chooseQaWorkspace(page);
  await dismissBlockingDialogs(page, { maxPasses: 6 }).catch(() => null);
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

async function waitForRouteSettle(page, tab, options = {}) {
  const spec = ROUTE_SPECS.find(r => r.tab === tab);
  const timeout = options.timeout || 45000;
  const deadline = Date.now() + timeout;
  let selectedWorkspace = false;
  while (Date.now() < deadline) {
    const text = await bodyText(page, 16000);
    if (/choose workspace|select workspace|select restaurant|choose restaurant/i.test(text)) {
      selectedWorkspace = await chooseQaWorkspace(page).catch((err) => {
        throw new Error(`Workspace chooser blocked ${tab} route readiness: ${err?.message || err}`);
      }) || selectedWorkspace;
      await page.waitForTimeout(500);
      continue;
    }
    const activeTab = await page.evaluate(() => new URLSearchParams(window.location.search).get('tab') || '').catch(() => '');
    const routeLooksReady = !/Loading workspace|Preparing|Unlock System|Email Address\s*Password/i.test(text);
    const re = spec?.expect ? new RegExp(spec.expect.source, 'i') : null;
    if (routeLooksReady && (activeTab === tab || !tab) && (!re || re.test(text) || /permission|restricted|not available|access denied/i.test(text))) break;
    await page.waitForTimeout(350);
  }
  if (selectedWorkspace) await page.waitForTimeout(options.settleMs ?? 700);
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);
  await dismissNoise(page);
  return bodyText(page, options.maxText || 30000);
}

async function openTabInApp(page, tab, options = {}) {
  const settleMs = options.settleMs ?? 700;
  const current = new URL(page.url());
  const currentTab = current.searchParams.get('tab') || 'today';
  if (currentTab === tab && !options.force) {
    await page.waitForTimeout(settleMs);
    return waitForRouteSettle(page, tab, options);
  }
  const navCandidates = [
    page.getByRole('button', { name: new RegExp(`^${tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first(),
    page.getByRole('link', { name: new RegExp(`^${tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first(),
  ];
  for (const candidate of navCandidates) {
    if (await candidate.isVisible({ timeout: 500 }).catch(() => false)) {
      await candidate.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(settleMs);
      return waitForRouteSettle(page, tab, options);
    }
  }
  await page.evaluate((nextTab) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    window.history.pushState({ tab: nextTab }, '', `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { tab: nextTab } }));
    window.dispatchEvent(new CustomEvent('chaos:navigate-tab', { detail: { tab: nextTab } }));
  }, tab).catch(() => {});
  await page.waitForTimeout(settleMs);
  return waitForRouteSettle(page, tab, options);
}

async function gotoTab(page, tab, options = {}) {
  if (options.fullReload === true) {
    await page.goto(appUrl(tab), { waitUntil: 'domcontentloaded', timeout: options.timeout || 45000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(options.settleMs || 900);
    await dismissBlockingDialogs(page, { maxPasses: 6 }).catch(() => null);
    await chooseQaWorkspace(page);
    await dismissBlockingDialogs(page, { maxPasses: 6 }).catch(() => null);
    await dismissNoise(page);
    return bodyText(page, options.maxText || 30000);
  }
  return openTabInApp(page, tab, options);
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
    const coarsePointer = Boolean(window.matchMedia?.('(pointer: coarse)')?.matches) || viewportWidth <= 640;
    const minHit = coarsePointer ? 42 : 24;
    const smallButtons = Array.from(document.querySelectorAll('button')).map(el => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.getAttribute('aria-label') || '').trim();
      const style = window.getComputedStyle(el);
      return { text, width: Math.round(rect.width), height: Math.round(rect.height), minHit, coarsePointer, display: style.display, visibility: style.visibility };
    }).filter(b => b.text && b.width > 0 && b.height > 0 && b.display !== 'none' && b.visibility !== 'hidden' && (b.width < minHit || b.height < minHit)).slice(0, 40);
    return { viewportWidth, viewportHeight, scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth), scrollHeight: Math.max(doc.scrollHeight, body.scrollHeight), horizontalOverflow: Math.max(doc.scrollWidth, body.scrollWidth) > viewportWidth + 8, offenders, smallButtons, touchTargetPolicy: { coarsePointer, minHit } };
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


async function neutralizeTestingPreviewOverlays(page, options = {}) {
  const evidence = [];
  const url = page.url?.() || BASE_URL || '';
  if (!SAFE_TESTING_URL_RE.test(url) || PRODUCTION_URL_RE.test(url)) {
    return { ok: true, skipped: true, reason: 'not a safe testing-preview URL', evidence };
  }
  const result = await page.evaluate(() => {
    const rows = [];
    const knownTags = new Set(['VERCEL-LIVE-FEEDBACK', 'VERCEL-TOOLBAR', 'VERCEL-LIVE-FEEDBACK-BUTTON']);
    const candidates = Array.from(document.querySelectorAll('vercel-live-feedback, vercel-toolbar, [data-vercel-toolbar], [data-vercel-live-feedback]'))
      .filter(el => knownTags.has(el.tagName) || String(el.tagName || '').toLowerCase().includes('vercel'));
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const row = {
        tag: el.tagName,
        visible: Boolean(rect.width || rect.height),
        boundingBox: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        pointerEvents: style.pointerEvents || '',
        action: 'none',
      };
      try {
        const shadowButtons = el.shadowRoot ? Array.from(el.shadowRoot.querySelectorAll('button,[role="button"]')) : [];
        const close = shadowButtons.find(button => /close|hide|dismiss/i.test(button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || ''));
        if (close) {
          close.click();
          row.action = 'clicked-shadow-close';
        } else {
          el.setAttribute('data-86chaos-test-overlay-neutralized', 'true');
          el.style.pointerEvents = 'none';
          row.action = 'disabled-pointer-events';
        }
      } catch (err) {
        row.action = `failed:${String(err?.message || err).slice(0, 120)}`;
      }
      rows.push(row);
    }
    return { evidence: rows, remaining: Array.from(document.querySelectorAll('vercel-live-feedback, vercel-toolbar, [data-vercel-toolbar], [data-vercel-live-feedback]')).length };
  }).catch(err => ({ evidence: [{ action: 'evaluate-failed', error: String(err?.message || err).slice(0, 200) }], remaining: -1 }));
  evidence.push(...(result.evidence || []));
  if (options.attach && evidence.length) await options.attach('vercel-preview-overlay-neutralized.json', { evidence, remaining: result.remaining });
  return { ok: true, skipped: false, evidence, remaining: result.remaining };
}

function seedReportPath() {
  const runId = process.env.CHAOS_RELEASE_GATE_RUN_ID || process.env.CHAOS_FULL_AUDIT_RUN_ID || RUN_ID;
  return runContext?.getSeedReportPath?.(runId) || path.join(process.cwd(), 'test-results', '86chaos-play-store-release-gate', runId, '86chaos-full-audit-seed-report.json');
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
  CAPABILITIES,
  hasFeature,
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
  openTabInApp,
  waitForRouteSettle,
  expectNoFatal,
  clickSafeButtons,
  viewportAudit,
  collectTextNear,
  readSeedReport,
  seedReportPath,
  mutationSkipMessage,
  chooseQaWorkspace,
  dismissBlockingDialogs,
  visibleDialogSnapshot,
  neutralizeTestingPreviewOverlays,
  QA_WORKSPACE_NAME,
};
