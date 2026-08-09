'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

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
function parsePngRgba(buffer) {
  if (!pngDimensions(buffer)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset); offset += 4;
    const type = buffer.toString('ascii', offset, offset + 4); offset += 4;
    const data = buffer.slice(offset, offset + length); offset += length;
    offset += 4;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || !width || !height) return null;
  const channels = colorType === 6 ? 4 : 3;
  const bpp = channels;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rows = Buffer.alloc(width * height * 4);
  let inOffset = 0;
  let outOffset = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[inOffset++];
    const cur = Buffer.from(raw.slice(inOffset, inOffset + stride));
    inOffset += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? cur[x - bpp] : 0;
      const up = prev[x] || 0;
      const upLeft = x >= bpp ? prev[x - bpp] || 0 : 0;
      let value = cur[x];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pr = pa <= pb && pa <= pc ? left : (pb <= pc ? up : upLeft);
        value = (value + pr) & 255;
      } else if (filter !== 0) {
        return null;
      }
      cur[x] = value;
    }
    for (let x = 0; x < width; x += 1) {
      const source = x * bpp;
      rows[outOffset++] = cur[source];
      rows[outOffset++] = cur[source + 1];
      rows[outOffset++] = cur[source + 2];
      rows[outOffset++] = colorType === 6 ? cur[source + 3] : 255;
    }
    prev = cur;
  }
  return { width, height, rgba: rows };
}
function analyzePngSafeArea(buffer, options = {}) {
  const parsed = parsePngRgba(buffer);
  if (!parsed) return null;
  const bg = options.background || { r: 0x12, g: 0x16, b: 0x1A };
  const tolerance = options.tolerance ?? 12;
  let minX = parsed.width;
  let minY = parsed.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < parsed.height; y += 1) {
    for (let x = 0; x < parsed.width; x += 1) {
      const i = (y * parsed.width + x) * 4;
      const a = parsed.rgba[i + 3];
      if (a <= 5) continue;
      const dr = Math.abs(parsed.rgba[i] - bg.r);
      const dg = Math.abs(parsed.rgba[i + 1] - bg.g);
      const db = Math.abs(parsed.rgba[i + 2] - bg.b);
      if (dr > tolerance || dg > tolerance || db > tolerance) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const margins = {
    left: minX,
    top: minY,
    right: parsed.width - 1 - maxX,
    bottom: parsed.height - 1 - maxY,
  };
  const minMargin = Math.min(margins.left, margins.top, margins.right, margins.bottom);
  return {
    width: parsed.width,
    height: parsed.height,
    bbox: { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
    margins,
    minMargin,
    minMarginRatio: minMargin / Math.min(parsed.width, parsed.height),
  };
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
    const item = { ...ref, relPath, exists: fs.existsSync(abs), size: 0, sha256: '', dimensions: null, safeArea: null, ok: false };
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
      if (/86chaos-(?:pwa|maskable)-(?:192|512)-v4\.png$/i.test(relPath)) {
        item.safeArea = analyzePngSafeArea(buf);
        if (!item.safeArea) errors.push(`Could not analyze safe-area padding: ${relPath}`);
        else if (item.safeArea.minMarginRatio < 0.17) errors.push(`PWA launch artwork is too close to the mask-danger edge in ${relPath}: ${(item.safeArea.minMarginRatio * 100).toFixed(1)}% margin`);
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
  for (const required of ['86chaos-pwa-192-v4.png','86chaos-pwa-512-v4.png','86chaos-maskable-192-v4.png','86chaos-maskable-512-v4.png','86chaos-icon-180-v2.png','favicon.ico']) {
    if (!declared.includes(required)) errors.push(`Required icon is not declared: ${required}`);
    if (!fs.existsSync(path.join(root, 'public', required))) errors.push(`Required icon file is missing: public/${required}`);
  }
  for (const stale of ['86chaos-icon-192-v2.png','86chaos-icon-512-v2.png','86chaos-maskable-192-v3.png','86chaos-maskable-512-v3.png']) {
    if (declared.includes(stale)) errors.push(`Manifest should not use the unpadded launch candidate for PWA splash: ${stale}`);
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
module.exports = { validateIconSourcePackage, pngDimensions, icoDimensions, sha256, publicPathFromUrl, analyzePngSafeArea };
