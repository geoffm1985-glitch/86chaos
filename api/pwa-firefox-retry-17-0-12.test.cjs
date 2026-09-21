'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

test('Firefox PWA project has exactly one bounded retry in full and failed-only configs', () => {
  for (const file of ['playwright.play-store-release.config.cjs', 'playwright.failed-release.config.cjs']) {
    const source = read(file);
    assert.match(source, /\{ name: 'firefox-pwa', retries: 1,/, `${file} retries the isolated Firefox project once`);
    assert.doesNotMatch(source, /\{ name: 'edge-pwa', retries:/, `${file} does not broaden retry behavior to Edge`);
    assert.doesNotMatch(source, /\{ name: 'webkit-pwa', retries:/, `${file} does not broaden retry behavior to WebKit`);
    assert.doesNotMatch(source, /\{ name: 'mobile-webkit-pwa', retries:/, `${file} does not broaden retry behavior to mobile WebKit`);
  }
});
