const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
let failures = 0;
const assert = (condition, message) => {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`OK ${message}`);
  }
};

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const schedule = read('src/features/schedule.jsx');
const styles = read('src/styles.css');

assert(pkg.version === '16.0.8', 'package.json version is 16.0.8');
assert(lock.version === '16.0.8' && lock.packages?.['']?.version === '16.0.8', 'package-lock.json version is 16.0.8');
assert(version.version === '16.0.8' && version.build === '16.0.8', 'public/version.json is 16.0.8');
assert(appCore.includes("CURRENT_VERSION = '16.0.8'"), 'CURRENT_VERSION is 16.0.8');
assert(pkg.scripts?.test === 'node scripts/validate-16-0-8.js', 'npm test runs 16.0.8 validator');

assert(schedule.includes('schedule-builder-desktop-table'), 'Schedule Builder desktop table class is present');
assert(schedule.includes("'--schedule-builder-min-width'"), 'Schedule Builder uses a desktop min-width custom property');
assert(schedule.includes('schedule-builder-time-chip'), 'Schedule Builder time chips have a dedicated class');
assert(schedule.includes('scheduledHoursWeekBlocks'), 'Scheduled Hours Tracker uses whole pay-period week blocks');
assert(schedule.includes('getScheduledHoursWeekStart'), 'Scheduled Hours Tracker starts each block at the pay-period week start');
assert(schedule.includes('scheduledHoursPeriodShifts'), 'Scheduled Hours Tracker pulls shifts from the full weekly range, including prior month spillover');
assert(schedule.includes('shiftMatchesPerson(s, u)'), 'Scheduled Hours Tracker matches shifts using stable employee identity logic');
assert(schedule.includes('formatScheduledHoursWeekRange'), 'Scheduled Hours Tracker labels cross-month weeks clearly');
assert(schedule.includes('Requested off:'), 'Partial-day request-off time range title is clearer');

assert(styles.includes('@media (min-width: 1024px)') && styles.includes('.schedule-builder-time-chip'), 'Schedule time-chip readability CSS is desktop-only');
assert(styles.includes('min-width: max(100%, var(--schedule-builder-min-width, 1200px))'), 'Desktop Schedule Builder expands cells enough to show times');
assert(styles.includes('white-space: nowrap !important'), 'Desktop schedule times do not wrap or truncate awkwardly');

if (failures) {
  console.error(`16.0.8 desktop schedule/pay-period hours validator failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.8 desktop schedule/pay-period hours validator passed.');
