'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  deriveScheduleToolsPeriod,
  deriveScheduleToolsCopyWeek,
  filterScheduleToolsRecords,
  recurringDatesForWeekday,
  assessScheduleToolsCompleteness,
} = require('../src/core/scheduleToolsPeriod.cjs');
const { buildCoverageVarianceRows, buildScheduleConflictWarningRows } = require('../src/core/scheduleWarningControls.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exactRole = (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase();

test('week period uses the configured Builder week boundary and exactly seven local dates', () => {
  const period = deriveScheduleToolsPeriod({ anchorDate: '2026-09-16', mode: 'weekly', weeks: 1, weekStartsOn: 'Sunday' });
  assert.equal(period.start, '2026-09-13');
  assert.equal(period.end, '2026-09-19');
  assert.equal(period.dates.length, 7);
  assert.deepEqual(period.dates, ['2026-09-13','2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19']);
});

test('biweekly period covers both Builder weeks across a year boundary', () => {
  const period = deriveScheduleToolsPeriod({ anchorDate: '2026-12-30', mode: 'biweekly', weekStartsOn: 'Monday' });
  assert.equal(period.start, '2026-12-28');
  assert.equal(period.end, '2027-01-10');
  assert.equal(period.dates.length, 14);
  assert.deepEqual(period.weekSegments.map(row => [row.start, row.end]), [['2026-12-28','2027-01-03'],['2027-01-04','2027-01-10']]);
});

test('month period contains only the selected calendar month, including leap day', () => {
  const leap = deriveScheduleToolsPeriod({ anchorDate: '2028-02-14', mode: 'monthly', weekStartsOn: 'Monday' });
  assert.equal(leap.start, '2028-02-01');
  assert.equal(leap.end, '2028-02-29');
  assert.equal(leap.dates.length, 29);
  assert.equal(leap.dates.some(date => !date.startsWith('2028-02-')), false);
  assert.equal(leap.dates.includes('2028-01-31'), false);
  assert.equal(leap.dates.includes('2028-03-01'), false);
});

test('local calendar periods stay contiguous across daylight-saving changes', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'America/Chicago';
  try {
    const spring = deriveScheduleToolsPeriod({ anchorDate: '2026-03-08', mode: 'weekly', weekStartsOn: 'Sunday' });
    const fall = deriveScheduleToolsPeriod({ anchorDate: '2026-11-01', mode: 'weekly', weekStartsOn: 'Sunday' });
    assert.deepEqual(spring.dates, ['2026-03-08','2026-03-09','2026-03-10','2026-03-11','2026-03-12','2026-03-13','2026-03-14']);
    assert.deepEqual(fall.dates, ['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07']);
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('period navigation recalculates without retaining dates from the old view', () => {
  const september = deriveScheduleToolsPeriod({ anchorDate: '2026-09-01', mode: 'monthly', weekStartsOn: 'Monday' });
  const october = deriveScheduleToolsPeriod({ anchorDate: '2026-10-01', mode: 'monthly', weekStartsOn: 'Monday' });
  const twoWeeks = deriveScheduleToolsPeriod({ anchorDate: '2026-10-01', mode: 'biweekly', weekStartsOn: 'Monday' });
  assert.notEqual(september.key, october.key);
  assert.notEqual(october.key, twoWeeks.key);
  assert.equal(new Set(september.dates.filter(date => october.dates.includes(date))).size, 0);
  assert.equal(twoWeeks.dates.length, 14);
});

test('weekly coverage targets recur independently on every matching date in longer periods', () => {
  const period = deriveScheduleToolsPeriod({ anchorDate: '2026-09-01', mode: 'monthly', weekStartsOn: 'Monday' });
  const mondays = recurringDatesForWeekday(period, 1);
  assert.deepEqual(mondays, ['2026-09-07','2026-09-14','2026-09-21','2026-09-28']);
  const shifts = mondays.slice(0, 3).flatMap(date => [
    { date, role: 'Cook', startTime: '16:00' },
    { date, role: 'Cook', startTime: '16:00' },
  ]);
  shifts.push({ date: '2026-09-28', role: 'Cook', startTime: '16:00' });
  const rows = buildCoverageVarianceRows({
    coverageTargets: [{ id: 'monday-cooks', dayIndex: 1, role: 'Cook', startTime: '16:00', endTime: '20:00', count: 2 }],
    periodDates: period.dates,
    periodShifts: shifts,
    roleMatcher: exactRole,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-09-28');
  assert.equal(rows[0].type, 'under');
  assert.equal(rows[0].needed, 1);
});

test('biweekly and monthly coverage detect later-period gaps and over-coverage while excluding outside dates', () => {
  const biweekly = deriveScheduleToolsPeriod({ anchorDate: '2026-09-14', mode: 'biweekly', weekStartsOn: 'Monday' });
  const shifts = [
    { date: '2026-09-14', role: 'Cook', startTime: '16:00' },
    { date: '2026-09-14', role: 'Cook', startTime: '16:00' },
    { date: '2026-09-21', role: 'Cook', startTime: '16:00' },
    { date: '2026-09-28', role: 'Cook', startTime: '16:00' },
  ];
  const rows = buildCoverageVarianceRows({ coverageTargets: [{ id: 'cook', dayIndex: 1, role: 'Cook', startTime: '16:00', count: 2 }], periodDates: biweekly.dates, periodShifts: shifts, roleMatcher: exactRole });
  assert.deepEqual(rows.map(row => [row.date, row.type, row.needed]), [['2026-09-21','under',1]]);

  const month = deriveScheduleToolsPeriod({ anchorDate: '2026-09-01', mode: 'monthly', weekStartsOn: 'Monday' });
  const monthRows = buildCoverageVarianceRows({ coverageTargets: [{ id: 'cook', dayIndex: 1, role: 'Cook', startTime: '16:00', count: 1 }], periodDates: month.dates, periodShifts: [
    { date: '2026-09-07', role: 'Cook', startTime: '16:00' },
    { date: '2026-09-14', role: 'Cook', startTime: '16:00' },
    { date: '2026-09-21', role: 'Cook', startTime: '16:00' },
    { date: '2026-09-28', role: 'Cook', startTime: '16:00' },
    { date: '2026-09-28', role: 'Cook', startTime: '16:00' },
    { date: '2026-10-05', role: 'Cook', startTime: '16:00' },
  ], roleMatcher: exactRole });
  assert.equal(monthRows.length, 1);
  assert.equal(monthRows[0].date, '2026-09-28');
  assert.equal(monthRows[0].type, 'over');
});

test('draft, warning, fill, and publish source records share one workspace-scoped period filter', () => {
  const period = deriveScheduleToolsPeriod({ anchorDate: '2026-09-01', mode: 'monthly', weekStartsOn: 'Monday' });
  const records = [
    { id: 'canonical', restaurantId: 'cheers', date: '2026-09-02', isPublished: false },
    { id: 'rescue', restaurantId: 'cheers', scheduleDateKey: '2026-09-03', isPublished: false },
    { id: 'adjacent', restaurantId: 'cheers', date: '2026-10-01', isPublished: false },
    { id: 'foreign', restaurantId: 'other', date: '2026-09-04', isPublished: false },
  ];
  assert.deepEqual(filterScheduleToolsRecords(records, period, 'cheers').map(row => row.id), ['canonical','rescue']);
});

test('weekly copy action remains a separate configured-week operation in longer views', () => {
  const month = deriveScheduleToolsPeriod({ anchorDate: '2026-09-01', mode: 'monthly', weekStartsOn: 'Monday' });
  const copyWeek = deriveScheduleToolsCopyWeek(month);
  assert.equal(copyWeek.mode, 'weekly');
  assert.equal(copyWeek.start, '2026-08-31');
  assert.equal(copyWeek.end, '2026-09-06');
  assert.equal(copyWeek.dates.length, 7);
});

test('incomplete or capped evidence can never be reported as complete', () => {
  const complete = assessScheduleToolsCompleteness([
    { label: 'shifts', resolved: true, count: 40, limit: 420 },
    { label: 'Request Off', resolved: true, count: 10, limit: 180 },
  ]);
  assert.equal(complete.complete, true);
  const incomplete = assessScheduleToolsCompleteness([
    { label: 'shifts', resolved: true, count: 420, limit: 420 },
    { label: 'Request Off', resolved: false, count: 0, limit: 180 },
    { label: 'availability', resolved: true, error: new Error('denied'), count: 0, limit: 220 },
  ]);
  assert.equal(incomplete.complete, false);
  assert.match(incomplete.reasons.join(' | '), /retrieval limit|still loading|could not be loaded/);
});

test('workload warnings stay weekly inside a longer active period', () => {
  const period = deriveScheduleToolsPeriod({ anchorDate: '2026-09-14', mode: 'biweekly', weekStartsOn: 'Monday' });
  const user = { id: 'cook-1', name: 'Alex Cook' };
  const schedule = period.dates.map((date, index) => ({ id: `shift-${index}`, employeeId: user.id, date }));
  const warnings = buildScheduleConflictWarningRows({ weekStart: period.start, periodWeeks: period.weekSegments, schedule, allUsers: [user], requests: [], formatDate: value => value });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0].message, /2026-09-14 through 2026-09-20/);
  assert.match(warnings[1].message, /2026-09-21 through 2026-09-27/);
});

test('active source wires one period into Schedule Tools and retains mature Firebase safeguards', () => {
  const schedule = read('src/features/schedule.jsx');
  const app = read('src/App.js');
  assert.match(schedule, /deriveScheduleToolsPeriod/);
  assert.match(schedule, /period=\{scheduleToolsPeriod\}/);
  assert.match(schedule, /periodDates: activePeriodDates/);
  assert.match(schedule, /onReviewPublish/);
  assert.doesNotMatch(schedule, /const weekDates = getWeekDates\(currentDate\);/);
  assert.match(schedule, /buildCanonicalScheduleCreateFields\(date, appUser\.restaurantId\)/);
  assert.match(schedule, /getAvailabilityConflict/);
  assert.match(app, /useLiveCollectionState\('shifts'/);
  assert.equal((schedule.match(/useLiveCollectionState\('shifts'/g) || []).length, 0, 'Schedule Tools must reuse loaded shifts instead of creating its own shift listener');
});

test('Fill Coverage Gaps and templates use the whole period without bypassing identity, time-off, availability, or canonical date safeguards', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /recurringDatesForWeekday\(activePeriod, row\.dayIndex\)/);
  assert.match(schedule, /const used = activePeriodShifts\.filter/);
  assert.match(schedule, /timeOffMatchesPerson\(request, u\)/);
  assert.match(schedule, /getActiveAvailabilityForDate\(u\.id, date, availabilityRecords\)/);
  assert.match(schedule, /\['unavailable', 'outside'\]\.includes\(availabilityCheck\.level\)/);
  assert.match(schedule, /buildCanonicalScheduleCreateFields\(date, appUser\.restaurantId\)/);
  assert.match(schedule, /\.\.\.buildScheduleIdentityFields\(employee \|\| \{\}\)/);
  assert.match(schedule, /Existing shifts already cover this template/);
});

test('Schedule Tools review delegates to the mature publisher and clips its full-period scope to active dates', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /onReviewPublish\?\.\(\)/);
  assert.match(schedule, /publishPickerSource === 'schedule-tools' \? schedulePeriodDays : publicationWeekDays/);
  assert.match(schedule, /const publishDays = publishAll \? activePublishDays : selectedPublishDays/);
  assert.match(schedule, /writeBatch\(db\)/);
  assert.match(schedule, /verificationFailures/);
  assert.match(schedule, /buildCanonicalScheduleIdentityBlock/);
  assert.doesNotMatch(schedule, /Promise\.all\(drafts\.map\(s => updateDoc\(doc\(db, 'shifts'/);
});

test('Copy Previous Week stays weekly and explains the exact source and destination range', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /const copyWeekPeriod = deriveScheduleToolsCopyWeek\(activePeriod\)/);
  assert.match(schedule, /Copy Previous Week/);
  assert.match(schedule, /Copy \$\{prevShifts\.length\} shifts from \$\{formatDisplayDate\(prevDates\[0\]\)\} through/);
  assert.match(schedule, /source: 'schedule_copy_week'/);
});

test('Schedule Tools mobile layout wraps period content and avoids a horizontal page expansion', () => {
  const schedule = read('src/features/schedule.jsx');
  const styles = read('src/styles.css');
  assert.match(schedule, /grid sm:grid-cols-2 xl:grid-cols-7 gap-2/);
  assert.match(schedule, /className="min-h-\[160px\] min-w-0/);
  assert.match(schedule, /schedule-tools-period-label/);
  assert.match(styles, /\.schedule-tools-period-label\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(styles, /body\s*\{\s*overflow-x:\s*clip;/);
});
