'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const inv = require('../scripts/86chaos-release-gate/playwright-inventory.cjs');

test('schema v3 keeps repeated leaf titles under different describes separate', () => {
  const output = [
    '[chromium] › tests/e2e/authenticated-release.spec.cjs:10:5 › system-admin › opens every permitted primary surface without fatal errors',
    '[chromium] › tests/e2e/authenticated-release.spec.cjs:20:5 › staff › opens every permitted primary surface without fatal errors'
  ].join('\n');
  const records = inv.parsePlaywrightListOutput(output, process.cwd());
  assert.equal(records.length, 2);
  assert.notEqual(records[0].stableKey, records[1].stableKey);
  assert.deepEqual(records.map(r => r.fullSuitePath).sort(), ['staff', 'system-admin']);
});

test('schema v3 records actual expanded dynamic titles from Playwright discovery', () => {
  const output = '[mobile-chromium] › tests/e2e/layout.spec.cjs:3:1 › compact layout › does not create body-level horizontal overflow at 390x844';
  const [record] = inv.parsePlaywrightListOutput(output, process.cwd());
  assert.equal(record.leafTitle, 'does not create body-level horizontal overflow at 390x844');
  assert.ok(!record.leafTitle.includes('${'));
});

test('project applicability does not invent mobile V8 coverage', () => {
  assert.deepEqual(inv.projectsForSpec('tests/e2e/runtime-code-coverage.spec.cjs'), ['chromium']);
});

test('duplicate stable identities fail validation', () => {
  const output = [
    '[chromium] › tests/a.spec.cjs:1:1 › role › same title',
    '[chromium] › tests/a.spec.cjs:2:1 › role › same title'
  ].join('\n');
  assert.throws(() => inv.parsePlaywrightListOutput(output, process.cwd()), /duplicate/i);
});
