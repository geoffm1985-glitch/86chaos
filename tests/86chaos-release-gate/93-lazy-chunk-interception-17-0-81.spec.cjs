const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { isLazyJavaScriptChunkRequest } = require('./utils/lazy-chunk-request.cjs');

test.describe('17.0.81 lazy chunk failure-injection fidelity repair', () => {
  test('release-gate chunk injection skips the CRA boot bundle and still selects actual lazy chunks', async () => {
    expect(isLazyJavaScriptChunkRequest('http://127.0.0.1:3000/static/js/bundle.js')).toBe(false);
    expect(isLazyJavaScriptChunkRequest('http://127.0.0.1:3000/static/js/src_features_operations_index_js.chunk.js')).toBe(true);
    expect(isLazyJavaScriptChunkRequest('https://testing.86chaos.com/static/js/main.abc123.js')).toBe(false);
    expect(isLazyJavaScriptChunkRequest('https://testing.86chaos.com/static/js/742.a1b2c3.chunk.js')).toBe(true);

    const historicalSpec = fs.readFileSync(path.join(process.cwd(), 'tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs'), 'utf8');
    expect(historicalSpec).toContain('isLazyJavaScriptChunkRequest(url)');
    expect(historicalSpec).toContain('The injected failure must target a lazy chunk, never the CRA boot bundle');
  });
});
