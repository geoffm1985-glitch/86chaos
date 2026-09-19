const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.69 targeted test failed: ${message}`);
    process.exit(1);
  }
};

const app = read('src/App.js');
const management = read('src/features/management.jsx');
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));

assert(pkg.version === '16.0.69', 'package version is 16.0.69');
assert(version.version === '16.0.69', 'public version is 16.0.69');
assert(app.includes('const hasCurrentLoginAlreadyHonoredForceLogout'), 'App defines force logout one-shot guard');
assert(app.includes('getAuthLastSignInTimeMs'), 'App compares forceLogoutAt to the current Firebase sign-in time');
assert(app.includes('markForceLogoutHandledLocally(liveAppUser)'), 'App records that a legacy/no-timestamp logout event was honored locally');
assert(app.includes('if (alreadyHonored)'), 'App allows fresh logins after the previous logout event was already honored');
assert(app.includes("forceLogoutClearMode: 'client-stale-session-guard'"), 'App attempts to clear stale forceLogout flags after allowing a fresh login');
assert(app.includes('Your session was signed out by a System Administrator. Please log in again.'), 'Employee-facing force logout message is plain English');
assert(!app.includes('Session terminated by System Administrator to clear a cache error'), 'Old hard-cache-error alert is removed');
assert(management.match(/forceLogoutAt: new Date\(\)\.toISOString\(\)/g)?.length >= 2, 'Individual force logout actions include forceLogoutAt timestamps');
console.log('16.0.69 targeted force logout session test passed.');
