#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const requiredAssets = [
  'public/86chaos-icon-16-v2.png',
  'public/86chaos-icon-32-v2.png',
  'public/86chaos-icon-48-v2.png',
  'public/86chaos-icon-144-v2.png',
  'public/86chaos-icon-180-v2.png',
  'public/86chaos-pwa-192-v4.png',
  'public/86chaos-icon-256-v2.png',
  'public/86chaos-icon-384-v2.png',
  'public/86chaos-pwa-512-v4.png',
  'public/86chaos-maskable-192-v4.png',
  'public/86chaos-maskable-512-v4.png',
  'public/6139.png'
];

test('86 Chaos header and PWA image assets exist and are non-empty', () => {
  for (const file of requiredAssets) {
    const full = path.join(root, file);
    assert.equal(fs.existsSync(full), true, `${file} should exist`);
    assert.ok(fs.statSync(full).size > 0, `${file} should be non-empty`);
  }
});

test('header components still point at restored icon and wordmark assets', () => {
  const common = read('src/components/common.jsx');
  const cheersLogo = read('src/components/CheersLogo.js');

  for (const source of [common, cheersLogo]) {
    assert.match(source, /src="\/86chaos-icon-48-v2\.png"/);
    assert.match(source, /alt="86 Chaos app icon"/);
    assert.match(source, /src="\/6139\.png"/);
    assert.match(source, /alt="86 Chaos"/);
  }
});

test('index and manifest references resolve to restored public assets', () => {
  const indexHtml = read('public/index.html');
  const manifest = json('public/manifest.json');
  const manifestSources = new Set((manifest.icons || []).map(icon => icon.src));

  for (const src of [
    '/86chaos-icon-16-v2.png',
    '/86chaos-icon-32-v2.png',
    '/86chaos-icon-48-v2.png',
    '/86chaos-icon-180-v2.png'
  ]) {
    assert.equal(indexHtml.includes(src), true, `index.html should reference ${src}`);
  }

  for (const file of requiredAssets.filter(file => file.startsWith('public/86chaos-'))) {
    const src = `/${path.basename(file)}`;
    assert.equal(manifestSources.has(src), true, `manifest should reference ${src}`);
  }
});
