const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'));
const indexHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const common = fs.readFileSync(path.join(root, 'src/components/common.jsx'), 'utf8');
const cheersLogo = fs.readFileSync(path.join(root, 'src/components/CheersLogo.js'), 'utf8');

test('PWA manifest uses dedicated v4 launch-safe assets and browser/header icons keep v2 metallic artwork', () => {
  const normalV2Sizes = ['16','32','48','144','180','256','384'];
  for (const size of normalV2Sizes) {
    const iconPath = path.join(root, `public/86chaos-icon-${size}-v2.png`);
    assert.ok(fs.statSync(iconPath).size > 500, `${iconPath} should exist and be non-empty`);
    assert.ok(manifest.icons.some(icon => icon.src === `/86chaos-icon-${size}-v2.png` && icon.sizes === `${size}x${size}`), `${size} manifest icon should reference v2`);
  }
  for (const size of ['192', '512']) {
    const pwaPath = path.join(root, `public/86chaos-pwa-${size}-v4.png`);
    const maskablePath = path.join(root, `public/86chaos-maskable-${size}-v4.png`);
    assert.ok(fs.statSync(pwaPath).size > 500, `${pwaPath} should exist and be non-empty`);
    assert.ok(fs.statSync(maskablePath).size > 500, `${maskablePath} should exist and be non-empty`);
    assert.ok(manifest.icons.some(icon => icon.src === `/86chaos-pwa-${size}-v4.png` && icon.purpose === 'any'), `${size} PWA manifest icon should reference v4 safe-canvas asset`);
    assert.ok(manifest.icons.some(icon => icon.src === `/86chaos-maskable-${size}-v4.png` && icon.purpose === 'maskable'), `${size} maskable manifest icon should reference v4 safe-canvas asset`);
  }
  const manifestSources = manifest.icons.map(icon => icon.src).join('\n');
  assert.doesNotMatch(manifestSources, /86chaos-icon-(192|512)-v2\.png/);
  assert.doesNotMatch(manifestSources, /86chaos-maskable-(192|512)-v3\.png/);
});

test('index favicon/apple-touch and top header no longer use Wisconsin app mark', () => {
  assert.match(indexHtml, /86chaos-icon-16-v2\.png/);
  assert.match(indexHtml, /86chaos-icon-32-v2\.png/);
  assert.match(indexHtml, /86chaos-icon-180-v2\.png/);
  assert.match(common, /src="\/86chaos-icon-48-v2\.png"/);
  assert.match(cheersLogo, /src="\/86chaos-icon-48-v2\.png"/);
  assert.doesNotMatch(common, /src="\/wisco\.png"/);
  assert.doesNotMatch(cheersLogo, /src="\/wisco\.png"/);
  assert.match(common, /src="\/6139\.png"/);
  assert.match(cheersLogo, /src="\/6139\.png"/);
});
