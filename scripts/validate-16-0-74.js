const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.74 source validation failed: ${message}`);
    process.exitCode = 1;
  }
};
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const manifest = json('public/manifest.json');
const indexHtml = read('public/index.html');
const management = read('src/features/management.jsx');
const schedule = read('src/features/schedule.jsx');
const setupTests = read('src/setupTests.js');
const sourceInventory = read('scripts/86chaos-release-gate/source-inventory.cjs');
const verifyRoles = read('scripts/86chaos-release-gate/verify-role-accounts.cjs');
const coverageGate = read('scripts/86chaos-release-gate/enforce-jest-coverage.cjs');

assert(pkg.version === '16.0.74', 'package.json version is 16.0.74');
assert(lock.version === '16.0.74' && lock.packages?.['']?.version === '16.0.74', 'package-lock root version is 16.0.74');
assert(version.version === '16.0.74' && version.build === '16.0.74', 'public version/build is 16.0.74');
assert(appCore.includes("CURRENT_VERSION = '16.0.74'"), 'appCore CURRENT_VERSION is 16.0.74');
assert(apiVersion.includes("APP_VERSION = '16.0.74'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.74'"), 'API version constants are 16.0.74');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-74.js', 'test:source points at 16.0.74 validator');
assert(!pkg.jest?.coverageThreshold, 'Jest unit run no longer fails before writing coverage artifacts due impossible global thresholds');
assert(manifest.icons.some(i => i.src === 'app-icon-192.png' && i.sizes === '192x192'), 'manifest includes truthful 192x192 icon');
assert(manifest.icons.some(i => i.src === 'app-icon-512.png' && i.sizes === '512x512'), 'manifest includes truthful 512x512 icon');
assert(manifest.icons.some(i => i.src === 'app-icon-maskable-512.png' && i.sizes === '512x512' && /maskable/.test(i.purpose || '')), 'manifest includes truthful maskable 512x512 icon');
assert(indexHtml.includes('apple-touch-icon') && indexHtml.includes('app-icon-192.png'), 'index.html includes iOS apple-touch-icon link');
assert(management.indexOf('const PROTECTED_ROOT_ADMIN_EMAIL') < management.indexOf('const TabTeam'), 'protected root admin constants are top-level');
assert(!/const TabTimeOff[\s\S]*setLocalBuilderDeletedShiftMarkers/.test(schedule), 'TabTimeOff does not reference Schedule Builder delete marker state');
assert(setupTests.startsWith('/* global globalThis, jest */'), 'setupTests declares Jest/globalThis globals for lint');
assert(sourceInventory.includes("require.resolve('@babel/parser', { paths: [root] })"), 'source inventory resolves Babel parser from current app root');
assert(sourceInventory.includes("require.resolve('@babel/traverse', { paths: [root] })"), 'source inventory resolves Babel traverse from current app root');
assert(verifyRoles.includes('buildFirebaseAuthRequestHeaders') && verifyRoles.includes('buildFirebaseAuthFetchOptions') && verifyRoles.includes('Referer') && verifyRoles.includes('Origin') && verifyRoles.includes('referrerPolicy'), 'role verifier sends safe app referrer/origin fetch metadata for restricted Firebase Auth API key');
assert(coverageGate.includes("'CHAOS_MIN_JEST_LINES', 0") && coverageGate.includes("boolEnv('CHAOS_REQUIRE_EVERY_SOURCE_FILE_COVERED')") && !coverageGate.includes("|| !process.env.CHAOS_REQUIRE_EVERY_SOURCE_FILE_COVERED"), 'Jest coverage gate requires an artifact by default without impossible whole-app thresholds');



assert(schedule.includes('const myMonthBounds = getScheduleMonthBoundsForKey(monthStr);'), 'My Schedule uses selected calendar month bounds for the employee-facing published list');
assert(schedule.includes('No published shifts found for this month.'), 'My Schedule empty state uses selected-month wording');
assert(schedule.includes('mergeSchedulePublishCandidates'), 'schedule publish merges live, visible, autofill, and local echo candidates before publishing');
assert(schedule.includes('Promise.allSettled(unpub.map'), 'selected schedule publishing attempts every selected shift and reports partial failures');
assert(schedule.includes("published: true") && schedule.includes("publishStatus: 'published'") && schedule.includes("scheduleDateKey"), 'schedule publish writes full legacy-compatible published fields');
assert(schedule.includes('localBuilderPublishedShiftIds'), 'schedule builder locally marks published shifts immediately after successful partial publishing');
assert(schedule.includes('fetchSchedulePublishCandidatesForDaySet'), 'partial publish refreshes selected-day candidates from Firestore before writing');
assert(schedule.includes("where('scheduleDateKey', '==', day)"), 'partial publish checks scheduleDateKey-only shift records as well as date records');
assert(schedule.includes('dedupeScheduleShiftsByDatePersonTime((shifts || [])'), 'My Published Schedule dedupes duplicate same-person/date/time records');
assert(schedule.includes('sourceRecordTime: getShiftRecordTimeMs(shift)'), 'deleted-shift tombstones remember source record timing');
assert(schedule.includes('shiftTime <= markerTime + 1000'), 'deleted-shift fingerprint tombstones do not hide newly re-added shifts');

assert(schedule.includes('const isScheduleShiftPublished = (shift = {})'), 'schedule has flexible published-shift detector for restored/partial-published records');
assert(schedule.includes('membershipId, person.workspaceMemberId'), 'schedule person identity includes workspace membership IDs so real employees match shifts ghost mode can see');
assert(schedule.includes('const isMyPublishedUpcomingShift = (shift) => isMyPublishedShift(shift) && isShiftStillCurrentOrUpcoming(shift, scheduleNow)'), 'My Schedule uses flexible published detection for employee-facing shifts');
assert(management.includes('const [globalLogoutBusy, setGlobalLogoutBusy] = useState(false);'), 'System Administrator has global logout busy state in active console');
assert(management.includes('const handleGlobalLogoutNonAdmins = async () =>'), 'active System Administrator console exposes Global Logout Non-Admins handler');
assert(management.includes('Global Logout Non-Admins'), 'System Administrator shows Global Logout Non-Admins action');
const adminGlobalOperation = read('api/admin-global-operation.js');
assert(adminGlobalOperation.includes("action === 'logoutNonAdmins'"), 'admin global operation API supports logoutNonAdmins');
assert(adminGlobalOperation.includes('isProtectedRootAdminEmail'), 'global logout API skips protected root administrator');


const app = read('src/App.js');
assert(app.includes('hasCurrentLoginAlreadyHonoredForceLogout'), 'App has one-shot force logout guard so staff are not trapped after logging back in');
assert(app.includes('forceLogoutClearMode'), 'App attempts to clear stale forceLogout flags without requiring the user to have server write permission');
assert(app.includes('Your session was signed out by a System Administrator. Please log in again.'), 'Force logout user message is plain English');
assert(management.includes('forceLogoutAt: new Date().toISOString()'), 'Individual force logout actions write forceLogoutAt so one-shot sessions can be distinguished');


assert(app.includes('maybeApplyRemoteRefreshSignal'), 'App handles remote refresh signals centrally');
assert(app.includes('REMOTE_REFRESH_RECENT_SIGNAL_MS'), 'App refreshes clients that first see a recent global refresh signal');
assert(app.includes('forceRefreshAt') && app.includes('clientRefreshAt') && app.includes('globalRefreshAt'), 'App listens for user/workspace refresh signal fields');
assert(!app.includes('if (localRefresh)'), 'Global refresh does not require an old local baseline before reloading');
assert(app.includes('shouldHonorForceLogoutNow'), 'App checks whether a force logout is current before signing out');
assert(adminGlobalOperation.includes('async function pageUsers'), 'Global operation API can page user documents');
assert(adminGlobalOperation.includes('usersAffected'), 'Global refresh reports user profile refresh signals');
assert(adminGlobalOperation.includes('clientRefreshAt: now'), 'Global refresh writes user-level refresh signals');
assert(adminGlobalOperation.includes('forceLogoutNonce: idempotencyKey'), 'Global logout writes nonce-backed one-shot logout events');

if (!process.exitCode) console.log('16.0.74 source validator passed.');

assert(schedule.indexOf('const activeLocalDeleteKeySet') < schedule.indexOf('const isMyPublishedShift'), 'My Schedule published-shift filter is declared after local delete-marker state is initialized');
