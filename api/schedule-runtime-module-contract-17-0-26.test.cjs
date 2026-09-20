'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cjs = require('../src/core/scheduleRuntimeSafety.cjs');
const wrapper = fs.readFileSync(path.join(root, 'src/core/scheduleRuntimeSafety.js'), 'utf8');
const schedule = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');

const consumed = [
  'safeScheduleObjectRows',
  'safeScheduleRosterRows',
  'safeScheduleShiftRows',
  'safeScheduleAvailabilityRows',
  'safeScheduleEventRows',
];

test('17.0.26 CommonJS schedule safety module exposes every route-boundary sanitizer', () => {
  for (const name of consumed) assert.equal(typeof cjs[name], 'function', `${name} must be callable`);
});

test('17.0.26 ES-module wrapper re-exports every schedule safety helper consumed by schedule.jsx', () => {
  for (const name of consumed) {
    assert.match(schedule, new RegExp(`\\b${name}\\b`), `${name} should remain consumed by schedule.jsx`);
    assert.match(wrapper, new RegExp(`export const ${name} = safety\\.${name};`), `${name} must be forwarded by the ESM wrapper`);
  }
  assert.match(wrapper, /export const normalizeScheduleAvailabilityRow = safety\.normalizeScheduleAvailabilityRow;/);
});

test('17.0.26 hostile availability values are normalized without throwing', () => {
  assert.doesNotThrow(() => cjs.safeScheduleAvailabilityRows([
    null,
    'bad',
    { id: 'a1', employeeName: { legacy: true }, weeklyAvailability: { Monday: { start: { bad: true }, end: '17:00' } } },
  ]));
  const rows = cjs.safeScheduleAvailabilityRows([{ id: 'a1', weeklyAvailability: { Monday: { start: { bad: true }, end: '17:00' } } }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].weeklyAvailability.Monday.start, '');
  assert.equal(rows[0].weeklyAvailability.Monday.end, '17:00');
});
