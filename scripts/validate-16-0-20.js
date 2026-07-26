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
const modalBlock = common.slice(common.indexOf('const Modal ='), common.indexOf('const reminderNeedsAttention'));
const schedule = read('src/features/schedule.jsx');
const management = read('src/features/management.jsx');
const presenceApi = read('api/presence-snapshot.js');
const styles = read('src/styles.css');
const vercel = read('vercel.json');

assert(pkg.version === '16.0.20', 'package.json version is 16.0.20');
assert(lock.version === '16.0.20' && lock.packages?.['']?.version === '16.0.20', 'package-lock.json version is 16.0.20');

const yargsTypes = lock.packages?.['node_modules/@types/yargs'];
assert(yargsTypes?.version === '16.0.11', '@types/yargs remains locked to the valid npm package version 16.0.11');
assert(yargsTypes?.resolved === 'https://registry.npmjs.org/@types/yargs/-/yargs-16.0.11.tgz', '@types/yargs resolved tarball is valid and not app-version stamped');
assert(!lockText.includes('@types/yargs/-/yargs-16.0.20.tgz'), 'package-lock does not point to nonexistent @types/yargs 16.0.20 tarball');
assert(!lockText.includes('@types/yargs/-/yargs-16.0.19.tgz'), 'package-lock does not point to nonexistent @types/yargs 16.0.19 tarball');
assert(!lockText.includes('@types/yargs/-/yargs-16.0.12.tgz'), 'package-lock does not point to nonexistent @types/yargs 16.0.12 tarball');
assert(version.version === '16.0.20' && version.build === '16.0.20', 'public/version.json is 16.0.20');
assert(appCore.includes("CURRENT_VERSION = '16.0.20'"), 'CURRENT_VERSION is 16.0.20');
assert(pkg.scripts?.test === 'node scripts/validate-16-0-20.js', 'npm test runs 16.0.20 validator');
assert(pkg.scripts?.['test:ci'] === 'node scripts/validate-16-0-20.js', 'npm test:ci runs 16.0.20 validator');



// 16.0.20: Schedule hours math must understand AM/PM display strings and ignore exact duplicate shift docs.
assert(schedule.includes('const parseScheduleClockMinutes = (value) =>'), 'Schedule Builder has a parser for shift clock values');
assert(schedule.includes('legacy/display values like 3p, 10a, 10:30pm'), 'shift hour parser documents AM/PM legacy/display inputs');
assert(schedule.includes("['close', 'cl', 'closing'].includes(raw)"), 'shift hour parser handles CLOSE-style end times');
assert(schedule.includes("meridiem === 'p' && hour < 12"), 'shift hour parser converts PM times to 24-hour minutes');
assert(schedule.includes("meridiem === 'a' && hour === 12"), 'shift hour parser converts midnight correctly');
assert(schedule.includes('return interval ? interval.minutes / 60 : 0;'), 'calculateShiftHours returns minute-based hour totals');
assert(schedule.includes('dedupeScheduleShiftsForSamePerson'), 'Schedule Builder dedupes exact duplicate shifts per employee');
assert(schedule.includes('getScheduleShiftDedupeKey'), 'Schedule Builder has a stable shift dedupe fingerprint');
assert(schedule.includes('getScheduleBuilderRawShiftsForPersonDate'), 'Schedule Builder can still delete all raw duplicate shift docs in one cell');
assert(schedule.includes('const existingShifts = getScheduleBuilderRawShiftsForPersonDate(d, emp);'), 'cell delete uses raw matching shifts so hidden duplicates can be removed');
assert(schedule.includes('const dayShifts = getScheduleBuilderShiftsForPersonDate(d, u);'), 'visible grid uses deduped shift chips');
assert(schedule.includes('getUniqueScheduledHoursForShifts(getScheduleBuilderRawShiftsForPersonDate(d, emp))'), 'projected labor uses merged unique schedule hours');
assert(schedule.includes('const audit = getScheduledHoursDayAudit(d, u);'), 'Scheduled Hours Tracker audits each visible day before summing unique intervals');
assert(schedule.includes('getScheduleShiftInterval(shiftData ? { ...shiftData, startTime: start, endTime: end }'), 'calculateShiftHours uses the validated shift interval parser');

// 16.0.14 carried forward: Schedule Builder must load Event Calendar records while the schedule screen is open.
assert(app.includes('const wantsEventData = wantsToday || wantsScheduleScreen'), 'App enables event loading for schedule screens');
assert(app.includes('const eventRangeClauses = wantsScheduleScreen'), 'App uses schedule-window event range clauses on schedule screens');
assert(app.includes("['date', '>=', scheduleWindowStart]"), 'Schedule event query starts at the schedule window start');
assert(app.includes("['date', '<=', scheduleWindowEnd]"), 'Schedule event query ends at the schedule window end');
assert(app.includes('whereClauses: eventRangeClauses'), 'Events live collection uses the dynamic event range clauses');
assert(app.includes('orderDirection: eventOrderDirection'), 'Events live collection uses schedule-aware ordering');
assert(app.includes('limitCount: eventLimitCount'), 'Events live collection uses a larger schedule-screen limit');
assert(app.includes('fallbackLimitCount: wantsScheduleScreen ? 400 : 25'), 'Events live collection has a larger schedule-screen fallback limit');
assert(app.includes('scheduleBuilderProps={{ currentDate, users: displayUsers, shifts, events,'), 'Schedule Builder still receives the live events collection prop');

// 16.0.13 mobile keyboard fix: modal focus effect must not restart every typed character.
assert(modalBlock.includes('const onCloseRef = useRef(onClose);'), 'shared Modal stores latest onClose in a ref');
assert(modalBlock.includes('onCloseRef.current = onClose;'), 'shared Modal refreshes close handler without changing focus effect');
assert(modalBlock.includes("if (event.key === 'Escape') onCloseRef.current?.();"), 'Escape uses latest close handler ref');
assert(modalBlock.includes('Mobile keyboards were blurring after one character'), 'keyboard blur root cause is documented in Modal');
assert(modalBlock.includes('}, [isOpen]);'), 'shared Modal focus/key listener effect depends only on isOpen');
assert(!modalBlock.includes('}, [isOpen, onClose]);'), 'shared Modal no longer re-runs focus cleanup when parent inline onClose changes');
assert(modalBlock.includes('if (activeElement && panelRef.current?.contains(activeElement)) return;'), 'shared Modal does not steal focus when a field is already focused');
assert(modalBlock.includes('onClick={() => onCloseRef.current?.()}'), 'shared Modal close button uses latest close handler ref');

// Keep the event modal wired to the shared Modal where the mobile issue was reported.
assert(schedule.includes('title={editingEventId ? "Edit Special Event" : "Add Special Event"}'), 'Add/Edit Special Event modal still uses shared Modal');
assert(schedule.includes('value={eventTitle} onChange={e=>setEventTitle(e.target.value)}'), 'Event Title input remains controlled by eventTitle state');
assert(schedule.includes('value={eventNotes} onChange={e=>setEventNotes(e.target.value)}'), 'Event Notes textarea remains controlled by eventNotes state');

// Preserve recent 16.0.8/16.0.9/16.0.10 behavior the user already verified/asked for.
assert(schedule.includes('schedule-builder-desktop-table'), 'Schedule Builder desktop table class is present');
assert(schedule.includes('eventsByScheduleDay'), 'Schedule Builder groups special events by visible schedule day');
assert(schedule.includes('formatScheduleBuilderEventLabel'), 'Schedule Builder has compact event labels for the grid');
assert(schedule.includes('schedule-builder-events-row'), 'Schedule Builder renders a dedicated events row above staff rows');
assert(schedule.includes('staff up'), 'Schedule Builder event row tells managers events may need extra staffing');
assert(schedule.includes('schedulePeriodEvents.length} event'), 'Schedule Builder period summary counts visible events');
assert(styles.includes('schedule-builder-event-chip'), 'Schedule Builder event chips have compact CSS');
assert(styles.includes('Schedule Builder event visibility row'), 'event visibility CSS note is present');
assert(schedule.includes('`${82 + (schedulePeriodDays.length * 56)}px`'), 'Schedule Builder desktop min-width is tightened for 16.0.20');
assert(styles.includes('min-width: 56px !important'), 'Desktop schedule day cells are tightened to 56px');
assert(styles.includes('border-top: 1px solid rgba(125, 151, 166, 0.32) !important'), 'Desktop schedule horizontal grid lines stay strengthened');
assert(styles.includes('schedule-builder-partial-off-chip'), 'Partial-day request-off chip has desktop readability control');
assert(management.includes('formatPresenceDeviceLabel'), 'Presence screen uses friendly device labels');
assert(management.includes('TRUE_ONLINE_WINDOW_MS'), 'Presence UI has a strict true-online cutoff');
assert(management.includes('onlineSeconds=90'), 'Presence snapshot request asks API for 90-second online truth window');
assert(management.includes('Recently active: {recentlyActiveUsers.length}'), 'Presence header separates recently active from online now');
assert(management.includes('Active today: {activeTodayUsers.length}'), 'Presence header separates active-today users from online now');
assert(presenceApi.includes('onlineSeconds'), 'Presence API supports a strict onlineSeconds cutoff');
assert(presenceApi.includes("markPresenceBucket(row, 'recentlyActive')"), 'Presence API labels recently active rows separately');
assert(presenceApi.includes('Live presence source unavailable. Showing last-seen fallback.'), 'Presence API returns friendly RTDB fallback warning');


// 16.0.20: Scheduled Hours Tracker must use merged per-day time intervals, not raw document sums.
assert(schedule.includes('MAX_REASONABLE_SCHEDULE_SHIFT_MINUTES = 18 * 60'), 'Schedule math has a max reasonable shift guard');
assert(schedule.includes('const parseScheduleClockInfo = (value) =>'), 'Schedule math keeps full AM/PM parse metadata');
assert(schedule.includes('same-meridiem pairs like 10p-3p'), 'Schedule math documents rejecting impossible same-meridiem time ranges');
assert(schedule.includes('const getScheduleShiftInterval = (shift = {}) =>'), 'Schedule math converts each shift into a validated interval');
assert(schedule.includes("startInfo.meridiem === 'p' && endInfo.meridiem === 'a'"), 'Schedule math allows only real PM-to-AM overnight ranges from AM/PM strings');
assert(schedule.includes('const getScheduleShiftTimeStatus = (shift = {}) =>'), 'Schedule math exposes a validation status helper for visible chips');
assert(schedule.includes('Bad schedule time ranges should be flagged for correction, not guessed or auto-repaired.'), 'invalid time ranges are flagged instead of guessed');
assert(schedule.includes('Invalid time range: end time is before start time. Check AM/PM.'), 'end-before-start shifts produce a clear correction message');
assert(schedule.includes('const getUniqueScheduledMinutesForShifts = (shiftList = [])'), 'Schedule math merges overlapping or duplicate intervals per person/day');
assert(schedule.includes('interval.start <= last.end'), 'Schedule math merges overlapping duplicate shift intervals');
assert(schedule.includes('const getUniqueScheduledHoursForShifts = (shiftList = [])'), 'Schedule math exposes unique scheduled hours helper');
assert(schedule.includes('getUniqueScheduledHoursForShifts(getScheduleBuilderRawShiftsForPersonDate(d, emp))'), 'projected labor uses the same raw-to-merged schedule hours as the tracker');
assert(schedule.includes('const audit = getScheduledHoursDayAudit(d, u);'), 'Scheduled Hours Tracker groups visible grid shifts by day before math');
assert(schedule.includes('return sum + audit.hours;'), 'Scheduled Hours Tracker sums audited merged daily intervals');
assert(!schedule.includes('reduce((dayTotal, shift) => dayTotal + calculateShiftHours(shift.startTime, shift.endTime), 0)'), 'Scheduled Hours Tracker no longer sums every raw shift document blindly');
assert(schedule.includes('startMinutes === null ? normalizeShiftFingerprintValue(shift.startTime) : `s${startMinutes}`'), 'dedupe key normalizes equivalent start times such as 10a and 10:00');
assert(schedule.includes('endMinutes === null ? normalizeShiftFingerprintValue(shift.endTime) : `e${endMinutes}`'), 'dedupe key normalizes equivalent end times such as 9p and 21:00');
assert(schedule.includes('invalidTimeRange'), 'Schedule Builder flags invalid visible time ranges so bad data can be corrected');
assert(schedule.includes('INVALID TIME RANGE - NOT COUNTED'), 'invalid schedule time ranges clearly say they are not counted in hours math');
assert(schedule.includes("{invalidTimeRange ? 'INVALID TIME'"), 'bad visible schedule chips show INVALID TIME instead of pretending they are normal shifts');
assert(common.includes('title="86 Voice Assistant"><Mic size={24}/></button>'), '86Voice mic button no longer shows a Preview badge');
assert(!common.includes('>PREVIEW</span>'), '86Voice mic button preview label was removed');


// Runtime examples for schedule math and invalid-time handling. Invalid ranges are excluded and flagged for correction.
const testParseClockInfo = (value) => {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return null;
  if (['close', 'cl', 'closing'].includes(raw)) return { minutes: 1439, meridiem: '', is24Hour: true };
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
  { date: '2026-08-10', startTime: '3p', endTime: '9p' },
  { date: '2026-08-11', startTime: '10a', endTime: '9p' },
  { date: '2026-08-12', startTime: '3p', endTime: '9p' },
  { date: '2026-08-14', startTime: '3p', endTime: '9p' },
  { date: '2026-08-14', startTime: '10p', endTime: '3p' }
]) === 29, 'runtime math: Allen-style visible week cannot inflate to 52 from 10a-9p plus 10p-3p');

assert(schedule.includes('const getScheduledHoursDayAudit = (dateKey, person) => {'), 'scheduled hours has day audit helper');
assert(schedule.includes('getScheduleBuilderRawShiftsForPersonDate(dateKey, person)'), 'scheduled hours uses same raw visible-grid shift source');
assert(schedule.includes("return lines.join('\\n');"), 'scheduled hours audit tooltip uses escaped newline string');
assert(schedule.includes('title={formatScheduledHoursWeekAudit(u.person || u, scheduledHoursWeekBlocks[i], hrs)}'), 'weekly hour cells expose day-by-day audit tooltip');
assert(!schedule.includes('const scheduledHoursPeriodShifts = shifts.filter'), 'scheduled hours no longer uses separate hidden shift source');

// Firebase wiring/config/CSP should remain intact.
assert(vercel.includes('https://www.gstatic.com'), 'CSP still allows Firebase static assets');
assert(vercel.includes('firebaseio.com'), 'CSP still allows Firebase RTDB endpoints');
assert(vercel.includes('firebaseapp.com'), 'CSP still allows Firebase Auth iframe domains');
assert(vercel.includes('web.app'), 'CSP still allows Firebase web.app iframe domains');

if (failures) {
  console.error(`16.0.20 schedule hours source-of-truth validator failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log('16.0.20 schedule hours source-of-truth validator passed.');
