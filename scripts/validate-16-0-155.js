#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = process.cwd();
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); }
let failures = 0;
function assert(ok, message) { if (ok) console.log(`✓ ${message}`); else { console.error(`✗ ${message}`); failures += 1; } }

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const schedule = read('src/features/schedule.jsx');
const warningHelpers = read('src/core/scheduleWarningControls.cjs');
const failedRunner = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
const failedOnlyWrapper = read('RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1');
const failedUtils = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const prepareManifest = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
const repairScope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');
const failedConfig = read('playwright.failed-release.config.cjs');
const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
const helpKnowledge = read('src/core/customerHelpKnowledge.cjs');
const loginHelper = read('tests/e2e/utils/release-login-helper.cjs');
const ghostRequestOffSpec = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
const compactUiSpec = read('tests/e2e/compact-ui-layout.spec.cjs');
const styles = read('src/styles.css');

assert(pkg.version === '16.0.155', 'package.json version is 16.0.155');
assert(lock.version === '16.0.155' && lock.packages?.['']?.version === '16.0.155', 'package-lock root versions are 16.0.155');
assert(version.version === '16.0.155' && version.build === '16.0.155', 'public/version.json version/build are 16.0.155');
assert(version.releaseTitle === 'Workspace Targeting, Request Off Navigation, and Schedule Warning Runtime Repair', 'public/version.json release title is 16.0.155 release name');
assert(appCore.includes("CURRENT_VERSION = '16.0.155'"), 'app core CURRENT_VERSION is 16.0.155');
assert(apiVersion.includes("APP_VERSION = '16.0.155'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.155'"), 'api version reports 16.0.155');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-155.js', 'test:source points at 16.0.155 validator');
assert(pkg.scripts['test:play-store:delta'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1', 'delta command remains failed+new shared runner');
assert(pkg.scripts['test:play-store:failed'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1', 'failed command uses strict failed-only wrapper');
assert(pkg.scripts['test:play-store:repair']?.includes('-SelectionMode repair'), 'repair command selects explicit repair mode');
assert(!fs.existsSync(path.join(root, 'scripts/validate-16-0-154.js')), 'previous 16.0.154 validator was replaced');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');

assert(failedRunner.includes('param(') && failedRunner.includes("[ValidateSet('failed+new','failed-only','repair')]") && failedRunner.includes('$env:CHAOS_RELEASE_GATE_SELECTION_MODE = $SelectionMode'), 'shared runner is parameterized by selection mode');
assert(failedOnlyWrapper.includes('-SelectionMode failed-only') && !failedOnlyWrapper.includes('FAILED_AND_NEW_RELEASE_GATE.ps1"\n& $script @args'), 'failed-only wrapper no longer aliases failed+new unqualified behavior');
assert(prepareManifest.includes("includeNewInventory: selectionMode === 'failed+new'") && prepareManifest.includes("selectionMode === 'repair'") && prepareManifest.includes('previousTimeoutsSelected') && prepareManifest.includes('currentReleaseFeatureTestsSelected') && prepareManifest.includes('duplicateIdentitiesRemoved'), 'manifest preparer separates failed+new, failed-only, and repair semantics with failed/timed-out counts');
assert(failedUtils.includes('hasCompletedReleaseGateEvidence') && failedUtils.includes('missing-completed-summary') && failedUtils.includes('includeNewInventory = true') && failedUtils.includes('if (includeNewInventory)') && failedUtils.includes("manifest.newTestsCount = 0"), 'failed-only utilities require completed evidence and can disable new-test expansion');
assert(failedUtils.includes('No failed or timed-out Playwright tests remain.') && failedRunner.includes('no-failed-tests-remain'), 'strict failed-only can exit cleanly when no failures remain');
assert(repairScope.includes("CURRENT_RELEASE_VERSION = '16.0.153'") && repairScope.includes('Carried forward from 16.0.153') && repairScope.includes('schedule-request-off-management.spec.cjs') && repairScope.includes('buildRepairSelection') && !repairScope.includes('old full baseline'), 'current-release repair scope carries forward the explicit 16.0.153 feature tests without baseline-new expansion');
assert(failedConfig.includes('CHAOS_RELEASE_GATE_SELECTION_MODE') && failedConfig.includes('releaseSelectionMode'), 'Playwright failed config reports real selection mode');
assert(collector.includes("'repair'") && collector.includes('selectionMode') && collector.includes('noFailedOnlyTestsRemain'), 'release report records failed+new, failed-only, and repair modes accurately');

assert(loginHelper.includes('while (Date.now() < deadline)') && loginHelper.includes('workspaceChooserLocator(page).isVisible') && loginHelper.includes('chooseReleaseWorkspaceIfNeeded(page, { ...options, chooserTimeout: 450 })'), 'auth readiness helper re-checks and selects a late workspace chooser during the readiness window');
assert(loginHelper.includes('CHAOS_QA_WORKSPACE_NAME is required when a workspace chooser appears') && loginHelper.includes("getByRole('heading', { name: /^(Choose|Select) (Workspace|Restaurant)$/i }).first()") && loginHelper.includes('workspaceOpenButtonRegex(workspaceName)') && loginHelper.includes('targetCount !== 1'), 'auth readiness helper targets the real chooser heading and requires exactly one configured QA workspace Open button');
assert(!loginHelper.includes('86 Chaos OS Logo') && !/getByText\(requested/.test(loginHelper), 'auth readiness does not accept the logo or broad page text as proof/selection');
assert(ghostRequestOffSpec.includes("gotoTab(page, 'published'") && ghostRequestOffSpec.includes("getByRole('button', { name: /^Schedule Request Off$/i })") && !ghostRequestOffSpec.includes("gotoTab(page, 'schedule', { settleMs: 1800, maxText: 70000 })"), 'Ghost Request Off uses Time Clock & Schedule published route, not Schedule Builder');
assert(styles.includes('16.0.154 login action target cascade repair') && styles.includes('.chaos-login-screen .chaos-login-primary-action') && styles.includes('.chaos-login-screen .chaos-login-secondary-action') && /min-height:\s*44px !important/.test(styles), 'login tap-target cascade repair is scoped to login primary/secondary actions');
assert(compactUiSpec.includes('minHeight') && compactUiSpec.includes('paddingTop') && compactUiSpec.includes('parentTransform'), 'login tap-target test captures computed dimensions and cascade diagnostics');

assert(schedule.includes('buildScheduleConflictWarningRows') && schedule.includes('resolvePerson: resolveSchedulePersonForShift') && schedule.includes('employeeLabeler: scheduleWarningEmployeeLabel'), 'Schedule warnings use guarded canonical shift/person resolution');
assert(!schedule.includes('Someone is scheduled on requested-off date') && !schedule.includes("|| 'Someone'"), 'Schedule warnings no longer produce literal Someone fallback');
assert(warningHelpers.includes('Unresolved employee') && warningHelpers.includes('warningShiftContext(shift)'), 'unresolved schedule warnings use safe fallback with shift context');
assert(schedule.includes('buildCoverageVarianceRows') && schedule.includes("row.type === 'under'") && schedule.includes('coverage-over') && schedule.includes('Existing: ${row.existing} • Target: ${row.count}'), 'coverage warnings include under and over target variance with shared math');
assert(schedule.includes('useRememberedAlert') && schedule.includes('buildAlertFingerprint') && schedule.includes('Dismiss warning'), 'Schedule warnings use existing alert memory for per-warning dismissal');
assert(warningHelpers.includes('buildCoverageVarianceRows') && warningHelpers.includes('delta = existing - targetCount') && warningHelpers.includes("type: delta < 0 ? 'under' : 'over'"), 'coverage variance helper implements delta model');
assert(warningHelpers.includes('safeRecordArray') && warningHelpers.includes('buildScheduleConflictWarningRows') && warningHelpers.includes('A malformed legacy shift must not take down Schedule Builder'), 'Schedule warning model isolates malformed legacy rows instead of crashing the Schedule Builder route');
const qaProfile = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
assert(qaProfile.includes("dayIndex: 2, role: 'Bartender', startTime: '10a', endTime: '4p', count: 1"), 'QA seed has deterministic Tuesday Bartender over-coverage fixture');

assert(warningHelpers.includes('SUBJECT_ID_FIELDS') && !warningHelpers.includes("'createdBy'") && !warningHelpers.includes("'requestedBy'"), 'Request Off employee filtering uses subject identity fields, not audit actor fields');
assert(schedule.includes('Filter Request Off by employee') && schedule.includes('requestMatchesEmployeeFilter(r, employeeFilter)'), 'Request Off manager workflow has employee filter');
assert(schedule.includes('Approve All Visible') && schedule.includes('eligibleVisibleRequests({ requirePending: true })') && schedule.includes('Promise.allSettled'), 'Approve All Visible is scoped to visible pending eligible requests with all-settled reporting');
assert(schedule.includes('Archive All Visible') && schedule.includes('eligibleVisibleRequests({ requirePending: false })') && schedule.includes('previousStatus'), 'Archive All Visible is scoped to visible eligible requests and preserves previous status');
assert(schedule.includes('bulkBusy') && schedule.includes('disabled={!!bulkBusy}'), 'bulk actions have a busy/double-click guard');

assert(fs.existsSync(path.join(root, 'tests/e2e/schedule-request-off-management.spec.cjs')), 'focused 16.0.153 carried-forward Playwright feature spec exists');
const featureSpec = read('tests/e2e/schedule-request-off-management.spec.cjs');
assert(featureSpec.includes('openManagerRequestOff') && featureSpec.includes("gotoTab(page, 'published'") && featureSpec.includes("getByRole('button', { name: /^Schedule Request Off$/i })"), 'carried-forward Request Off feature tests explicitly open the Request Off workflow');
assert(featureSpec.includes('Open Copilot Tools') && featureSpec.includes("getByRole('button', { name: /^Warnings$/i })") && !featureSpec.includes('getByText(/Warnings/i).first().click'), 'carried-forward warning tests open exact Schedule Copilot warning controls');
assert(featureSpec.includes("getByRole('button', { name: /^Needs Review$/i })") && featureSpec.includes("getByRole('button', { name: /^Upcoming Approved$/i })"), 'carried-forward bulk tests use the correct seeded Request Off views');
[
  'Schedule Builder requested-off warning shows employee name and never Someone',
  'Schedule Builder coverage warnings show under and over target math',
  'Schedule Builder warning dismissal hides only the warning',
  'Request Off employee filter narrows and clears manager-visible requests',
  'Approve All Visible updates only filtered visible pending requests',
  'Archive All Visible archives only filtered visible eligible requests',
].forEach(title => {
  assert(featureSpec.includes(title) && repairScope.includes(title), `feature test is present and repair-scoped: ${title}`);
});
assert(repairScope.match(/mobile-chromium/g)?.length >= 1 && repairScope.match(/chromium/g)?.length >= 1, 'repair scope covers chromium and mobile-chromium feature identities');
assert(fs.existsSync(path.join(root, 'api/schedule-warning-request-off-controls.test.cjs')), 'focused Schedule/Request Off helper unit tests exist');
assert(fs.existsSync(path.join(root, 'api/failed-only-repair-selection-16-0-153.test.cjs')), 'focused failed-only/repair selection unit tests exist');

assert(helpKnowledge.includes("CUSTOMER_HELP_VERSION = '16.0.150'"), 'customer Help knowledge version was not bumped unnecessarily');
assert(helpKnowledge.includes('over-coverage against targets') && helpKnowledge.includes('approve or archive only the visible filtered requests in bulk'), 'minimal relevant customer Help additions are present');
assert(!read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '16.0.155'"), 'browser Help export version was not bumped to app version');

if (failures) { console.error(`\n${failures} validation check(s) failed.`); process.exit(1); }
console.log('\n16.0.155 source validation passed.');
