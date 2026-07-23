// 86 Chaos Playwright helper kit for 15.1.10+.
// Safe by default: UI checks only. Optional mutation clicks require CHAOS_ALLOW_MUTATION=1.
const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (_) {}
}

for (const name of ['.env.playwright', '.env.local', '.env.test', '.env']) loadEnvFile(path.resolve(process.cwd(), name));

const RUN_ID = process.env.CHAOS_RUN_ID || `chaos-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const BASE_URL = (process.env.CHAOS_BASE_URL || process.env.APP_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXPECTED_VERSION = process.env.CHAOS_EXPECTED_VERSION || process.env.EXPECTED_VERSION || '15.1.10';

const ROUTE_ALIASES = {
  sales: 'sales',
  financials: 'financials',
  labor: 'labor',
  backoffice: 'back-office',
  'back-office': 'back-office',
  schedule: 'schedule',
  published: 'published',
  timeclock: 'published',
  'time-clock': 'published',
  inventory: 'inventory',
  'menu-intelligence': 'menu-intelligence',
  'ai-tools': 'ai-tools',
  voice: 'ai-tools',
  prep: 'prep',
  recipes: 'recipes',
  reminders: 'reminders',
  team: 'team',
  roster: 'team',
  settings: 'settings',
  help: 'help',
  messages: 'messages',
  today: 'today',
  godmode: 'godmode',
  audit: 'audit',
};

const FATAL_TEXT_RE = /Application error|Unhandled Runtime Error|Failed to compile|Module not found|Cannot find module|Cannot read properties of undefined|Cannot read property|undefined is not an object|Minified React error|ReferenceError:|SyntaxError:|TypeError:|No test found/i;
const PERMISSION_GATE_RE = /Plan & Permission Gate|permission|not authorized|access denied|does not include this tool|not include this tool|role does not include|not available for this workspace|locked feature|ask the account owner/i;
const UNAVAILABLE_RE = /This page is not available|not available|coming soon|turned off for this workspace|old app link/i;
const INTERNAL_ADMIN_DEBUG_RE = /private_key|firebase-adminsdk|MASTER_ADMIN_EMAILS|CRON_SECRET|Security Diagnostics|Forensics Timeline|Backup Center|Global Users|Access Control|Deployment Readiness|Emergency Read-Only|Grant Access|Nuke/i;
const STAFF_VISIBLE_FORBIDDEN_RE = /Emergency Read-Only|Backup Now|Restore Backup|Forensics Timeline|Security Diagnostics|Global Users|Access Control|Deploy Workspace|Grant Access|CRON_SECRET|private_key|firebase-adminsdk/i;
const STAFF_UNLOCKED_RESTRICTED_CONTENT_RE = /Approve Timesheets|Export Daily Ledger|Gross Profit|Prime Cost|Operating Expenses|Net Income|Schedule Builder|Publish Week|Labor Cost|Daily Ledger|QuickBooks|Owner Controls|Back Office Suite/i;

function envValue(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function hasCreds(prefix) {
  const p = String(prefix || '').toUpperCase();
  return Boolean(envValue([`${p}_EMAIL`, `TEST_${p}_EMAIL`, `CHAOS_${p}_EMAIL`, `E2E_${p}_EMAIL`]) && envValue([`${p}_PASSWORD`, `TEST_${p}_PASSWORD`, `CHAOS_${p}_PASSWORD`, `E2E_${p}_PASSWORD`]));
}

function creds(prefix) {
  const p = String(prefix || '').toUpperCase();
  const extraOwnerEmail = p === 'OWNER' ? ['TEST_EMAIL', 'TEST_OWNER_EMAIL', 'OWNER_LIKE_EMAIL'] : [];
  const extraOwnerPassword = p === 'OWNER' ? ['TEST_PASSWORD', 'TEST_OWNER_PASSWORD', 'OWNER_LIKE_PASSWORD'] : [];
  return {
    label: p,
    email: envValue([`${p}_EMAIL`, `TEST_${p}_EMAIL`, `CHAOS_${p}_EMAIL`, `E2E_${p}_EMAIL`, ...extraOwnerEmail]),
    password: envValue([`${p}_PASSWORD`, `TEST_${p}_PASSWORD`, `CHAOS_${p}_PASSWORD`, `E2E_${p}_PASSWORD`, ...extraOwnerPassword]),
  };
}

function ownerLikeCreds() {
  if (hasCreds('OWNER')) return creds('OWNER');
  return {
    label: 'OWNER',
    email: envValue(['OWNER_EMAIL', 'TEST_EMAIL', 'TEST_OWNER_EMAIL', 'CHAOS_OWNER_EMAIL', 'E2E_OWNER_EMAIL']),
    password: envValue(['OWNER_PASSWORD', 'TEST_PASSWORD', 'TEST_OWNER_PASSWORD', 'CHAOS_OWNER_PASSWORD', 'E2E_OWNER_PASSWORD']),
  };
}

function managerCredsOrOwner() { return hasCreds('MANAGER') ? creds('MANAGER') : ownerLikeCreds(); }
function staffCredsOrNull() { return hasCreds('STAFF') ? creds('STAFF') : null; }

function requireCreds(test, account, label) {
  if (!account || !account.email || !account.password) {
    throw new Error(`Missing ${label} credentials. Add them to .env.playwright or .env. Example: OWNER_EMAIL=... and OWNER_PASSWORD=...`);
  }
}

function isMutationAllowed() { return process.env.CHAOS_ALLOW_MUTATION === '1'; }

function watchForProblems(page, problems) {
  page.on('pageerror', (error) => {
    problems.push({ type: 'pageerror', message: error.message, stack: String(error.stack || '').slice(0, 2000), url: page.url() });
  });
  page.on('console', (msg) => {
    const text = msg.text() || '';
    if (msg.type() === 'error' && FATAL_TEXT_RE.test(text)) problems.push({ type: 'console-error', message: text.slice(0, 1500), url: page.url() });
  });
  page.on('requestfailed', (req) => {
    const kind = req.resourceType();
    const url = req.url();
    if (!['document', 'script'].includes(kind)) return;
    if (/favicon|sockjs|hot-update|chrome-extension|google-analytics|firebaselogging/i.test(url)) return;
    problems.push({ type: 'requestfailed', resourceType: kind, url, failure: req.failure()?.errorText || '' });
  });
}

function summarizeProblems(problems = []) {
  return problems.map((p) => ({ ...p, message: p.message ? String(p.message).slice(0, 1000) : p.message, stack: p.stack ? String(p.stack).slice(0, 1000) : p.stack }));
}

async function bodyText(page, limit = 50000) {
  const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function pageState(text = '') {
  return {
    isPermissionGate: PERMISSION_GATE_RE.test(text),
    isUnavailable: UNAVAILABLE_RE.test(text),
    hasInternalAdminDebug: INTERNAL_ADMIN_DEBUG_RE.test(text),
    hasFatalText: FATAL_TEXT_RE.test(text),
  };
}

async function settle(page, ms = 700) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  if (ms) await page.waitForTimeout(ms);
}

async function closeTransientUi(page) {
  await page.keyboard.press('Escape').catch(() => {});
  const closeButtons = [
    page.getByRole('button', { name: /close|dismiss|not now|skip|got it/i }).first(),
    page.locator('button[title*="Close" i]').first(),
    page.locator('button[aria-label*="Close" i]').first(),
  ];
  for (const button of closeButtons) {
    try { if (await button.isVisible({ timeout: 700 })) await button.click({ timeout: 1200 }); } catch (_) {}
  }
}

async function maybeClick(page, locator, options = {}) {
  try {
    const target = locator.first ? locator.first() : locator;
    if (await target.isVisible({ timeout: options.timeout || 1200 })) {
      await target.click({ timeout: options.clickTimeout || 3000, force: !!options.force });
      await settle(page, options.settleMs ?? 350);
      return true;
    }
  } catch (_) {}
  return false;
}

async function fillFirstVisible(page, locators, value) {
  for (const locator of locators) {
    try {
      const target = locator.first();
      if (await target.isVisible({ timeout: 1500 })) {
        await target.fill(value);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

async function login(page, email, password, options = {}) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: options.timeout || 45000 });
  await settle(page, 500);
  await closeTransientUi(page);

  const passwordField = page.locator('input[type="password"]').first();
  const needsLogin = await passwordField.isVisible({ timeout: options.loginBoxTimeout || 8000 }).catch(() => false);
  if (needsLogin) {
    const emailFilled = await fillFirstVisible(page, [
      page.locator('input[type="email"]'),
      page.locator('input[name*="email" i]'),
      page.locator('input[placeholder*="email" i]'),
      page.locator('input[type="text"]'),
    ], email);
    expect(emailFilled, 'Could not find a visible email field on the login screen').toBeTruthy();
    await passwordField.fill(password);

    const clicked = await maybeClick(page, page.getByRole('button', { name: /unlock|sign in|login|enter|save/i }), { timeout: 2500, settleMs: 1200 })
      || await maybeClick(page, page.locator('button[type="submit"]'), { timeout: 2500, settleMs: 1200 });
    expect(clicked, 'Could not find the login submit button').toBeTruthy();
  }

  await settle(page, 1200);

  const text = await bodyText(page, 10000);
  if (/Select a workspace|Choose the restaurant|View all workspaces/i.test(text)) {
    await maybeClick(page, page.getByText(/Cheers|Active|Open|Restaurant|Workspace/i).first(), { settleMs: 800 });
    await maybeClick(page, page.getByRole('button', { name: /continue|open|enter|unlock|select/i }).first(), { settleMs: 800 });
  }

  const after = await bodyText(page, 12000);
  if (/auth\/|wrong-password|invalid-credential|user-not-found|Login successful, but user profile is missing/i.test(after)) {
    throw new Error(`Login failed or profile missing. Visible text: ${after.slice(0, 1200)}`);
  }
  return after;
}

async function expectVersion(page) {
  if (!EXPECTED_VERSION || EXPECTED_VERSION === 'any' || EXPECTED_VERSION === '*') return { skipped: true };
  let jsonVersion = '';
  try {
    const url = `${BASE_URL}/version.json?t=${Date.now()}`;
    jsonVersion = await page.evaluate(async (u) => {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) return '';
      const data = await r.json().catch(() => ({}));
      return data.version || data.build || data.label || '';
    }, url);
  } catch (_) {}
  const visible = await bodyText(page, 30000).catch(() => '');
  const haystack = `${jsonVersion}\n${visible}`;
  expect(haystack, `Expected app version ${EXPECTED_VERSION}. Set CHAOS_EXPECTED_VERSION=any to skip.`).toContain(EXPECTED_VERSION);
  return { version: jsonVersion || EXPECTED_VERSION };
}

function routeUrl(tab) {
  const route = ROUTE_ALIASES[String(tab || '').trim()] || String(tab || 'today').trim();
  const url = new URL(BASE_URL);
  url.searchParams.set('tab', route);
  return url.toString();
}

async function gotoTab(page, tab, options = {}) {
  await page.goto(routeUrl(tab), { waitUntil: 'domcontentloaded', timeout: options.timeout || 45000 });
  await settle(page, options.settleMs ?? 700);
  await closeTransientUi(page);
}

async function expectRouteHealthy(page, tab, options = {}) {
  await gotoTab(page, tab, options);
  const text = await bodyText(page, options.textLimit || 50000);
  const state = pageState(text);
  expect(text.length, `${tab} should render body text instead of a blank shell`).toBeGreaterThan(20);
  expect(text, `${tab} should not show a fatal app/runtime error`).not.toMatch(FATAL_TEXT_RE);
  return { tab, text, gated: state.isPermissionGate, unavailable: state.isUnavailable, state };
}

async function openMenu(page) {
  const before = await bodyText(page, 8000).catch(() => '');
  const candidates = [
    page.locator('.native-mobile-bottom-nav button[title*="More" i]').first(),
    page.locator('button.native-menu-button').first(),
    page.locator('button[title*="More tools" i]').first(),
    page.locator('button[aria-label*="menu" i]').first(),
    page.getByRole('button', { name: /open menu|menu|more/i }).first(),
  ];
  for (const c of candidates) {
    if (await maybeClick(page, c, { timeout: 900, force: true, settleMs: 500 })) {
      const after = await bodyText(page, 10000).catch(() => '');
      return after !== before || /App menu|Open Menu|System Admin|Help Center/i.test(after);
    }
  }
  return false;
}

async function attachReport(testInfo, name, data) {
  await testInfo.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}

function envDebugSummary() {
  const keys = Object.keys(process.env).filter((k) => /^(CHAOS_|APP_URL|BASE_URL|PLAYWRIGHT_|OWNER_|TEST_|MANAGER_|STAFF_|SYSTEM_ADMIN_|WRONG_WORKSPACE_|DISABLED_)/.test(k)).sort();
  const redacted = {};
  for (const key of keys) {
    const value = process.env[key];
    redacted[key] = /PASSWORD|SECRET|KEY|TOKEN/i.test(key) ? Boolean(value) : value;
  }
  return redacted;
}

module.exports = {
  RUN_ID,
  BASE_URL,
  EXPECTED_VERSION,
  hasCreds,
  creds,
  ownerLikeCreds,
  managerCredsOrOwner,
  staffCredsOrNull,
  requireCreds,
  isMutationAllowed,
  watchForProblems,
  login,
  expectVersion,
  gotoTab,
  expectRouteHealthy,
  bodyText,
  pageState,
  maybeClick,
  openMenu,
  closeTransientUi,
  attachReport,
  summarizeProblems,
  envDebugSummary,
  PERMISSION_GATE_RE,
  INTERNAL_ADMIN_DEBUG_RE,
  STAFF_VISIBLE_FORBIDDEN_RE,
  STAFF_UNLOCKED_RESTRICTED_CONTENT_RE,
};
