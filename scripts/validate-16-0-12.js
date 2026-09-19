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
const common = read('src/components/common.jsx');
const modalBlock = common.slice(common.indexOf('const Modal ='), common.indexOf('const reminderNeedsAttention'));
const schedule = read('src/features/schedule.jsx');
const management = read('src/features/management.jsx');
const presenceApi = read('api/presence-snapshot.js');
const styles = read('src/styles.css');
const vercel = read('vercel.json');

assert(pkg.version === '16.0.12', 'package.json version is 16.0.12');
assert(lock.version === '16.0.12' && lock.packages?.['']?.version === '16.0.12', 'package-lock.json version is 16.0.12');
assert(version.version === '16.0.12' && version.build === '16.0.12', 'public/version.json is 16.0.12');
assert(appCore.includes("CURRENT_VERSION = '16.0.12'"), 'CURRENT_VERSION is 16.0.12');
assert(pkg.scripts?.test === 'node scripts/validate-16-0-12.js', 'npm test runs 16.0.12 validator');
assert(pkg.scripts?.['test:ci'] === 'node scripts/validate-16-0-12.js', 'npm test:ci runs 16.0.12 validator');

// 16.0.12 mobile keyboard fix: modal focus effect must not restart every typed character.
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
assert(styles.includes('Schedule Builder event visibility row'), '16.0.12 event visibility CSS note is present');
assert(schedule.includes('`${92 + (schedulePeriodDays.length * 62)}px`'), 'Schedule Builder desktop min-width stays compact');
assert(styles.includes('min-width: 62px !important'), 'Desktop schedule day cells stay compact');
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

// Firebase wiring/config/CSP should remain intact.
assert(vercel.includes('https://www.gstatic.com'), 'CSP still allows Firebase static assets');
assert(vercel.includes('firebaseio.com'), 'CSP still allows Firebase RTDB endpoints');
assert(vercel.includes('firebaseapp.com'), 'CSP still allows Firebase Auth iframe domains');
assert(vercel.includes('web.app'), 'CSP still allows Firebase web.app iframe domains');

if (failures) {
  console.error(`16.0.12 schedule builder events visibility validator failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.12 schedule builder events visibility validator passed.');
