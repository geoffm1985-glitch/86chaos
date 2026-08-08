const { test, expect } = require('@playwright/test');
const { loginIfNeeded, gotoAuthenticatedRoute, assertAuthenticatedAfterNavigation, isLoginShellVisible } = require('./utils/release-login-helper.cjs');

const releaseGate = process.env.CHAOS_RELEASE_GATE === 'true';

async function login(page, email, password) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page, email, password, { timeout: 30_000 });
}

test('lazy chunk failure reports once, avoids a reload loop, and recovers without losing auth', async ({ page }) => {
  const base = process.env.APP_URL || process.env.CHAOS_E2E_BASE_URL || '';
  if (/app\.86chaos\.com/i.test(base)) throw new Error('Chunk interception is blocked on production.');
  const email = process.env.OWNER_EMAIL || (!releaseGate ? process.env.TEST_EMAIL : '');
  const password = process.env.OWNER_PASSWORD || (!releaseGate ? process.env.TEST_PASSWORD : '');
  if (!email || !password) {
    if (releaseGate) throw new Error('OWNER_EMAIL/OWNER_PASSWORD are required for chunk recovery.');
    test.skip(true, 'Missing owner credentials for local chunk test.');
  }

  let blockingEnabled = false;
  let blockedUrl = '';
  let reportAttempts = 0;
  let topLevelNavigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) topLevelNavigations += 1; });
  await page.route(/\/api\/report-bug$/, async route => {
    reportAttempts += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, reportId: 'qa_chunk_report' }) });
  });
  await page.route(/\/static\/js\/(?!main\.)[^/?]+\.chunk\.js(?:\?.*)?$/i, async route => {
    if (!blockingEnabled || blockedUrl) return route.continue();
    blockedUrl = route.request().url();
    return route.abort('failed');
  });

  await login(page, email, password);
  await gotoAuthenticatedRoute(page, 'today', { timeout: 30_000 });
  const baselineNavigations = topLevelNavigations;
  blockingEnabled = true;

  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'recipes');
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  });
  await page.waitForTimeout(4500);

  expect(blockedUrl, 'a concrete lazy JavaScript chunk request was intercepted').toMatch(/\/static\/js\/(?!main\.)[^/?]+\.chunk\.js(?:\?.*)?$/i);
  expect(blockedUrl, 'chunk recovery test must not intercept CSS, main JS, service worker, or runtime boot assets').not.toMatch(/\/static\/css\/|\/main\.|service-worker|runtime/i);
  expect(reportAttempts, 'one crash report was submitted').toBe(1);
  expect(topLevelNavigations - baselineNavigations, 'recovery performed no more than one extra top-level navigation').toBeLessThanOrEqual(2);
  await expect(page.locator('body')).toContainText(/refresh app|update required|stale app file|failed to load/i, { timeout: 15_000 });

  blockingEnabled = false;
  await page.unroute(/\/static\/js\/(?!main\.)[^/?]+\.chunk\.js(?:\?.*)?$/i);
  const refresh = page.getByRole('button', { name: /refresh app|refresh/i }).first();
  if (await refresh.isVisible({ timeout: 3000 }).catch(() => false)) await refresh.click();
  else await page.reload({ waitUntil: 'domcontentloaded' });
  await assertAuthenticatedAfterNavigation(page, { timeout: 30_000 });
  await gotoAuthenticatedRoute(page, 'recipes', { timeout: 30_000 });
  await expect(page.locator('body')).toContainText(/recipes/i, { timeout: 30_000 });
  expect(await isLoginShellVisible(page), 'authentication should survive the lazy chunk recovery path').toBe(false);
});
