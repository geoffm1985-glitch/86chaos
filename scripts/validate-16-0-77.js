const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.77 source validation failed: ${message}`);
    process.exitCode = 1;
  }
};

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const schedule = read('src/features/schedule.jsx');
const planner = read('src/core/scheduleQueryPlanner.js');
const styles = read('src/styles.css');
const rules = read('firestore.rules');

assert(pkg.version === '16.0.77', 'package.json version is 16.0.77');
assert(lock.version === '16.0.77' && lock.packages?.['']?.version === '16.0.77', 'package-lock root version is 16.0.77');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-77.js', 'test:source points at 16.0.77 validator');
assert(version.version === '16.0.77' && version.build === '16.0.77', 'public version/build is 16.0.77');
assert(appCore.includes("CURRENT_VERSION = '16.0.77'"), 'appCore CURRENT_VERSION is 16.0.77');
assert(apiVersion.includes("APP_VERSION = '16.0.77'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.77'"), 'API version constants are 16.0.77');
assert(planner.includes('collectScheduleIdentityAliases') && planner.includes('resolveSchedulePersonForShift'), 'shared schedule identity helpers are present');
assert(schedule.includes('writeBatch(db)'), 'schedule publishing uses batched Firestore updates');
assert(schedule.includes('verificationFailures'), 'schedule publishing verifies saved shifts after commit');
assert(schedule.includes('identityVerifiedAt'), 'schedule publishing repairs employee identity on existing published shifts');
assert(schedule.includes('Published with Employee Review Needed'), 'schedule publishing has specific unresolved-employee reporting');
assert(schedule.includes('shiftMatchesPerson(shift, schedulePerson, users)'), 'My Schedule uses roster-aware identity matching');
assert(schedule.includes("addToast('Date Selected', 'Tap an individual shift chip to delete only that shift."), 'filled-cell clicks no longer bulk-delete existing shifts');
assert(!schedule.includes('activeLocalDeleteKeysSet'), 'Schedule code does not reference the old misspelled delete-marker variable');
assert(styles.includes('16.0.77 Schedule Builder shift chips'), 'styles include compact one-line Schedule Builder chip guard');
assert(styles.includes('white-space: nowrap !important'), 'styles force schedule chip labels to one line');
assert(styles.includes('min-height: 16px !important'), 'styles restore compact visual chip height');
assert(rules.includes('function protectedFoundingAdminEmail()'), 'Firestore rules include protected founding admin helper');
assert(rules.includes('protectedFoundingAdminUserUpdateIsSafe()'), 'Firestore rules protect founding admin user updates');
assert(rules.includes('scheduleCollection(collectionName) && isRestaurantOwner(restId)'), 'Firestore rules align owner publish permissions with UI');

if (!process.exitCode) console.log('16.0.77 source validator passed.');
