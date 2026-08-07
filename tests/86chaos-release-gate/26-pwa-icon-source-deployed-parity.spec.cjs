const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateIconSourcePackage, pngDimensions, icoDimensions, sha256, publicPathFromUrl } = require('../../scripts/86chaos-release-gate/icon-source-validator.cjs');
const { ensureRunDir, writeJson } = require('../../scripts/86chaos-release-gate/run-context.cjs');

function publicAssetPath(src) { return publicPathFromUrl(src).replace(/\\/g, '/').replace(/^public\//, ''); }
function publicUrl(baseURL, src) { return new URL(publicAssetPath(src), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString(); }
function localPath(root, src) { return path.join(root, publicPathFromUrl(src)); }
function expectedSizes(sizes='') { return String(sizes || '').split(/\s+/).filter(Boolean).map(s => { const m=s.match(/^(\d+)x(\d+)$/); return m ? [Number(m[1]), Number(m[2])] : null; }).filter(Boolean); }

test('PWA source and deployed icon bytes match declared manifest assets', async ({ request, baseURL }, testInfo) => {
  const root = path.join(__dirname, '../..');
  const source = validateIconSourcePackage(root, { writeReport: true, reportPath: path.join(ensureRunDir().runDir, 'pwa-icon-source-inventory.json') });
  expect(source.ok, source.errors.join('\n')).toBeTruthy();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  expect(manifest.name).toBe('86 Chaos');
  expect(manifest.display).toBe('standalone');
  const refs = [...manifest.icons.map(icon => ({ source: 'manifest', ...icon }))];
  const htmlIconMatches = [...html.matchAll(/<link\b[^>]*(?:rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["'])[^>]*>/gi)];
  for (const match of htmlIconMatches) refs.push({ source: 'html', src: match[1] || match[2] });
  const results = [];
  for (const ref of refs.filter(r => r.src && !/^https?:|^data:/i.test(r.src))) {
    const response = await request.get(publicUrl(baseURL, ref.src), { failOnStatusCode: false });
    const body = Buffer.from(await response.body());
    const sourcePath = localPath(root, ref.src);
    const sourceBuffer = fs.readFileSync(sourcePath);
    const contentType = response.headers()['content-type'] || '';
    const item = { src: ref.src, status: response.status(), contentType, bytes: body.length, sourceSha256: sha256(sourceBuffer), deployedSha256: sha256(body), dimensions: null };
    expect(response.status(), `${ref.src} should return HTTP 200`).toBe(200);
    expect(contentType, `${ref.src} should not return HTML`).not.toMatch(/text\/html/i);
    expect(body.length, `${ref.src} should return bytes`).toBeGreaterThan(0);
    expect(item.deployedSha256, `${ref.src} deployed bytes should match source bytes`).toBe(item.sourceSha256);
    if (/\.png$/i.test(ref.src)) {
      const dims = pngDimensions(body);
      item.dimensions = dims;
      expect(dims, `${ref.src} should be a real PNG`).toBeTruthy();
      for (const [w, h] of expectedSizes(ref.sizes)) expect(`${dims.width}x${dims.height}`).toBe(`${w}x${h}`);
    } else if (/\.ico$/i.test(ref.src)) {
      expect(icoDimensions(body), `${ref.src} should be a real ICO`).toBeTruthy();
    }
    results.push(item);
  }
  writeJson(path.join(ensureRunDir().runDir, 'pwa-icon-source-deployed-parity.json'), { ok: true, generatedAt: new Date().toISOString(), baseURL, results });
  await testInfo.attach('pwa-icon-source-deployed-parity', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
});
