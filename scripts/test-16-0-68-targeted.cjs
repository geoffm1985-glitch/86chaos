#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.68 targeted test failed: ${message}`);
    process.exitCode = 1;
  }
};
const schedule = read('src/features/schedule.jsx');
const app = read('src/App.js');
const management = read('src/features/management.jsx');
const apiGlobal = read('api/admin-global-operation.js');
const planner = read('src/core/scheduleQueryPlanner.js');
const pkg = json('package.json');
const version = json('public/version.json');

assert(pkg.version === '16.0.68', 'package.json version is 16.0.68');
assert(version.version === '16.0.68' && version.build === '16.0.68', 'public version is 16.0.68');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-68.js', 'test:source points to 16.0.68 validator');

assert(schedule.includes('person.membershipId') && schedule.includes('person.workspaceMemberId'), 'shift matching includes workspace membership identity fields');
assert(app.includes('membershipId = member.membershipId || member.id') && app.includes('scheduleUserId: member.scheduleUserId || rosterId || stableUserId'), 'real logged-in employees retain roster/workspace member schedule identity');
assert(planner.includes('safeUser.membershipId || safeUser.workspaceMemberId'), 'query planner canonical identity includes membership ids');
assert(schedule.includes('const isScheduleShiftPublished = (shift = {})'), 'schedule has flexible published-shift helper');
assert(schedule.includes('shift?.published === true') && schedule.includes("status === 'published'") && schedule.includes('shift?.publishedAt'), 'published helper recognizes restored/legacy publish fields');
assert(schedule.includes('shiftMatchesPerson(s, schedulePerson) && isScheduleShiftPublished(s)'), 'employee My Schedule uses flexible published detection');

assert(management.includes('const [globalLogoutBusy, setGlobalLogoutBusy] = useState(false);'), 'active admin console has global logout state');
assert(management.includes('const handleGlobalLogoutNonAdmins = async () =>'), 'active admin console has global logout handler');
assert(management.includes('Global Logout Non-Admins') && management.includes('Log Out Non-Admins'), 'global logout is visible in System Administrator');
assert(apiGlobal.includes("action === 'logoutNonAdmins'"), 'server global operation supports logoutNonAdmins');
assert(apiGlobal.includes('isProtectedRootAdminEmail(email)') || apiGlobal.includes('isProtectedRootAdminEmail'), 'server global logout skips protected root admin email');
assert(apiGlobal.includes('data.isSuperAdmin === true') && apiGlobal.includes('systemAccess?.superAdmin'), 'server global logout skips system administrators');

if (!process.exitCode) console.log('16.0.68 targeted My Schedule identity + global logout test passed.');
