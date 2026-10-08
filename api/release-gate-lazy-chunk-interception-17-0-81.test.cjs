'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isLazyJavaScriptChunkRequest } = require('../tests/86chaos-release-gate/utils/lazy-chunk-request.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.81 lazy-chunk classifier never mistakes the CRA development boot bundle for a recoverable lazy chunk', () => {
  assert.equal(isLazyJavaScriptChunkRequest('http://127.0.0.1:3000/static/js/bundle.js'), false);
  assert.equal(isLazyJavaScriptChunkRequest('https://testing.86chaos.com/static/js/main.abc123.js'), false);
  assert.equal(isLazyJavaScriptChunkRequest('https://testing.86chaos.com/static/js/runtime-main.abc123.js'), false);
  assert.equal(isLazyJavaScriptChunkRequest('https://testing.86chaos.com/firebase-messaging-sw.js'), false);
});

test('17.0.81 lazy-chunk classifier still selects real CRA lazy JavaScript chunks', () => {
  assert.equal(isLazyJavaScriptChunkRequest('http://127.0.0.1:3000/static/js/src_features_operations_index_js.chunk.js'), true);
  assert.equal(isLazyJavaScriptChunkRequest('https://testing.86chaos.com/static/js/742.a1b2c3.chunk.js?cache=1'), true);
  assert.equal(isLazyJavaScriptChunkRequest('https://testing.86chaos.com/static/css/742.a1b2c3.chunk.css'), false);
});

test('17.0.81 historical resilience gate delegates fault injection to the lazy-chunk classifier', () => {
  const spec = read('tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs');
  assert.match(spec, /isLazyJavaScriptChunkRequest\(url\)/);
  assert.match(spec, /never the CRA boot bundle/);
  assert.doesNotMatch(spec, /!\/main\\\\\.|runtime-main\\\\\.|firebase-messaging-sw\/i\.test\(url\)/);
});
