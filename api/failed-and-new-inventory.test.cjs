'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTestTitlesFromSpec, projectsForSpec } = require('../scripts/86chaos-release-gate/playwright-inventory.cjs');

test('Playwright inventory extracts exact titles and marks PWA matrix projects as new combinations', () => {
  const source = `test('alpha exact title', async()=>{});
test.describe('x',()=>{
  test('beta exact title', async()=>{});
});`;
  const titles = extractTestTitlesFromSpec(source);
  assert.ok(titles.includes('alpha exact title'));
  assert.ok(titles.includes('beta exact title'));
  assert.ok(projectsForSpec('86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs').includes('edge-pwa'));
  assert.ok(projectsForSpec('86chaos-full-audit/01-auth-route-health.spec.cjs').includes('mobile-chromium'));
});
