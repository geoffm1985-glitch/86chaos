'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  buildCoverageVarianceRows,
  measureCoverageForTarget,
  sortScheduleWarningsChronologically,
} = require('../src/core/scheduleWarningControls.shared.js');
const {
  validatePartialRequestOffTimeRange,
} = require('../src/core/requestOffValidation.shared.js');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const roleMatcher = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

test('17.0.40 warnings are sorted in real chronological date order', () => {
  const rows = sortScheduleWarningsChronologically([
    { date: '2026-10-19', role: 'Kitchen', startTime: '10:00', message: 'Oct 19' },
    { date: '2026-10-26', role: 'Kitchen', startTime: '10:00', message: 'Oct 26' },
    { date: '2026-10-01', role: 'Kitchen', startTime: '10:00', message: 'Oct 1' },
  ]);
  assert.deepEqual(rows.map(row => row.date), ['2026-10-01', '2026-10-19', '2026-10-26']);
});

test('17.0.40 coverage target honors staggered handoffs across the entire required window', () => {
  const target = { id: 'kitchen-thu', dayIndex: 4, role: 'Kitchen', startTime: '10:00', endTime: '21:00', count: 2 };
  const shifts = [
    { id: 'a', employeeId: 'a', date: '2026-10-01', role: 'Kitchen', startTime: '08:00', endTime: '15:00' },
    { id: 'b', employeeId: 'b', date: '2026-10-01', role: 'Kitchen', startTime: '10:00', endTime: '16:00' },
    { id: 'c', employeeId: 'c', date: '2026-10-01', role: 'Kitchen', startTime: '15:00', endTime: '21:00' },
    { id: 'd', employeeId: 'd', date: '2026-10-01', role: 'Kitchen', startTime: '16:00', endTime: '21:00' },
  ];
  const measured = measureCoverageForTarget({ date: '2026-10-01', role: 'Kitchen', target, shifts, roleMatcher });
  assert.equal(measured.minimum, 2);
  assert.equal(measured.maximum, 2);
  const warnings = buildCoverageVarianceRows({ coverageTargets: [target], periodDates: ['2026-10-01'], periodShifts: shifts, roleMatcher, canonicalRole: x => x });
  assert.deepEqual(warnings, []);
});

test('17.0.40 coverage reports a genuine gap and does not inflate duplicate shifts for one person', () => {
  const target = { id: 'kitchen-thu', dayIndex: 4, role: 'Kitchen', startTime: '10:00', endTime: '21:00', count: 2 };
  const shifts = [
    { id: 'a1', employeeId: 'a', date: '2026-10-01', role: 'Kitchen', startTime: '10:00', endTime: '21:00' },
    { id: 'a2', employeeId: 'a', date: '2026-10-01', role: 'Kitchen', startTime: '10:00', endTime: '21:00' },
    { id: 'b', employeeId: 'b', date: '2026-10-01', role: 'Kitchen', startTime: '10:00', endTime: '14:00' },
  ];
  const warnings = buildCoverageVarianceRows({ coverageTargets: [target], periodDates: ['2026-10-01'], periodShifts: shifts, roleMatcher, canonicalRole: x => x });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].type, 'under');
  assert.equal(warnings[0].existing, 1);
  assert.equal(warnings[0].needed, 1);
});

test('17.0.40 overnight shifts can contribute to next-day required coverage', () => {
  const target = { id: 'overnight', dayIndex: 5, role: 'Kitchen', startTime: '00:00', endTime: '02:00', count: 1 };
  const shifts = [{ id: 'night', employeeId: 'n', date: '2026-10-01', role: 'Kitchen', startTime: '20:00', endTime: '02:00' }];
  const measured = measureCoverageForTarget({ date: '2026-10-02', role: 'Kitchen', target, shifts, roleMatcher });
  assert.equal(measured.minimum, 1);
});

test('17.0.40 partial Request Off rejects backward/equal ranges and accepts forward ranges', () => {
  assert.equal(validatePartialRequestOffTimeRange({ isPartial: true, startTime: '16:00', endTime: '14:00' }).valid, false);
  assert.equal(validatePartialRequestOffTimeRange({ isPartial: true, startTime: '16:00', endTime: '16:00' }).valid, false);
  assert.equal(validatePartialRequestOffTimeRange({ isPartial: true, startTime: '14:00', endTime: '16:00' }).valid, true);
  assert.equal(validatePartialRequestOffTimeRange({ isPartial: false, startTime: '16:00', endTime: '14:00' }).valid, true);
});

test('17.0.40 Request Off writes and Ghost cancellation remain authoritative server paths', () => {
  const schedule = read('src/features/schedule.jsx');
  const app = read('src/App.js');
  const api = read('api/time-off-request.js');
  const common = read('src/components/common.jsx');
  const rules = read('firestore.rules');
  assert.match(schedule, /requestOffApi\('create'/);
  assert.match(schedule, /requestOffApi\('ghost-cancel'/);
  assert.match(schedule, /validatePartialRequestOffTimeRange/);
  assert.match(app, /userGhostRequestOffPath/);
  assert.match(app, /wantsTimeOffData[\s\S]*!userGhostRequestOffPath/);
  assert.match(api, /action === 'create'/);
  assert.match(api, /handleGhostCancel/);
  assert.match(api, /validatePartialRequestOffTimeRange/);
  assert.match(common, /action:\s*'create'/);
  assert.doesNotMatch(common, /create_time_off_request[\s\S]{0,3500}addDoc\(collection\(db,\s*['"]timeOffRequests['"]/);
  assert.match(rules, /timeOffCreateRangeIsValid\(request\.resource\.data\)/);
});

test('17.0.40 Schedule Builder installs a sticky day header with bidirectional horizontal sync', () => {
  const schedule = read('src/features/schedule.jsx');
  const styles = read('src/styles.css');
  assert.match(schedule, /data-testid="schedule-builder-sticky-day-header"/);
  assert.match(schedule, /data-testid="schedule-builder-header-scroll"/);
  assert.match(schedule, /data-testid="schedule-builder-body-scroll"/);
  assert.match(schedule, /syncScheduleBuilderHorizontalScroll/);
  assert.match(styles, /\.schedule-builder-sticky-day-header\s*\{[\s\S]*position:\s*sticky/);
  assert.match(styles, /--schedule-builder-sticky-top/);
});
