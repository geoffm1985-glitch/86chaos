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
const operations = read('src/features/operations.jsx');
const featureAccess = read('src/lib/featureAccess.js');
const app = read('src/App.js');
const rules = read('firestore.rules');
const storageRules = read('storage.rules');
const pushRepair = read('api/push-token-repair.js');
const psRunner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
const localChecks = read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
const maturityGuards = read('src/core/maturityGuards.js');
const maturityGuardsTest = read('src/core/maturityGuards.test.js');

assert(pkg.version === '16.0.132', 'package.json version is 16.0.132');
assert(lock.version === '16.0.132' && lock.packages?.['']?.version === '16.0.132', 'package-lock root versions are 16.0.132');
assert(version.version === '16.0.132' && version.build === '16.0.132', 'public/version.json version/build are 16.0.132');
assert(appCore.includes("CURRENT_VERSION = '16.0.132'"), 'app core CURRENT_VERSION is 16.0.132');
assert(apiVersion.includes("APP_VERSION = '16.0.132'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.132'"), 'api version reports 16.0.132');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-132.js', 'test:source points at the 16.0.132 validator');
assert(!fs.existsSync(path.join(root, 'scripts/validate-16-0-131.js')), 'previous 16.0.131 validator was replaced');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'working Firestore rules are preserved byte-for-byte for this app-only maturity pass');
assert(sha('storage.rules') === 'efe2abb95c6227767927f51eca64984661686b65574957433ee14d7911fce5d3', 'Storage rules are preserved byte-for-byte for this app-only maturity pass');
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
assert(reminders.includes("['participantUserIds', 'array-contains'") && reminders.includes("['userId', '=='") && reminders.includes("['assignedToUserId', '=='") && reminders.includes("['createdBy', '=='"), 'reminder query helper covers canonical and legacy UID-scoped queries without broad fallback');
assert(intelligence.includes('usePersonalReminderRows'), 'personal reminders feature reuses the shared reminder-query boundary');

assert(featureAccess.includes('canViewRestaurantOpsIntelligence') && featureAccess.includes('userHasRestaurantLeadershipAuthority'), 'ops intelligence frontend access uses one leadership-aware selector');
assert(operations.includes('canViewRestaurantOpsIntelligence') && operations.includes('useLiveDocument(\'opsIntelligenceReports\'') && operations.includes('canUsePythonIntelligence'), 'ops intelligence listener is gated before it starts');

assert(app.includes('validLabelledByText') && app.includes('hasExplicitName') && app.includes('if (!hasExplicitName && normalized)'), 'global control normalizer preserves explicit accessible names');
assert(app.includes('data-chaos-control-kind') && app.includes('data-chaos-workflow-id'), 'controls receive stable nonvisual semantics for the release census');
assert(app.includes('data-chaos-recovery-state="manual-update-available"'), 'chunk recovery exposes stable manual recovery state');
assert(!app.includes("return 'Open 86 Voice Assistant';"), 'voice labels are no longer forcibly rewritten to a generic Open label');

assert(read('src/styles.css').includes('min-width: 42px') && read('src/styles.css').includes('min-height: 42px'), 'mobile schedule shift chips expose 42px tap targets');
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
assert(localChecks.includes('node-test-live-summary.json') && localChecks.includes('run-rules-release-gate.cjs'), 'node-test-live-summary is produced from real local/source/build/rules checks');
assert(localChecks.includes('firebase emulators:exec --only firestore,storage') && localChecks.includes('node scripts/86chaos-release-gate/run-rules-release-gate.cjs'), 'release-gate rules readiness check runs inside Firebase emulator discovery instead of bare rules-unit-testing');
assert(/metadata\\\.get\\\('purpose', ''\\\) == 'document-vault'/.test(read('api/app-route-and-document-vault.test.cjs')) && /metadata\\\.get\\\('restaurantId', ''\\\) == restaurantId/.test(read('api/app-route-and-document-vault.test.cjs')), 'Document Vault server assertion matches supplied safe metadata.get Storage rules');
assert(collector.includes('releaseReadiness') && collector.includes('firstActionableBlocker'), 'collector emits compact release-readiness summary and first blocker');

assert(read('tests/86chaos-full-audit/02-permission-role-security.spec.cjs').includes('visibleProtectedControls') && !read('tests/86chaos-full-audit/02-permission-role-security.spec.cjs').includes('const leaks = checked.filter(x => x.forbidden || x.actions)'), 'staff permission test no longer fails on raw body text phrases');
assert(read('tests/86chaos-full-audit/05-schedule-builder-mutation.spec.cjs').includes('getByRole(\'row\'') && read('tests/86chaos-full-audit/05-schedule-builder-mutation.spec.cjs').includes('Schedule Builder context'), 'schedule visibility test uses semantic Schedule Builder locators');
assert(read('tests/86chaos-release-gate/15-interactive-control-census.spec.cjs').includes('controlKind') && read('tests/86chaos-release-gate/15-interactive-control-census.spec.cjs').includes('workflowId'), 'control census prefers stable metadata over wording guesses');


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
assert(rulesRunner.includes("const { doc, setDoc, updateDoc, deleteDoc, deleteField"), 'rules tests use Firestore deleteField behavior for protected field removal');


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

if (failures) process.exit(1);
