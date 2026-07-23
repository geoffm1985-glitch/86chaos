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

for (const name of ['.env.playwright.deep', '.env.playwright', '.env.local', '.env.test', '.env']) loadEnvFile(path.resolve(process.cwd(), name));

const RUN_ID = process.env.CHAOS_RUN_ID || `deep-deep-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const BASE_URL = (process.env.CHAOS_BASE_URL || process.env.APP_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXPECTED_VERSION = process.env.CHAOS_EXPECTED_VERSION || process.env.EXPECTED_VERSION || '15.1.13';
const ALLOW_MUTATION = process.env.CHAOS_ALLOW_MUTATION === '1';
const MAX_SAFE_CLICKS_PER_ROUTE = Number(process.env.CHAOS_MAX_SAFE_CLICKS_PER_ROUTE || 45);

const ROUTE_ALIASES = {
  today: 'today', home: 'today', schedule: 'schedule', published: 'published', timeclock: 'published', 'time-clock': 'published', clock: 'published',
  financials: 'financials', finance: 'financials', sales: 'sales', labor: 'labor', 'back-office': 'back-office', backoffice: 'back-office',
  inventory: 'inventory', ordering: 'inventory', invoices: 'inventory', scan: 'inventory', recipes: 'recipes', 'menu-intelligence': 'menu-intelligence',
  prep: 'prep', tasks: 'prep', messages: 'messages', team: 'team', roster: 'team', settings: 'settings', help: 'help', reminders: 'reminders',
  ops: 'ops', manager: 'ops', 'ai-tools': 'ai-tools', voice: 'ai-tools', godmode: 'godmode', audit: 'audit'
};

const ROUTES = [
  { tab: 'today', name: 'Today', expect: /Today|Sales Today|Labor|Prep|Inventory|Message Board|Manager Brief/i, minButtons: 6, minPanels: 5 },
  { tab: 'published', name: 'Time Clock / My Schedule', expect: /Schedule|Next Shift|Clock In|Clock Out|Timesheet|Published/i, minButtons: 4, minPanels: 2 },
  { tab: 'schedule', name: 'Schedule Builder', expect: /Schedule Builder|Publish|Coverage|Availability|Open Shifts|Time Off|Schedule/i, minButtons: 6, minPanels: 2, mayGate: true },
  { tab: 'financials', name: 'Financials', expect: /Financials|Timesheets|Daily Ledger|Sales|Labor|Export|Net Sales|Gross Profit/i, minButtons: 4, minPanels: 3, mayGate: true },
  { tab: 'sales', name: 'Sales Import / Ledger', expect: /Sales|Daily Ledger|Import|Financial|Revenue|Voids|Discounts|Export/i, minButtons: 3, minPanels: 1, mayGate: true },
  { tab: 'labor', name: 'Labor', expect: /Labor|Timesheet|Hours|Role|Wage|Cost|Export|Schedule/i, minButtons: 3, minPanels: 1, mayGate: true },
  { tab: 'back-office', name: 'Back Office', expect: /Back Office|QuickBooks|Accountant|Approval|Export|Owner Summary|Document/i, minButtons: 3, minPanels: 1, mayGate: true },
  { tab: 'inventory', name: 'Inventory', expect: /Inventory|Invoice|Menu Scan|Burn|Ordering|Par|Vendor|Stock|COGS/i, minButtons: 5, minPanels: 3, mayGate: true },
  { tab: 'recipes', name: 'Recipes', expect: /Recipe|Menu Cost|Food Cost|Margin|Ingredients|Yield|Smart Kitchen/i, minButtons: 4, minPanels: 2, mayGate: true },
  { tab: 'prep', name: 'Prep & Tasks', expect: /Prep|Task|86|Due|Reminder|Substitute|Station/i, minButtons: 5, minPanels: 3, mayGate: true },
  { tab: 'messages', name: 'Message Board', expect: /Message|Announcement|Post|Shift Note|Read|Pinned/i, minButtons: 3, minPanels: 1, mayGate: true },
  { tab: 'team', name: 'Staff Roster', expect: /Staff|Roster|Team|Role|Permission|Employee|Contact/i, minButtons: 3, minPanels: 1, mayGate: true },
  { tab: 'settings', name: 'Settings', expect: /Settings|Branding|Roster Roles|Notifications|Billing|Owner Controls|Integrations/i, minButtons: 5, minPanels: 2, mayGate: true },
  { tab: 'help', name: 'Help Center', expect: /Help|Manual|Search|Support|Training|Guide/i, minButtons: 3, minPanels: 1 },
  { tab: 'ops', name: 'Manager Brief', expect: /Manager Brief|Command|Operations|Snapshot|Brief|Kitchen/i, minButtons: 3, minPanels: 1, mayGate: true },
  { tab: 'ai-tools', name: 'Voice / AI Tools', expect: /Voice|86Voice|Command|AI|Prep|Inventory|Recipe|Reminder/i, minButtons: 3, minPanels: 1, mayGate: true },
  { tab: 'reminders', name: 'Reminders', expect: /Reminder|Due|Personal|Shared|Schedule|Repeat/i, minButtons: 3, minPanels: 1, mayGate: true },
];

const FATAL_TEXT_RE = /Application error|Unhandled Runtime Error|Failed to compile|Module not found|Cannot find module|Cannot read properties of undefined|Cannot read property|undefined is not an object|Minified React error|ReferenceError:|SyntaxError:|TypeError:|No test found/i;
const FATAL_CONSOLE_RE = /Application error|Unhandled Runtime Error|Failed to compile|Module not found|Cannot find module|Cannot read properties of undefined|Cannot read property|undefined is not an object|Minified React error|ReferenceError|SyntaxError|TypeError/i;
const PERMISSION_GATE_RE = /Plan & Permission Gate|permission|not authorized|access denied|does not include this tool|not include this tool|role does not include|not available for this workspace|locked feature|ask the account owner/i;
const UNAVAILABLE_RE = /This page is not available|SCREEN FAILED SAFELY|Screen failed to load|old app link|turned off for this workspace/i;
const PROTECTED_SECRET_RE = /private_key|firebase-adminsdk|CRON_SECRET|MASTER_ADMIN_EMAILS|refresh token|access token|service account key|FIREBASE_SERVICE_ACCOUNT_KEY/i;
const INTERNAL_ADMIN_RE = /System Administrator|Backup Center|Security Center|Forensics|Global Users|Access Control|Deployment Readiness|Emergency Read-Only|Retention|Push Health/i;
const MUTATING_RE = /\b(delete|trash|remove|reset|restore|emergency|deploy|broadcast|publish|approve all|approve timesheet|clock in|clock out|start break|end break|save|post message|send|add item|new recipe|create purchase|upload|import|scan|repair|grant|nuke|sync|disconnect|connect|optimize|mark done|complete|submit|archive|void|pause automation)\b/i;
const ALWAYS_DANGEROUS_RE = /\b(delete|trash|nuke|permanent|grant access|emergency read-only|restore backup|deploy workspace|broadcast alert)\b/i;

function envValue(names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  return '';
}

function hasCreds(prefix) {
  const p = String(prefix || '').toUpperCase();
  return Boolean(envValue([`${p}_EMAIL`, `TEST_${p}_EMAIL`, `CHAOS_${p}_EMAIL`, `E2E_${p}_EMAIL`]) && envValue([`${p}_PASSWORD`, `TEST_${p}_PASSWORD`, `CHAOS_${p}_PASSWORD`, `E2E_${p}_PASSWORD`]));
}

function creds(prefix) {
  const p = String(prefix || '').toUpperCase();
  const ownerEmailAliases = p === 'OWNER' ? ['TEST_EMAIL', 'TEST_OWNER_EMAIL', 'OWNER_LIKE_EMAIL'] : [];
  const ownerPasswordAliases = p === 'OWNER' ? ['TEST_PASSWORD', 'TEST_OWNER_PASSWORD', 'OWNER_LIKE_PASSWORD'] : [];
  return {
    label: p,
    email: envValue([`${p}_EMAIL`, `TEST_${p}_EMAIL`, `CHAOS_${p}_EMAIL`, `E2E_${p}_EMAIL`, ...ownerEmailAliases]),
    password: envValue([`${p}_PASSWORD`, `TEST_${p}_PASSWORD`, `CHAOS_${p}_PASSWORD`, `E2E_${p}_PASSWORD`, ...ownerPasswordAliases]),
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

function staffCredsOrNull() { return hasCreds('STAFF') ? creds('STAFF') : null; }
function managerCredsOrOwner() { return hasCreds('MANAGER') ? creds('MANAGER') : ownerLikeCreds(); }
function systemAdminCredsOrNull() { return hasCreds('SYSTEM_ADMIN') ? creds('SYSTEM_ADMIN') : null; }
function requireCreds(test, account, label) {
  if (!account || !account.email || !account.password) throw new Error(`Missing ${label} credentials. Add them to .env.playwright.deep or .env.playwright.`);
}

function routeUrl(tab) {
  const route = ROUTE_ALIASES[String(tab || '').trim()] || String(tab || 'today').trim() || 'today';
  const url = new URL(BASE_URL);
  url.searchParams.set('tab', route);
  return url.toString();
}

async function settle(page, ms = 700) {
  await page.waitForLoadState('domcontentloaded', { timeout: 25000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
  if (ms) await page.waitForTimeout(ms);
}

async function bodyText(page, limit = 80000) {
  const text = await page.locator('body').innerText({ timeout: 18000 }).catch(() => '');
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

async function closeTransientUi(page) {
  await page.keyboard.press('Escape').catch(() => {});
  const closeCandidates = [
    page.getByRole('button', { name: /^close$|dismiss|not now|skip|got it|cancel/i }).first(),
    page.locator('button[title*="Close" i]').first(),
    page.locator('button[aria-label*="Close" i]').first(),
    page.locator('.modal button').filter({ hasText: /^×|x$/i }).first(),
  ];
  for (const c of closeCandidates) {
    try { if (await c.isVisible({ timeout: 500 })) await c.click({ timeout: 1200 }); } catch (_) {}
  }
}

async function maybeClick(page, locator, options = {}) {
  try {
    const target = locator.first ? locator.first() : locator;
    if (await target.isVisible({ timeout: options.timeout || 1200 })) {
      await target.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
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
      if (await target.isVisible({ timeout: 1200 })) {
        await target.fill(value, { timeout: 3000 });
        return true;
      }
    } catch (_) {}
  }
  return false;
}

function watchForProblems(page, problems) {
  page.on('pageerror', (error) => problems.push({ type: 'pageerror', message: error.message, stack: String(error.stack || '').slice(0, 2500), url: page.url() }));
  page.on('console', (msg) => {
    const text = msg.text() || '';
    if (msg.type() === 'error' && FATAL_CONSOLE_RE.test(text)) problems.push({ type: 'console-error', message: text.slice(0, 2000), url: page.url() });
  });
  page.on('requestfailed', (req) => {
    const type = req.resourceType();
    const url = req.url();
    if (!['document', 'script', 'xhr', 'fetch'].includes(type)) return;
    const failure = req.failure()?.errorText || '';
    if (/favicon|sockjs|hot-update|chrome-extension|google-analytics|firebaselogging|googleapis.*listen|firestore.*Listen/i.test(url)) return;
    // Benign aborts happen when Playwright navigates between routes or closes a page while
    // Vercel auth probes / Firestore long-poll channels are still open. Treat real network
    // errors as failures, but do not fail the app for expected teardown aborts.
    if (/ERR_ABORTED/i.test(failure) && (/\.well-known\/vercel\/jwe/i.test(url) || /[?&]tab=/i.test(url) || /firestore\/Write\/channel/i.test(url))) return;
    problems.push({ type: 'requestfailed', resourceType: type, url, failure });
  });
}

function summarizeProblems(problems = []) {
  return problems.map(p => ({ ...p, message: p.message ? String(p.message).slice(0, 1000) : p.message, stack: p.stack ? String(p.stack).slice(0, 1000) : p.stack }));
}

async function assertNoFatal(page, label = 'page') {
  const text = await bodyText(page, 90000);
  expect(text.length, `${label} rendered almost no text`).toBeGreaterThan(20);
  expect(text, `${label} rendered a fatal app/runtime error`).not.toMatch(FATAL_TEXT_RE);
  return text;
}

async function login(page, email, password, options = {}) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: options.timeout || 60000 });
  await settle(page, 800);
  await closeTransientUi(page);

  const passwordField = page.locator('input[type="password"]').first();
  const needsLogin = await passwordField.isVisible({ timeout: options.loginBoxTimeout || 10000 }).catch(() => false);
  if (needsLogin) {
    const emailFilled = await fillFirstVisible(page, [
      page.locator('input[type="email"]'),
      page.locator('input[name*="email" i]'),
      page.locator('input[placeholder*="email" i]'),
      page.locator('input[type="text"]'),
    ], email);
    expect(emailFilled, 'Could not find the login email field').toBeTruthy();
    await passwordField.fill(password, { timeout: 3000 });
    const submitted = await maybeClick(page, page.getByRole('button', { name: /unlock|sign in|login|enter/i }), { settleMs: 1500 })
      || await maybeClick(page, page.locator('button[type="submit"]'), { settleMs: 1500 });
    expect(submitted, 'Could not find login submit button').toBeTruthy();
  }

  await settle(page, 1800);
  let text = await bodyText(page, 30000);
  if (/Choose Workspace|Select a workspace|Pick which restaurant/i.test(text)) {
    const workspaceButton = page.locator('button').filter({ hasText: /Cheers|Active|Open|Workspace|Restaurant|Chilton/i }).first();
    await maybeClick(page, workspaceButton, { settleMs: 1200 });
    text = await bodyText(page, 30000);
  }

  expect(text, `Login appears to have failed. Visible text: ${text.slice(0, 1500)}`).not.toMatch(/Email or password was not accepted|auth\/invalid|wrong-password|user-not-found|Firebase login did not finish|profile could not be loaded|not attached to an active restaurant workspace/i);
  return text;
}

async function expectVersion(page) {
  if (!EXPECTED_VERSION || ['any', '*', 'skip'].includes(String(EXPECTED_VERSION).toLowerCase())) return { skipped: true };
  let jsonVersion = '';
  try {
    jsonVersion = await page.evaluate(async (url) => {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return '';
      const data = await r.json().catch(() => ({}));
      return data.version || data.build || data.label || '';
    }, `${BASE_URL}/version.json?t=${Date.now()}`);
  } catch (_) {}
  const text = await bodyText(page, 50000).catch(() => '');
  expect(`${jsonVersion}\n${text}`, `Expected version ${EXPECTED_VERSION}. Set CHAOS_EXPECTED_VERSION=any to bypass while testing older builds.`).toContain(EXPECTED_VERSION);
  return { version: jsonVersion || EXPECTED_VERSION };
}

async function gotoTab(page, tab, options = {}) {
  await page.goto(routeUrl(tab), { waitUntil: 'domcontentloaded', timeout: options.timeout || 60000 });
  await settle(page, options.settleMs ?? 900);
  await closeTransientUi(page);
}

async function expectRouteHealthy(page, route, options = {}) {
  await gotoTab(page, route.tab || route, options);
  const text = await assertNoFatal(page, route.name || route.tab || route);
  const gated = PERMISSION_GATE_RE.test(text);
  const unavailable = UNAVAILABLE_RE.test(text);
  if (route.expect && !gated && !unavailable) expect(text, `${route.name || route.tab} did not show expected feature language`).toMatch(route.expect);
  if (!options.allowSecretTerms) expect(text, `${route.name || route.tab} leaked protected backend/secret language`).not.toMatch(PROTECTED_SECRET_RE);
  return { tab: route.tab || route, text, gated, unavailable };
}

async function pageMetrics(page) {
  return await page.evaluate(() => {
    const panels = document.querySelectorAll('.ref-panel, .cockpit-panel, section, [class*="panel"], [class*="card"]').length;
    const charts = document.querySelectorAll('svg[role="img"], canvas, .ref-donut, .ref-spark, .ref-live-bars, .ref-chart-line, .ref-progress').length;
    const buttons = [...document.querySelectorAll('button')].filter(el => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none';
    }).length;
    const inputs = [...document.querySelectorAll('input, textarea, select')].filter(el => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none';
    }).length;
    return { panels, charts, buttons, inputs, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight };
  });
}

async function expectNoHorizontalOverflow(page, label, tolerance = 12) {
  const metrics = await pageMetrics(page);
  expect(metrics.scrollWidth, `${label} should not create page-level horizontal overflow: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.width + tolerance);
  return metrics;
}

async function listVisibleInteractions(page, options = {}) {
  const includeMutation = options.includeMutation ?? ALLOW_MUTATION;
  const max = options.max || 160;
  return await page.evaluate(({ includeMutation, max, mutating, dangerous }) => {
    const mutatingRe = new RegExp(mutating, 'i');
    const dangerousRe = new RegExp(dangerous, 'i');
    const selectors = 'button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';
    const pathFor = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && node !== document.body && parts.length < 6) {
        let part = node.tagName.toLowerCase();
        if (node.classList && node.classList.length) part += '.' + [...node.classList].slice(0, 3).map(c => CSS.escape(c)).join('.');
        const parent = node.parentElement;
        if (parent) {
          const same = [...parent.children].filter(x => x.tagName === node.tagName);
          if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
        }
        parts.unshift(part);
        node = parent;
      }
      return parts.join(' > ');
    };
    const elements = [...document.querySelectorAll(selectors)];
    const rows = [];
    for (const el of elements) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width < 4 || r.height < 4 || s.visibility === 'hidden' || s.display === 'none' || el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      const text = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || el.placeholder || el.name || el.type || el.tagName || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!text && !['SELECT', 'INPUT', 'TEXTAREA'].includes(el.tagName)) continue;
      const isMutating = mutatingRe.test(text);
      const isDangerous = dangerousRe.test(text);
      if (isDangerous && !includeMutation) continue;
      if (isMutating && !includeMutation) continue;
      rows.push({ selector: pathFor(el), text: text || el.tagName.toLowerCase(), tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '', href: el.getAttribute('href') || '', isMutating, isDangerous, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      if (rows.length >= max) break;
    }
    return rows;
  }, { includeMutation, max, mutating: MUTATING_RE.source, dangerous: ALWAYS_DANGEROUS_RE.source });
}

async function clickInteractionBySelector(page, item, options = {}) {
  const before = await signature(page);
  const locator = page.locator(item.selector).first();
  await locator.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
  await locator.click({ timeout: options.timeout || 4500, force: !!options.force });
  await settle(page, options.settleMs ?? 650);
  const afterText = await assertNoFatal(page, `after clicking ${item.text}`);
  const after = await signature(page, afterText);
  return { item, before, after, changed: before.hash !== after.hash || before.url !== after.url };
}

async function signature(page, text) {
  const body = text || await bodyText(page, 40000).catch(() => '');
  const sig = body.slice(0, 2500);
  let hash = 0;
  for (let i = 0; i < sig.length; i++) hash = ((hash << 5) - hash + sig.charCodeAt(i)) | 0;
  const modalCount = await page.locator('[role="dialog"], .modal, .fixed').count().catch(() => 0);
  return { url: page.url(), hash, textStart: sig.slice(0, 500), modalCount };
}

async function attachReport(testInfo, name, data) {
  await testInfo.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}

function envDebugSummary() {
  const keys = Object.keys(process.env).filter(k => /^(CHAOS_|APP_URL|BASE_URL|PLAYWRIGHT_|OWNER_|TEST_|MANAGER_|STAFF_|SYSTEM_ADMIN_|WRONG_WORKSPACE_|DISABLED_)/.test(k)).sort();
  const out = {};
  for (const key of keys) out[key] = /PASSWORD|SECRET|KEY|TOKEN/i.test(key) ? Boolean(process.env[key]) : process.env[key];
  return out;
}

module.exports = {
  RUN_ID, BASE_URL, EXPECTED_VERSION, ROUTES, ALLOW_MUTATION, MAX_SAFE_CLICKS_PER_ROUTE,
  hasCreds, creds, ownerLikeCreds, staffCredsOrNull, managerCredsOrOwner, systemAdminCredsOrNull, requireCreds,
  routeUrl, settle, bodyText, closeTransientUi, maybeClick, watchForProblems, summarizeProblems, assertNoFatal,
  login, expectVersion, gotoTab, expectRouteHealthy, pageMetrics, expectNoHorizontalOverflow, listVisibleInteractions,
  clickInteractionBySelector, attachReport, envDebugSummary, PERMISSION_GATE_RE, UNAVAILABLE_RE, PROTECTED_SECRET_RE,
  INTERNAL_ADMIN_RE, MUTATING_RE, ALWAYS_DANGEROUS_RE,
};
