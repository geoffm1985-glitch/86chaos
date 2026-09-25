'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const bytes = file => fs.readFileSync(path.join(root, file));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

test('17.1.14 removes the exact Vercel css-loader failure path without changing the approved image bytes', () => {
  const css = read('src/concept17.css');
  assert.doesNotMatch(css, /url\(['\"]\/concept17-kitchen-reference\.jpg['\"]\)/, 'root-public URL must not be parsed by css-loader');
  const match = css.match(/--c17-ref-kitchen-image:\s*url\(\"data:image\/jpeg;base64,([^\"]+)\"\);/);
  assert.ok(match, 'approved kitchen image is embedded as one Vercel-safe JPEG data URI');
  const decoded = Buffer.from(match[1], 'base64');
  const original = bytes('public/concept17-kitchen-reference.jpg');
  assert.equal(decoded.length, original.length, 'embedded image byte length matches approved reference');
  assert.equal(sha256(decoded), sha256(original), 'embedded image bytes are exactly the approved reference image');
  assert.ok((css.match(/var\(--c17-ref-kitchen-image\)/g) || []).length >= 3, 'desktop, route, and mobile surfaces reuse the same exact image');
});

test('17.1.14 preserves the complete 17.1.13 redesign and feature surface', () => {
  const pkg = JSON.parse(read('package.json'));
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  assert.equal(pkg.version, '17.1.14');
  assert.ok(pkg.scripts['test:current-release-targeted'].includes('api/pixel-reference-full-app-17-1-13.test.cjs'));
  assert.ok(pkg.scripts['test:current-release-targeted'].includes('api/mobile-voice-pwa-panel-17-1-12.test.cjs'));
  for (const file of ['src/features/schedule.jsx','src/features/operations.jsx','src/features/inventory.jsx','src/features/management.jsx','src/features/hr.jsx','src/features/intelligence.jsx']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} remains present`);
  }
  for (const route of ['today','ops','prep','inventory','recipes','team','published','financials','messages','godmode','settings','help']) {
    assert.ok(app.includes(`{ id: '${route}',`) || shell.includes(`${route}:`) || shell.includes(`'${route}':`), `${route} remains routed`);
  }
  assert.match(shell, /data-testid="concept17-mobile-voice-button"/);
  assert.doesNotMatch(app, /concept17-header-report/);
});
