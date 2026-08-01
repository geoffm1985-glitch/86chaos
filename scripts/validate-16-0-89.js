const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.89 source validation failed: ${message}`);
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
const runtimeClassifierTest = read('api/runtime-recovery-classifier.test.cjs');
const runnerObservable = read('scripts/86chaos-release-gate/run-observable-command.cjs');
const runnerPs1 = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
const releaseGateRunnerTest = read('api/release-gate-runner-observability.test.cjs');

assert(pkg.version === '16.0.89', 'package.json version is 16.0.89');
assert(lock.version === '16.0.89' && lock.packages?.['']?.version === '16.0.89', 'package-lock root version is 16.0.89');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-89.js', 'test:source points at 16.0.89 validator');
assert(version.version === '16.0.89' && version.build === '16.0.89', 'public version/build is 16.0.89');
assert(appCore.includes("CURRENT_VERSION = '16.0.89'"), 'appCore CURRENT_VERSION is 16.0.89');
assert(apiVersion.includes("APP_VERSION = '16.0.89'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.89'"), 'API version constants are 16.0.89');

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

assert(app.includes('CHUNK_LOAD_ERROR_MESSAGE_RE') && app.includes('getChunkFailureSignalText'), 'chunk classifier uses explicit error name/message signals');
assert(!/const isChunkLoadFailure[\s\S]{0,260}stack/.test(app), 'chunk classifier does not classify by stack file URLs');
assert(runtimeClassifierTest.includes('normal TypeError stack containing /static/js') && runtimeClassifierTest.includes('genuine ChunkLoadError'), 'runtime classifier regression tests cover TypeError stacks and genuine chunk failures');
assert(app.includes('reportRuntimeSectionError') && app.includes('react_section_runtime_error'), 'normal React runtime errors are reported separately from stale chunk failures');
assert(app.includes('Retry This Section'), 'normal runtime error recovery retries the section instead of clearing app caches');

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

assert(!app.includes('liveAppUser?.lastPushFailureCode ||\n'), 'push repair request identity no longer uses changing failure code fields');
assert(!app.includes('liveAppUser?.pushRepairRequestedAt ||\n') && !app.includes('liveAppUser?.pushRepairFlaggedAt ||\n'), 'push repair request identity no longer uses changing repair timestamps');
assert(pushRepairTest.includes('legacy push repair request identity is stable when failure details change'), 'push repair tests prove failure/status changes do not create a new dismissal identity');
assert(pushRepairApi.includes('verifiedProfileDocId') && pushRepairApi.includes('verifySelfRepairReadback'), 'secured self-repair verifies profile update and repaired readback before returning success');
assert(pushRepairApi.includes('existingNonce') && pushRepairApi.includes('existingTarget.pushTokenRepairNonce'), 'admin repair request payload preserves the active request nonce while the same repair remains open');

// Release-gate runner observability checks.
assert(runnerObservable.includes('STILL RUNNING') && runnerObservable.includes('TIMED OUT') && runnerObservable.includes('FINISHED'), 'observable dependency installer prints heartbeat, timeout, and completion lines');
assert(runnerObservable.includes('normalizeSpawnCommand') && runnerObservable.includes('shell: false'), 'observable dependency installer spawns without shell:true so Windows paths with spaces are preserved');
assert(!runnerObservable.includes("shell: process.platform === 'win32'"), 'observable dependency installer does not use Windows shell mode that splits C:\Program Files paths');
assert(runnerObservable.includes('resolveNpmCli') && runnerObservable.includes('process.execPath') && runnerObservable.includes("process.env.ComSpec || 'cmd.exe'"), 'observable dependency installer runs npm through npm CLI and reserves cmd.exe for non-npm .cmd/.bat files');
assert(runnerPs1.includes('run-observable-command.cjs') && runnerPs1.includes('--timeout 1800'), 'release gate uses observable 30-minute dependency install wrapper');
assert(runnerPs1.includes('.current-run.lock') && runnerPs1.includes('another release-gate run is already active'), 'release gate prevents overlapping runs with a current-run lock');
assert(collector.includes('BLOCKED BEFORE TEST EXECUTION') && collector.includes('dependencyInstallIncomplete'), 'collector labels zero-test incomplete installs as blocked before test execution');
assert(releaseGateRunnerTest.includes('observable command times out') && releaseGateRunnerTest.includes('PowerShell runner uses observable dependency install'), 'release gate observability tests cover success, timeout, and runner wiring');


// 16.0.89 System Administrator / push / Windows release-gate repairs.
const adminSafety = read('src/core/systemAdminDataSafety.cjs');
assert(adminSafety.includes('normalizeTierPriceMap') && adminSafety.includes('adminSafeText'), 'System Administrator data boundary normalizes malformed live data and safe text');
assert(management.includes('normalizeTierPriceMap(raw, defaultTierPrices)'), 'System Administrator pricing doc listener keeps defaults for missing/malformed pricing');
assert(management.includes('normalizeCrashReport') && management.includes('normalizeAuditLog') && management.includes('normalizeRestaurantRecord'), 'System Administrator live collections normalize crash/audit/restaurant records before rendering');
assert(management.includes('React.isValidElement(cell) ? cell : adminSafeText(cell'), 'System Administrator tables do not render raw Firestore objects as React children');
assert(app.includes('componentDidUpdate(prevProps)') && app.includes('resetKey') && app.includes('retrySection'), 'section error boundary resets and remounts route sections on retry/reset keys');
assert(app.includes('pushRepairLinkRequest') && app.includes('window.history.replaceState') && app.includes("['pushRepair', 'pushRepairNonce', 'repairNonce']"), 'push repair link params are consumed once and removed from the URL');
assert(app.includes('getAuthenticatedPushUserId') && app.includes('getPushRepairAutoAttemptKey'), 'push repair dismissal and auto attempts use stable auth/device/request identity');
assert(!app.includes('pushRepairRequested && !pushRepairRequestedByLink'), 'repair links cannot bypass dismissal for the same request');
assert(pushRepairLogic.includes('context.authUid') && !pushRepairLogic.includes('const profileId = String(context.profileDocId'), 'legacy push repair request identity no longer depends on hydration-sensitive profileDocId');
assert(pushRepairLogic.includes('verifySelfRepairReadback'), 'secure self-repair verifies saved push state with server readback');
assert(pushRepairApi.includes('completedRepairRequestId') && pushRepairApi.includes('verifySelfRepairReadback'), 'push repair API returns completed repair identity and verifies readback before success');
assert(runnerObservable.includes('resolveNpmCli') && runnerObservable.includes('process.execPath') && runnerObservable.includes('NPM_VERSION'), 'observable command launches npm via npm CLI through node and logs npm metadata');
assert(runnerPs1.includes('Verify npm wrapper') && runnerPs1.includes('[Console]::OutputEncoding'), 'PowerShell release gate verifies npm wrapper and forces UTF-8 output');
assert(releaseGateRunnerTest.includes('npm --version') && releaseGateRunnerTest.includes('path with spaces'), 'release gate tests cover npm wrapper and Windows .cmd paths with spaces');

if (!process.exitCode) console.log('16.0.89 source validator passed.');
