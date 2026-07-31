const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.82 source validation failed: ${message}`);
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
const app = read('src/App.js');
const sessionAccess = read('src/core/sessionAccess.js');
const authFeature = read('src/features/auth.jsx');
const indexes = json('firestore.indexes.json');
const verifyRoles = require('./86chaos-release-gate/verify-role-accounts.cjs');

assert(pkg.version === '16.0.82', 'package.json version is 16.0.82');
assert(lock.version === '16.0.82' && lock.packages?.['']?.version === '16.0.82', 'package-lock root version is 16.0.82');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-82.js', 'test:source points at 16.0.82 validator');
assert(version.version === '16.0.82' && version.build === '16.0.82', 'public version/build is 16.0.82');
assert(appCore.includes("CURRENT_VERSION = '16.0.82'"), 'appCore CURRENT_VERSION is 16.0.82');
assert(apiVersion.includes("APP_VERSION = '16.0.82'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.82'"), 'API version constants are 16.0.82');
assert(planner.includes('collectScheduleIdentityAliases') && planner.includes('resolveSchedulePersonForShift'), 'shared schedule identity helpers are present');
assert(schedule.includes('writeBatch(db)'), 'schedule publishing uses batched Firestore updates');
assert(schedule.includes('verificationFailures'), 'schedule publishing verifies saved shifts after commit');
assert(schedule.includes('identityVerifiedAt'), 'schedule publishing repairs employee identity on existing published shifts');
assert(schedule.includes('Published with Employee Review Needed'), 'schedule publishing has specific unresolved-employee reporting');
assert(schedule.includes('shiftMatchesPerson(shift, schedulePerson, users)'), 'My Schedule uses roster-aware identity matching');
assert(schedule.includes("addToast('Date Selected', 'Tap an individual shift chip to delete only that shift."), 'filled-cell clicks no longer bulk-delete existing shifts');
assert(!schedule.includes('activeLocalDeleteKeysSet'), 'Schedule code does not reference the old misspelled delete-marker variable');
assert(styles.includes('16.0.78 Schedule Builder shift chip surface correction'), 'styles include compact one-line Schedule Builder chip guard');
assert(styles.includes('white-space: nowrap !important'), 'styles force schedule chip labels to one line');
assert(styles.includes('width: fit-content !important'), 'shift chips size to content instead of filling the entire cell');
assert(styles.includes('background-clip: padding-box !important'), 'role color covers the complete visible chip surface');
assert(styles.includes('contain: paint !important'), 'chip paint is contained inside the colored surface');
assert(rules.includes('function protectedFoundingAdminEmail()'), 'Firestore rules include protected founding admin helper');
assert(rules.includes('protectedFoundingAdminUserUpdateIsSafe()'), 'Firestore rules protect founding admin user updates');
assert(rules.includes('scheduleCollection(collectionName) && isRestaurantOwner(restId)'), 'Firestore rules align owner publish permissions with UI');
assert(read('src/core/scheduleQueryPlanner.test.js').includes("['date', '>=', '2026-06-29']") && read('src/core/scheduleQueryPlanner.test.js').includes("['date', '<=', '2026-08-02']"), 'My Schedule test expects outer-week month bounds');
assert(read('scripts/86chaos-release-gate/check-java-prerequisite.cjs').includes('java -version'), 'Java prerequisite checker is present for emulator rules tests');
assert(fs.existsSync(path.join(root, 'INSTALL_AND_RUN_86CHAOS_ULTIMATE_TESTS.ps1')) && fs.existsSync(path.join(root, 'INSTALL_AND_RUN_86CHAOS_ULTIMATE_TESTS.cmd')), 'V9 installer files are restored at the source root');
assert(app.includes('shouldHoldAccessHydration({'), 'App gates cached-session role controls during access hydration');
assert(app.includes('classifyWhoamiResponse({ ok: res.ok'), 'App classifies /api/whoami responses instead of treating transient failures as denial');
assert(app.includes('forceTokenRefresh') && app.includes('res.status === 401'), 'App retries one 401 with a refreshed Firebase ID token');
assert(app.includes('Restoring session') && app.includes('Checking your access'), 'App shows a restoring session state instead of a downgraded menu');
assert(authFeature.includes('accessHydrationRequired: true') && authFeature.includes('profileDocId') && !authFeature.includes('...activeUser,'), 'login reload cache persists only non-authoritative identity/workspace hints');
assert(sessionAccess.includes('WHOAMI_STATES') && sessionAccess.includes('TRANSIENT_FAILURE'), 'session access helper tracks pending, verified, denied, and transient states');
assert(sessionAccess.includes('mergeVerifiedAccess') && sessionAccess.includes('server-verified-not-system-admin'), 'session access helper only removes super admin on definitive verification denial');
assert(read('src/core/sessionAccess.test.js').includes('transient whoami failures keep the current verified administrator state'), 'refresh/access regression tests cover transient /api/whoami failures');

assert(app.includes('rawScheduleDateKeyShifts') && app.includes('shifts-scheduleDateKey-rescue'), 'App loads scheduleDateKey rescue shifts for employee-facing schedule screens');
assert(app.includes('mergeLoadedScheduleShifts(rawDateShifts, rawScheduleDateKeyShifts)'), 'App merges date and scheduleDateKey shift snapshots before rendering');
assert(planner.includes('buildScheduleDateKeyRangeClauses') && planner.includes('mergeLoadedScheduleShifts') && planner.includes('normalizeLoadedScheduleShift'), 'schedule planner exposes legacy scheduleDateKey load/merge helpers');
assert(read('src/core/scheduleQueryPlanner.test.js').includes('schedule screen can rescue scheduleDateKey-only shift records'), 'schedule query tests cover scheduleDateKey-only shift rescue');
assert(indexes.indexes.some(idx => idx.collectionGroup === 'shifts' && idx.fields?.some(f => f.fieldPath === 'scheduleDateKey') && idx.fields?.some(f => f.fieldPath === 'restaurantId')), 'Firestore indexes include restaurantId + scheduleDateKey for employee schedule visibility');



// 16.0.82 release-gate request-header regression checks.
process.env.APP_URL = process.env.APP_URL || 'https://app.86chaos.com';
const headerOptions = verifyRoles.buildFirebaseAuthFetchOptions({
  method: 'POST',
  referrer: 'https://example.invalid/extra-referrer',
  referrerPolicy: 'origin-when-cross-origin',
  headers: {
    origin: 'https://bad-origin.example',
    Origin: 'https://bad-origin-2.example',
    referer: 'https://bad-referer.example/',
    Referer: 'https://bad-referer-2.example/',
    Authorization: 'Bearer test-token'
  }
});
const headerCounts = verifyRoles.getFirebaseAuthOriginHeaderCounts(headerOptions.headers);
assert(headerCounts.origin === 1, 'Firebase Auth request helper emits exactly one Origin header after duplicate-case input');
assert(headerCounts.referer === 1, 'Firebase Auth request helper emits exactly one Referer header after duplicate-case input');
assert(Object.prototype.hasOwnProperty.call(headerOptions.headers, 'Origin'), 'Firebase Auth request helper keeps canonical Origin header');
assert(Object.prototype.hasOwnProperty.call(headerOptions.headers, 'Referer'), 'Firebase Auth request helper keeps canonical Referer header');
assert(!Object.prototype.hasOwnProperty.call(headerOptions.headers, 'origin'), 'Firebase Auth request helper removes lowercase origin duplicate');
assert(!Object.prototype.hasOwnProperty.call(headerOptions.headers, 'referer'), 'Firebase Auth request helper removes lowercase referer duplicate');
assert(!Object.prototype.hasOwnProperty.call(headerOptions, 'referrer'), 'Firebase Auth fetch options omit referrer so fetch cannot synthesize a duplicate Referer header');
assert(!Object.prototype.hasOwnProperty.call(headerOptions, 'referrerPolicy'), 'Firebase Auth fetch options omit referrerPolicy with the stripped referrer option');
assert(headerOptions.headers.Authorization === 'Bearer test-token', 'Firebase Auth request helper preserves non-origin headers like Authorization');
assert(verifyRoles.isFirebaseAuthRequestFormatFailure('HTTP 400: Bad request: multiple values in Origin header.'), 'role verifier classifies duplicate Origin response as a test-harness request-format failure');
assert(!read('scripts/86chaos-release-gate/verify-role-accounts.cjs').includes('headers.origin = origin'), 'role verifier no longer sends duplicate lowercase origin header');
assert(!read('scripts/86chaos-release-gate/verify-role-accounts.cjs').includes('headers.referer ='), 'role verifier no longer sends duplicate lowercase referer header');
assert(read('scripts/86chaos-release-gate/verify-role-accounts.cjs').includes('Release-gate Firebase Auth request headers are malformed'), 'role report wording identifies header-format failures as test-harness failures');
assert(read('scripts/86chaos-release-gate/verify-role-accounts.cjs').includes('before replacing QA accounts'), 'role report wording does not tell the user to replace QA accounts for request-format failures');

// 16.0.82 Schedule Builder readability checks.
assert(schedule.includes('return `${start}-${end}`;'), 'Schedule Builder partial unavailable ranges render without extra spaces so full time ranges fit in compact chips');
assert(styles.includes('16.0.82: Schedule Builder time chip readability'), 'styles include 16.0.82 schedule chip readability override');
assert(styles.includes('font-weight: 900 !important'), 'schedule time chips are bolder and easier to read');
assert(styles.includes('min-width: max-content !important'), 'schedule time chips reserve enough width for full time text');
assert(styles.includes('overflow: visible !important'), 'schedule time chips avoid clipping full unavailable/request-off time ranges');
assert(styles.includes('contain: none !important'), 'schedule time chips no longer paint-contain text in a way that clips the label');


if (!process.exitCode) console.log('16.0.82 source validator passed.');
