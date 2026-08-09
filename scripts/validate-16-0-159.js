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
const warningHelpers = read('src/core/scheduleWarningControls.shared.js');
const warningBrowserWrapper = read('src/core/scheduleWarningControls.js');
const warningCjsWrapper = read('src/core/scheduleWarningControls.cjs');
const failedRunner = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
const failedOnlyWrapper = read('RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1');
const failedUtils = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const prepareManifest = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
const repairScope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');
const failedConfig = read('playwright.failed-release.config.cjs');
const appShell = read('src/App.js');
const reportedFailedManifest = json('scripts/86chaos-release-gate/reported-failed-only-20260809-004632.json');
const fullConfig = read('playwright.play-store-release.config.cjs');
const releaseReporter = read('test-tools/reporters/chaos-release-gate-reporter.cjs');
const reporterUnitSpec = read('api/release-gate-console-reporter.test.cjs');
const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
const helpKnowledge = read('src/core/customerHelpKnowledge.cjs');
const loginHelper = read('tests/e2e/utils/release-login-helper.cjs');
const ghostRequestOffSpec = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
const compactUiSpec = read('tests/e2e/compact-ui-layout.spec.cjs');
const styles = read('src/styles.css');

assert(pkg.version === '16.0.159', 'package.json version is 16.0.159');
assert(lock.version === '16.0.159' && lock.packages?.['']?.version === '16.0.159', 'package-lock root versions are 16.0.159');
assert(version.version === '16.0.159' && version.build === '16.0.159', 'public/version.json version/build are 16.0.159');
assert(version.releaseTitle === 'Repair Lineage Recovery and Blocked-Run Reporting', 'public/version.json release title is 16.0.159 release name');
assert(appCore.includes("CURRENT_VERSION = '16.0.159'"), 'app core CURRENT_VERSION is 16.0.159');
assert(apiVersion.includes("APP_VERSION = '16.0.159'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.159'"), 'api version reports 16.0.159');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-159.js', 'test:source points at 16.0.159 validator');
assert(pkg.scripts['test:play-store:delta'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1', 'delta command remains failed+new shared runner');
assert(pkg.scripts['test:play-store:failed'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1', 'failed command uses strict failed-only wrapper');
assert(pkg.scripts['test:play-store:repair']?.includes('-SelectionMode repair'), 'repair command selects explicit repair mode');
assert(pkg.scripts['test:play-store:failed-current'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1 -SelectionMode reported-failed-only', 'failed-current command runs reported-failed-only mode only');
assert(!fs.existsSync(path.join(root, 'scripts/validate-16-0-158.js')), 'previous 16.0.158 validator was replaced');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');

assert(failedRunner.includes('param(') && failedRunner.includes("[ValidateSet('failed+new','failed-only','repair','reported-failed-only')]") && failedRunner.includes('$env:CHAOS_RELEASE_GATE_SELECTION_MODE = $SelectionMode'), 'shared runner is parameterized by selection mode including reported failed-only');
assert(failedOnlyWrapper.includes('-SelectionMode failed-only') && !failedOnlyWrapper.includes('FAILED_AND_NEW_RELEASE_GATE.ps1"\n& $script @args'), 'failed-only wrapper no longer aliases failed+new unqualified behavior');
assert(prepareManifest.includes("includeNewInventory: selectionMode === 'failed+new'") && prepareManifest.includes("selectionMode === 'repair'") && prepareManifest.includes("selectionMode === 'reported-failed-only'") && prepareManifest.includes('previousTimeoutsSelected') && prepareManifest.includes('currentReleaseFeatureTestsSelected') && prepareManifest.includes('duplicateIdentitiesRemoved'), 'manifest preparer separates failed+new, failed-only, repair, and reported failed-only semantics with failed/timed-out counts');
assert(failedUtils.includes('hasCompletedReleaseGateEvidence') && failedUtils.includes('missing-completed-summary') && failedUtils.includes('includeNewInventory = true') && failedUtils.includes('if (includeNewInventory)') && failedUtils.includes("manifest.newTestsCount = 0"), 'failed-only utilities require completed evidence and can disable new-test expansion');
assert(failedUtils.includes('No failed or timed-out Playwright tests remain.') && failedRunner.includes('no-failed-tests-remain'), 'strict failed-only can exit cleanly when no failures remain');
assert(repairScope.includes('schedule-request-off-management.spec.cjs') && repairScope.includes('buildRepairSelection') && !repairScope.includes('old full baseline'), 'current-release repair scope selection identities remain intact');
assert(failedConfig.includes('CHAOS_RELEASE_GATE_SELECTION_MODE') && failedConfig.includes('releaseSelectionMode'), 'Playwright failed config reports real selection mode');
assert(failedConfig.includes('assertReportedFailedOnlySelection') && failedConfig.includes("rows.length !== 12") && failedConfig.includes("allProjects.filter(project => ['chromium', 'mobile-chromium'].includes(project.name))"), 'Playwright failed config fail-closes reported failed-only selection to exactly 12 chromium/mobile identities');
assert(collector.includes("'reported-failed-only'") && collector.includes('selectionMode') && collector.includes('noFailedOnlyTestsRemain'), 'release report records failed+new, failed-only, repair, and reported failed-only modes accurately');
assert(failedConfig.includes('chaos-release-gate-reporter.cjs') && failedConfig.includes('[chaosReleaseGateReporter]') && !failedConfig.includes("['list']"), 'failed/repair Playwright config uses ASCII release-gate reporter instead of list reporter');
assert(fullConfig.includes('chaos-release-gate-reporter.cjs') && fullConfig.includes('[chaosReleaseGateReporter]') && !fullConfig.includes("['list']"), 'full Play Store config uses ASCII release-gate reporter instead of list reporter');
assert(!failedConfig.includes('console.log(`86 Chaos ${releaseSelectionMode} selected tests:`)') && failedConfig.includes('specsFromManifest(FAILED_ONLY_TESTS)') && failedConfig.includes("grepForProject(FAILED_ONLY_TESTS, 'chromium')"), 'failed/repair config no longer reprints the manifest while preserving selection semantics');
assert(releaseReporter.includes("86 Chaos ${mode || selection.mode || 'release'} selected tests:") && releaseReporter.includes('createResultLine') && releaseReporter.includes('PASS') && releaseReporter.includes('TIMEOUT'), 'release-gate reporter owns one-time selected-test output and ASCII result lines');
assert(releaseReporter.includes('TEST-SUMMARY.txt') && releaseReporter.includes('FAILED-TESTS.txt') && collector.includes('TEST-SUMMARY.txt') && collector.includes('FAILED-TESTS.txt'), 'human summary artifacts are written and collected into run artifacts');
assert(failedRunner.includes("foreach ($summaryName in @('TEST-SUMMARY.txt', 'FAILED-TESTS.txt'))") && read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1').includes("foreach ($summaryName in @('TEST-SUMMARY.txt', 'FAILED-TESTS.txt'))"), 'slim release-gate ZIP promotes TEST-SUMMARY and FAILED-TESTS near the top level');
assert(reporterUnitSpec.includes('prints selected manifest once') && reporterUnitSpec.includes('output is ASCII-only') && reporterUnitSpec.includes('interrupted run summary is explicitly non-authoritative'), 'focused reporter regression tests cover one-time manifest, ASCII output, and interrupted runs');
const reportedRows = reportedFailedManifest.selected || [];
assert(reportedFailedManifest.mode === 'reported-failed-only' && reportedRows.length === 12, 'reported failed-only manifest contains exactly 12 identities');
assert(reportedRows.filter(row => row.project === 'chromium').length === 6 && reportedRows.filter(row => row.project === 'mobile-chromium').length === 6, 'reported failed-only manifest is 6 chromium and 6 mobile-chromium identities');
assert(!reportedRows.some(row => (row.leafTitle || row.title) === 'Schedule Builder warning runtime renders without Runtime Recovery or TypeError'), 'reported failed-only manifest excludes already-passing Schedule runtime tests');
assert(new Set(reportedRows.map(row => row.leafTitle)).size === 6 && reportedRows.every(row => row.specPath === 'e2e/schedule-request-off-management.spec.cjs'), 'reported failed-only manifest contains only the six failed Schedule/Request Off titles');
assert(fs.existsSync(path.join(root, 'api/reported-failed-only-current-selection.test.cjs')), 'reported failed-only selection regression test exists');
assert(fs.existsSync(path.join(root, 'api/pwa-back-exit-source.test.cjs')), 'PWA double-back exit source regression test exists');

assert(loginHelper.includes('while (Date.now() < deadline)') && loginHelper.includes('workspaceChooserLocator(page).isVisible') && loginHelper.includes('chooseReleaseWorkspaceIfNeeded(page, { ...options, chooserTimeout: 450 })'), 'auth readiness helper re-checks and selects a late workspace chooser during the readiness window');
assert(loginHelper.includes('CHAOS_QA_WORKSPACE_NAME is required when a workspace chooser appears') && loginHelper.includes("getByRole('heading', { name: /^(Choose|Select) (Workspace|Restaurant)$/i }).first()") && loginHelper.includes('workspaceOpenButtonRegex(workspaceName)') && loginHelper.includes('targetCount !== 1'), 'auth readiness helper targets the real chooser heading and requires exactly one configured QA workspace Open button');
assert(!loginHelper.includes('86 Chaos OS Logo') && !/getByText\(requested/.test(loginHelper), 'auth readiness does not accept the logo or broad page text as proof/selection');
assert(ghostRequestOffSpec.includes("gotoTab(page, 'published'") && ghostRequestOffSpec.includes("getByRole('button', { name: /^Schedule Request Off$/i })") && !ghostRequestOffSpec.includes("gotoTab(page, 'schedule', { settleMs: 1800, maxText: 70000 })"), 'Ghost Request Off uses Time Clock & Schedule published route, not Schedule Builder');
assert(styles.includes('16.0.154 login action target cascade repair') && styles.includes('.chaos-login-screen .chaos-login-primary-action') && styles.includes('.chaos-login-screen .chaos-login-secondary-action') && /min-height:\s*44px !important/.test(styles), 'login tap-target cascade repair is scoped to login primary/secondary actions');
assert(compactUiSpec.includes('minHeight') && compactUiSpec.includes('paddingTop') && compactUiSpec.includes('parentTransform'), 'login tap-target test captures computed dimensions and cascade diagnostics');

assert(appShell.includes('CHAOS_PWA_BACK_EXIT_WINDOW_MS = 2000') && appShell.includes('isStandalone86ChaosPwa') && appShell.includes("display-mode: standalone"), 'App shell detects installed PWA/standalone mode for double-back exit handling');
assert(appShell.includes('writeTopLevelTabHistory') && appShell.includes('window.history.replaceState({ ...currentState, tab: normalized, chaosAppShell: true, chaosPwaBackGuard: true }') && appShell.includes('window.history.pushState({ tab, chaosAppShell: true, chaosPwaBackGuard: true }'), 'installed PWA top-level tab navigation updates URL without growing tab history stack');
assert(appShell.includes("Press back again to exit.") && appShell.includes('window.history.back()') && !appShell.includes('window.close()'), 'installed PWA Back shows exit toast first and uses browser history, not window.close');

assert(schedule.includes("from '../core/scheduleWarningControls';") && !schedule.includes('scheduleWarningControls.cjs') && !schedule.includes('scheduleWarningControlExports'), 'Schedule browser code uses native ESM named warning helper imports and no direct CJS helper import');
assert(warningBrowserWrapper.includes("import './scheduleWarningControls.shared';") && warningBrowserWrapper.includes('export const buildCoverageVarianceRows') && warningBrowserWrapper.includes('export const buildScheduleConflictWarningRows'), 'browser warning helper wrapper exposes explicit named exports');
assert(warningCjsWrapper.includes("require('./scheduleWarningControls.shared.js')") && warningCjsWrapper.includes('module.exports = scheduleWarningControls'), 'Node warning helper wrapper uses the same shared implementation');
assert(warningHelpers.includes('__86ChaosScheduleWarningControlsShared') && warningHelpers.includes('const scheduleWarningControlsShared = {'), 'shared warning helper implementation is the single business-logic source');
assert(schedule.includes('buildScheduleConflictWarningRows') && schedule.includes('resolvePerson: resolveSchedulePersonForShift') && schedule.includes('employeeLabeler: scheduleWarningEmployeeLabel'), 'Schedule warnings use guarded canonical shift/person resolution');
assert(!schedule.includes('Someone is scheduled on requested-off date') && !schedule.includes("|| 'Someone'"), 'Schedule warnings no longer produce literal Someone fallback');
assert(warningHelpers.includes('Unresolved employee') && warningHelpers.includes('warningShiftContext(shift)'), 'unresolved schedule warnings use safe fallback with shift context');
assert(schedule.includes('buildCoverageVarianceRows') && schedule.includes("row.type === 'under'") && schedule.includes('coverage-over') && schedule.includes('Existing: ${row.existing} • Target: ${row.count}'), 'coverage warnings include under and over target variance with shared math');
assert(schedule.includes('useRememberedAlert') && schedule.includes('buildAlertFingerprint') && schedule.includes('Dismiss warning'), 'Schedule warnings use existing alert memory for per-warning dismissal');
assert(warningHelpers.includes('buildCoverageVarianceRows') && warningHelpers.includes('delta = existing - targetCount') && warningHelpers.includes("type: delta < 0 ? 'under' : 'over'"), 'coverage variance helper implements delta model');
assert(warningHelpers.includes('safeRecordArray') && warningHelpers.includes('asFunction') && warningHelpers.includes('buildScheduleConflictWarningRows') && warningHelpers.includes('A malformed legacy shift must not take down Schedule Builder'), 'Schedule warning model isolates malformed legacy rows and malformed injected callbacks instead of crashing the Schedule Builder route');
const qaProfile = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
assert(qaProfile.includes("dayIndex: 2, role: 'Bartender', startTime: '10a', endTime: '4p', count: 1"), 'QA seed has deterministic Tuesday Bartender over-coverage fixture');

assert(warningHelpers.includes('SUBJECT_ID_FIELDS') && !warningHelpers.includes("'createdBy'") && !warningHelpers.includes("'requestedBy'"), 'Request Off employee filtering uses subject identity fields, not audit actor fields');
assert(schedule.includes('Filter Request Off by employee') && schedule.includes('requestMatchesEmployeeFilter(r, employeeFilter)'), 'Request Off manager workflow has employee filter');
assert(schedule.includes('Approve All Visible') && schedule.includes('eligibleVisibleRequests({ requirePending: true })') && schedule.includes('Promise.allSettled'), 'Approve All Visible is scoped to visible pending eligible requests with all-settled reporting');
assert(schedule.includes('Archive All Visible') && schedule.includes('eligibleVisibleRequests({ requirePending: false })') && schedule.includes('previousStatus'), 'Archive All Visible is scoped to visible eligible requests and preserves previous status');
assert(schedule.includes('bulkBusy') && schedule.includes('disabled={!!bulkBusy}'), 'bulk actions have a busy/double-click guard');

assert(fs.existsSync(path.join(root, 'tests/e2e/schedule-request-off-management.spec.cjs')), 'focused Schedule runtime Playwright feature spec exists');
const featureSpec = read('tests/e2e/schedule-request-off-management.spec.cjs');
assert(featureSpec.includes('openManagerRequestOff') && featureSpec.includes("gotoTab(page, 'published'") && featureSpec.includes("getByRole('button', { name: /^Schedule Request Off$/i })"), 'carried-forward Request Off feature tests explicitly open the Request Off workflow');
assert(featureSpec.includes('Open Copilot Tools') && featureSpec.includes("getByRole('button', { name: /^Warnings$/i })") && !featureSpec.includes('getByText(/Warnings/i).first().click'), 'carried-forward warning tests open exact Schedule Copilot warning controls');
assert(featureSpec.includes("openRequestOffView(page, 'Needs Review')") && featureSpec.includes("openRequestOffView(page, 'Upcoming Approved')") && featureSpec.includes("new RegExp(`^Open ${label}$`, 'i')"), 'carried-forward bulk tests use the correct seeded Request Off views');
assert(featureSpec.includes('installSeededScheduleClock') && featureSpec.includes('scheduleFixtureDateFromSeed') && featureSpec.includes('__CHAOS_QA_FIXED_SCHEDULE_DATE__'), 'Schedule/Request Off feature tests freeze the browser clock to the seeded fixture week');
assert(featureSpec.includes('waitForRequestOffEmployee') && featureSpec.includes('Seeded Sara QA pending request should be visible before employee filtering') && featureSpec.includes('Seeded Allen QA approved request should be visible before bulk archive'), 'Request Off tests wait for seeded request rows before filtering and bulk actions');
assert(!featureSpec.includes("not.toMatch(/No schedule|No requests here.*No coverage targets/i)"), 'warning dismissal test no longer uses overbroad body-wide No schedule regex');
[
  'Schedule Builder warning runtime renders without Runtime Recovery or TypeError',
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
const helperUnitSpec = read('api/schedule-warning-request-off-controls.test.cjs');
assert(helperUnitSpec.includes('Schedule browser import contract uses native ESM named warning helpers') && helperUnitSpec.includes('schedule warning helpers ignore malformed injected callbacks'), 'focused helper tests cover browser import callable contract and malformed callback hardening');
assert(fs.existsSync(path.join(root, 'api/failed-only-repair-selection-16-0-153.test.cjs')), 'focused failed-only/repair selection unit tests exist');

assert(helpKnowledge.includes("CUSTOMER_HELP_VERSION = '16.0.150'"), 'customer Help knowledge version was not bumped unnecessarily');
assert(helpKnowledge.includes('over-coverage against targets') && helpKnowledge.includes('approve or archive only the visible filtered requests in bulk'), 'minimal relevant customer Help additions are present');
assert(!read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '16.0.159'"), 'browser Help export version was not bumped to app version');
assert(fs.existsSync(path.join(root, 'artifacts/16.0.158-schedule-runtime-root-cause.txt')), '16.0.158 Schedule runtime diagnostic artifact is retained');


assert(failedUtils.includes("['failed-only', 'repair', 'failed+new'].includes(mode)") && failedUtils.includes('findLatestCompletedFocusedRun'), 'focused repair/failed-only runs are classified separately from full baselines and can be recovered');
assert(failedUtils.includes('latest-compatible-focused-result-with-pruned-full-baseline') && failedUtils.includes("baselineMode === 'focused'"), 'strict failed-only can safely narrow from the latest completed focused run when the old full baseline directory was pruned');
assert(prepareManifest.includes("lineageMode: 'none'") && prepareManifest.includes('no-compatible-previous-failures-feature-scope-only'), 'repair mode can still run the explicit feature scope when no historical Playwright lineage exists');
assert(read('api/failed-only-repair-selection-16-0-153.test.cjs').includes('recovers from latest completed focused run when the old full baseline directory was pruned'), 'focused lineage recovery has a regression test');
assert(reporterUnitSpec.includes('blocked-before-execution summary does not claim that previous failures are cleared') || read('api/release-gate-console-reporter.test.cjs').includes('blocked-before-execution summary does not claim that previous failures are cleared'), 'blocked run reporting has a regression test');
assert(releaseReporter.includes('Not evaluated - Playwright did not start.') && releaseReporter.includes('Existing failed-test lineage was not cleared by this blocked run.'), 'blocked human summary does not falsely report zero remaining failures');
assert(collector.includes('blockedBeforeTestExecution') && collector.includes('rerunCommand') && collector.includes('test:play-store:failed-current'), 'collector passes blocked status and the correct rerun command into human summaries');

if (failures) { console.error(`\n${failures} validation check(s) failed.`); process.exit(1); }
console.log('\n16.0.159 source validation passed.');
