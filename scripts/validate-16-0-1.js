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
const firebaseProjectAdmin = read('api/_firebase-project-admin.js');
const presenceSnapshot = read('api/presence-snapshot.js');
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

assert(pkg.version === '16.0.1', 'package.json version is 16.0.1');
assert(version.version === '16.0.1' && version.build === '16.0.1', 'public/version.json is 16.0.1');
assert(appCore.includes("CURRENT_VERSION = '16.0.1'"), 'CURRENT_VERSION is 16.0.1');
assert(pkg.scripts.test === 'node scripts/validate-16-0-1.js' && pkg.scripts['test:ci'] === 'node scripts/validate-16-0-1.js', 'npm test and test:ci point to current validator');

assert(appCore.includes('getDatabase') && appCore.includes('startLowCostPresenceSession') && appCore.includes('rtdbOnDisconnect'), 'Realtime Database low-cost presence helper exists');
assert(appCore.includes('useLowCostPresenceSummaries') && appCore.includes('statusSummary/${workspaceKey}'), 'RTDB status summary hook exists for cheap last-seen reads');
assert(firebaseJson.includes('database.rules.json') && databaseRules.includes('statusSummary') && databaseRules.includes('auth.uid === $userId'), 'Realtime Database presence rules are included for own-session writes');
assert(firebaseProjectAdmin.includes('getDatabaseUrlForProject') && firebaseProjectAdmin.includes('databaseURL: getDatabaseUrlForProject(finalProjectId)'), 'Firebase Admin apps include RTDB databaseURL for server presence snapshots');
assert(presenceSnapshot.includes('rtdb-statusSummary') && presenceSnapshot.includes("app.database().ref(refPath).once('value')"), 'System Admin presence snapshot reads RTDB summary before Firestore fallback');
assert(app.includes('startLowCostPresenceSession') && app.includes('activeTab: \'app\'') && !app.includes('activeTab: activeTabState,'), 'RTDB presence does not rewrite on every tab change');
assert(app.includes('false && !ghostTenant && appUser?.id'), 'old Firestore/API heartbeat check-in is disabled');

assert(app.includes('wantsPublishedSchedule ||') && app.includes("activeTabState === 'published'"), 'published/My Schedule route loads schedule data even for staff-facing schedule view');
assert(app.includes('(canViewTeamScheduleData || wantsScheduleScreen) ? []'), 'schedule screens do not hide legacy request-offs behind userId-only query');
assert(schedule.includes('getSchedulePersonForAppUser') && schedule.includes('rosterUserId') && schedule.includes('accountUserId'), 'schedule identity matching keeps auth and roster identities');
assert(schedule.includes('shiftMatchesPerson(s, schedulePerson) && String(s.date || \'\').startsWith(monthStr)'), 'My Month Shifts matches against merged schedule person');
assert(schedule.includes('shiftMatchesPerson(s, schedulePerson) && s.isPublished && isShiftStillCurrentOrUpcoming'), 'Next Shift matches current/upcoming shifts against merged schedule person');
assert(schedule.includes('Do NOT use createdBy/author fields here') && !schedule.includes('const shiftMatchesPerson = (shift = {}, person = {}) => recordMatchesPerson(shift, person);'), 'shift matching ignores createdBy/importer fields so owners do not see every imported shift');
assert(schedule.includes('visibleRequests = (timeOffRequests || []).filter(r => canManage || timeOffMatchesPerson(r, schedulePerson) || timeOffMatchesPerson(r, appUser))'), 'Request Off calendar matches schedule person and app user');

assert(schedule.includes('requestedAt: nowIso') && schedule.includes('requestedAtMs: Date.now()') && schedule.includes('requestTimestamp: nowIso'), 'request-off submissions store requested timestamp fields');
assert(schedule.includes('priorRequestInfoForDate') && schedule.includes('has already been requested off') && schedule.includes('people have'), 'request-off calendar warns when others already requested the day');
assert(schedule.includes('Requested {formatClockDateTime(r.requestedAt || r.submittedAt || r.createdAt || r.requestTimestamp)}'), 'request-off cards display request timestamp');
assert(schedule.includes('{priorCount} req'), 'request-off calendar shows prior request count badges');

assert(godMode.includes('handleGlobalLogoutNonAdmins') && godMode.includes('forceLogout: true') && godMode.includes('LOG OUT USERS'), 'System Administrator can log out non-System Administrator users with typed confirmation');
assert(godMode.includes('isProtectedSystemAdminUser') && godMode.includes('isSuperAdmin'), 'global logout protects System Administrator accounts');

if (process.exitCode) process.exit(1);
console.log('16.0.1 My Schedule strict shift matching validator passed.');
