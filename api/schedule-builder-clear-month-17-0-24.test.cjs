'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.24 Schedule Builder exposes an explicitly confirmed Clear Month destructive action', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /data-chaos-workflow-id="schedule-clear-month"/);
  assert.match(schedule, /onClick=\{handleClearScheduleMonth\}/);
  assert.match(schedule, /Delete ALL \$\{targets\.length\} saved shift/);
  assert.match(schedule, /This includes draft and published shifts/);
  assert.match(schedule, /Events and time-off requests will NOT be deleted/);
  assert.match(schedule, /This cannot be undone/);
});

test('17.0.24 Clear Month reloads the full canonical tenant shift collection before deleting', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /getDocsFromServer\(query\(baseCollection, where\('restaurantId', '==', restaurantId\)\)\)/);
  assert.match(schedule, /shiftBelongsToScheduleMonth\(shift, targetMonth\)/);
  assert.match(schedule, /scheduleMonth, shift\?\.month, shift\?\.sourceMonth, shift\?\.restoreMonth/);
});

test('17.0.24 Clear Month verifies Firestore is empty and retries once instead of silently accepting a partial delete', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /scope: 'schedule-builder-clear-month'/);
  assert.match(schedule, /scope: 'schedule-builder-clear-month-verification-retry'/);
  const fetchCalls = (schedule.match(/fetchSavedScheduleBuilderMonthTargets\(targetMonth\)/g) || []).length;
  assert.ok(fetchCalls >= 3, `expected initial load plus two verification loads, found ${fetchCalls}`);
  assert.match(schedule, /still remain in \$\{monthLabel\}/);
  assert.match(schedule, /setLocalBuilderShiftEchoes\(prev => prev\.filter\(shift => !shiftBelongsToScheduleMonth/);
  assert.match(schedule, /setAutoFillVisibleShifts\(prev => prev\.filter\(shift => !shiftBelongsToScheduleMonth/);
});

test('17.0.24 Clear Month stays inside existing Schedule Builder and does not add a new permission surface', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /\{subTab === 'schedule' && \(/);
  assert.match(schedule, /subTab === 'schedule-builder' && scheduleBuilderProps/);
  assert.doesNotMatch(schedule, /clearMonthPermission|scheduleClearMonthPermission|canClearMonthPermission/);
});
