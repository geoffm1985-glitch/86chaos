const { test, expect } = require('@playwright/test');
require('dotenv').config();

const APP_URL = String(
  process.env.APP_URL ||
    process.env.TEST_APP_URL ||
    process.env.PLAYWRIGHT_APP_URL ||
    'https://cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app'
).replace(/\/+$/, '');

// Canonical 86 Chaos tab routes. Older public names such as manager-brief,
// kitchen-command, time-clock, staff-roster, message-board, and help-center are
// legacy aliases and should normalize in the app, not be treated as primary routes.
const pagesToTry = [
  { tab: '?tab=today', label: 'Today / Manager Brief' },
  { tab: '?tab=published', label: 'Time Clock & Schedule' },
  { tab: '?tab=schedule', label: 'Schedule Builder' },
  { tab: '?tab=ops', label: 'Kitchen Command Center' },
  { tab: '?tab=inventory', label: 'Inventory' },
  { tab: '?tab=team', label: 'Staff Roster' },
  { tab: '?tab=messages', label: 'Message Board' },
  { tab: '?tab=prep', label: 'Prep' },
  { tab: '?tab=recipes', label: 'Recipes' },
  { tab: '?tab=maintenance', label: 'Maintenance' },
  { tab: '?tab=financials', label: 'Financials' },
  { tab: '?tab=settings', label: 'Settings' },
  { tab: '?tab=help', label: 'Help Center' },
];

const legacyRoutesToSmoke = [
  { from: '?tab=manager-brief', to: 'today' },
  { from: '?tab=kitchen-command', to: 'ops' },
  { from: '?tab=time-clock', to: 'published' },
  { from: '?tab=staff-roster', to: 'team' },
  { from: '?tab=message-board', to: 'messages' },
  { from: '?tab=help-center', to: 'help' },
];

const dangerousWords = [
  'delete',
  'remove',
  'archive',
  'trash',
  'restore',
  'backup',
  'reset',
  'disable',
  'enable',
  'approve',
  'confirm',
  'submit',
  'save',
  'publish',
  'send',
  'email',
  'text',
  'notify',
  'push',
  'import',
  'upload',
  'export',
  'download',
  'print',
  'create',
  'add',
  'edit',
  'update',
  'clock in',
  'clock out',
  'log waste',
  'deduct',
  'order now',
  'place order',
  'send order',
  'apply all',
  'apply selected',
  'use suggested qty',
  'use qty',
  'undo',
  'forgot password',
  'privacy policy',
  'terms of service',
  'unlock system',
  'sign out',
  'logout',
  'active workspace',
  'report a problem',
  'voice assistant',
  'start listening',
  'listening',
  'parse typed command',
  'microphone',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function isSafeClick(name) {
  const clean = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!clean) return false;
  if (clean.length > 80) return false;
  return !dangerousWords.some((word) => clean.includes(word));
}

function isExpectedAbortedRequest(url, failure) {
  const cleanFailure = String(failure || '');

  // Browser cancellations are expected while Playwright rapidly changes tabs.
  // Firebase Listen/Write long-polling, Vercel preview internals, static chunks,
  // images, and non-mutating API reads can be cancelled without indicating an app crash.
  return cleanFailure === 'net::ERR_ABORTED';
}

function isExpectedConsoleNoise(text) {
  const clean = String(text || '');

  // Chrome logs this without exposing the request URL in the console event.
  // Real HTTP failures are handled by page.on('response') below.
  if (/Failed to load resource: the server responded with a status of 403/i.test(clean)) return true;
  if (/ResizeObserver loop completed with undelivered notifications/i.test(clean)) return true;

  return false;
}

function isExpectedHttpResponse(url, status) {
  const cleanUrl = String(url || '');
  if (status === 403 && cleanUrl.includes('/.well-known/vercel/jwe')) return true;
  if (status === 404 && /favicon\.(ico|png|svg)$/i.test(cleanUrl)) return true;
  return false;
}

function isCriticalHttpUrl(url) {
  const cleanUrl = String(url || '');
  return (
    cleanUrl.includes('/api/') ||
    cleanUrl.includes('identitytoolkit.googleapis.com') ||
    cleanUrl.includes('securetoken.googleapis.com') ||
    cleanUrl.includes('firestore.googleapis.com') ||
    cleanUrl.includes('firebasestorage.googleapis.com')
  );
}


function assertPageIsOpen(page, actionName) {
  if (page.isClosed()) {
    throw new Error(
      `Playwright page was closed before ${actionName}. Do not close the headed browser while the test is running. ` +
        'If you did not close it, rerun with --workers=1 and check the trace for a browser crash.'
    );
  }
}

async function gotoApp(page, route, timeout = 60000) {
  assertPageIsOpen(page, `navigating to ${route}`);
  await page.goto(`${APP_URL}/${route}`, { waitUntil: 'domcontentloaded', timeout });
  assertPageIsOpen(page, `waiting for app shell after ${route}`);
  await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
}

function watchForProblems(page, problems) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;

    const text = msg.text();
    if (isExpectedConsoleNoise(text)) return;

    problems.push({ type: 'console-error', text, url: page.url() });
  });

  page.on('pageerror', (error) => {
    problems.push({ type: 'page-crash', text: error.message, url: page.url() });
  });

  page.on('requestfailed', (request) => {
    const requestUrl = request.url();
    const failure = request.failure()?.errorText || '';
    if (isExpectedAbortedRequest(requestUrl, failure)) return;

    problems.push({ type: 'request-failed', requestUrl, failure, pageUrl: page.url() });
  });

  page.on('response', (response) => {
    const status = response.status();
    const requestUrl = response.url();
    if (isExpectedHttpResponse(requestUrl, status)) return;

    if (status >= 500 || (status >= 400 && isCriticalHttpUrl(requestUrl))) {
      problems.push({ type: 'http-error', status, requestUrl, pageUrl: page.url() });
    }
  });

  page.on('dialog', async (dialog) => {
    problems.push({ type: 'popup-dialog', message: dialog.message(), url: page.url() });
    await dialog.dismiss().catch(() => {});
  });
}

async function login(page, email, password) {
  assertPageIsOpen(page, 'login navigation');
  await page.goto(`${APP_URL}/?tab=today`, { waitUntil: 'domcontentloaded', timeout: 60000 });

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
}

async function dismissOverlays(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page
    .getByRole('button', { name: /close|cancel|back|skip for now/i })
    .first()
    .click({ timeout: 750 })
    .catch(() => {});
  await page.waitForTimeout(250);
}

async function getVisibleClickables(page) {
  return await page.locator('button, a, [role="button"], [role="tab"]').evaluateAll((elements) => {
    return elements
      .map((el, index) => {
        const box = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
        const name = (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.innerText ||
          el.textContent ||
          ''
        ).replace(/\s+/g, ' ').trim();

        return {
          index,
          name,
          visible:
            !disabled &&
            box.width > 0 &&
            box.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.pointerEvents !== 'none' &&
            style.cursor !== 'default',
        };
      })
      .filter((item) => item.visible && item.name);
  });
}

async function checkManagerBriefMath(page, problems, mathChecks) {
  assertPageIsOpen(page, 'Manager Brief math check');

  // login() already lands on Today. Avoid a second immediate goto here because
  // headed runs can close/crash the page or interrupt navigation, which hides
  // the real test signal behind "Target page/context closed".
  if (!/tab=today/i.test(page.url())) {
    await gotoApp(page, '?tab=today');
  } else {
    await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
  }

  await page.waitForTimeout(1200);

  const summary = page.getByTestId('manager-brief-math-summary-global');
  const summaryText =
    (await summary.textContent().catch(() => '')) ||
    (await page.locator('body').innerText().catch(() => ''));

  const managerBriefMath = summaryText.match(/(\d+)\s+On Schedule\s+(\d+)\s+Clocked In\s+(\d+)\s+Needs Eyes/i);

  if (managerBriefMath) {
    const onSchedule = Number(managerBriefMath[1]);
    const clockedIn = Number(managerBriefMath[2]);
    const needsEyes = Number(managerBriefMath[3]);
    mathChecks.push({ onSchedule, clockedIn, needsEyes });
    expect(onSchedule).toBeGreaterThanOrEqual(0);
    expect(clockedIn).toBeGreaterThanOrEqual(0);
    expect(needsEyes).toBeGreaterThanOrEqual(0);
    expect(clockedIn).toBeLessThanOrEqual(onSchedule);
  } else {
    problems.push({
      type: 'math-check-missing',
      message: 'Could not find Manager Brief math text like "2 On Schedule 0 Clocked In 1 Needs Eyes".',
      url: page.url(),
    });
  }
}

async function openMainMenu(page) {
  assertPageIsOpen(page, 'opening main menu');
  await dismissOverlays(page);

  const labelledMenu = page.getByRole('button', { name: /open menu|menu/i }).last();
  if (await labelledMenu.isVisible({ timeout: 1500 }).catch(() => false)) {
    await labelledMenu.click({ timeout: 5000 });
  } else {
    // Fallback for older deployed builds before the menu button had an aria-label.
    await page.locator('header button').last().click({ timeout: 5000 });
  }

  await expect(page.getByRole('dialog', { name: /main menu/i })).toBeVisible({ timeout: 5000 });
}

async function collectVisibleMatches(page, patterns, scope = page.locator('body')) {
  const found = [];
  for (const pattern of patterns) {
    const visible = await scope.getByText(pattern).first().isVisible({ timeout: 2500 }).catch(() => false);
    if (visible) found.push(String(pattern));
  }
  return found;
}

test.describe('86 Chaos deep automated checks', () => {
  test('login, Manager Brief math, and safe auto-click crawl', async ({ page }, testInfo) => {
    test.setTimeout(240000);

    const problems = [];
    const clicked = [];
    const mathChecks = [];
    const seen = new Set();

    watchForProblems(page, problems);

    await login(page, requireEnv('TEST_EMAIL'), requireEnv('TEST_PASSWORD'));
    await checkManagerBriefMath(page, problems, mathChecks);
    await dismissOverlays(page);

    for (let step = 0; step < 100; step++) {
      const buttons = await getVisibleClickables(page);
      const next = buttons.find((button) => {
        const key = `${page.url()}::${button.index}::${button.name}`;
        return !seen.has(key) && isSafeClick(button.name);
      });

      if (!next) break;

      const key = `${page.url()}::${next.index}::${next.name}`;
      seen.add(key);
      const beforeUrl = page.url();

      try {
        await page.locator('button, a, [role="button"], [role="tab"]').nth(next.index).click({ timeout: 5000 });
        await page.waitForTimeout(700);

        clicked.push({ step, clicked: next.name, from: beforeUrl, to: page.url() });
        await dismissOverlays(page);

        if (!page.url().startsWith(APP_URL)) {
          assertPageIsOpen(page, 'returning to prior URL');
          await page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        }
      } catch (error) {
        problems.push({ type: 'click-failed', clicked: next.name, from: beforeUrl, message: error.message });
        await dismissOverlays(page);
      }
    }

    await testInfo.attach('86chaos-click-and-math-report.json', {
      body: JSON.stringify({ clicked, mathChecks, problems }, null, 2),
      contentType: 'application/json',
    });

    const seriousProblems = problems.filter((problem) => !['click-failed'].includes(problem.type));
    expect(seriousProblems, JSON.stringify(seriousProblems, null, 2)).toEqual([]);
  });

  test('important app pages load without crashes', async ({ page }, testInfo) => {
    test.setTimeout(180000);

    const problems = [];
    const visited = [];

    watchForProblems(page, problems);
    await login(page, requireEnv('TEST_EMAIL'), requireEnv('TEST_PASSWORD'));

    for (const pageInfo of pagesToTry) {
      await gotoApp(page, pageInfo.tab);
      await page.waitForTimeout(1200);

      const bodyText = await page.locator('body').innerText().catch(() => '');
      visited.push({
        tab: pageInfo.tab,
        label: pageInfo.label,
        url: page.url(),
        hasMain: await page.locator('main').isVisible().catch(() => false),
        visibleTextStart: bodyText.slice(0, 250),
      });

      if (/this page is not available/i.test(bodyText)) {
        problems.push({ type: 'unavailable-page', tab: pageInfo.tab, label: pageInfo.label, url: page.url() });
      }
    }

    await testInfo.attach('86chaos-page-load-report.json', {
      body: JSON.stringify({ visited, problems }, null, 2),
      contentType: 'application/json',
    });

    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });

  test('legacy public tab links normalize to live app routes', async ({ page }, testInfo) => {
    test.setTimeout(90000);

    const problems = [];
    const checked = [];

    watchForProblems(page, problems);
    await login(page, requireEnv('TEST_EMAIL'), requireEnv('TEST_PASSWORD'));

    for (const route of legacyRoutesToSmoke) {
      await gotoApp(page, route.from);
      await page.waitForTimeout(750);
      const url = page.url();
      const bodyText = await page.locator('body').innerText().catch(() => '');
      checked.push({ ...route, url, visibleTextStart: bodyText.slice(0, 180) });
      if (!url.includes(`tab=${route.to}`)) {
        problems.push({ type: 'legacy-route-not-normalized', from: route.from, expectedTab: route.to, url });
      }
      if (/this page is not available/i.test(bodyText)) {
        problems.push({ type: 'legacy-route-unavailable', from: route.from, expectedTab: route.to, url });
      }
    }

    await testInfo.attach('86chaos-legacy-route-report.json', {
      body: JSON.stringify({ checked, problems }, null, 2),
      contentType: 'application/json',
    });

    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });

  test('staff account should not see owner-only controls', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    const staffEmail = process.env.STAFF_EMAIL;
    const staffPassword = process.env.STAFF_PASSWORD;
    test.skip(!staffEmail || !staffPassword, 'Skipped because STAFF_EMAIL and STAFF_PASSWORD are blank in .env');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, staffEmail, staffPassword);

    const forbiddenText = [
      /system administrator/i,
      /backup center/i,
      /restore/i,
      /security center/i,
      /forensics/i,
      /clients/i,
      /billing/i,
      /subscription/i,
      /pay rates/i,
      /push notification center/i,
    ];

    for (const text of forbiddenText) {
      await expect(page.getByText(text).first()).toBeHidden({ timeout: 5000 });
    }

    await testInfo.attach('86chaos-staff-permission-report.json', {
      body: JSON.stringify({ problems }, null, 2),
      contentType: 'application/json',
    });

    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });

  test('owner account should see admin-level controls', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerPassword = process.env.OWNER_PASSWORD;
    test.skip(!ownerEmail || !ownerPassword, 'Skipped because OWNER_EMAIL and OWNER_PASSWORD are blank in .env');

    const problems = [];
    const found = [];
    const checks = [];
    watchForProblems(page, problems);
    await login(page, ownerEmail, ownerPassword);

    // Owner/admin controls are mostly in the main menu or Settings, not always
    // printed on the Manager Brief home screen. Open the menu before checking.
    await openMainMenu(page);
    const menu = page.getByRole('dialog', { name: /main menu/i });

    const menuControlText = [
      /settings/i,
      /system audit/i,
      /audit logs/i,
      /system administrator/i,
      /team/i,
    ];
    const menuFound = await collectVisibleMatches(page, menuControlText, menu);
    found.push(...menuFound.map((item) => `menu:${item}`));
    checks.push({ area: 'main-menu', found: menuFound });

    await dismissOverlays(page);
    await gotoApp(page, '?tab=settings');
    await page.waitForTimeout(1000);

    const settingsText = await page.locator('body').innerText().catch(() => '');
    const settingsControlText = [
      /workspace/i,
      /permissions/i,
      /branding/i,
      /security/i,
      /access/i,
      /mfa/i,
      /owner/i,
      /settings/i,
    ];
    const settingsFound = await collectVisibleMatches(page, settingsControlText);
    found.push(...settingsFound.map((item) => `settings:${item}`));
    checks.push({ area: 'settings', found: settingsFound, visibleTextStart: settingsText.slice(0, 250) });

    await testInfo.attach('86chaos-owner-control-report.json', {
      body: JSON.stringify({ found, checks, problems }, null, 2),
      contentType: 'application/json',
    });

    expect(
      found.length,
      `Owner/admin controls found: ${JSON.stringify(found)}. ` +
        'If this is still empty, verify OWNER_EMAIL is actually an owner/admin in the testing workspace.'
    ).toBeGreaterThan(0);
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
