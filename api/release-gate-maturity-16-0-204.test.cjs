'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('16.0.204 Schedule Builder oracle requires visible seed data after a fresh-route hydration retry', () => {
  const spec = read('tests/86chaos-full-audit/04-schedule-math-oracle.spec.cjs');
  assert.match(spec, /waitForScheduleSeedLabels/);
  assert.match(spec, /gotoTab\(page, 'schedule', \{ fullReload: true/);
  assert.match(spec, /04-schedule-ui-seed-visibility-initial-miss/);
  assert.match(spec, /expect\(missing, 'Schedule Builder should hydrate current-run QA staff\/events before seed visibility assertions run'\)\.toEqual\(\[\]\)/);
  assert.doesNotMatch(spec, /test\.skip\(true, 'Schedule Builder/);
});

test('16.0.204 exhaustive form probe targets the exact visible control before structural fallback', () => {
  const helper = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  assert.match(helper, /data-chaos-probe-token/);
  assert.match(helper, /probeRunId/);
  assert.match(helper, /node\.setAttribute\('data-chaos-probe-token', probeToken\)/);
  assert.match(helper, /if \(row\.probeToken\) return page\.locator/);
  assert.match(helper, /if \(row\.type\) parts\.push/);
  assert.match(helper, /\[type="/);
  assert.match(helper, /\$\{parts\.join\(''\)\}:visible/);
});

test('16.0.204 validator remains archived after later version bumps', () => {
  const validator = read('scripts/validate-16-0-204.js');
  assert.match(validator, /Schedule Hydration and Form Probe Determinism Repair/);
  assert.match(validator, /schedule oracle waits for deterministic seeded data/);
  assert.match(validator, /form descriptor reconstruction first targets the exact originally inventoried visible control/);
});
