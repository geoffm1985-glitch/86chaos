const { test, expect } = require('@playwright/test');
const { hasFeature } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.skip(!hasFeature('pwa'), 'PWA files are not present in this app version.');
test.describe('25 Android PWA and store-wrapper installability gate', () => {
  test('manifest, icons, viewport, HTTPS, and service-worker foundations are valid', async ({ page, request }, testInfo) => {
    const base = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL;
    const root = new URL('/', base);
    expect(root.protocol, 'A release candidate must use HTTPS except an explicitly non-release localhost diagnostic').toBe('https:');

    await page.goto(root.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const shell = await page.evaluate(() => ({
      manifestHref: document.querySelector('link[rel="manifest"]')?.href || '',
      viewport: document.querySelector('meta[name="viewport"]')?.content || '',
      themeColor: document.querySelector('meta[name="theme-color"]')?.content || '',
      appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content || '',
      serviceWorkerSupported: 'serviceWorker' in navigator,
    }));
    expect(shell.manifestHref, 'HTML must link a web app manifest').toBeTruthy();
    expect(shell.viewport, 'HTML must define a mobile viewport').toMatch(/width=device-width/i);
    expect(shell.serviceWorkerSupported, 'Target browser must expose service-worker support').toBe(true);

    const manifestResponse = await request.get(shell.manifestHref, { failOnStatusCode: false });
    expect(manifestResponse.status(), 'Manifest must load').toBe(200);
    const manifest = await manifestResponse.json();
    const sizes = (manifest.icons || []).flatMap(icon => String(icon.sizes || '').split(/\s+/)).filter(Boolean);
    const checks = {
      name: Boolean(manifest.name),
      shortName: Boolean(manifest.short_name),
      startUrl: Boolean(manifest.start_url),
      display: /standalone|fullscreen|minimal-ui/i.test(String(manifest.display || '')),
      icon192: sizes.includes('192x192'),
      icon512: sizes.includes('512x512'),
      themeColor: Boolean(manifest.theme_color || shell.themeColor),
      backgroundColor: Boolean(manifest.background_color),
    };

    const iconResults = [];
    for (const icon of manifest.icons || []) {
      const iconUrl = new URL(icon.src, shell.manifestHref).toString();
      const response = await request.get(iconUrl, { failOnStatusCode: false });
      iconResults.push({ src: icon.src, sizes: icon.sizes, type: icon.type, status: response.status(), contentType: response.headers()['content-type'] || '' });
    }

    const registration = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then(reg => ({ supported: true, scope: reg.scope, active: Boolean(reg.active) })),
        new Promise(resolve => setTimeout(() => resolve({ supported: true, timeout: true }), 10000)),
      ]);
      return ready;
    });

    await attachJson(testInfo, '25-pwa-installability.json', { shell, manifest, checks, iconResults, registration });
    expect(Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name), 'Manifest is missing required installability fields').toEqual([]);
    expect(iconResults.filter(row => row.status !== 200), 'Every declared manifest icon must load').toEqual([]);
    expect(registration.active, 'The deployed release candidate must activate a service worker').toBe(true);
  });
});
