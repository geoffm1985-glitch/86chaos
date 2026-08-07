const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('PWA icon metadata matrix is coherent for this browser engine', async ({ page, request, baseURL, browserName }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const metadata = await page.evaluate(() => ({
    title: document.title,
    manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '',
    appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || '',
    icons: [...document.querySelectorAll('link[rel~="icon"]')].map(el => ({ href: el.getAttribute('href'), sizes: el.getAttribute('sizes'), type: el.getAttribute('type') })),
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || '',
    appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content') || '',
    appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content') || '',
  }));
  expect(metadata.title).toMatch(/86 Chaos/);
  expect(metadata.manifestHref).toBeTruthy();
  expect(metadata.appleTouchIcon).toContain('86chaos-icon-180-v1.png');
  expect(metadata.themeColor).toBeTruthy();
  const manifestResponse = await request.get(new URL(metadata.manifestHref, baseURL).toString());
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('86 Chaos');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(4);
  for (const icon of manifest.icons) {
    const response = await request.get(new URL(icon.src, baseURL).toString(), { failOnStatusCode: false });
    expect(response.status(), `${browserName} ${icon.src}`).toBe(200);
    expect(response.headers()['content-type'] || '').not.toMatch(/text\/html/i);
    expect((await response.body()).length).toBeGreaterThan(0);
  }
  await testInfo.attach('pwa-browser-icon-matrix', { body: JSON.stringify({ browserName, metadata, manifest }, null, 2), contentType: 'application/json' });
});
