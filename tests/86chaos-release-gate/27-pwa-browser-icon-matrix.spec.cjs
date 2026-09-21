const { test, expect } = require('@playwright/test');

// This check validates only app-shell/manifest/icon metadata. Keep it request-only
// so a metadata assertion cannot fail because an optional browser process exits
// before Playwright creates a page.
test.use({ video: 'off' });

const getAttr = (tag = '', name = '') => {
  const quoted = tag.match(new RegExp(name + '\\s*=\\s*(["\'])(.*?)\\1', 'i'));
  if (quoted) return quoted[2];
  const bare = tag.match(new RegExp(name + '\\s*=\\s*([^\\s"\'<>`=]+)', 'i'));
  return bare ? bare[1] : '';
};
const tagList = (html = '', tagName = '') => [...html.matchAll(new RegExp('<' + tagName + '\\b[^>]*>', 'gi'))].map(match => match[0]);
const relHas = (tag = '', value = '') => getAttr(tag, 'rel').toLowerCase().split(/\s+/).includes(value);
const firstMetaContent = (html = '', name = '') => {
  const tag = tagList(html, 'meta').find(item => getAttr(item, 'name').toLowerCase() === name.toLowerCase());
  return tag ? getAttr(tag, 'content') : '';
};
const firstLinkHref = (html = '', rel = '') => {
  const tag = tagList(html, 'link').find(item => relHas(item, rel));
  return tag ? getAttr(tag, 'href') : '';
};

test('PWA icon metadata matrix is coherent for this browser engine', async ({ request, baseURL, browserName }, testInfo) => {
  const rootUrl = new URL('/', baseURL).toString();
  const pageResponse = await request.get(rootUrl, { failOnStatusCode: false });
  expect(pageResponse.status(), `${browserName} app shell`).toBe(200);
  const html = await pageResponse.text();
  const metadata = {
    title: (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim(),
    manifestHref: firstLinkHref(html, 'manifest'),
    appleTouchIcon: firstLinkHref(html, 'apple-touch-icon'),
    icons: tagList(html, 'link').filter(tag => relHas(tag, 'icon')).map(tag => ({ href: getAttr(tag, 'href'), sizes: getAttr(tag, 'sizes'), type: getAttr(tag, 'type') })),
    themeColor: firstMetaContent(html, 'theme-color'),
    appleTitle: firstMetaContent(html, 'apple-mobile-web-app-title'),
    appleCapable: firstMetaContent(html, 'apple-mobile-web-app-capable'),
  };
  expect(metadata.title).toMatch(/86 Chaos/);
  expect(metadata.manifestHref).toBeTruthy();
  expect(metadata.appleTouchIcon).toContain('86chaos-icon-180-v2.png');
  expect(metadata.themeColor).toBeTruthy();
  const manifestResponse = await request.get(new URL(metadata.manifestHref, baseURL).toString(), { failOnStatusCode: false });
  expect(manifestResponse.status(), `${browserName} manifest`).toBe(200);
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
