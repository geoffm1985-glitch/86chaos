const { test, expect } = require('@playwright/test');
const {
  ownerLikeCreds,
  requireCreds,
  login,
  appUrl,
  bodyText,
  attachJson,
  watchForProblems,
  summarizeProblems,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const RECOVERY_RE = /refresh app|update available|update required|reload|try again|new version|recover/i;
const FATAL_BLANK_RE = /^\s*$|Application error|Unhandled Runtime Error|White screen/i;

test.describe('17 stale chunk, offline, refresh, and service-worker resilience', () => {
  test('one failed lazy chunk never leaves a permanent blank screen or reload loop', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const problems = [];
    watchForProblems(page, problems);
    await page.addInitScript(() => {
      window.__chaosRecoveryEvents = [];
      const record = (type, detail = {}) => { try { window.__chaosRecoveryEvents.push({ type, at: Date.now(), url: location.href, ...detail }); } catch (_) {} };
      const originalReplace = window.location.replace.bind(window.location);
      window.location.replace = (url) => { record('location.replace', { target: String(url || '') }); return originalReplace(url); };
      const originalReload = window.location.reload.bind(window.location);
      window.location.reload = () => { record('location.reload'); return originalReload(); };
      const originalSetItem = window.sessionStorage.setItem.bind(window.sessionStorage);
      window.sessionStorage.setItem = (key, value) => { if (/chaosReloadAt|chunk|recovery|autoReload/i.test(String(key))) record('sessionStorage.setItem', { key: String(key), value: String(value).slice(0, 120) }); return originalSetItem(key, value); };
    });
    await login(page, account.email, account.password, { tab: 'today' });

    let abortedUrl = '';
    let aborted = false;
    await page.route(/\/static\/js\/.*(?:chunk|\.js)/, async route => {
      const url = route.request().url();
      if (!aborted && !/main\.|runtime-main\.|firebase-messaging-sw/i.test(url)) {
        aborted = true;
        abortedUrl = url;
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    const reloads = [];
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) reloads.push({ at: Date.now(), url: frame.url(), note: 'supporting-evidence-only' }); });
    await page.goto(appUrl('recipes'), { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForFunction(() => {
      const stateNode = document.querySelector('[data-chaos-recovery-state]');
      const text = (document.body?.innerText || '').trim();
      return Boolean(stateNode || text.length > 20);
    }, null, { timeout: 15000 }).catch(() => {});
    const firstText = await bodyText(page, 30000);
    const firstUrl = page.url();

    const recoveryControl = page.locator('[data-chaos-recovery-state], button[aria-label*="recover" i], button:has-text("REFRESH NOW")').first();
    await recoveryControl.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const recoveryStateNodes = await page.locator('[data-chaos-recovery-state]').evaluateAll(nodes => nodes.map(node => ({ state: node.getAttribute('data-chaos-recovery-state'), text: (node.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500) }))).catch(() => []);
    const finalText = await bodyText(page, 30000);
    const finalUrl = page.url();
    const recoveryEvents = await page.evaluate(() => window.__chaosRecoveryEvents || []).catch(() => []);
    const parsedStateWrites = recoveryEvents
      .filter(x => x.type === 'sessionStorage.setItem' && /chunkRecoveryState|chunk|recovery/i.test(String(x.key || '')))
      .map((x) => {
        try { return { ...JSON.parse(x.value || '{}'), eventAt: x.at, key: x.key }; } catch (_) { return null; }
      })
      .filter(Boolean);
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

    await attachJson(testInfo, '17-chunk-failure-recovery.json', {
      aborted,
      abortedUrl,
      firstUrl,
      finalUrl,
      firstText: firstText.slice(0, 5000),
      finalText: finalText.slice(0, 5000),
      reloads,
      recoveryEvents,
      stateTransitions,
      recoveryStateNodes,
      maxAutoReloadCount,
      autoRecoveryStartedTransitions,
      recoveryStartedAt: Number.isFinite(recoveryStartedAt) ? recoveryStartedAt : null,
      markerWrites,
      postRecoveryNavigations,
      uniqueAutoReloadUsedGenerations,
      logicalAutomaticAttemptCount: automaticRecoveryAttempts,
      automaticRecoveryAttempts,
      firstNonemptyRecoveryUi: recoveryStateNodes[0]?.state || '',
      finalRouteState: finalUrl,
      problems: summarizeProblems(problems),
    });

    expect(aborted, 'The test must actually intercept one lazy JavaScript chunk').toBe(true);
    expect(firstText, 'Chunk failure must not produce a blank or fatal-only screen').not.toMatch(FATAL_BLANK_RE);
    expect(finalText, 'Repeated chunk failure must provide a usable update/recovery action').toMatch(RECOVERY_RE);
    expect(maxAutoReloadCount, 'Chunk recovery structured autoReloadCount must never exceed one').toBeLessThanOrEqual(1);
    expect(autoRecoveryStartedTransitions, 'Chunk recovery should start automatic recovery at most once').toBeLessThanOrEqual(1);
    expect(automaticRecoveryAttempts, 'Chunk recovery must not enter an infinite reload loop').toBeLessThanOrEqual(1);
  });

  test('brief offline period recovers without logout or permanent broken state', async ({ page, context }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password, { tab: 'today' });
    const before = page.url();
    await context.setOffline(true);
    await page.goto(appUrl('inventory'), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const offlineText = await bodyText(page, 20000);
    await context.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const recoveredText = await bodyText(page, 30000);
    await attachJson(testInfo, '17-offline-recovery.json', { before, offlineUrl: page.url(), offlineText: offlineText.slice(0, 4000), recoveredText: recoveredText.slice(0, 6000) });
    expect(recoveredText).not.toMatch(FATAL_BLANK_RE);
    expect(recoveredText).not.toMatch(/Email Address\s*Password|Unlock System/i);
  });

  test('HTML, version metadata, and service worker use safe deployment cache headers', async ({ request }, testInfo) => {
    const base = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL;
    const urls = [
      new URL('/', base).toString(),
      new URL('/version.json', base).toString(),
      new URL('/firebase-messaging-sw.js', base).toString(),
    ];
    const results = [];
    for (const url of urls) {
      const response = await request.get(url, { failOnStatusCode: false });
      results.push({ url, status: response.status(), cacheControl: response.headers()['cache-control'] || '', contentType: response.headers()['content-type'] || '' });
    }
    await attachJson(testInfo, '17-cache-headers.json', { results });
    for (const row of results) expect(row.status, `${row.url} should load`).toBeLessThan(500);
    const html = results[0];
    const version = results[1];
    const sw = results[2];
    expect(html.cacheControl, 'index HTML must not be immutable').not.toMatch(/immutable/i);
    expect(version.cacheControl, 'version.json must revalidate and must not be immutable').not.toMatch(/immutable/i);
    expect(sw.cacheControl, 'service worker must revalidate and must not be immutable').not.toMatch(/immutable/i);
  });
});
