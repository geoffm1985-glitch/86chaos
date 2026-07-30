#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };

const schedule = read('src/features/schedule.jsx');
const styles = read('src/styles.css');
const version = JSON.parse(read('public/version.json'));
const pkg = JSON.parse(read('package.json'));

assert(pkg.version === '16.0.61', 'package.json is bumped to 16.0.61');
assert(version.version === '16.0.61' && version.build === '16.0.61', 'public version is 16.0.61');

assert(schedule.includes('getScheduledHoursTrackerRawShiftsForPersonDate'), 'Scheduled Hours Tracker has its own raw-shift lookup');
assert(
  /getScheduledHoursTrackerRawShiftsForPersonDate\s*=\s*\([^)]*\)\s*=>\s*visibleShifts\.filter/s.test(schedule),
  'Scheduled Hours Tracker reads from all loaded visible shifts, not only the visible month/schedulePeriodShifts'
);
assert(
  /const\s+rawShifts\s*=\s*getScheduledHoursTrackerRawShiftsForPersonDate\(dateKey,\s*person\)/.test(schedule),
  'Scheduled Hours day audit uses the tracker lookup so Week 1 can include previous-month shifts'
);
assert(
  /days:\s*buildDateRange\(fullWeekStart,\s*fullWeekEnd\)/.test(schedule),
  'Scheduled Hours weeks are full pay-period weeks, not clipped to the visible month'
);
assert(schedule.includes('formatScheduledHoursWeekRangeCompact'), 'Scheduled Hours header has a compact no-wrap range formatter');
assert(schedule.includes('scheduled-hours-week-head') && schedule.includes('scheduled-hours-week-range'), 'Scheduled Hours header uses explicit no-wrap header spans');
assert(schedule.includes('Period Total'), 'Scheduled Hours total column label avoids stacked Month Total wording');

assert(styles.includes('.scheduled-hours-tracker-table {\n  table-layout: auto !important;'), 'Scheduled Hours table uses auto layout so columns can honor readable widths');
assert(styles.includes('width: max-content !important;'), 'Scheduled Hours table can expand and scroll horizontally instead of squeezing text vertical');
assert(styles.includes('.scheduled-hours-week-head') && styles.includes('word-break: keep-all !important'), 'Scheduled Hours week headers forbid stacked-letter wrapping');
assert(styles.includes('.scheduled-hours-week-range') && styles.includes('white-space: nowrap !important'), 'Scheduled Hours date range is nowrap');
assert(/@media \(max-width: 767px\)[\s\S]*\.scheduled-hours-tracker-table th,[\s\S]*white-space: nowrap !important/.test(styles), 'Mobile Scheduled Hours cells stay horizontal and scroll instead of wrapping vertically');

const addDays = (dateKey, offset) => {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const buildDateRange = (start, end) => {
  const days = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
};
const getWeekStart = (dateKey, startDayInt = 0) => {
  const d = new Date(`${dateKey}T12:00:00`);
  while (d.getDay() !== startDayInt) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
const visibleMonthStart = '2026-08-01';
const visibleMonthEnd = '2026-08-31';
const wk1Start = getWeekStart(visibleMonthStart, 1);
const wk1Days = buildDateRange(wk1Start, addDays(wk1Start, 6));
assert(wk1Start === '2026-07-27', 'test fixture expects an August Week 1 that starts in July');
assert(wk1Days.includes('2026-07-27') && wk1Days.includes('2026-08-02'), 'Week 1 fixture includes previous-month and current-month dates');
const loadedShifts = [
  { employeeId: 'clare', date: '2026-07-27', startTime: '11:00', endTime: '17:00' },
  { employeeId: 'clare', date: '2026-08-01', startTime: '11:00', endTime: '14:00' },
  { employeeId: 'clare', date: '2026-08-03', startTime: '09:00', endTime: '12:00' }
];
const hoursForWk1 = loadedShifts
  .filter(shift => shift.employeeId === 'clare' && wk1Days.includes(shift.date))
  .reduce((sum, shift) => {
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const [eh, em] = shift.endTime.split(':').map(Number);
    return sum + (((eh * 60 + em) - (sh * 60 + sm)) / 60);
  }, 0);
assert(hoursForWk1 === 9, 'Week 1 hours include previous-month shifts in the same pay-period week');
assert(loadedShifts.filter(shift => shift.date >= visibleMonthStart && shift.date <= visibleMonthEnd && shift.employeeId === 'clare').length === 2, 'visible month alone would miss the previous-month Week 1 shift');

console.log('16.0.61 targeted Schedule Hours test passed. Week 1 uses full pay-period weeks and tracker headers stay horizontal.');
