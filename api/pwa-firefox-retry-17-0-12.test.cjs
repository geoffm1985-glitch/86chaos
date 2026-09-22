'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('PWA metadata check no longer depends on a Firefox browser launch', () => {
  const spec = read('tests/86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs');
  assert.match(spec, /async \(\{ request, baseURL, browserName \}/);
  assert.doesNotMatch(spec, /\{ page,/);
  assert.match(spec, /request\.get\(rootUrl/);
  for (const file of ['playwright.play-store-release.config.cjs', 'playwright.failed-release.config.cjs']) {
    const source = read(file);
    assert.doesNotMatch(source, /\{ name: 'firefox-pwa', retries:/, `${file} does not paper over browser launch failures with a project-specific retry`);
  }
});
