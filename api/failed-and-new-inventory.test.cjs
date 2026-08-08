'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePlaywrightListOutput, projectsForSpec } = require('../scripts/86chaos-release-gate/playwright-inventory.cjs');

test('Playwright inventory v3 extracts exact discovered titles and PWA project combinations', () => {
  const output = [
    '[chromium] › tests/86chaos-full-audit/01-auth-route-health.spec.cjs:10:3 › route health › alpha exact title',
    '[edge-pwa] › tests/86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs:20:3 › pwa metadata › Edge icon metadata loads'
  ].join('\n');
  const records = parsePlaywrightListOutput(output, process.cwd());
  assert.equal(records.length, 2);
  assert.ok(records.some(r => r.leafTitle === 'alpha exact title' && r.fullSuitePath === 'route health'));
  assert.ok(records.some(r => r.project === 'edge-pwa' && r.leafTitle === 'Edge icon metadata loads'));
  assert.ok(projectsForSpec('86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs').includes('edge-pwa'));
  assert.ok(projectsForSpec('86chaos-full-audit/01-auth-route-health.spec.cjs').includes('mobile-chromium'));
});
