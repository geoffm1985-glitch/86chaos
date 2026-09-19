const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const schedule = read('src/features/schedule.jsx');
const app = read('src/App.js');
const appCore = read('src/core/appCore.js');
const godMode = read('src/components/TabGodMode.js');
const firebaseJson = read('firebase.json');
const databaseRules = read('database.rules.json');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

assert(pkg.version === '15.0.100', 'package.json version is 15.0.100');
assert(version.version === '15.0.100' && version.build === '15.0.100', 'public/version.json is 15.0.100');
assert(appCore.includes("CURRENT_VERSION = '15.0.100'"), 'CURRENT_VERSION is 15.0.100');
assert(appCore.includes('getDatabase') && appCore.includes('startLowCostPresenceSession') && appCore.includes('rtdbOnDisconnect'), 'Realtime Database low-cost presence helper exists');
assert(firebaseJson.includes('database.rules.json') && databaseRules.includes('statusSummary') && databaseRules.includes('auth.uid === $userId'), 'Realtime Database presence rules are included for own-session writes');
assert(app.includes('startLowCostPresenceSession') && app.includes('false && !ghostTenant && appUser?.id'), 'old Firestore/API heartbeat check-in is disabled and RTDB presence is used');
assert(app.includes('wantsPublishedSchedule ||') && app.includes('activeTabState === \'published\''), 'published/My Schedule route loads schedule data even for staff-facing schedule view');
assert(app.includes('(canViewTeamScheduleData || wantsScheduleScreen) ? []'), 'schedule screens do not hide legacy request-offs behind userId-only query');
assert(schedule.includes('getSchedulePersonForAppUser') && schedule.includes('rosterUserId') && schedule.includes('accountUserId'), 'schedule identity matching keeps auth and roster identities');
assert(schedule.includes('shiftMatchesPerson(s, schedulePerson) && String(s.date || \'\').startsWith(monthStr)'), 'My Month Shifts matches against merged schedule person');
assert(schedule.includes('shiftMatchesPerson(s, schedulePerson) && s.isPublished && isShiftStillCurrentOrUpcoming'), 'Next Shift matches against merged schedule person');
assert(schedule.includes('visibleRequests = (timeOffRequests || []).filter(r => canManage || timeOffMatchesPerson(r, schedulePerson) || timeOffMatchesPerson(r, appUser))'), 'Request Off calendar matches schedule person and app user');
assert(godMode.includes('handleGlobalLogoutNonAdmins') && godMode.includes('forceLogout: true') && godMode.includes('LOG OUT USERS'), 'System Administrator can log out non-System Administrator users with typed confirmation');
assert(godMode.includes('isProtectedSystemAdminUser') && godMode.includes('isSuperAdmin'), 'global logout protects System Administrator accounts');

if (process.exitCode) process.exit(1);
console.log('15.0.100 low-cost presence / schedule visibility / global logout validator passed.');
