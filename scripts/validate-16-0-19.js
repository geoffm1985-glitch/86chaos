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
const lockText = read('package-lock.json');
const lock = JSON.parse(lockText);
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const app = read('src/App.js');
const common = read('src/components/common.jsx');
const schedule = read('src/features/schedule.jsx');
const management = read('src/features/management.jsx');
const presenceApi = read('api/presence-snapshot.js');
const styles = read('src/styles.css');
const vercel = read('vercel.json');

assert(pkg.version === '16.0.19', 'package.json version is 16.0.19');
assert(lock.version === '16.0.19' && lock.packages?.['']?.version === '16.0.19', 'package-lock.json root version is 16.0.19');
assert(version.version === '16.0.19' && version.build === '16.0.19', 'public/version.json is 16.0.19');
assert(appCore.includes("CURRENT_VERSION = '16.0.19'"), 'CURRENT_VERSION is 16.0.19');
assert(pkg.scripts?.test === 'node scripts/validate-16-0-19.js', 'npm test runs 16.0.19 validator');
assert(pkg.scripts?.['test:ci'] === 'node scripts/validate-16-0-19.js', 'npm test:ci runs 16.0.19 validator');

const yargsTypes = lock.packages?.['node_modules/@types/yargs'];
assert(yargsTypes?.version === '16.0.11', '@types/yargs remains locked to valid npm package version 16.0.11');
assert(!lockText.includes('@types/yargs/-/yargs-16.0.19.tgz'), 'package-lock does not stamp @types/yargs with app version 16.0.19');
assert(!lockText.includes('@types/yargs/-/yargs-16.0.18.tgz'), 'package-lock does not point to nonexistent @types/yargs 16.0.18 tarball');
assert(!lockText.includes('@types/yargs/-/yargs-16.0.12.tgz'), 'package-lock does not point to nonexistent @types/yargs 16.0.12 tarball');

// 16.0.19: the tracker math was not the only problem. Partial-day request-off chips looked like schedule chips.
assert(schedule.includes('const formatScheduleRequestOffLabel = (request = {}) =>'), 'Schedule Builder has an explicit request-off label formatter');
assert(schedule.includes("return `OFF ${start}-${end}`;"), 'partial request-off chips display with OFF prefix');
assert(schedule.includes('Requested off / not counted as scheduled hours'), 'partial request-off chip title says it is not counted');
assert(schedule.includes('OFF / request-off / availability chips are not counted'), 'Scheduled Hours Tracker explains what is not counted');
assert(schedule.includes('Hover or long-press a weekly total to see the exact day-by-day math'), 'Scheduled Hours Tracker surfaces day-by-day math help');
assert(schedule.includes('const formatScheduledHoursCellTitle = (personName, week = {}, weekDetails = []) =>'), 'weekly hour cells have a detailed math tooltip');
assert(schedule.includes('Counts scheduled shift chips only. Request-off / availability chips labeled OFF are not counted.'), 'weekly cell tooltip explains counted vs non-counted chips');
assert(schedule.includes('formatScheduledHoursDayLine'), 'weekly cell title uses day-by-day breakdown lines');
assert(schedule.includes('getScheduleHoursDayDetail'), 'weekly tracker builds per-day details before summing');
assert(schedule.includes('requests: dayRequests'), 'weekly tracker includes request-off exclusions in the math details');
assert(schedule.includes('invalid: hoursInfo.invalid'), 'weekly tracker includes invalid shift exclusions in the math details');
assert(schedule.includes('title={formatScheduledHoursCellTitle(u.name, scheduledHoursWeekBlocks[i], u.weeklyDetails?.[i] || [])}'), 'weekly total cells show exact math in the title');

// Schedule hour parsing/counting still uses safe interval math.
assert(schedule.includes('MAX_REASONABLE_SCHEDULE_SHIFT_MINUTES = 18 * 60'), 'Schedule math has a max reasonable shift guard');
assert(schedule.includes('const parseScheduleClockInfo = (value) =>'), 'Schedule math keeps full AM/PM parse metadata');
assert(schedule.includes('same-meridiem pairs like 10p-3p'), 'Schedule math documents rejecting impossible same-meridiem time ranges');
assert(schedule.includes('const getScheduleShiftTimeStatus = (shift = {}) =>'), 'Schedule math exposes a validation status helper for visible chips');
assert(schedule.includes('Bad schedule time ranges should be flagged for correction, not guessed or auto-repaired.'), 'invalid time ranges are flagged instead of guessed');
assert(schedule.includes('Invalid time range: end time is before start time. Check AM/PM.'), 'end-before-start shifts produce a clear correction message');
assert(schedule.includes('const getUniqueScheduledHoursDetailsForShifts = (shiftList = []) =>'), 'Schedule math returns counted, invalid, merged details, not just a number');
assert(schedule.includes('const getUniqueScheduledMinutesForShifts = (shiftList = []) => getUniqueScheduledHoursDetailsForShifts(shiftList).minutes;'), 'Schedule math derives minutes from detailed interval results');
assert(schedule.includes('interval.start <= last.end'), 'Schedule math merges overlapping duplicate shift intervals');
assert(schedule.includes('const dayRawShifts = userShifts.filter(s => getScheduleShiftDateKey(s) === dateKey);'), 'Scheduled Hours Tracker groups raw shifts by exact date');
assert(schedule.includes('const weekly = weeklyDetails.map(dayDetails => dayDetails.reduce((sum, detail) => sum + detail.hours, 0));'), 'Scheduled Hours Tracker totals from per-day details');
assert(!schedule.includes('const shift = userShifts.find(s => s.date === d);'), 'Scheduled Hours Tracker no longer grabs only the first shift per day');
assert(!schedule.includes('reduce((dayTotal, shift) => dayTotal + calculateShiftHours(shift.startTime, shift.endTime), 0)'), 'Scheduled Hours Tracker no longer blindly sums raw documents');
assert(schedule.includes('invalidTimeRange'), 'Schedule Builder flags invalid visible time ranges so bad data can be corrected');
assert(schedule.includes('INVALID TIME RANGE - NOT COUNTED'), 'invalid schedule time ranges clearly say they are not counted in hours math');
assert(schedule.includes("{invalidTimeRange ? 'INVALID TIME'"), 'bad visible schedule chips show INVALID TIME instead of pretending they are normal shifts');

// Carried-forward schedule builder visibility/event/presence/voice behavior.
assert(schedule.includes('schedule-builder-events-row'), 'Schedule Builder still renders the Events / staff up row');
assert(schedule.includes('schedulePeriodEvents.length} event'), 'Schedule Builder period summary still counts visible events');
assert(app.includes('const wantsEventData = wantsToday || wantsScheduleScreen'), 'App still loads events for schedule screens');
assert(common.includes('title="86 Voice Assistant"><Mic size={24}/></button>'), '86Voice mic button no longer shows a Preview badge');
assert(!common.includes('>PREVIEW</span>'), '86Voice mic button preview label remains removed');
assert(management.includes('TRUE_ONLINE_WINDOW_MS'), 'Presence UI still has strict true-online cutoff');
assert(presenceApi.includes('onlineSeconds'), 'Presence API still supports strict onlineSeconds cutoff');
assert(styles.includes('schedule-builder-partial-off-chip'), 'Partial-day request-off chip desktop/mobile styling is still present');

// Runtime-style schedule math checks. These mirror the intended production rules.
const testParseClockInfo = (value) => {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return null;
  if (['close', 'cl', 'closing'].includes(raw)) return { minutes: 1439, meridiem: '', is24Hour: true };
  if (['open', 'opening'].includes(raw)) return { minutes: 0, meridiem: '', is24Hour: true };
  const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = match[2] !== undefined ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.startsWith('a') ? 'a' : match[3]?.startsWith('p') ? 'p' : '';
  if (meridiem === 'p' && hour < 12) hour += 12;
  if (meridiem === 'a' && hour === 12) hour = 0;
  if (!meridiem && hour === 24) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { minutes: hour * 60 + minute, meridiem, is24Hour: !meridiem };
};
const testInterval = (shift) => {
  const startInfo = testParseClockInfo(shift.startTime);
  const endInfo = testParseClockInfo(shift.endTime);
  if (!startInfo || !endInfo) return null;
  let start = startInfo.minutes;
  let end = endInfo.minutes;
  if (end <= start) {
    const overnight = (shift.isOvernight === true || shift.endsNextDay === true) || (startInfo.meridiem === 'p' && endInfo.meridiem === 'a') || (startInfo.is24Hour && endInfo.is24Hour && start >= 1080 && end <= 600);
    if (!overnight) return null;
    end += 1440;
  }
  const minutes = end - start;
  if (minutes <= 0 || minutes > 1080) return null;
  return { start, end, minutes };
};
const testUniqueHoursForOneDay = (shifts) => {
  const intervals = shifts.map(testInterval).filter(Boolean).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  intervals.forEach(interval => {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ start: interval.start, end: interval.end });
  });
  return merged.reduce((sum, interval) => sum + interval.end - interval.start, 0) / 60;
};
const testUniqueHours = (shifts) => {
  const byDate = new Map();
  shifts.forEach(shift => {
    const key = shift.date || 'one-day';
    byDate.set(key, [...(byDate.get(key) || []), shift]);
  });
  return Array.from(byDate.values()).reduce((sum, dayShifts) => sum + testUniqueHoursForOneDay(dayShifts), 0);
};
assert(testUniqueHours([{ startTime: '10a', endTime: '9p' }]) === 11, 'runtime math: 10a-9p is 11 hours, not 23');
assert(testUniqueHours([{ startTime: '10p', endTime: '3p' }]) === 0, 'runtime math: impossible 10p-3p is rejected, not counted as 17 hours');
assert(testUniqueHours([{ startTime: '10p', endTime: '3a' }]) === 5, 'runtime math: real 10p-3a overnight is 5 hours');
assert(testUniqueHours([{ startTime: '10a', endTime: '9p' }, { startTime: '10:00', endTime: '21:00' }]) === 11, 'runtime math: equivalent duplicate 10a-9p and 10:00-21:00 counts once');
assert(testUniqueHours([{ startTime: '3p', endTime: '9p' }, { startTime: '4p', endTime: '10p' }]) === 7, 'runtime math: overlapping same-day shifts are merged before totals');
assert(testUniqueHours([
  { date: '2026-08-17', startTime: '3p', endTime: '9p' },
  { date: '2026-08-18', startTime: '10a', endTime: '4p' },
  { date: '2026-08-19', startTime: '10a', endTime: '9p' },
  { date: '2026-08-20', startTime: '10a', endTime: '4p' },
  { date: '2026-08-21', startTime: '10p', endTime: '3p' }
]) === 29, 'runtime math: Allen Week 4-style counted shifts total 29 when OFF/request-off chips are excluded and 10p-3p is invalid');

// Firebase wiring/config/CSP should remain intact.
assert(vercel.includes('https://www.gstatic.com'), 'CSP still allows Firebase static assets');
assert(vercel.includes('firebaseio.com'), 'CSP still allows Firebase RTDB endpoints');

if (failures) {
  console.error(`\n${failures} validation check(s) failed.`);
  process.exit(1);
}
console.log('\n86 Chaos 16.0.19 validation passed.');
