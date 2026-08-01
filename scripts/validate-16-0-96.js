const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.96 source validation failed: ${message}`);
    process.exitCode = 1;
  }
};

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const app = read('src/App.js');
const runtimeState = read('src/core/runtimeReportState.cjs');
const common = read('src/components/common.jsx');
const intelligence = read('src/features/intelligence.jsx');
const featureAccess = read('src/lib/featureAccess.js');
const authFeature = read('src/features/auth.jsx');
const preflight = read('scripts/86chaos-release-gate/preflight-env.cjs');
const workspaceHelper = read('scripts/86chaos-release-gate/qa-workspace.cjs');
const safetyHelper = read('scripts/86chaos-release-gate/mutation-safety.cjs');
const seed = read('scripts/86chaos-full-audit/seed-fake-restaurant.cjs');
const cleanup = read('scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');
const provision = read('scripts/86chaos-release-gate/provision-test-accounts.cjs');
const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
const auditHelpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');

assert(pkg.version === '16.0.96', 'package.json version is 16.0.96');
assert(lock.version === '16.0.96' && lock.packages?.['']?.version === '16.0.96', 'package-lock root version is 16.0.96');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-96.js', 'test:source points at 16.0.96 validator');
assert(version.version === '16.0.96' && version.build === '16.0.96', 'public version/build is 16.0.96');
assert(!/16\.0\.89 Admin Push Release Gate Fix/.test(JSON.stringify(version)), 'public version metadata does not restore stale 16.0.89 labels');
assert(appCore.includes("CURRENT_VERSION = '16.0.96'"), 'appCore CURRENT_VERSION is 16.0.96');
assert(apiVersion.includes("APP_VERSION = '16.0.96'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.96'"), 'API version constants are 16.0.96');

assert(workspaceHelper.includes('QA_WORKSPACE_PREFIX') && workspaceHelper.includes('86 Chaos Release Gate QA '), 'QA workspace helper defines the unique run-name prefix');
assert(preflight.includes('validateQaWorkspaceName') && !preflight.includes('must be exactly "86 Chaos Full Audit QA Restaurant"'), 'preflight validates current-run QA workspace names instead of obsolete fixed name');
assert(preflight.includes('assertMutationSafety'), 'preflight uses shared mutation safety guard');
assert(seed.includes('applyQaWorkspaceEnv') && seed.includes('mergeSetupState') && seed.includes('writesStarted: true'), 'seed derives one workspace name and records writesStarted immediately');
assert(cleanup.includes('resolveQaWorkspaceName') && cleanup.includes('validateSeedForCleanup(seed, RUN_ID, setupState') && cleanup.includes('writesStarted'), 'cleanup supports unique and partial current-run workspaces');
assert(cleanup.includes('qaOwned') && cleanup.includes('qaRunId') && cleanup.includes('restaurantId'), 'cleanup queries current-run QA ownership markers');
assert(provision.includes('assertMutationSafety'), 'provisioner uses shared mutation safety guard before account mutation');
assert(safetyHelper.includes('app.86chaos.com') && safetyHelper.includes('www.86chaos.com') && safetyHelper.includes('cheers-34b8d'), 'mutation safety helper explicitly refuses production hosts/projects');
assert(collector.includes('expectedSkippedArtifacts') && collector.includes('test-account-provisioning'), 'collector preserves blocked-before-test expected-skipped artifact reporting');

assert(runtimeState.includes('DEFAULT_IN_FLIGHT_STALE_MS') && runtimeState.includes('isInFlightMarkerStale') && runtimeState.includes('atMs'), 'runtime report in-flight markers have timestamps and stale expiry');
assert(app.includes('finally {\n    if (timer) clearTimeout(timer);'), 'runtime report request timer is cleared in finalization');
assert(app.includes('beginReportSubmission(storage, fingerprint, { fallbackReportId })'), 'runtime reporting preserves fallback ID relationship for in-flight markers');

assert(common.includes('activeRecognitionRef') && common.includes('pendingVoiceStartTimerRef') && common.includes('closeDock'), '86Voice stores active recognition and delayed start in refs');
assert(common.includes('aria-label={open ? \'Close 86Voice\' : \'Open 86Voice\'}') && common.includes('aria-label={listening ? \'Stop listening\' : \'Start listening\'}'), '86Voice controls expose stable accessible labels');
assert(common.includes('const VoiceCommandDock = VoiceCommandDockBase;'), '86Voice no longer uses the unsafe stale-props custom comparator');
assert(intelligence.includes('reminderRecognitionRef') && intelligence.includes('stopReminderRecognition') && intelligence.includes('Speak Reminder'), 'Speak Reminder uses a guarded recognition lifecycle');

assert(featureAccess.includes('isVerifiedPlatformAdminUser') && !featureAccess.includes("lower(user?.role) === 'system administrator'") && !featureAccess.includes('user?.masterAdmin === true'), 'feature access no longer grants master admin from role text/client masterAdmin flag');
assert(!authFeature.includes('id: firebaseUser.uid,\n        ...bootstrapResult.bootstrap.user,\n        id: firebaseUser.uid'), 'auth bootstrap no longer declares duplicate id property around server bootstrap user');
assert(auditHelpers.includes("{ tab: 'ops'") && !auditHelpers.includes("{ tab: 'kitchen'"), 'route registry uses real ops route instead of stale kitchen route');

console.log('All 16.0.96 source validations passed.');
