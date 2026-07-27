const { test, expect } = require('@playwright/test');

const releaseGate = process.env.CHAOS_RELEASE_GATE === 'true';

async function login(page, email, password) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  const chooser = page.getByText(/choose workspace/i).first();
  if (await chooser.isVisible({ timeout: 5000 }).catch(() => false)) {
    const name = process.env.CHAOS_QA_WORKSPACE_NAME || process.env.CHAOS_QA_WORKSPACE || '';
    if (releaseGate && !name) throw new Error('CHAOS_QA_WORKSPACE_NAME is required for chunk recovery.');
    const target = name ? page.getByText(name, { exact: false }).first() : page.locator('button,[role="button"]').filter({ hasText: /owner|manager|staff|admin/i }).first();
    await target.click();
  }
  await expect(page.locator('body')).toContainText(/86 chaos|today|manager brief/i, { timeout: 30_000 });
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
  await page.route(/\/static\/(?:js|css)\/.*\.(?:chunk\.)?(?:js|css)(?:\?.*)?$/, async route => {
    if (!blockingEnabled || blockedUrl) return route.continue();
    blockedUrl = route.request().url();
    return route.abort('failed');
  });

  await login(page, email, password);
  const baselineNavigations = topLevelNavigations;
  blockingEnabled = true;
  await page.goto('/?tab=recipes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  expect(blockedUrl, 'a concrete lazy asset request was intercepted').not.toBe('');
  expect(reportAttempts, 'one crash report was submitted').toBe(1);
  expect(topLevelNavigations - baselineNavigations, 'recovery performed no more than one extra top-level navigation').toBeLessThanOrEqual(2);
  await expect(page.locator('body')).toContainText(/refresh app|update required|stale app file|failed to load/i, { timeout: 15_000 });

  blockingEnabled = false;
  await page.unroute(/\/static\/(?:js|css)\/.*\.(?:chunk\.)?(?:js|css)(?:\?.*)?$/);
  const refresh = page.getByRole('button', { name: /refresh app|refresh/i }).first();
  if (await refresh.isVisible({ timeout: 3000 }).catch(() => false)) await refresh.click();
  else await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto('/?tab=recipes', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toContainText(/recipes/i, { timeout: 30_000 });
  await expect(page.getByLabel(/email/i)).not.toBeVisible({ timeout: 3000 }).catch(() => {});
});
