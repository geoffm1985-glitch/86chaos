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
const styles = read('src/styles.css');

assert(pkg.version === '16.0.9', 'package.json version is 16.0.9');
assert(lock.version === '16.0.9' && lock.packages?.['']?.version === '16.0.9', 'package-lock.json version is 16.0.9');
assert(version.version === '16.0.9' && version.build === '16.0.9', 'public/version.json is 16.0.9');
assert(appCore.includes("CURRENT_VERSION = '16.0.9'"), 'CURRENT_VERSION is 16.0.9');
assert(pkg.scripts?.test === 'node scripts/validate-16-0-9.js', 'npm test runs 16.0.9 validator');

assert(schedule.includes('schedule-builder-desktop-table'), 'Schedule Builder desktop table class is present');
assert(schedule.includes('`${92 + (schedulePeriodDays.length * 62)}px`'), 'Schedule Builder desktop min-width was tightened from oversized 86px cells');
assert(styles.includes('/* 16.0.9: desktop-only Schedule Builder density/readability. Keep mobile cell density unchanged. */'), '16.0.9 desktop-only schedule density block is present');
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

if (failures) {
  console.error(`16.0.9 desktop schedule density/device-label validator failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.9 desktop schedule density/device-label validator passed.');
