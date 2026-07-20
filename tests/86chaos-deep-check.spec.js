import 'dotenv/config';
import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL?.replace(/\/$/, '');

const dangerousWords = [
  'delete',
  'remove',
  'trash',
  'archive',
  'publish',
  'send',
  'dispatch',
  'restore',
  'reset',
  'approve',
  'decline',
  'subscribe',
  'billing',
  'pay',
  'clock in',
  'clock out',
  'start break',
  'end break',
  'upload',
  'save',
  'create',
  'add',
  'submit',
  'forgot password',
  'privacy',
  'terms',
  'sign out',
  'logout',
];

const pagesToTry = [
  '?tab=today',
  '?tab=manager-brief',
  '?tab=kitchen-command',
  '?tab=time-clock',
  '?tab=schedule',
  '?tab=inventory',
  '?tab=staff-roster',
  '?tab=message-board',
  '?tab=prep',
  '?tab=recipes',
  '?tab=maintenance',
  '?tab=financials',
  '?tab=settings',
  '?tab=help-center',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }
  return value;
}

function isSafeClick(name) {
  const clean = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();

  if (!clean) return false;
  if (clean.length > 80) return false;

  return !dangerousWords.some((word) => clean.includes(word));
}

function watchForProblems(page, problems) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      problems.push({
        type: 'console-error',
        text: msg.text(),
        url: page.url(),
      });
    }
  });

  page.on('pageerror', (error) => {
    problems.push({
      type: 'page-crash',
      text: error.message,
      url: page.url(),
    });
  });

  page.on('requestfailed', (request) => {
    problems.push({
      type: 'request-failed',
      requestUrl: request.url(),
      failure: request.failure()?.errorText,
      pageUrl: page.url(),
    });
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();

    if (status >= 500) {
      problems.push({
        type: 'server-error',
        status,
        requestUrl: url,
        pageUrl: page.url(),
      });
    }
  });

  page.on('dialog', async (dialog) => {
    problems.push({
      type: 'popup-dialog',
      message: dialog.message(),
      url: page.url(),
    });

    await dialog.dismiss().catch(() => {});
  });
}

async function login(page, email, password) {
  await page.goto(`${APP_URL}/?tab=today`, {
    waitUntil: 'domcontentloaded',
  });

  const emailBox = page.getByRole('textbox', { name: /email address/i });

  if (await emailBox.isVisible({ timeout: 15000 }).catch(() => false)) {
    await emailBox.fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);
    await page.getByRole('button', { name: /unlock system/i }).click();

    await expect(page.getByRole('button', { name: /unlock system/i }))
      .toBeHidden({ timeout: 60000 });
  }

  await expect(page.locator('main')).toBeVisible({ timeout: 60000 });
}

async function getVisibleClickables(page) {
  return await page.locator('button, a, [role="button"], [role="tab"]').evaluateAll((elements) => {
    return elements
      .map((el, index) => {
        const box = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        const name = (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.innerText ||
          el.textContent ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim();

        return {
          index,
          name,
          visible:
            box.width > 0 &&
            box.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden',
        };
      })
      .filter((item) => item.visible && item.name);
  });
}

test.describe('86 Chaos deep automated checks', () => {
  test('login, Manager Brief math, and safe auto-click crawl', async ({ page }, testInfo) => {
    test.setTimeout(240000);

    const problems = [];
    const clicked = [];
    const mathChecks = [];
    const seen = new Set();

    watchForProblems(page, problems);

    await login(
      page,
      requireEnv('TEST_EMAIL'),
      requireEnv('TEST_PASSWORD')
    );

    await expect(page.locator('main')).toBeVisible();

    const bodyText = await page.locator('body').innerText();

    const managerBriefMath = bodyText.match(
      /(\d+)\s+On Schedule\s+(\d+)\s+Clocked In\s+(\d+)\s+Needs Eyes/i
    );

    if (managerBriefMath) {
      const onSchedule = Number(managerBriefMath[1]);
      const clockedIn = Number(managerBriefMath[2]);
      const needsEyes = Number(managerBriefMath[3]);

      mathChecks.push({
        onSchedule,
        clockedIn,
        needsEyes,
      });

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
        await page
          .locator('button, a, [role="button"], [role="tab"]')
          .nth(next.index)
          .click({ timeout: 5000 });

        await page.waitForTimeout(700);

        clicked.push({
          step,
          clicked: next.name,
          from: beforeUrl,
          to: page.url(),
        });

        await page
          .getByRole('button', { name: /close|cancel|back/i })
          .first()
          .click({ timeout: 750 })
          .catch(() => {});

        if (!page.url().startsWith(APP_URL)) {
          await page.goto(beforeUrl);
        }
      } catch (error) {
        problems.push({
          type: 'click-failed',
          clicked: next.name,
          from: beforeUrl,
          message: error.message,
        });
      }
    }

    await testInfo.attach('86chaos-click-and-math-report.json', {
      body: JSON.stringify({ clicked, mathChecks, problems }, null, 2),
      contentType: 'application/json',
    });

    const seriousProblems = problems.filter((problem) => {
      return !['click-failed'].includes(problem.type);
    });

    expect(seriousProblems, JSON.stringify(seriousProblems, null, 2)).toEqual([]);
  });

  test('important app pages load without crashes', async ({ page }, testInfo) => {
    test.setTimeout(180000);

    const problems = [];
    const visited = [];

    watchForProblems(page, problems);

    await login(
      page,
      requireEnv('TEST_EMAIL'),
      requireEnv('TEST_PASSWORD')
    );

    for (const tab of pagesToTry) {
      await page.goto(`${APP_URL}/${tab}`, {
        waitUntil: 'domcontentloaded',
      });

      await page.waitForTimeout(1200);

      const bodyText = await page.locator('body').innerText().catch(() => '');

      visited.push({
        tab,
        url: page.url(),
        hasMain: await page.locator('main').isVisible().catch(() => false),
        visibleTextStart: bodyText.slice(0, 250),
      });

      await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
    }

    await testInfo.attach('86chaos-page-load-report.json', {
      body: JSON.stringify({ visited, problems }, null, 2),
      contentType: 'application/json',
    });

    const seriousProblems = problems.filter((problem) => {
      return !String(problem.requestUrl || '').includes('favicon');
    });

    expect(seriousProblems, JSON.stringify(seriousProblems, null, 2)).toEqual([]);
  });

  test('staff account should not see owner-only controls', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    const staffEmail = process.env.STAFF_EMAIL;
    const staffPassword = process.env.STAFF_PASSWORD;

    test.skip(
      !staffEmail || !staffPassword,
      'Skipped because STAFF_EMAIL and STAFF_PASSWORD are blank in .env'
    );

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
  });

  test('owner account should see admin-level controls', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerPassword = process.env.OWNER_PASSWORD;

    test.skip(
      !ownerEmail || !ownerPassword,
      'Skipped because OWNER_EMAIL and OWNER_PASSWORD are blank in .env'
    );

    const problems = [];
    const found = [];

    watchForProblems(page, problems);

    await login(page, ownerEmail, ownerPassword);

    const expectedOwnerText = [
      /settings/i,
      /preferences/i,
      /staff roster/i,
      /administrator/i,
    ];

    for (const text of expectedOwnerText) {
      const item = page.getByText(text).first();

      if (await item.isVisible().catch(() => false)) {
        found.push(text.toString());
      }
    }

    await testInfo.attach('86chaos-owner-permission-report.json', {
      body: JSON.stringify({ found, problems }, null, 2),
      contentType: 'application/json',
    });

    expect(found.length).toBeGreaterThan(0);
  });
});