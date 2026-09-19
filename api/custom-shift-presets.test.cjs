'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./custom-shift-presets-utils.cjs');

test('custom shift presets normalize and dedupe by name/start/end', () => {
  const rows = api.dedupePresets([
    { label: 'Dinner 4p-10p', start: '16:00', end: '22:00' },
    { label: 'Dinner 4p-10p', startTime: '16:00', endTime: '22:00' },
    { label: 'Bad', start: '99:00', end: '22:00' }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Dinner 4p-10p');
});

test('custom shift schedule edit authority accepts managers and rejects plain staff', () => {
  assert.equal(api.canEditSchedule({ user: { role: 'Manager' } }), true);
  assert.equal(api.canEditSchedule({ user: { permissions: { scheduleEditing: true } } }), true);
  assert.equal(api.canEditSchedule({ user: { role: 'Staff', permissions: {} } }), false);
});
