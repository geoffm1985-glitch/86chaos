const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
};
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const lock = JSON.parse(read('package-lock.json'));
const appCore = read('src/core/appCore.js');
const schedule = read('src/features/schedule.jsx');
const management = read('src/features/management.jsx');
const presenceSnapshot = read('api/presence-snapshot.js');
const vercel = read('vercel.json');
assert(pkg.version === '16.0.6', 'package.json version is 16.0.6');
assert(lock.version === '16.0.6' && lock.packages?.['']?.version === '16.0.6', 'package-lock.json version is 16.0.6');
assert(version.version === '16.0.6' && version.build === '16.0.6', 'public/version.json is 16.0.6');
assert(appCore.includes("CURRENT_VERSION = '16.0.6'"), 'CURRENT_VERSION is 16.0.6');
assert(pkg.scripts.test === 'node scripts/validate-16-0-6.js' && pkg.scripts['test:ci'] === 'node scripts/validate-16-0-6.js', 'npm test and test:ci point to current validator');
assert(vercel.includes('https://*.firebaseio.com') && vercel.includes('https://*.firebasedatabase.app') && vercel.includes('https://*.firebaseapp.com'), 'Firebase RTDB/Auth CSP allowances are preserved');
assert(presenceSnapshot.includes('readRtdbStatusSummaryViaRest') && presenceSnapshot.includes('timeoutMs') && presenceSnapshot.includes('empty-safe-fallback'), 'presence snapshot API uses bounded REST reads and safe fallback');
assert(presenceSnapshot.includes('writeAudit(db, ctx') && presenceSnapshot.includes('.catch(err => console.warn'), 'presence snapshot audit write is non-blocking');
assert(management.includes('presenceSnapshotWarning') && management.includes('client-roster-fallback') && management.includes('limit=500&timeoutMs=3200'), 'System Administrator Online / Last Seen has client fallback instead of a red 504-only failure');
assert(management.includes("label:'Online / Last Seen'") && management.includes('Last online is shown right here in People Directory'), 'System Administrator still exposes Online / Last Seen clearly');
assert(!management.includes("id:'branding', label:'Branding / Display'"), 'System Administrator Branding / Display navigation tab is still removed');
assert(schedule.includes('isAssigningShift') && schedule.includes('getScheduleBuilderShiftsForPersonDate'), 'Schedule Builder assignment is guarded and uses visible shift matching');
assert(schedule.includes("assignmentSource: 'schedule-builder-stable-row'") && schedule.includes('rosterUserId: emp.id') && schedule.includes('assignedUserId: emp.id'), 'Schedule Builder writes stable roster identity fields for manual shifts');
assert(schedule.includes('setAssignDates(prev => {') && schedule.includes('const base = selectedEmp && selectedEmp !== empId ? [] : prev'), 'Schedule Builder clears stale selected dates when changing employee rows');
assert(schedule.includes('duplicate/visible shifts were removed') && schedule.includes("deleteDoc(doc(db, 'shifts', s.id))"), 'Schedule Builder can delete duplicate or malformed visible shifts by document id');
if (process.exitCode) process.exit(process.exitCode);
console.log('16.0.6 presence snapshot and Schedule Builder assignment validator passed.');
