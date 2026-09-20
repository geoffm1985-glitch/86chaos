'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const safety = require('../src/core/scheduleRuntimeSafety.cjs');

const root = path.resolve(__dirname, '..');

test('17.0.25 normalizes malformed legacy roster values before schedule surfaces sort or render them', () => {
  const rows = safety.safeScheduleRosterRows([
    null,
    'bad-row',
    { id: 'u1', name: { unexpected: true }, displayName: 'Kitchen One', role: { legacy: true }, isActive: true },
    { id: 'u2', name: undefined, email: 'cook@example.test', role: 'Cook', isActive: false },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Kitchen One');
  assert.equal(rows[0].role, 'Unassigned');
  assert.equal(rows[0].isActive, true);
  assert.equal(rows[1].name, 'cook@example.test');
  assert.equal(rows[1].role, 'Cook');
  assert.equal(rows[1].isActive, false);
  assert.doesNotThrow(() => rows.slice().sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.name).localeCompare(String(b.name))));
});

test('17.0.25 normalizes malformed legacy shift fields used by Schedule Builder', () => {
  const rows = safety.safeScheduleShiftRows([
    { id: 's1', date: '2026-09-19', startTime: { seconds: 1 }, endTime: ['bad'], role: { old: true }, employeeName: { old: true } },
    { id: 's2', scheduleDateKey: '2026-09-20', startTime: '09:00', endTime: '17:00', role: 'Cook', employeeName: 'Pat' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '2026-09-19');
  assert.equal(rows[0].startTime, '');
  assert.equal(rows[0].endTime, '');
  assert.equal(rows[0].role, 'Unassigned');
  assert.equal(rows[0].employeeName, '');
  assert.equal(rows[1].date, '2026-09-20');
  assert.equal(rows[1].scheduleDateKey, '2026-09-20');
});


test('17.0.25 normalizes malformed availability records before Schedule Builder consumes them', () => {
  const rows = safety.safeScheduleAvailabilityRows([
    {
      id: 'a1', employeeName: { legacy: true }, effectiveStartDate: { seconds: 1789776000 },
      weeklyAvailability: { Monday: { available: true, preferred: true, start: { bad: true }, end: '17:00' }, Tuesday: 'legacy-bad' },
      unavailableWindows: [{ day: { bad: true }, start: ['bad'], end: '12:00' }],
      preferredDaysOff: ['Friday', { bad: true }], maxHoursPerWeek: '40'
    }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(typeof rows[0].employeeName, 'string');
  assert.equal(rows[0].weeklyAvailability.Monday.start, '');
  assert.equal(rows[0].weeklyAvailability.Monday.end, '17:00');
  assert.equal(rows[0].unavailableWindows[0].day, '');
  assert.deepEqual(rows[0].preferredDaysOff, ['Friday']);
  assert.equal(rows[0].maxHoursPerWeek, 40);
});

test('17.0.25 wires route-boundary normalization into both Schedule Builder and Request Off', () => {
  const source = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
  const masterStart = source.indexOf('const TabMasterSchedule =');
  const masterEnd = source.indexOf('const TabSchedule =', masterStart);
  const master = source.slice(masterStart, masterEnd);
  assert.match(master, /users = safeScheduleRosterRows\(users\)/);
  assert.match(master, /shifts = safeScheduleShiftRows\(shifts\)/);
  assert.match(master, /events = safeScheduleEventRows\(events\)/);
  assert.match(master, /const availabilityRecords = safeScheduleAvailabilityRows\(availabilityRecordsState\.data \|\| \[\]\)/);
  assert.match(master, /timeOffRequests = mergeRequestOffWorkflowRows\(timeOffRequests\)/);
  assert.match(master, /<TabScheduleWorkbench[\s\S]*users=\{safeScheduleRosterRows/);
  assert.match(master, /availabilityRecords=\{availabilityRecords\}/);
  assert.match(master, /<TabTimeOff[\s\S]*users=\{users\}/);
  const timeOffStart = source.indexOf('const TabTimeOff =');
  const timeOff = source.slice(timeOffStart, source.indexOf('const TabAvailability', timeOffStart) > 0 ? source.indexOf('const TabAvailability', timeOffStart) : undefined);
  assert.match(timeOff, /users = safeScheduleRosterRows\(users\)/);
  assert.match(timeOff, /shifts = safeScheduleShiftRows\(shifts\)/);
  assert.doesNotMatch(source, /a\.name\.localeCompare\(b\.name\)/);
});
