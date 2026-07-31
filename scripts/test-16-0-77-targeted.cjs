#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.77 targeted test failed: ${message}`);
    process.exitCode = 1;
  }
};

const version = json('public/version.json');
const pkg = json('package.json');
const schedule = read('src/features/schedule.jsx');
const planner = read('src/core/scheduleQueryPlanner.js');
const styles = read('src/styles.css');
const rules = read('firestore.rules');
const apiVersion = read('api/_version.js');
const appCore = read('src/core/appCore.js');

assert(version.version === '16.0.77', 'version.json reports 16.0.77');
assert(pkg.version === '16.0.77', 'package.json reports 16.0.77');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-77.js', 'test:source points to the 16.0.77 validator');
assert(apiVersion.includes("APP_VERSION = '16.0.77'"), 'API version constant is 16.0.77');
assert(appCore.includes("CURRENT_VERSION = '16.0.77'"), 'appCore CURRENT_VERSION is 16.0.77');

assert(planner.includes('collectScheduleDurableIdentityAliases'), 'shared durable schedule identity alias helper exists');
assert(planner.includes('resolveSchedulePersonForAccount'), 'shared account-to-roster resolver exists');
assert(planner.includes('resolveSchedulePersonForShift'), 'shared shift-to-roster resolver exists');
assert(planner.includes('buildCanonicalScheduleIdentityBlock'), 'canonical schedule identity block helper exists');
assert(planner.includes('scheduleIdentityBlockMatchesPerson'), 'identity read-back verifier helper exists');
assert(schedule.includes('resolveSchedulePersonForShift(shift, users)'), 'publisher resolves each shift to one active roster person');
assert(schedule.includes('writeBatch(db)'), 'publisher uses Firestore writeBatch instead of loose Promise.allSettled updates');
assert(schedule.includes('verificationFailures'), 'publisher reads updated shifts back and verifies persisted fields');
assert(schedule.includes('identityVerifiedAt'), 'publisher repairs stale published identity fields without unpublishing');
assert(schedule.includes('Published with Employee Review Needed'), 'publisher reports unresolved employee matches in plain English');
assert(schedule.includes('Schedule is already published and employee visibility is verified.'), 'publisher can verify already-published schedules without rewriting them');
assert(schedule.includes('addToast(\'Date Selected\', \'Tap an individual shift chip to delete only that shift.'), 'clicking a filled cell no longer bulk-deletes shifts');
assert(!schedule.includes('Delete ${label} for ${emp.name || \'this employee\'}'), 'filled-cell bulk delete confirmation was removed');
assert(schedule.includes('shiftMatchesPerson(shift, schedulePerson, users)'), 'My Schedule uses roster-aware identity matching');
assert(schedule.includes('scheduleIdentityBlockMatchesPerson(data, item.person)'), 'read-back verifies canonical employee identity');
assert(schedule.includes("where('workspaceId', '==', appUser.restaurantId)"), 'publish fallback queries workspaceId records too');

assert(styles.includes('16.0.77 Schedule Builder shift chips'), 'Schedule Builder compact chip CSS exists');
assert(/schedule-builder-time-chip[\s\S]*white-space:\s*nowrap !important/.test(styles), 'schedule chip labels are forced to one horizontal line');
assert(/schedule-builder-time-chip[\s\S]*min-height:\s*16px !important/.test(styles), 'schedule chip visual height is compact');
assert(/schedule-builder-time-chip[\s\S]*min-width:\s*0 !important/.test(styles), 'schedule chip visual width does not force inflated boxes');
assert(/schedule-builder-time-chip[\s\S]*width:\s*calc\(100% - 8px\) !important/.test(styles), 'schedule chip keeps margins inside the date cell');
assert(!/schedule-builder-time-chip[\s\S]{0,240}white-space:\s*normal !important[\s\S]{0,240}16\.0\.77/.test(styles), 'final 16.0.77 cascade does not reintroduce wrapping');

assert(rules.includes('function protectedFoundingAdminEmail()'), 'Firestore rules know the protected founding admin email');
assert(rules.includes("return 'geoffm1985@gmail.com';"), 'Firestore rules protect the exact founding admin email');
assert(rules.includes('protectedFoundingAdminUserUpdateIsSafe()'), 'Firestore rules block protected admin revocation updates');
assert(rules.includes('!isProtectedFoundingAdminUser(resource.data)'), 'Firestore rules block protected admin deletion');
assert(rules.includes('scheduleCollection(collectionName) && isRestaurantOwner(restId)'), 'schedule writes allow restaurant owners without weakening all tenant collections');

if (!process.exitCode) console.log('16.0.77 targeted schedule publishing, My Schedule, compact chip, and protected admin tests passed.');
