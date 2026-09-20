'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const scheduleWrapper = read('src/core/scheduleRuntimeSafety.js');
const requestWrapper = read('src/core/requestOffRuntimeSafety.js');
const scheduleCjs = read('src/core/scheduleRuntimeSafety.cjs');
const requestCjs = read('src/core/requestOffRuntimeSafety.cjs');
const scheduleShared = read('src/core/scheduleRuntimeSafety.shared.js');
const routeRegression = read('src/features/scheduleRuntimeSafety.test.jsx');

test('17.0.27 browser wrappers import JavaScript modules instead of CRA static-media cjs assets', () => {
  assert.match(scheduleWrapper, /require\('\.\/scheduleRuntimeSafety\.shared\.js'\)/);
  assert.match(requestWrapper, /require\('\.\/requestOffRuntimeSafety\.shared\.js'\)/);
  assert.doesNotMatch(scheduleWrapper, /\.cjs['"]/);
  assert.doesNotMatch(requestWrapper, /\.cjs['"]/);
  assert.match(scheduleShared, /require\('\.\/requestOffRuntimeSafety\.shared\.js'\)/);
  assert.doesNotMatch(scheduleShared, /requestOffRuntimeSafety\.cjs/);
});

test('17.0.27 Node proxies and browser sources expose the exact same runtime implementations', () => {
  assert.match(scheduleCjs, /module\.exports = require\('\.\/scheduleRuntimeSafety\.shared\.js'\)/);
  assert.match(requestCjs, /module\.exports = require\('\.\/requestOffRuntimeSafety\.shared\.js'\)/);
  assert.strictEqual(require('../src/core/scheduleRuntimeSafety.cjs'), require('../src/core/scheduleRuntimeSafety.shared.js'));
  assert.strictEqual(require('../src/core/requestOffRuntimeSafety.cjs'), require('../src/core/requestOffRuntimeSafety.shared.js'));
});

test('17.0.27 parent-route regression covers Time Clock and Schedule subtab navigation behind a recovery boundary', () => {
  assert.match(routeRegression, /TabMasterSchedule/);
  assert.match(routeRegression, /top-level Time Clock and Schedule route survives hostile legacy data across every schedule subtab/);
  for (const evidence of ['clock in', 'month view', 'schedule request off', 'availability', 'schedule builder', 'This section hit a snag']) {
    assert.match(routeRegression.toLowerCase(), new RegExp(evidence.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('17.0.27 production-build verification rejects runtime safety modules emitted as media', () => {
  const verifier = read('scripts/verify-schedule-runtime-bundle.cjs');
  assert.match(verifier, /scheduleRuntimeSafety/);
  assert.match(verifier, /requestOffRuntimeSafety/);
  assert.match(verifier, /static[\\/]media/);
});
