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
const management = read('src/features/management.jsx');
const presenceApi = read('api/presence-snapshot.js');
const styles = read('src/styles.css');

assert(pkg.version === '16.0.10', 'package.json version is 16.0.10');
assert(lock.version === '16.0.10' && lock.packages?.['']?.version === '16.0.10', 'package-lock.json version is 16.0.10');
assert(version.version === '16.0.10' && version.build === '16.0.10', 'public/version.json is 16.0.10');
assert(appCore.includes("CURRENT_VERSION = '16.0.10'"), 'CURRENT_VERSION is 16.0.10');
assert(pkg.scripts?.test === 'node scripts/validate-16-0-10.js', 'npm test runs 16.0.10 validator');

assert(schedule.includes('schedule-builder-desktop-table'), 'Schedule Builder desktop table class is present');
assert(schedule.includes('`${92 + (schedulePeriodDays.length * 62)}px`'), 'Schedule Builder desktop min-width was tightened from oversized 86px cells');
assert(styles.includes('/* 16.0.10: desktop-only Schedule Builder density/readability. Keep mobile cell density unchanged. */'), 'Desktop-only schedule density block is still present');
assert(styles.includes('min-width: 62px !important'), 'Desktop schedule day cells are compact enough to avoid oversized squares');
assert(styles.includes('border-top: 1px solid rgba(125, 151, 166, 0.32) !important'), 'Desktop schedule horizontal grid lines are strengthened');
assert(styles.includes('border-right: 1px solid rgba(125, 151, 166, 0.42) !important'), 'Desktop schedule vertical grid lines are strengthened');
assert(styles.includes('font-size: 9px !important'), 'Desktop schedule time chips remain readable without giant cells');
assert(styles.includes('schedule-builder-partial-off-chip'), 'Partial-day request-off chip has desktop readability control');

assert(management.includes('formatPresenceDeviceLabel'), 'Presence screen uses friendly device labels');
assert(management.includes("platform = 'Android'"), 'Presence device parser recognizes Android');
assert(management.includes("browser = 'Chrome'"), 'Presence device parser recognizes Chrome without showing raw AppleWebKit token');
assert(management.includes('Android WebView'), 'Presence device parser handles Android WebView labels');
assert(management.includes("deviceLabel: formatPresenceDeviceLabel"), 'People Directory presence rows use friendly device labels');
assert(management.includes("formatPresenceDeviceLabel(u.activeDevice || u.device || u.deviceType || '')"), 'Online Now list uses friendly device labels');


assert(management.includes('TRUE_ONLINE_WINDOW_MS'), 'Presence UI has a strict true-online cutoff');
assert(management.includes('onlineSeconds=90'), 'Presence snapshot request asks API for 90-second online truth window');
assert(management.includes('Recently active: {recentlyActiveUsers.length}'), 'Presence header separates recently active from online now');
assert(management.includes('Active today: {activeTodayUsers.length}'), 'Presence header separates active-today users from online now');
assert(management.includes('No users have a fresh heartbeat'), 'Online Now empty state explains stale sessions are not online');
assert(management.includes('Last-seen fallback'), 'Presence UI uses friendly fallback wording');
assert(management.includes('AppleWebKit') === false, 'Presence UI does not hard-code AppleWebKit in display text');
assert(presenceApi.includes('onlineSeconds'), 'Presence API supports a strict onlineSeconds cutoff');
assert(presenceApi.includes("presenceBucket: 'onlineNow'") || presenceApi.includes("markPresenceBucket(row, 'onlineNow')"), 'Presence API labels truly online rows');
assert(presenceApi.includes("markPresenceBucket(row, 'recentlyActive')"), 'Presence API labels recently active rows separately');
assert(presenceApi.includes("markPresenceBucket(row, 'activeToday')"), 'Presence API labels active-today rows separately');
assert(presenceApi.includes('Live presence source unavailable. Showing last-seen fallback.'), 'Presence API returns friendly RTDB fallback warning');
assert(!presenceApi.includes("(data.online === true ? 'online' : data.online === false ? 'offline' : 'online')"), 'Presence API no longer defaults unknown rows to online');

if (failures) {
  console.error(`16.0.10 honest presence status validator failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.10 honest presence status validator passed.');
