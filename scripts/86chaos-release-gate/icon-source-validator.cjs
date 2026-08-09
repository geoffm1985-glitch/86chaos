'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function stripQuery(value='') { return String(value || '').split('#')[0].split('?')[0]; }
function isLocalUrl(value='') {
  const url = stripQuery(value);
  return url && !/^https?:\/\//i.test(url) && !/^data:/i.test(url);
}
function publicPathFromUrl(url='') {
  const cleaned = stripQuery(url).replace(/^%PUBLIC_URL%\/?/, '').replace(/^\//, '');
  return cleaned.startsWith('public/') ? cleaned : path.join('public', cleaned || '');
}
function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), type: 'image/png' };
}
function icoDimensions(buffer) {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return null;
  const count = buffer.readUInt16LE(4);
  const sizes = [];
  for (let i = 0; i < count; i += 1) {
    const off = 6 + i * 16;
    if (buffer.length < off + 16) break;
    const w = buffer[off] || 256;
    const h = buffer[off + 1] || 256;
    sizes.push(`${w}x${h}`);
  }
  return { type: 'image/x-icon', sizes };
}
function expectedSizesFromString(value='') {
  return String(value || '').split(/\s+/).filter(Boolean).map(part => {
    const m = part.match(/^(\d+)x(\d+)$/i);
    return m ? { width: Number(m[1]), height: Number(m[2]), text: `${Number(m[1])}x${Number(m[2])}` } : null;
  }).filter(Boolean);
}
function parseHtmlIconRefs(html='') {
  const refs = [];
  const linkRe = /<link\b[^>]*>/gi;
  let match;
  while ((match = linkRe.exec(html))) {
    const tag = match[0];
    const rel = (tag.match(/\brel=["']([^"']+)["']/i) || [])[1] || '';
    const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1] || '';
    const sizes = (tag.match(/\bsizes=["']([^"']+)["']/i) || [])[1] || '';
    const type = (tag.match(/\btype=["']([^"']+)["']/i) || [])[1] || '';
    if (!href || !isLocalUrl(href)) continue;
    if (/icon|manifest/i.test(rel)) refs.push({ source: 'html', rel, src: href, sizes, type });
  }
  return refs;
}
function validateIconSourcePackage(root=process.cwd(), { writeReport = false, reportPath = null } = {}) {
  const errors = [];
  const warnings = [];
  const manifestPath = path.join(root, 'public/manifest.json');
  const htmlPath = path.join(root, 'public/index.html');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const html = fs.readFileSync(htmlPath, 'utf8');
  const refs = [];
  for (const icon of manifest.icons || []) refs.push({ source: 'manifest', rel: icon.purpose || 'any', src: icon.src, sizes: icon.sizes, type: icon.type, purpose: icon.purpose || 'any' });
  refs.push(...parseHtmlIconRefs(html));
  const inventory = [];
  for (const ref of refs) {
    if (!isLocalUrl(ref.src)) continue;
    const relPath = publicPathFromUrl(ref.src).replace(/\\/g, '/');
    const abs = path.join(root, relPath);
    const item = { ...ref, relPath, exists: fs.existsSync(abs), size: 0, sha256: '', dimensions: null, ok: false };
    if (!item.exists) {
      errors.push(`Missing icon/manifest asset: ${ref.src} -> ${relPath}`);
      inventory.push(item);
      continue;
    }
    const buf = fs.readFileSync(abs);
    item.size = buf.length;
    item.sha256 = sha256(buf);
    if (buf.length <= 0) errors.push(`Empty asset: ${relPath}`);
    if (/\.png$/i.test(relPath)) {
      item.dimensions = pngDimensions(buf);
      if (!item.dimensions) errors.push(`PNG signature/dimensions invalid: ${relPath}`);
      const expected = expectedSizesFromString(ref.sizes);
      if (item.dimensions && expected.length) {
        const ok = expected.some(s => s.width === item.dimensions.width && s.height === item.dimensions.height);
        if (!ok) errors.push(`PNG dimensions mismatch for ${relPath}: declared ${ref.sizes}, actual ${item.dimensions.width}x${item.dimensions.height}`);
      }
      const head = buf.slice(0, 64).toString('utf8').toLowerCase();
      if (head.includes('<!doctype') || head.includes('<html')) errors.push(`Asset looks like HTML, not PNG: ${relPath}`);
    } else if (/\.ico$/i.test(relPath)) {
      item.dimensions = icoDimensions(buf);
      if (!item.dimensions) errors.push(`ICO signature invalid: ${relPath}`);
    } else if (/manifest\.json$/i.test(relPath)) {
      try { JSON.parse(buf.toString('utf8')); } catch (_) { errors.push(`Manifest link is not valid JSON: ${relPath}`); }
    }
    item.ok = !errors.some(e => e.includes(relPath));
    inventory.push(item);
  }
  const declared = refs.map(r => r.src || '').join('\n');
  for (const required of ['86chaos-icon-192-v2.png','86chaos-icon-512-v2.png','86chaos-maskable-192-v2.png','86chaos-maskable-512-v2.png','86chaos-icon-180-v2.png','favicon.ico']) {
    if (!declared.includes(required)) errors.push(`Required icon is not declared: ${required}`);
    if (!fs.existsSync(path.join(root, 'public', required))) errors.push(`Required icon file is missing: public/${required}`);
  }
  const maskable = (manifest.icons || []).filter(i => /maskable/i.test(i.purpose || ''));
  if (maskable.length < 2) errors.push('Manifest must declare separate maskable icons.');
  const report = { ok: errors.length === 0, generatedAt: new Date().toISOString(), errors, warnings, inventory };
  if (writeReport) fs.writeFileSync(reportPath || path.join(root, 'pwa-icon-source-inventory.json'), JSON.stringify(report, null, 2));
  return report;
}
if (require.main === module) {
  const report = validateIconSourcePackage(process.cwd(), { writeReport: true });
  console.log(JSON.stringify({ ok: report.ok, iconCount: report.inventory.length, errors: report.errors }, null, 2));
  if (!report.ok) process.exit(1);
}
module.exports = { validateIconSourcePackage, pngDimensions, icoDimensions, sha256, publicPathFromUrl };
