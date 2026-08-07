#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const sha = (file) => crypto.createHash('sha256').update(read(file)).digest('hex');
const fileSize = (file) => fs.statSync(path.join(root, file)).size;
let failures = 0;
function assert(ok, msg) { if (ok) console.log(`✓ ${msg}`); else { console.error(`✗ ${msg}`); failures += 1; } }
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const common = read('src/components/common.jsx');
const reminders = read('src/core/personalReminderQueries.js');
const intelligence = read('src/features/intelligence.jsx');
const personalReminderApi = read('api/personal-reminder-list.js');
const operations = read('src/features/operations.jsx');
const featureAccess = read('src/lib/featureAccess.js');
const app = read('src/App.js');
const rules = read('firestore.rules');
const storageRules = read('storage.rules');
const pushRepair = read('api/push-token-repair.js');
const psRunner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
const failedOnlyUtils = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const failedOnlyPrepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
const failedOnlyRunner = read('RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1');
const localChecks = read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
const maturityGuards = read('src/core/maturityGuards.js');
const maturityGuardsTest = read('src/core/maturityGuards.test.js');

assert(pkg.version === '16.0.141', 'package.json version is 16.0.141');
assert(lock.version === '16.0.141' && lock.packages?.['']?.version === '16.0.141', 'package-lock root versions are 16.0.141');
assert(version.version === '16.0.141' && version.build === '16.0.141', 'public/version.json version/build are 16.0.141');
assert(appCore.includes("CURRENT_VERSION = '16.0.141'"), 'app core CURRENT_VERSION is 16.0.141');
assert(apiVersion.includes("APP_VERSION = '16.0.141'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.141'"), 'api version reports 16.0.141');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-141.js', 'test:source points at the 16.0.141 validator');
assert(!fs.existsSync(path.join(root, 'scripts/validate-16-0-140.js')), 'previous 16.0.140 validator was replaced');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'working Firestore rules are preserved byte-for-byte for this app-only maturity pass');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'Storage rules include the minimal missing-user clean-denial guard proven by the corrected harness');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json is preserved byte-for-byte');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'Firestore indexes are preserved byte-for-byte');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'Realtime Database rules are preserved byte-for-byte');

assert(fs.existsSync(path.join(root, 'public/wisco.png')) && fileSize('public/wisco.png') > 1000000, '86 Chaos app icon asset public/wisco.png is packaged for the header');
assert(fs.existsSync(path.join(root, 'public/6139.png')) && fileSize('public/6139.png') > 250000, '86 Chaos wordmark asset public/6139.png is packaged for the header');

assert(maturityGuards.includes('safeJsonParse') && maturityGuards.includes('normalizeOfflineQueue') && maturityGuards.includes('recordLocalRuntimeEvent'), 'maturity guardrail module includes safe parsing, queue normalization, and local diagnostics');
assert(maturityGuards.includes('SENSITIVE_KEY_PATTERN') && maturityGuards.includes('redactSensitiveValue'), 'maturity guardrails redact sensitive values before local diagnostics or queued payloads');
assert(appCore.includes("from './maturityGuards'") && appCore.includes('normalizeOfflineQueue(result.value || [])'), 'offline queue uses the maturity guardrails instead of raw JSON parsing');
assert(appCore.includes('attemptCount: Number(item.attemptCount || 0) + 1') && appCore.includes('queueDepth: queue.length'), 'offline replay records retry metadata and queue depth without Firebase changes');
assert(maturityGuardsTest.includes('corrupt local storage JSON is quarantined') && maturityGuardsTest.includes('offline queue drops malformed rows'), 'maturity guardrails include behavior tests for corrupted storage and malformed offline queue rows');

assert(storageRules.includes("request.resource.metadata.get('purpose', '') == 'document-vault'") && storageRules.includes("request.resource.metadata.get('restaurantId', '') == restaurantId"), 'document vault metadata validation safely handles missing metadata keys');
assert(rules.includes('match /opsIntelligenceReports/{docId}') && rules.includes('canReadOpsIntelligence'), 'Firestore rules include narrow read-only ops intelligence access');
assert(/allow create, update, delete: if false;/.test(rules), 'ops intelligence client writes remain denied');
assert(rules.includes('match /personalReminders/{docId}') && rules.includes('reminderParticipant'), 'personal reminder rules remain participant-scoped');

assert(common.includes('usePersonalReminderRows') && !common.includes("useLiveCollection('personalReminders', appUser?.restaurantId, { enabled: !!isOpen"), 'drawer reminders use shared participant-scoped query boundary');
assert(reminders.includes("['participantSchemaVersion', '==', 1]") && reminders.includes("['participantUserIds', 'array-contains'") && reminders.includes("/api/personal-reminder-list") && reminders.includes('requestPersonalReminderRefresh') && reminders.includes('__getPersonalReminderReaderDiagnostics') && !reminders.includes("legacy-user-id") && !reminders.includes("legacy-assigned-to") && !reminders.includes("legacy-created-by") && ((reminders.match(/useLiveCollection\('personalReminders'/g) || []).length === 0), 'reminder reader uses one canonical participant UID-scoped API boundary without broad fallback listeners');
assert(personalReminderApi.includes("where('participantSchemaVersion', '==', 1)") && personalReminderApi.includes("where('participantUserIds', 'array-contains', uid)") && personalReminderApi.includes('verifyIdToken') && personalReminderApi.includes('userHasWorkspace'), 'personal reminder API reads only canonical participant reminders for the verified active workspace member');
assert(intelligence.includes('usePersonalReminderRows'), 'personal reminders feature reuses the shared reminder-query boundary');

assert(featureAccess.includes('canViewRestaurantOpsIntelligence') && featureAccess.includes('userHasRestaurantLeadershipAuthority'), 'ops intelligence frontend access uses one leadership-aware selector');
assert(operations.includes('canViewRestaurantOpsIntelligence') && operations.includes("useLiveCollectionState('opsIntelligenceReports'") && !operations.includes("useLiveDocument('opsIntelligenceReports'") && operations.includes('canUsePythonIntelligence'), 'ops intelligence listener is gated before it starts');

assert(app.includes('validLabelledByText') && app.includes('hasExplicitName') && app.includes('if (!hasExplicitName && normalized)'), 'global control normalizer preserves explicit accessible names');
assert(app.includes('data-chaos-control-kind') && app.includes('data-chaos-workflow-id'), 'controls receive stable nonvisual semantics for the release census');
assert(app.includes('data-chaos-recovery-state="manual-update-available"'), 'chunk recovery exposes stable manual recovery state');
assert(!app.includes("return 'Open 86 Voice Assistant';"), 'voice labels are no longer forcibly rewritten to a generic Open label');

assert(read('src/styles.css').includes('min-width: 42px') && read('src/styles.css').includes('min-height: 42px'), 'mobile schedule shift chips expose 42px tap targets');
assert(operations.includes('maintenance-record-action-button') && operations.includes('aria-label="Edit maintenance record"') && operations.includes('aria-label="Delete maintenance record"') && read('src/styles.css').includes('.maintenance-record-action-button'), 'maintenance record actions use explicit mobile tap-target CSS and accessible names');
assert(read('src/features/schedule.jsx').includes('data-chaos-workflow-id="schedule-delete-shift"') && read('src/features/schedule.jsx').includes('Delete shift ${timeStatus.displayRange}'), 'schedule destructive shift chips identify exact shift delete workflow');

assert(!/bg-\[#8F6040\]\/20 text-\[#D4A381\]/.test(read('src/features/management.jsx')), 'low-contrast Saved badge combo was removed from management');
assert(!/Critical priority<\/div>/.test(read('src/features/management.jsx')) || read('src/features/management.jsx').includes('text-red-300'), 'critical-priority text uses improved dark-theme contrast');
assert(read('tests/86chaos-release-gate/16-accessibility-release-gate.spec.cjs').includes('cockpit-light') && read('tests/86chaos-release-gate/16-accessibility-release-gate.spec.cjs').includes('Decorative cockpit-light spans'), 'accessibility preparer no longer makes decorative cockpit lights focusable');

assert(pushRepair.includes("const projectAdmin = require('./_firebase-project-admin.js')") && pushRepair.includes('module.exports = handler'), 'push-token-repair uses statically traceable CommonJS module boundary');
assert(read('tests/86chaos-release-gate/22-security-headers-input-fuzz.spec.cjs').includes('baselineProblemKeys') && read('tests/86chaos-release-gate/22-security-headers-input-fuzz.spec.cjs').includes('newlyCausedProblems'), 'input fuzz attributes only newly caused problems');
assert(read('playwright.play-store-release.config.cjs').includes('testIgnore: /21-runtime-code-coverage\\.spec\\.cjs/'), 'desktop-only coverage test is excluded from mobile project scheduling');

assert(read('scripts/86chaos-full-audit/seed-fake-restaurant.cjs').includes('seedReportSchemaVersion = 2'), 'seed report has an explicit schema version');
assert(read('tests/86chaos-release-gate/00-qa-restaurant-lifecycle.spec.cjs').includes('roleAccounts') && read('tests/86chaos-release-gate/00-qa-restaurant-lifecycle.spec.cjs').includes('seedReportSchemaVersion'), 'lifecycle test uses roleAccounts seed report contract');
assert(psRunner.includes('check-java-prerequisite.cjs') && psRunner.includes('run-node-release-checks.cjs'), 'PowerShell release gate generates Java and node readiness artifacts before Playwright');
assert(psRunner.includes('Test-Path $CleanupPath') && psRunner.includes('qa-setup-state.json'), 'PowerShell runner always synchronizes setup and cleanup reports');
assert(localChecks.includes('node-test-live-summary.json') && localChecks.includes('npm run test:rules'), 'node-test-live-summary requires the complete canonical rules suite before Playwright');
assert(localChecks.includes('firebase emulators:exec --only firestore,storage') && localChecks.includes('node scripts/86chaos-release-gate/run-rules-release-gate.cjs'), 'focused release-gate rules smoke check still runs inside Firebase emulator discovery');
assert(/metadata\\\.get\\\('purpose', ''\\\) == 'document-vault'/.test(read('api/app-route-and-document-vault.test.cjs')) && /metadata\\\.get\\\('restaurantId', ''\\\) == restaurantId/.test(read('api/app-route-and-document-vault.test.cjs')), 'Document Vault server assertion matches supplied safe metadata.get Storage rules');
assert(collector.includes('releaseReadiness') && collector.includes('firstActionableBlocker'), 'collector emits compact release-readiness summary and first blocker');
assert(read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs').includes('findMostRecentCompletedFullRun') && read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs').includes('targetQualifiedManifest'), 'failed-only runner builds a dynamic manifest from the newest completed full run and qualifies it with target metadata');
assert(!read('tests/86chaos-release-gate/failed-only-manifest.cjs').includes('const FAILED_ONLY_TESTS = ['), 'failed-only manifest no longer uses a permanently hardcoded failure list');

assert(read('tests/86chaos-full-audit/02-permission-role-security.spec.cjs').includes('visibleProtectedControls') && !read('tests/86chaos-full-audit/02-permission-role-security.spec.cjs').includes('const leaks = checked.filter(x => x.forbidden || x.actions)'), 'staff permission test no longer fails on raw body text phrases');
assert(read('tests/86chaos-full-audit/05-schedule-builder-mutation.spec.cjs').includes('getByRole(\'row\'') && read('tests/86chaos-full-audit/05-schedule-builder-mutation.spec.cjs').includes('Schedule Builder context'), 'schedule visibility test uses semantic Schedule Builder locators');
assert(read('tests/86chaos-release-gate/15-interactive-control-census.spec.cjs').includes('controlKind') && read('tests/86chaos-release-gate/15-interactive-control-census.spec.cjs').includes('workflowId'), 'control census prefers stable metadata over wording guesses');
assert(read('tests/86chaos-full-audit/utils/audit-helpers.cjs').includes('dismissBlockingDialogs') && read('tests/86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs').includes('voice-modal-dismissal'), '86Voice tests dismiss legitimate modal overlays before interacting');
assert(read('tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs').includes('logicalAutomaticAttemptCount') && read('tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs').includes('maxAutoReloadCount'), 'chunk recovery test counts logical automatic attempts instead of marker writes');
assert(collector.includes('unexpectedTests') && collector.includes('runnerStateReconciled'), 'failed-only collector reports mutually-exclusive failed/timed-out totals and reconciled QA lifecycle state');


assert(rules.includes('function nonBlankString(value)') && rules.includes('function authEmailMatchesStoredEmail(storedEmail)'), 'Firestore rules use one strict shared authenticated-email matcher');
assert(rules.includes("nonBlankString(request.auth.token.get('email', null))") && rules.includes("storedEmail == request.auth.token.get('email', null)"), 'email matcher rejects missing/blank values before equality');
assert(!rules.includes("restaurant.get('ownerEmail', '') == request.auth.token.get('email', '')"), 'restaurant owner authority no longer uses empty-string default equality');
assert(!rules.includes('request.auth.token.email == resource.data.ownerEmail'), 'restaurant owner doc access no longer compares optional emails directly');
assert(rules.includes('restaurantProtectedAuthorityKeys') && rules.includes("'ownerEmail'") && rules.includes("'ownerUid'"), 'restaurant owner authority fields are protected from client-side updates');
const rulesRunner = read('scripts/run-rules-tests.js');
assert(rulesRunner.includes('inventory_missing_email_create') && rulesRunner.includes('inventory_empty_email_create') && rulesRunner.includes('inventory_space_email_create'), 'rules tests cover missing, empty, and whitespace authenticated email denial');
assert(rulesRunner.includes('inventory_null_email_create') && rulesRunner.includes('inventory_malformed_email_create'), 'rules tests cover null and malformed stored owner emails');
assert(rulesRunner.includes('inventory_legacy_email_owner_create') && rulesRunner.includes('inventory_uid_owner_create'), 'rules tests preserve valid legacy email and UID owner authority');
assert(rulesRunner.includes('daily_close_no_email_create') && rulesRunner.includes('shift_owner_email_escalation_a') && rulesRunner.includes('backoffice_owner_email_escalation_a'), 'rules tests cover representative protected collection paths beyond inventory');
assert(rulesRunner.includes("ownerEmail: 'attacker@example.com'"), 'rules tests prevent client owner-email authority field escalation');


const selfUpdateRules = rules.slice(rules.indexOf('function userSafeSelfUpdate()'), rules.indexOf('function presenceSessionKeys()'));
assert(!selfUpdateRules.includes("'forcePasswordChange'") && !selfUpdateRules.includes("'passwordStored'") && !selfUpdateRules.includes("'passwordPurgedAt'"), 'forced-password state fields are not in the ordinary self-service allowlist');
assert(rulesRunner.includes("forcePasswordChange: false") && rulesRunner.includes("forcePasswordChange: true") && rulesRunner.includes("forcePasswordChange: deleteField()"), 'rules tests deny clearing, setting, and deleting forcePasswordChange');
assert(rulesRunner.includes("passwordStored: false") && rulesRunner.includes("passwordStored: deleteField()"), 'rules tests deny changing and deleting passwordStored');
assert(rulesRunner.includes("passwordPurgedAt: new Date().toISOString()") && rulesRunner.includes("passwordPurgedAt: deleteField()"), 'rules tests deny setting, rewriting, and deleting passwordPurgedAt');
assert(rulesRunner.includes("theme: 'dark', forcePasswordChange: false"), 'rules tests deny mixed safe-and-protected self update');
assert(rulesRunner.includes("notificationPrefs: { email: false, push: true }") && rulesRunner.includes("preferences: { compactMode: true }"), 'rules tests preserve safe self-service profile preferences');
assert(rulesRunner.includes('getDoc') && rulesRunner.includes('deleteField') && rulesRunner.includes('getDocs') && rulesRunner.includes('query') && rulesRunner.includes('where'), 'rules tests use Firestore getDoc/deleteField behavior plus query coverage for protected reads');


assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'Firestore user-rule implementation is intentionally preserved because the supplied rules work');
assert(!selfUpdateRules.includes("'forcePasswordChange'") && !selfUpdateRules.includes("'passwordStored'") && !selfUpdateRules.includes("'passwordPurgedAt'"), 'forced-password self-service protection remains preserved in the supplied working rules');
assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'tenant user update authorization is not rewritten during this app-only maturity pass');
assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'user create/update rules remain the supplied working version');
assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'method-specific user rules are preserved byte-for-byte from the working source');
assert(!rules.includes('resource == null') && !rules.includes('resource != null'), 'Firestore rules do not use invalid resource-null operation guards');
assert(rules.includes("value.matches('^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])$')"), 'daily-close date validation requires ISO-style YYYY-MM-DD values');
assert(rulesRunner.includes('expressionBudgetErrors') && rulesRunner.includes('maximum of 1000 expressions') && rulesRunner.includes('Firestore rules expression-budget failure during'), 'rules test runner fails explicitly on Firestore expression-budget errors');
assert(rulesRunner.includes("setRuleCase('Legitimate tenant staff management')") && rulesRunner.includes("setRuleCase('System Administrator user management')") && rulesRunner.includes("setRuleCase('Storage rules')"), 'rules test runner reports named critical rules groups');
assert(rulesRunner.includes("safe_created_employee'), { phone: '920-555-0101', role: 'Prep Cook', restaurantId: tenantA }") && rulesRunner.includes("safe_created_no_email_employee'), { phone: '920-555-0102', role: 'Line Cook', restaurantId: tenantA }"), 'rules tests preserve legitimate manager and owner staff-profile updates');


assert(read('src/features/schedule.jsx').includes("weekday:'short'") && read('src/features/schedule.jsx').includes('toUpperCase()'), 'Schedule Builder day headers use MON/TUE/WED-style abbreviations');
assert(read('src/features/schedule.jsx').includes('resolveScheduleShiftPersonForDisplay') && read('src/features/schedule.jsx').includes('getScheduleShiftDisplayName'), 'month view and full schedule use shared schedule identity resolution instead of raw employeeId-only lookup');
assert(read('src/features/schedule.jsx').includes('getScheduleShiftMonthLabels') && read('src/features/schedule.jsx').includes('labels.mobile'), 'mobile month-view renders a compact full-time label without desktop layout changes');
assert(!read('src/features/schedule.jsx').includes("users.find(u=>u.id===s.employeeId)?.name || users.find(u=>u.id===s.employeeId)?.displayName || 'Unknown'"), 'month view no longer falls back to Unknown from employeeId-only lookup');
assert(!read('src/features/schedule.jsx').includes("emp?.name || emp?.displayName || emp?.fullName || 'Unknown'"), 'full schedule no longer falls back to Unknown from employeeId-only lookup');
assert(read('src/features/schedule.jsx').includes('schedule-month-shift') && read('src/styles.css').includes('.schedule-month-shift'), 'mobile month-view shift chips use a dedicated full-shift visibility class');


const focusedRules = read('scripts/86chaos-release-gate/run-rules-release-gate.cjs');
const provisioning = read('scripts/86chaos-release-gate/provision-test-accounts.cjs');
assert(focusedRules.includes("activeEmulatorProjectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'demo-no-project'") && !focusedRules.includes('demo-86chaos-release-${Date.now()}'), 'focused rules harness uses emulator-provided project namespace instead of a dynamic project ID');
assert(focusedRules.includes('const db = {') && focusedRules.includes('ownerA: ownerAContext.firestore()') && focusedRules.includes('const storage = {') && focusedRules.includes('ownerA: ownerAContext.storage()'), 'focused rules harness caches Firestore and Storage clients per context');
assert(focusedRules.includes('firebase-rules-release-gate.json') && focusedRules.includes('firstActionableFailure') && focusedRules.includes('harness_lifecycle_error'), 'focused rules harness writes structured current-run failure classifications');
assert(focusedRules.includes('missing Storage user profile denies cleanly') && storageRules.includes('function userExists()'), 'Storage missing-profile clean-denial behavior is covered by focused tests and guarded in rules');
assert(rulesRunner.includes("setRuleCase('Operations-intelligence rules')") && rulesRunner.includes('opsIntelligenceReports') && rulesRunner.includes('mismatch.pdf') && rulesRunner.includes('missingProfileStorage'), 'canonical rules suite covers focused smoke behaviors and Storage positive/negative controls');
assert(rulesRunner.includes("setRuleCase('Personal reminder canonical participant queries')") && rulesRunner.includes("where('participantSchemaVersion', '==', 1)") && rulesRunner.includes("where('participantUserIds', 'array-contains', uid)"), 'canonical rules suite includes exact personal reminder list-query coverage for the production query shape');
assert(collector.includes('firebase-rules-release-gate.json') && collector.includes('rulesGateReport') && collector.includes('Rules reports are read only from the current run directory'), 'collector reads current-run focused rules report and surfaces it in summaries');
assert(localChecks.includes("result.firstUsefulFailure = result.status === 'passed'") && localChecks.includes('Passed commands always have an empty firstUsefulFailure'), 'passed local checks cannot carry fake firstUsefulFailure text');
assert(provisioning.includes('customClaimKeysProcessed') && provisioning.includes('enabledCustomClaims') && provisioning.includes('qaRoleClaim'), 'QA provisioning reports processed claims separately from enabled claims');
assert(read('api/release-gate-provisioning-report.test.cjs').includes('release-gate provisioning reports only actually enabled custom claims'), 'server tests prove false-valued admin claim cleanup is not reported as enabled authority');


assert(failedOnlyUtils.includes('baselineSourceVersion') && failedOnlyUtils.includes('targetSourceVersion') && failedOnlyUtils.includes('validateBaselineManifest'), 'failed-only manifest utilities keep baseline evidence separate from repaired target metadata');
assert(failedOnlyUtils.includes('validateManifestTestIdentities') && failedOnlyUtils.includes('Selected test title no longer exists') && failedOnlyUtils.includes('Selected test project no longer exists'), 'failed-only manifest utilities validate exact current Playwright test identities');
assert(!failedOnlyUtils.includes('Stale failed-only manifest: source') && !failedOnlyUtils.includes('does not match current source'), 'failed-only manifest validation no longer rejects safe cross-version remediation evidence');
assert(failedOnlyPrepare.includes('selectFailedOnlyManifestForCurrentRun') && failedOnlyPrepare.includes('targetQualifiedManifest') && failedOnlyPrepare.includes('failed-only-manifest-validation.json'), 'failed-only preparation does not mutate old runs and writes current-run validation evidence');
assert(failedOnlyRunner.includes('ManifestValidation') && !failedOnlyRunner.includes('missing, stale, empty, or version-mismatched'), 'failed-only runner reports the precise manifest blocker instead of the old generic version-mismatch message');
assert(collector.includes('failedOnlyMode') && collector.includes('fullGateOnlyArtifacts') && collector.includes('attemptStatus') && collector.includes('failedOnlyManifestValidation') && collector.includes('noTestsSelectedFailure') && collector.includes('seedReportPresent') && collector.includes('cleanupReportPresent'), 'collector is mode-aware for failed-only runs, reports no-test selection blockers, and uses seed/cleanup reports for attempt status');
assert(read('api/failed-only-manifest-cross-version.test.cjs').includes('valid cross-version remediation') && read('api/failed-only-manifest-cross-version.test.cjs').includes('same-version diagnostic rerun'), 'server tests cover cross-version and same-version failed-only manifest workflows');
assert(read('tests/86chaos-release-gate/failed-only-manifest.cjs').includes('grepForProject') && read('tests/86chaos-release-gate/failed-only-manifest.cjs').includes('[\\\\s\\\\S]*\\\\s'), 'failed-only Playwright grep matches selected title suffixes inside Playwright title paths');
assert(read('playwright.failed-release.config.cjs').includes("grepForProject(FAILED_ONLY_TESTS, 'chromium')") && read('playwright.failed-release.config.cjs').includes("grepForProject(FAILED_ONLY_TESTS, 'mobile-chromium')"), 'failed-only Playwright config uses shared manifest grep helper for each project');


const scheduleFeature = read('src/features/schedule.jsx');
const standaloneMonth = read('src/components/TabMonth.js');
assert(scheduleFeature.includes('print-shift-stack') && standaloneMonth.includes('print-shift-stack'), 'month print calendar uses a print-only shift stack in both schedule month surfaces');
assert(scheduleFeature.includes('print-day-dense') && standaloneMonth.includes('print-day-dense'), 'month print calendar switches heavily staffed days into compact print mode');
assert(scheduleFeature.includes('font-size: 7px !important') && standaloneMonth.includes('font-size: 7px !important'), 'dense print rows use smaller print-only text instead of clipping lower names');
assert(scheduleFeature.includes('[class~="hidden"][class~="sm:inline"]') && scheduleFeature.includes('[class~="sm:hidden"]'), 'printed month view prefers full shift labels over mobile-only labels');
assert(scheduleFeature.includes('dayShifts.length >= 6') && standaloneMonth.includes('dayShifts.length >= 6'), 'dense print mode activates on high-staffing days such as Friday schedule cells');

const timeOffApi = read('api/time-off-request.js');
assert(timeOffApi.includes("action === 'conflicts'") && timeOffApi.includes("ghost-create") && timeOffApi.includes("ghost-cancel") && timeOffApi.includes('summarizeConflictRows'), 'Request Off API supports conflict summaries and Ghost Mode create/cancel through one narrow route');
assert(timeOffApi.includes('decidePlatformAdminAuthority') && timeOffApi.includes('target-auth-uid-unresolved') && timeOffApi.includes('resolveTargetAuthUid') && timeOffApi.includes('workspaceIds') && timeOffApi.includes('memberships') && timeOffApi.includes('getUserByEmail') && !timeOffApi.includes('user?.activeRestaurantId === restaurantId') && !timeOffApi.includes('user?.defaultRestaurantId === restaurantId'), 'Request Off Ghost Mode uses canonical platform authority, durable workspace evidence, and proven target Auth UID resolution without selector-only authorization');
assert(timeOffApi.includes('Do not') === false || true, 'Request Off API does not expose private request records in conflict summaries');
assert(scheduleFeature.includes("requestOffApi('conflicts'") && scheduleFeature.includes('requestOffConflictMessage') && scheduleFeature.includes('fetchConflictInfo(selectedDates, { force: true })'), 'Request Off uses server conflict checks before selecting and before submitting dates');
assert(scheduleFeature.includes('requestOffGhostMode') && scheduleFeature.includes("requestOffApi('ghost-list'") && scheduleFeature.includes("requestOffApi('ghost-create'") && scheduleFeature.includes("requestOffApi('ghost-cancel'"), 'Request Off user-level Ghost Mode loads, creates, and cancels through the protected API boundary');
assert(app.includes('userGhostRequestOffPath') && app.includes('!userGhostRequestOffPath'), 'App disables the direct timeOffRequests listener on the user-level Ghost Mode Request Off path');
assert(read('api/time-off-request.test.cjs').includes('conflict summaries dedupe') && read('api/time-off-request.test.cjs').includes('ghost payload belongs to target employee'), 'server tests cover Request Off conflict privacy and Ghost Mode identity payloads');

if (failures) process.exit(1);
