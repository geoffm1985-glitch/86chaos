const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { isLazyJavaScriptChunkRequest } = require('../86chaos-release-gate/utils/lazy-chunk-request.cjs');

test('17.0.81 independent regression preserves the exact bundle.js versus lazy-chunk boundary', async () => {
  const historicalFailedUrl = 'http://127.0.0.1:3000/static/js/bundle.js';
  const actualLazyChunk = 'http://127.0.0.1:3000/static/js/src_features_operations_index_js.chunk.js';
  expect(isLazyJavaScriptChunkRequest(historicalFailedUrl)).toBe(false);
  expect(isLazyJavaScriptChunkRequest(actualLazyChunk)).toBe(true);

  const releaseSpec = fs.readFileSync(path.join(process.cwd(), 'tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs'), 'utf8');
  expect(releaseSpec).toMatch(/page\.route\(\/\\\/static\\\/js\\\/\.\*\\\.js/);
  expect(releaseSpec).toContain('isLazyJavaScriptChunkRequest(url)');
  expect(releaseSpec).not.toContain("! /main");
});
