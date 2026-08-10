const { test, expect } = require('@playwright/test');
const { loginIfNeeded, gotoAuthenticatedRoute, assertAuthenticatedAfterNavigation, isLoginShellVisible } = require('./utils/release-login-helper.cjs');

const releaseGate = process.env.CHAOS_RELEASE_GATE === 'true';

async function login(page, email, password) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page, email, password, { timeout: 30_000 });
}

test('lazy chunk failure reports once, avoids a reload loop, and recovers without losing auth', async ({ page }, testInfo) => {
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
  await page.addInitScript(() => {
    window.__chaosRecoveryEvents = [];
    const record = (type, detail = {}) => {
      try { window.__chaosRecoveryEvents.push({ type, at: Date.now(), url: location.href, ...detail }); } catch (_) {}
    };
    const originalReplace = window.location.replace.bind(window.location);
    window.location.replace = (url) => { record('location.replace', { target: String(url || '') }); return originalReplace(url); };
    const originalReload = window.location.reload.bind(window.location);
    window.location.reload = () => { record('location.reload'); return originalReload(); };
    const originalSetItem = window.sessionStorage.setItem.bind(window.sessionStorage);
    window.sessionStorage.setItem = (key, value) => {
      if (/chaosReloadAt|chunk|recovery|autoReload/i.test(String(key))) record('sessionStorage.setItem', { key: String(key), value: String(value).slice(0, 180) });
      return originalSetItem(key, value);
    };
  });

  await login(page, email, password);
  await gotoAuthenticatedRoute(page, 'today', { timeout: 30_000 });
  const targetTab = 'inventory';
  const baselineNavigations = topLevelNavigations;
  blockingEnabled = true;

  await page.evaluate((targetTab) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', targetTab);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, targetTab);
  await page.waitForTimeout(4500);

  expect(blockedUrl, 'a concrete lazy JavaScript chunk request was intercepted').toMatch(/\/static\/js\/(?!main\.)[^/?]+\.chunk\.js(?:\?.*)?$/i);
  expect(blockedUrl, 'chunk recovery test must not intercept CSS, main JS, service worker, or runtime boot assets').not.toMatch(/\/static\/css\/|\/main\.|service-worker|runtime/i);
  expect(reportAttempts, 'one crash report was submitted').toBe(1);
  await expect(page.locator('body')).toContainText(/refresh app|update required|stale app file|failed to load/i, { timeout: 15_000 });
  const recoveryEvents = await page.evaluate(() => window.__chaosRecoveryEvents || []).catch(() => []);
  const parsedStateWrites = recoveryEvents
    .filter(x => x.type === 'sessionStorage.setItem' && /chunkRecoveryState|chunk|recovery/i.test(String(x.key || '')))
    .map((x) => {
      try { return { ...JSON.parse(x.value || '{}'), eventAt: x.at, key: x.key }; } catch (_) { return null; }
    })
    .filter(Boolean);
  const recoveryStateNodes = await page.locator('[data-chaos-recovery-state]').evaluateAll(nodes => nodes.map(node => ({
    state: node.getAttribute('data-chaos-recovery-state') || '',
    text: (node.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500)
  }))).catch(() => []);
  const stateTransitions = [...recoveryStateNodes, ...parsedStateWrites.map(row => ({ state: row.stage || '', autoReloadCount: Number(row.autoReloadCount || 0), eventAt: row.eventAt, key: row.key }))];
  const maxAutoReloadCount = Math.max(0, ...stateTransitions.map(row => Number(row.autoReloadCount || 0)).filter(Number.isFinite));
  const autoRecoveryStartedTransitions = stateTransitions.filter(row => row.state === 'auto-recovery-started').length;
  const recoveryStartedAt = Math.min(...stateTransitions.filter(row => row.state === 'auto-recovery-started' && row.eventAt).map(row => row.eventAt));
  const markerWrites = recoveryEvents.filter(x => /autoReloadInFlight|autoReloadUsed|chaosReloadAt/i.test(String(x.key || '')));
  const postRecoveryNavigations = recoveryEvents.filter(x => /location\.(replace|reload)/.test(String(x.type || '')) && (!Number.isFinite(recoveryStartedAt) || Number(x.at || 0) >= recoveryStartedAt));
  const uniqueAutoReloadUsedGenerations = new Set(markerWrites.filter(x => /autoReloadUsed/i.test(String(x.key || ''))).map(x => `${x.key || ''}:${x.value || ''}`)).size;
  const automaticRecoveryAttempts = Math.max(
    maxAutoReloadCount,
    autoRecoveryStartedTransitions,
    uniqueAutoReloadUsedGenerations ? 1 : 0,
    postRecoveryNavigations.length ? 1 : 0
  );
  expect(maxAutoReloadCount, 'Chunk recovery structured autoReloadCount must never exceed one').toBeLessThanOrEqual(1);
  expect(autoRecoveryStartedTransitions, 'Chunk recovery should start automatic recovery at most once').toBeLessThanOrEqual(1);
  expect(automaticRecoveryAttempts, 'Chunk recovery must not enter an infinite reload loop').toBeLessThanOrEqual(1);
  await testInfo.attach('chunk-recovery-logical-attempts.json', { body: JSON.stringify({ topLevelNavigations, baselineNavigations, recoveryEvents, stateTransitions, maxAutoReloadCount, autoRecoveryStartedTransitions, markerWrites, postRecoveryNavigations, uniqueAutoReloadUsedGenerations, automaticRecoveryAttempts }, null, 2), contentType: 'application/json' }).catch(() => null);

  blockingEnabled = false;
  await page.unroute(/\/static\/js\/(?!main\.)[^/?]+\.chunk\.js(?:\?.*)?$/i);
  const refresh = page.getByRole('button', { name: /refresh app|refresh/i }).first();
  if (await refresh.isVisible({ timeout: 3000 }).catch(() => false)) await refresh.click();
  else await page.reload({ waitUntil: 'domcontentloaded' });
  await assertAuthenticatedAfterNavigation(page, { timeout: 30_000 });
  await gotoAuthenticatedRoute(page, targetTab, { timeout: 30_000 });
  await expect(page.locator('body')).toContainText(/inventory|par|stock|vendors|orders/i, { timeout: 30_000 });
  expect(await isLoginShellVisible(page), 'authentication should survive the lazy chunk recovery path').toBe(false);
});
