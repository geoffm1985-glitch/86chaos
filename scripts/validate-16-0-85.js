const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.85 source validation failed: ${message}`);
    process.exitCode = 1;
  }
};

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const schedule = read('src/features/schedule.jsx');
const app = read('src/App.js');
const management = read('src/features/management.jsx');
const deleteUserApi = read('api/delete-user.js');
const deleteUserLogic = read('api/_delete-user-cleanup-logic.cjs');
const deleteUserTest = read('api/delete-user.test.cjs');
const pushRepairApi = read('api/push-token-repair.js');
const pushRepairLogic = read('api/_push-token-self-repair-logic.cjs');
const pushRepairTest = read('api/push-token-self-repair.test.cjs');

assert(pkg.version === '16.0.85', 'package.json version is 16.0.85');
assert(lock.version === '16.0.85' && lock.packages?.['']?.version === '16.0.85', 'package-lock root version is 16.0.85');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-85.js', 'test:source points at 16.0.85 validator');
assert(version.version === '16.0.85' && version.build === '16.0.85', 'public version/build is 16.0.85');
assert(appCore.includes("CURRENT_VERSION = '16.0.85'"), 'appCore CURRENT_VERSION is 16.0.85');
assert(apiVersion.includes("APP_VERSION = '16.0.85'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.85'"), 'API version constants are 16.0.85');

// Schedule Builder deleted-shift permanence checks.
assert(schedule.includes('getScheduleShiftLogicalDeleteIdentity'), 'Schedule Builder defines a logical delete identity helper');
assert(schedule.includes('scheduleShiftMatchesLogicalDeleteIdentity'), 'Schedule Builder matches delete targets by logical shift identity');
assert(schedule.includes("where('date', '==', dateKey)") && schedule.includes("where('scheduleDateKey', '==', dateKey)"), 'delete target lookup searches both date and scheduleDateKey records');
assert(schedule.includes('shiftMatchesPerson(candidate, identity.person, users)'), 'logical delete matching uses roster-aware identity resolution');
assert(schedule.includes('candidateStart !== identity.start || candidateEnd !== identity.end'), 'logical delete matching keeps separate same-day shifts with different times untouched');
assert(schedule.includes('remainingActiveMatches') && schedule.includes('active duplicate still exists'), 'Schedule Builder verifies no active matching duplicate remains before success');
assert(schedule.includes("scope: 'single-shift-logical-group'"), 'single visible chip deletes/tombstones one logical shift group');
assert(schedule.includes('shouldPruneDeletedLogicalShift') && schedule.includes('setAutoFillVisibleShifts(prev => prev.filter(item => !shouldPruneDeletedLogicalShift(item)))'), 'deleted logical shifts are pruned from local echoes and Auto-Fill state');
assert(!schedule.includes('const targetFingerprint = buildShiftFingerprint(shift);'), 'specific shift delete no longer relies on role-sensitive buildShiftFingerprint');
assert(!schedule.includes('buildShiftFingerprint(candidate) === targetFingerprint'), 'specific shift delete no longer requires duplicate Firestore records to share role/durable identity fingerprint');
assert(schedule.includes('shiftTime <= markerTime;'), 'local delete marker does not hide a newly recreated shift created after the deletion marker');

// Global employee deletion membership cleanup checks.
assert(deleteUserApi.includes("require('./_delete-user-cleanup-logic.cjs')"), 'delete-user API uses shared cleanup identity helpers');
assert(deleteUserApi.includes('cleanupTargetWorkspaceMemberships'), 'delete-user API cleans up active workspace memberships');
assert(deleteUserApi.includes('collectTargetWorkspaceMembershipDocs'), 'delete-user API finds target workspaceMembers records');
assert(deleteUserApi.includes("['userId', 'uid', 'authUid', 'accountUserId']"), 'delete-user API searches canonical and legacy membership identity fields');
assert(deleteUserApi.includes('membershipsActiveRemaining') && deleteUserApi.includes('activeRemaining: 0'), 'delete-user API reports and verifies active membership cleanup counts');
assert(deleteUserApi.includes('if (activeRemaining.length)'), 'delete-user API refuses success when active memberships remain');
assert(deleteUserApi.indexOf('cleanupTargetWorkspaceMemberships') < deleteUserApi.indexOf('deleteUser(targetUid)'), 'memberships are cleaned before the Auth account deletion success is returned');
assert(deleteUserLogic.includes('function isActiveWorkspaceMembership') && deleteUserLogic.includes("['deleted', 'removed', 'inactive', 'disabled', 'deactivated']"), 'cleanup logic treats tombstoned membership records as inactive');
assert(deleteUserLogic.includes('membershipMatchesTargetIdentity') && deleteUserLogic.includes('canonicalMembershipDocId'), 'cleanup logic matches canonical membership document IDs and legacy identity fields');
assert(deleteUserTest.includes('workspace membership identity matching supports canonical and legacy fields'), 'regression test covers canonical and legacy membership identity matching');
assert(deleteUserTest.includes('tombstoned memberships are not active roster sources'), 'regression test covers tombstoned membership exclusion');

// Client-side roster reconstruction checks.
assert(app.includes('workspaceMemberIsActive') && app.includes('.filter(m => workspaceMemberIsActive(m))'), 'App displayUsers excludes inactive/deleted workspaceMembers so orphaned memberships cannot rebuild roster users');
assert(management.includes('markStaffLocallyRemoved(u)'), 'Staff Roster removes deleted employees immediately while listeners catch up');
assert(management.includes('membershipsActiveRemaining') && management.includes('active roster memberships'), 'client success messages depend on verified membership cleanup');
assert(!management.includes('await deleteDoc(doc(db, "users", u.id));') && !management.includes("await deleteDoc(doc(db, 'users', u.id));"), 'management UI preserves 16.0.83 fix and does not perform forbidden client-side users delete');


// Runtime chunk recovery / System Administrator route recovery checks.
assert(app.includes('isFirebaseMessagingServiceWorkerRegistration'), 'runtime recovery can identify and preserve the Firebase messaging service worker');
assert(app.includes("preserveRecoveryMarkers: true"), 'automatic lazy chunk recovery preserves retry markers through the first reload');
assert(app.includes('clearChunkRecoveryMarkers()') && app.includes('removeRuntimeRecoveryQueryParams()'), 'chunk recovery markers and temporary query params are cleared only after a successful startup');
assert(app.includes("url.searchParams.set('chaosReloadVersion', CURRENT_VERSION)") && app.includes("url.searchParams.set('chaosReloadAt'"), 'chunk recovery performs one controlled full-page reload without losing the requested tab');
assert(app.includes("requestedTab === 'godmode'") && app.includes('serverSaysSuperAdmin'), 'System Administrator recovery waits for verified admin access before clearing recovery state');
assert(!app.includes('regs.map(reg => reg.unregister?.())'), 'general runtime recovery no longer unregisters every service worker');
assert(!app.includes("includes('firebase-messaging-sw')).map(reg => reg.unregister"), 'push refresh no longer unregisters the messaging service worker');

// Schedule post-delete verification checks.
assert(schedule.includes('getDocsFromServer'), 'post-delete schedule verification can force a server-authoritative Firestore read');
assert(schedule.includes('seedVisibleCandidates: false') && schedule.includes('serverOnly: true'), 'post-delete verification does not seed the original local visible shift');
assert(schedule.includes('verifySavedScheduleBuilderDeleteScopeCleared'), 'Schedule Builder has a dedicated post-delete server verification helper');
assert(schedule.includes("scope: 'single-shift-post-delete-duplicate-cleanup'"), 'real hidden duplicates found after delete are tombstoned/deleted once and reverified');
assert(schedule.includes('remainingActiveMatches = await verifySavedScheduleBuilderDeleteScopeCleared'), 'remaining active duplicate verification is server-based');

// Push self-repair checks.
assert(app.includes('directAccountUser?.id ||') && app.indexOf('directAccountUser?.id ||') < app.indexOf('auth.currentUser?.uid ||'), 'push repair prefers the loaded Firestore profileDocId before Auth UID');
assert(app.includes("secureFetch('/api/push-token-repair'") && app.includes("action: 'self-repair'"), 'client falls back to secured push self-repair API when direct write is blocked');
assert(app.includes('getPushRepairRequestId') && !app.includes("liveAppUser?.lastPushFailureCode || '',\n      liveAppUser?.pushRepairStatus || ''"), 'push repair dismissal is keyed to a stable repair request instead of changing status/error text');
assert(pushRepairApi.includes("action === 'self-repair'"), 'push-token-repair API supports secured self-repair');
assert(pushRepairApi.includes('verifyRequestToken') && pushRepairApi.includes('profileMatchesDecoded'), 'push self-repair verifies the Firebase ID token and matches the caller profile');
assert(pushRepairLogic.includes('sanitizeSelfRepairPatch') && pushRepairLogic.includes('EXACT_ALLOWED_PUSH_FIELDS'), 'push self-repair only allows limited token/device fields');
assert(pushRepairTest.includes('rejects another user profile') && pushRepairTest.includes('allows only push token and device fields'), 'push self-repair regression tests cover cross-account blocking and allowed fields');

if (!process.exitCode) console.log('16.0.85 source validator passed.');
