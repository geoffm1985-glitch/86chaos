#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
let failures = 0;
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function sha(file) { return crypto.createHash('sha256').update(read(file)).digest('hex'); }
function assert(condition, message) {
  if (!condition) { failures += 1; console.error(`FAIL: ${message}`); }
  else console.log(`OK: ${message}`);
}
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const management = read('src/features/management.jsx');
const peopleRoute = read('api/system-admin/people.js');
const safeRows = read('api/system-admin-safe-rows.cjs');
const listBackups = read('api/list-backups.js');
const watchdog = read('api/firestore-backup-watchdog.js');
const healthChecks = read('api/health-checks.js');
const app = read('src/App.js');
const schedule = read('src/features/schedule.jsx');
const appCoreSource = read('src/core/appCore.js');
const inventory = read('src/features/inventory.jsx');
const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
const failedConfig = read('playwright.failed-release.config.cjs');
const manifestUtils = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260810-015004.json');
const rows = manifest.selected || [];
const vercel = read('vercel.json');
const tabMonth = read('src/components/TabMonth.js');
const tabMasterSchedule = read('src/components/TabMasterSchedule.js');
const staffMemberApi = read('api/staff-member.js');
const staffEmailSourceTest = read('api/staff-member-email-update-source.test.cjs');
const monthPrintSourceTest = read('api/month-print-source.test.cjs');
const posthogClient = read('src/core/posthogClient.js');
const posthogServer = read('api/_posthog-server.js');
const posthogSourceTest = read('api/posthog-instrumentation-source.test.cjs');
const scheduleIdentitySourceTest = read('api/schedule-identity-dedupe-16-0-173.test.cjs');
const schedulePlanner = read('src/core/scheduleQueryPlanner.js');
const identityContaminationTest = read('api/staff-member-identity-contamination-16-0-175.test.cjs');
const sinceRunner = read('scripts/run-tests-since-16-0-170.cjs');
const partialResumeManifest = json('scripts/86chaos-release-gate/reported-partial-resume-20260813-205319.json');
const partialResumeSourceTest = read('api/partial-resume-release-gate-source-16-0-177.test.cjs');
const loginWorkspaceResumeTest = read('api/login-workspace-resume-16-0-177.test.cjs');
const auditHelpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
const authFeature = read('src/features/auth.jsx');
const partialResumeWrapper = read('RUN_86CHAOS_PARTIAL_RESUME_RELEASE_GATE.ps1');
const currentBlockersManifest = json('scripts/86chaos-release-gate/reported-current-blockers-20260814-064437.json');
const currentBlockersWrapper = read('RUN_86CHAOS_CURRENT_BLOCKERS_RELEASE_GATE.ps1');
const currentBlockersSourceTest = read('api/current-blockers-release-gate-source-16-0-183.test.cjs');
const costRegressionTest = read('tests/e2e/cost-regression.spec.cjs');
const timeOffRequestApi = read('api/time-off-request.js');
const timeOffRequestTest = read('api/time-off-request.test.cjs');

assert(pkg.version === '16.0.189', 'package.json version is 16.0.189');
assert(lock.version === '16.0.189' && lock.packages?.['']?.version === '16.0.189', 'package-lock root versions are 16.0.189');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-189.js', 'test:source points to 16.0.189 validator');
assert(pkg.scripts['test:since-16-0-170'] === 'node scripts/run-tests-since-16-0-170.cjs', 'targeted since-16.0.170 test command exists');
assert(pkg.scripts['test:since-16-0-170:node'] === 'node scripts/run-tests-since-16-0-170.cjs --node-only', 'targeted node-only since-16.0.170 test command exists');
assert(pkg.scripts['test:play-store:resume-current'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_PARTIAL_RESUME_RELEASE_GATE.ps1', 'partial resume Play Store command exists');
assert(pkg.scripts['test:play-store:partial-resume'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_PARTIAL_RESUME_RELEASE_GATE.ps1', 'partial resume alias exists');
assert(pkg.scripts['test:play-store:current-blockers'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_CURRENT_BLOCKERS_RELEASE_GATE.ps1', 'current blockers Play Store command exists');
assert(pkg.scripts['test:play-store:latest-blockers'] === pkg.scripts['test:play-store:current-blockers'], 'latest blockers alias exists');
assert(lock.packages?.['']?.scripts?.['test:play-store:resume-current'] === pkg.scripts['test:play-store:resume-current'], 'package-lock scripts include partial resume command');
assert(lock.packages?.['']?.scripts?.['test:play-store:current-blockers'] === pkg.scripts['test:play-store:current-blockers'], 'package-lock scripts include current blockers command');
assert(version.version === '16.0.189' && version.build === '16.0.189', 'public/version.json version/build are 16.0.189');
assert(version.releaseTitle === 'Request Off Workflow Date Range Repair', 'release title is correct');
assert(appCore.includes("CURRENT_VERSION = '16.0.189'"), 'app core CURRENT_VERSION is 16.0.189');
assert(apiVersion.includes("APP_VERSION = '16.0.189'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.189'"), 'api version reports 16.0.189');
assert(!fs.existsSync(path.join(root, 'scripts/validate-16-0-187.js')), 'previous validator was replaced');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');



// Targeted 16.0.184 Custom Shift dropdown dedupe repair.
const customShiftDropdownSourceTest = read('api/custom-shift-dropdown-source-16-0-184.test.cjs');
assert(schedule.includes("const presetLabelKeyClient = (p = {}) => String(p.label || '').trim().toLowerCase()"), 'Schedule Builder has a label key helper for dropdown dedupe');
assert(schedule.includes('const SHIFT_PRESETS = useMemo(() => {') && schedule.includes('const customRowsByLabel = new Map()') && schedule.includes('visibleRows.push(customRowsByLabel.get(key) || preset)'), 'Schedule Builder dropdown merges built-ins and Custom Shifts by visible label');
assert(schedule.includes('if (!key || usedLabels.has(key)) continue;') && schedule.includes('{customPresets.map(preset => ('), 'Schedule Builder hides duplicate dropdown labels while preserving Manage Custom Shifts list');
assert(!/const SHIFT_PRESETS = \[\s*\.\.\.BUILT_IN_SHIFT_PRESETS,\s*\.\.\.\[\.\.\.customPresets\]/.test(schedule), 'Schedule Builder no longer blindly concatenates built-ins and Custom Shifts in the dropdown');
assert(customShiftDropdownSourceTest.includes('Schedule Builder dropdown dedupes custom shifts against built-in labels') && customShiftDropdownSourceTest.includes('customRowsByLabel') && customShiftDropdownSourceTest.includes('Manage Custom Shifts still renders the real custom preset list'), '16.0.184 Custom Shift dropdown source regression exists');
assert(sinceRunner.includes('api/custom-shift-dropdown-source-16-0-184.test.cjs'), 'since-16.0.170 targeted test runner includes 16.0.184 Custom Shift dropdown regression');


// Targeted 16.0.189 Schedule Builder time readability repair.
const timeReadabilitySourceTest = read('api/schedule-builder-time-readability-source-16-0-185.test.cjs');
assert(schedule.includes('schedule-builder-time-control-row') && schedule.includes('schedule-builder-time-input') && schedule.includes('schedule-builder-time-label'), 'Schedule Builder IN/OUT time controls use scoped readability classes');
assert(schedule.includes('Schedule Builder start time ${formatShortTime(startTime)}') && schedule.includes('Schedule Builder end time ${formatShortTime(endTime)}'), 'Schedule Builder time inputs expose readable accessible labels');
assert(read('src/styles.css').includes('.schedule-builder-time-input') && read('src/styles.css').includes('font-size: .95rem !important') && read('src/styles.css').includes('min-width: 16rem !important'), 'Schedule Builder time controls reserve readable width and font size');
assert(timeReadabilitySourceTest.includes('Schedule Builder IN and OUT time controls remain readable') && timeReadabilitySourceTest.includes('schedule-builder-time-input') && timeReadabilitySourceTest.includes('height:\\s*44px !important'), '16.0.189 Schedule Builder time readability regression exists');
assert(sinceRunner.includes('api/schedule-builder-time-readability-source-16-0-185.test.cjs'), 'since-16.0.170 targeted test runner includes 16.0.189 time readability regression');

// Targeted 16.0.189 Month View print readability repair.
const monthPrintReadability187 = read('api/month-view-print-readability-source-16-0-187.test.cjs');
assert(schedule.includes('font-size:8.6px') && tabMonth.includes('font-size: 8.6px'), 'Month View printed shift text is larger than the previous 6px one-page layout');
assert(schedule.includes('font-family:"Arial Narrow",Arial,Helvetica,sans-serif') && tabMonth.includes('font-family: "Arial Narrow", Arial, Helvetica, sans-serif'), 'Month View print uses a condensed font stack to keep name and time on one line');
assert(schedule.includes('white-space:nowrap') && tabMonth.includes('white-space: nowrap'), 'Month View print still keeps each shift row on one line');
assert(schedule.includes('width:10.76in;height:8.26in') && tabMonth.includes('width: 10.76in; height: 8.26in'), 'Month View print remains constrained to one landscape letter page');
assert(monthPrintReadability187.includes('font-size:\\s*8\\.6px') && monthPrintReadability187.includes('white-space:\\s*nowrap'), '16.0.189 Month View print readability source regression exists');
assert(sinceRunner.includes('api/month-view-print-readability-source-16-0-187.test.cjs'), 'since-16.0.170 targeted test runner includes 16.0.189 Month View print readability regression');

// Targeted 16.0.189 Request Off workflow visibility repair.
const requestOffWorkflowVisibility188 = read('api/request-off-workflow-visibility-16-0-188.test.cjs');
assert(schedulePlanner.includes("timeOffClauses: canManageSchedule\n        ? [['status','in',activeStatuses]]"), 'Manager Request Off workflow loads all active pending/approved requests, not just current window');
assert(schedulePlanner.includes('show every active requested day off') && schedulePlanner.includes('timeOffLimit: canManageSchedule ? 500 : 120'), 'Request Off active listener has raised cap for all active requested days');
assert(schedule.includes("const [dateFilter, setDateFilter] = useState('all')") && schedule.includes("['all','All Dates']"), 'Request Off workflow defaults to All Dates and exposes the All Dates filter');
assert(requestOffWorkflowVisibility188.includes('loads all active requested days') && requestOffWorkflowVisibility188.includes("useState"), '16.0.189 Request Off workflow visibility regression exists');
assert(sinceRunner.includes('api/request-off-workflow-visibility-16-0-188.test.cjs'), 'since-16.0.170 targeted test runner includes 16.0.189 Request Off visibility regression');



// Targeted 16.0.179 release-gate resume and login/workspace readiness repairs.
assert(partialResumeManifest.mode === 'partial-resume' && partialResumeManifest.totalSelected === 156 && partialResumeManifest.previousFailuresSelected === 2 && partialResumeManifest.previousTimeoutsSelected === 3 && partialResumeManifest.partialNotRunSelected === 151, 'partial-resume manifest selects only the uploaded interrupted run non-passed identities');
assert((partialResumeManifest.selected || []).every(row => !['passed', 'pass'].includes(String(row.priorStatus || '').toLowerCase()) && !['passed', 'pass'].includes(String(row.baselineStatus || '').toLowerCase())), 'partial-resume manifest excludes every already-passed identity');
assert(prepare.includes("'partial-resume'") && prepare.includes('loadReportedPartialResumeManifest') && prepare.includes('reported-partial-resume-20260813-205319.json') && prepare.includes('Partial resume guard: excludes all 65 passed tests'), 'failed-only manifest preparer supports guarded partial-resume selection');
assert(failedConfig.includes("resumePartialRun: releaseSelectionMode === 'partial-resume'") && failedConfig.includes('partial-resume runs only the FAIL/TIMEOUT plus NOT-RUN identities'), 'failed-release config records partial-resume mode in its manifest');
assert(partialResumeWrapper.includes('SelectionMode partial-resume') && partialResumeWrapper.includes('excludes tests that already passed'), 'partial resume PowerShell wrapper runs the partial-resume selection mode');
assert(authFeature.includes("loadLoginBootstrapFromServer(firebaseUser),\n          10000,\n          'Server login bootstrap'") && authFeature.includes("getDoc(userDocRef),\n          2500,\n          'Browser account profile lookup'") && authFeature.includes("getDocs(query(collection(db, 'users'), where('email', '==', candidate))),\n            3000,\n            'Browser email field profile lookup'"), 'login profile bootstrap timeouts are increased for slow preview hydration');
assert(auditHelpers.includes('const preferredRe = new RegExp(`^Open\\\\s+${escapeRegex(preferred)}') && auditHelpers.includes("getByRole('button', { name: preferredRe })") && auditHelpers.includes('button.evaluate((el) => el.click())') && auditHelpers.includes('await chooseQaWorkspace(page);'), 'release-gate helper selects the current QA workspace and recovers from intercepted clicks');
assert(partialResumeSourceTest.includes('partial-resume manifest reruns only failed timed-out and not-run') && partialResumeSourceTest.includes('156') && partialResumeSourceTest.includes('65 tests that already passed'), '16.0.179 partial-resume source regression test exists');
assert(loginWorkspaceResumeTest.includes('Server login bootstrap') && loginWorkspaceResumeTest.includes('release-gate route settling selects the current QA workspace'), '16.0.179 login/workspace source regression test exists');
assert(sinceRunner.includes('api/partial-resume-release-gate-source-16-0-177.test.cjs') && sinceRunner.includes('api/login-workspace-resume-16-0-177.test.cjs'), 'since-16.0.170 targeted test runner includes 16.0.179 regressions');


// Targeted 16.0.183 Ghost Request Off-only current-blocker repairs.
assert(currentBlockersManifest.mode === 'reported-current-blockers' && currentBlockersManifest.totalSelected === 2 && currentBlockersManifest.previousFailuresSelected === 2 && currentBlockersManifest.previousTimeoutsSelected === 0 && currentBlockersManifest.partialNotRunSelected === 0, 'current-blockers manifest selects only the latest 2 failed Ghost Request Off identities');
assert(currentBlockersManifest.baselineFullRunId === '2026-08-14T01-00-59' && currentBlockersManifest.baselineSourceVersion === '16.0.181' && currentBlockersManifest.baselineDeployedVersion === '16.0.181', 'current-blockers manifest is based on the 16.0.181 current-blockers report');
assert((currentBlockersManifest.selected || []).length === 2 && (currentBlockersManifest.selected || []).every(row => String(row.priorStatus || '').toLowerCase() === 'failed' && String(row.baselineStatus || '').toLowerCase() === 'failed'), 'current-blockers manifest contains only failed prior statuses');
assert((currentBlockersManifest.selected || []).filter(row => row.project === 'chromium').length === 1 && (currentBlockersManifest.selected || []).filter(row => row.project === 'mobile-chromium').length === 1, 'current-blockers manifest contains one desktop and one mobile identity');
assert((currentBlockersManifest.selected || []).every(row => /06-request-off-events-integration/.test(row.specPath || '') && /Ghost Mode Request Off/.test(row.leafTitle || '')), 'current-blockers manifest contains only Ghost Request Off identities');
assert((currentBlockersManifest.selected || []).every(row => !/cost-regression|04-schedule-math-oracle/.test(`${row.specPath || ''} ${row.leafTitle || ''}`)), 'passed cost-regression and Schedule Builder identities are excluded from current-blockers manifest');
assert((currentBlockersManifest.selected || []).every(row => !['passed', 'pass', 'skipped', 'timeout', 'timedout', 'notrun', 'not-run', 'not_run'].includes(String(row.priorStatus || '').toLowerCase())), 'current-blockers manifest excludes pass, skip, timeout, and not-run identities');
assert(prepare.includes('reported-current-blockers-20260814-064437.json') && prepare.includes('exactly 2') && prepare.includes('Passed and skipped identities selected: 0'), 'manifest preparer supports guarded two-test current-blockers selection');
assert(failedConfig.includes("currentBlockersRun: releaseSelectionMode === 'reported-current-blockers'") && failedConfig.includes('reported-current-blockers runs only the 2 current FAIL identities') && failedConfig.includes('expected 0 timed-out identities'), 'failed-release config records two-test current-blockers mode');
assert(currentBlockersWrapper.includes('SelectionMode reported-current-blockers') && currentBlockersWrapper.includes('only the 2 current FAIL tests') && currentBlockersWrapper.includes('cost-regression, Schedule Builder, and unrelated identities'), 'current blockers PowerShell wrapper runs only the two failed Ghost Request Off tests');
assert(read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs').includes('const preferredAllenPartialRequestDate = isoDate(addDays(weekStart, 5))') && read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs').includes('const allenPartialRequestDate = preferredAllenPartialRequestDate === tomorrowStr') && read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs').includes('date: allenPartialRequestDate, requestDate: allenPartialRequestDate'), 'fake restaurant profile prevents Allen/Sara Request Off date collision');
assert(read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes("isTimeOffResponseAction(response, 'ghost-list')") && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('Ghost Mode Request Off should load the possessed employee records before date interaction'), 'Ghost Request Off test waits for ghost-list before date interaction');
assert(read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('QA fixture must leave the Ghost conflict date free of Allen QA active Request Off records'), 'Ghost Request Off test rejects invalid Allen/Sara date collision fixtures');
assert(read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('const conflictPrivacySurface = [') && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('JSON.stringify(cancelWarning.conflictRow || {})') && !read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes("expect(text, 'Canceling the warning should not reveal private request reasons or email addresses')"), 'Ghost Request Off privacy assertion is scoped to warning and conflict payload');
assert(read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('async function findRequestOffDateCell(conflictDate)') && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('normalize-space(.)="${day}"') && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('confirmedConflictRowsByDate') && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('First seeded conflict-date selection should call the Request Off conflicts API') && !read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes("locator('div.cursor-pointer, button, [role=\"gridcell\"]').filter({ hasText:"), 'Ghost Request Off date selection uses the visible day-number span and accepts a confirmed cached conflict row');
assert(read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('Conflict warning should be backed by the seeded conflict date from a fresh or cached conflict response') && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('Seeded Sara Request Off should count as at least one other-employee conflict') && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes("Ghost Mode Request Off creation response should be specifically ghost-create") && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes("Ghost Mode Request Off cancellation response should be specifically ghost-cancel"), 'Ghost Request Off workflow keeps conflict/create/cancel assertions authoritative');
assert(read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes("await openPeopleAndPossess(seed.ghostTargetName || 'Allen QA');\n    const refreshedGhostListBody = await openRequestOff();") && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('row?.id === createdRequestId') && read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs').includes('The exact Ghost Mode Request Off created before refresh must still exist after re-entering possession'), 'Ghost Request Off test re-enters possession after reload and verifies exact created request ID');
assert(app.includes('const [ghostTenant, setGhostTenant] = useState(null)') && !/localStorage\.setItem\([^)]*ghost|sessionStorage\.setItem\([^)]*ghost|document\.cookie[\s\S]{0,80}ghost/i.test(app), 'Ghost Mode remains in-memory and is not made persistent');
assert(currentBlockersSourceTest.includes('current-blockers manifest reruns only the two remaining failed Ghost Request Off') && currentBlockersSourceTest.includes('passed cost-regression identities must be absent') && currentBlockersSourceTest.includes('cached confirmed conflict row') && currentBlockersSourceTest.includes('re-enters exact possession after full reload'), '16.0.183 current-blockers source regression test exists');
assert(sinceRunner.includes('api/current-blockers-release-gate-source-16-0-183.test.cjs'), 'since-16.0.170 targeted test runner includes 16.0.183 current-blocker regressions');

// Preserve targeted post-16.0.170 repairs.
assert(tabMasterSchedule.includes('changeSubTab') && tabMasterSchedule.includes('onSubTabChange(normalized)') && tabMasterSchedule.includes("'month-view'"), 'Schedule parent subtab stays synchronized when Month View is selected');
assert(tabMonth.includes('visibleMonthShifts') && tabMonth.includes('getShiftDateKey(shift)') && tabMonth.includes('dateKey.startsWith(monthStr)') && tabMonth.includes('shift?.isPublished === true'), 'Month View print source filters to the selected published month shifts');
assert(tabMonth.includes('buildPrintableCalendarHtml') && tabMonth.includes('handlePrintCalendar') && tabMonth.includes('printWindow.document.write(buildPrintableCalendarHtml())'), 'Month View prints a generated calendar document instead of the stale app shell');
assert(tabMonth.includes('getShiftDisplayName') && tabMonth.includes('buildUserLookup') && tabMonth.includes('employeeEmail') && tabMonth.includes('scheduleUserId'), 'Month View print resolves names across legacy schedule/user identity fields');
assert(management.includes('originalEmail') && management.includes('(updates Firebase login email)') && !management.includes('Cannot be changed after creation') && !management.includes('disabled={!!editingUserId}'), 'Staff Roster email field is editable during profile edits');
assert(staffMemberApi.includes('isValidEmail') && staffMemberApi.includes('resolveTargetAuthUid') && staffMemberApi.includes('auth.getUserByEmail(nextEmail)') && staffMemberApi.includes('auth.updateUser(targetAuthUid, { email: nextEmail, emailVerified: false, displayName })'), 'Staff email updates are validated and applied through Firebase Auth');
assert(staffMemberApi.includes('authEmailUpdated') && staffMemberApi.includes("forceLogoutReason: 'staff-login-email-changed'") && staffMemberApi.includes("'STAFF_EMAIL_UPDATE'"), 'Staff email updates return status, force session refresh, and audit the Firebase-level change');
assert(staffMemberApi.includes('emailLower') && staffMemberApi.includes('employeeEmail') && staffMemberApi.includes('userEmail') && staffMemberApi.includes('authEmail'), 'Staff email updates keep Firestore identity aliases synchronized');
assert(staffMemberApi.includes('resolveTargetDisplayName') && staffMemberApi.includes('callerIdentityNameKeys') && staffMemberApi.includes('safeUpdateBody') && staffMemberApi.includes('buildMembershipPayload(ctx, targetAuthUid || targetUid, safeUpdateBody, current)'), 'staff email updates guard against caller-name identity contamination');
assert(identityContaminationTest.includes('preserves target name when caller identity is accidentally submitted') && identityContaminationTest.includes('P Test') && identityContaminationTest.includes('Geoff Test'), 'identity-contamination regression test exists');
assert(sinceRunner.includes('api/month-print-source.test.cjs') && sinceRunner.includes('api/staff-member-email-update-source.test.cjs') && sinceRunner.includes('api/posthog-instrumentation-source.test.cjs') && sinceRunner.includes('api/staff-member-identity-contamination-16-0-175.test.cjs') && sinceRunner.includes('src/core/scheduleQueryPlanner.test.js'), 'since-16.0.170 targeted test runner covers the post-170 repair surface');
assert(staffEmailSourceTest.includes('Firebase login email') && staffEmailSourceTest.includes('auth.updateUser') && monthPrintSourceTest.includes('generated print document'), 'source regression tests exist for staff email and month print repairs');

assert(fs.existsSync(path.join(root, 'public/86chaos-icon-16-v2.png')) && fs.existsSync(path.join(root, 'public/86chaos-icon-48-v2.png')) && fs.existsSync(path.join(root, 'public/86chaos-pwa-192-v4.png')) && fs.existsSync(path.join(root, 'public/86chaos-pwa-512-v4.png')) && fs.existsSync(path.join(root, 'public/86chaos-maskable-512-v4.png')) && fs.existsSync(path.join(root, 'public/6139.png')), 'app-owned PWA and header icon assets are present in the app ZIP');
assert(posthogClient.includes('REACT_APP_POSTHOG_KEY') && posthogClient.includes('REACT_APP_POSTHOG_HOST') && posthogClient.includes('autocapture: false') && posthogClient.includes('disable_session_recording: true') && posthogClient.includes('respect_dnt: true'), 'PostHog browser client is environment gated and privacy guarded');
assert(posthogClient.includes('identifyChaosPostHogUser') && posthogClient.includes('trackChaosPageView') && posthogClient.includes('trackChaosRuntimeError') && posthogClient.includes('resetChaosPostHogIdentity'), 'PostHog browser helper exposes identity, pageview, runtime error, and reset events');
assert(app.includes('initChaosPostHog({ appVersion: CURRENT_VERSION })') && app.includes('identifyChaosPostHogUser(liveAppUser') && app.includes('trackChaosPageView(activeTabState') && app.includes("trackChaosPostHogEvent('86chaos_problem_report_submitted'") && appCore.includes('__chaosPostHogRuntimeError'), 'App and appCore wire PostHog initialization, identity, page view, problem report, and global runtime error events');
assert(posthogServer.includes('POSTHOG_PROJECT_API_KEY') && posthogServer.includes('/i/v0/e/') && posthogServer.includes('redactSensitive') && staffMemberApi.includes('auth.updateUser'), 'server PostHog helper uses capture endpoint and preserves staff email Firebase Auth repair');
assert(read('api/report-bug.js').includes('capturePostHogEvent') && read('api/report-bug.js').includes('86chaos_api_crash_report_saved') && read('api/report-bug.js').includes('86chaos_problem_report_saved'), 'report-bug forwards saved crash/problem events to PostHog when configured');
assert(vercel.includes('https://*.posthog.com') && /script-src[^;]*https:\/\/\*\.posthog\.com/.test(vercel) && /connect-src[^;]*https:\/\/\*\.posthog\.com/.test(vercel), 'Vercel CSP permits PostHog scripts and event ingestion');
assert(posthogSourceTest.includes('PostHog client is environment gated') && posthogSourceTest.includes('Vercel CSP allows PostHog'), 'PostHog regression tests exist');

assert(schedulePlanner.includes('DURABLE_SHIFT_EMPLOYEE_ID_FIELDS') && schedulePlanner.includes('collectScheduleShiftDurableIdentityAliases') && !/DURABLE_SHIFT_EMPLOYEE_ID_FIELDS = \[([\s\S]*?)'id'/.test(schedulePlanner), 'shift identity resolver excludes Firestore shift document id from employee aliases');
assert(schedulePlanner.includes('if (id) return `id:${id}`') && /loadedScheduleShiftMergeKey[\s\S]{0,500}if \(id\) return `id:\$\{id\}`/.test(schedulePlanner), 'loaded date and scheduleDateKey query copies merge by Firestore document id before logical completeness');
assert(schedule.includes('collapseScheduleDisplayShifts') && schedule.includes('getScheduleShiftDisplayDedupeKey') && schedule.includes('collectScheduleShiftIdentityAliases(shift)') && schedule.includes('prettifyScheduleMachineName'), 'schedule display collapses logical duplicate shifts and cleans machine-like names');
assert(schedule.includes('const handlePrintCalendar = () =>') && schedule.includes('printWindow.document.write(buildPrintableCalendarHtml())') && !/onClick=\{\(\)=>window\.print\(\)\}/.test(schedule), 'active Month View prints the generated visible-shift document instead of raw window.print');
assert(scheduleIdentitySourceTest.includes('Month View dedupes duplicate published shift documents') && scheduleIdentitySourceTest.includes('resolveSchedulePersonForShift uses shift employee aliases without Firestore doc id'), 'schedule identity regression tests exist');




// Targeted 16.0.189 Request Off workflow date-range repair.
const requestOffDateRangeSourceTest = read('api/request-off-workflow-date-range-16-0-189.test.cjs');
assert(schedule.includes("const requestOffDateKey = (request = {}) =>"), 'Request Off workflow has a normalized date-key helper');
assert(schedule.includes("request?.requestDate") && schedule.includes("request?.requestedDate") && schedule.includes("request?.scheduleDateKey"), 'Request Off date helper supports modern and legacy date field aliases');
assert(schedule.includes("const workflowDateScopedRequests = useLiveCollection('timeOffRequests'"), 'Request Off workflow installs a date-scoped manager listener for selected filters');
assert(schedule.includes("whereClauses: [['date', '>=', workflowRequestRange.start], ['date', '<=', workflowRequestRange.end]]"), 'Request Off workflow listener uses selected range start/end');
assert(schedule.includes("mergeRequestOffWorkflowRows(timeOffRequests || [], workflowDateScopedRequests || [])"), 'Request Off workflow merges parent and date-scoped rows');
assert(schedule.includes("d.setDate(1); d.setMonth(d.getMonth()+1)"), 'Next Month filter starts from the first of the next month');
assert(schedule.includes("return startKey <= endKey ? { start: startKey, end: endKey } : { start: endKey, end: startKey }"), 'Custom Range tolerates reversed start/end entries');
assert(schedule.includes("const requestDate = requestOffDateKey(r)") && schedule.includes("requestDate >= range.start && requestDate <= range.end"), 'Request Off workflow filters by normalized request dates');
assert(requestOffDateRangeSourceTest.includes('Request Off workflow date filters load the selected month or custom range directly'), '16.0.189 Request Off date-range regression exists');
assert(sinceRunner.includes('api/request-off-workflow-date-range-16-0-189.test.cjs'), 'since-16.0.170 targeted test runner includes 16.0.189 Request Off date-range regression');

// Preserve recently fixed systems.
assert(app.includes('resolveInitialTopLevelTab') && app.includes('new URLSearchParams(window.location.search)'), '16.0.167 initial route read reduction preserved');
assert(app.includes('defaultScheduleSubTabForTopLevelTab') && app.includes('peekScheduleFocusSubTab'), '16.0.167 initial schedule subtab planning preserved');
assert(schedule.includes('const copilotReadEnabled = Boolean(open && appUser?.restaurantId)') && schedule.includes('enabled: copilotReadEnabled'), 'ScheduleCopilot open-gated listeners preserved');
assert(schedule.includes("if (subTab !== 'my-schedule')"), 'timePunch listener subtab gate preserved');
assert(appCoreSource.includes('LIVE_COLLECTION_RELEASE_GRACE_MS = 6 * 60 * 1000'), 'shared listener release grace remains six minutes');
assert(app.includes('rawScheduleDateKeyShifts') && app.includes('mergeLoadedScheduleShifts'), 'scheduleDateKey rescue query remains present');
assert(inventory.includes('opsIntelEnabled = false'), 'inventory ops intel listeners remain disabled');
assert(manifestUtils.includes('baselineStatus: sourceRow.baselineStatus') && manifestUtils.includes('baselineStatus: row.baselineStatus'), 'baselineStatus preservation remains in failed-only manifest utilities');
assert(prepare.includes('reported-failed-only-20260810-015004.json'), 'failed-only loader still points to current six-test manifest');
assert(failedConfig.includes('expected 6 selected FAIL identities'), 'failed-only config still guards current six-test manifest');
assert(rows.length === 6 && rows.filter(row => row.project === 'chromium').length === 2 && rows.filter(row => row.project === 'mobile-chromium').length === 4, 'failed-current manifest remains 6 total / 2 chromium / 4 mobile');

// System Administrator people roster enrichment.
assert(fs.existsSync(path.join(root, 'api/system-admin/people.js')), 'System Admin people endpoint exists');
assert(peopleRoute.includes("authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true })") && peopleRoute.includes('ctx.isSuperAdmin !== true'), 'people endpoint remains System Administrator only');
assert(peopleRoute.includes("db.collection('users')") && peopleRoute.includes('FieldPath.documentId()') && peopleRoute.includes('startAfter(cursor)'), 'people endpoint uses Admin SDK user pagination by document id');
assert(peopleRoute.includes("db.collection('workspaceMembers')"), 'people endpoint enriches users from canonical workspaceMembers');
assert(peopleRoute.includes('loadCanonicalWorkspaceMemberIndex') && peopleRoute.includes('canonicalWorkspaceIdsForUser'), 'people endpoint bulk-indexes workspaceMembers before enriching users');
assert(!/for\s*\([^)]*user[\s\S]{0,200}collection\('workspaceMembers'\)/.test(peopleRoute), 'people endpoint avoids N+1 workspaceMembers queries');
assert(safeRows.includes('workspaceMemberIsActive') && safeRows.includes('deleted === true') && safeRows.includes('archived === true'), 'membership enrichment ignores inactive/deleted/archived memberships');
assert(safeRows.includes('workspaceMemberIdentityKeys') && safeRows.includes('emailLower') && safeRows.includes('authUid') && safeRows.includes('userId'), 'membership identity matching supports durable/legacy IDs and email');
assert(!/displayName[\s\S]{0,160}workspaceMemberIdentityKeys/.test(safeRows), 'workspace membership identity does not use display name as primary identity');
assert(management.includes('getSystemAdminUserWorkspaceIds(u).includes(selectedClient.id)'), 'Workspaces / Clients filters users by workspaceIds helper');
assert(management.includes('getSystemAdminUserWorkspaceIds(u).some(workspaceId => selectedPushRestaurantIds.includes(workspaceId))'), 'Push Control Center roster behavior remains workspaceIds-based');
assert(management.includes("new Set(['tenants', 'push', 'users', 'live'])"), 'TabGodMode server people roster tabs include tenants, push, users, and live');
assert(/SYSTEM_ADMIN_GLOBAL_PEOPLE_TABS\.has\(subTab\)[\s\S]{0,180}loadSystemAdminPeopleRoster\(\{ refreshing: false \}\)/.test(management), 'TabGodMode loads authoritative server people roster for every platform people tab');
assert(!/if \(subTab === 'users' \|\| subTab === 'live'\)[\s\S]{0,500}collection\(db, 'users'\)/.test(management), 'People Directory and Live no longer use browser Firestore users roster listener');
assert(!/listen\('users',[\s\S]{0,260}collection\(db, 'users'\)[\s\S]{0,260}applySystemAdminUserCounts/.test(management), 'System Administrator people roster is not populated from client users onSnapshot');
assert(management.includes('Authoritative platform user roster could not load') && management.includes('Refresh People') && management.includes('Authoritative server roster'), 'People Directory exposes authoritative roster status, error, and refresh');

// Backup status trust boundary.
assert(!management.includes("listenDoc('backupStatus'"), 'System Admin no longer installs direct backupStatus browser listener');
assert(!/getDoc\(doc\(db,\s*'system',\s*'backupStatus'\)\)/.test(management), 'System Admin health no longer directly reads system/backupStatus through browser Firestore');
assert(management.includes('backupResult.backupStatus') && management.includes('setBackupStatus(result.backupStatus)'), 'System Admin consumes backupStatus from server list-backups response');
assert(listBackups.includes('function safeBackupStatus') && listBackups.includes("collection('system').doc('backupStatus').get()"), 'list-backups returns sanitized server-side backupStatus');
for (const forbidden of ['privateKey','serviceAccount','credentials','accessToken','refreshToken','authorization','cronSecret']) {
  const body = listBackups.slice(listBackups.indexOf('function safeBackupStatus'), listBackups.indexOf('async function readSafeBackupStatus'));
  assert(!body.includes(`'${forbidden}'`) && !body.includes(`"${forbidden}"`), `safeBackupStatus excludes ${forbidden}`);
}
assert(healthChecks.includes("collection('system').doc('backupStatus').get()") && healthChecks.includes('firestoreLatencyMs') && healthChecks.includes('firestoreReadOk'), 'health-checks provides server-authorized Firestore latency/read status');

// Native backup watchdog diagnostics.
assert(watchdog.includes('backupSchedules') && watchdog.includes('locations/-/backups'), 'watchdog still calls native Firestore Admin API backup endpoints');
assert(!/\/api\/firestore-backup['"`]/.test(watchdog), 'watchdog does not trigger custom JSON backup route');
assert(watchdog.includes('datastore.backupSchedules.list') && watchdog.includes('datastore.backups.list'), 'watchdog 403 diagnostics include required permissions');
assert(watchdog.includes('roles/datastore.backupSchedulesViewer') && watchdog.includes('roles/datastore.backupsViewer'), 'watchdog 403 diagnostics include least-privilege roles');
assert(watchdog.includes('serviceAccountEmail') && watchdog.includes('projectCredentialStatus'), 'watchdog safely reports runtime service-account email when available');
assert(fs.existsSync(path.join(root, 'scripts/verify-native-backup-iam.js')), 'native backup IAM helper exists');
assert(read('scripts/verify-native-backup-iam.js').includes('gcloud projects add-iam-policy-binding') && read('scripts/verify-native-backup-iam.js').includes('roles/datastore.backupsViewer'), 'IAM helper prints copyable least-privilege gcloud commands');
assert(vercel.includes('/api/firestore-backup') && vercel.includes('0 9 * * *') && vercel.includes('/api/firestore-backup-watchdog') && vercel.includes('0 21 * * *'), 'vercel cron schedules remain unchanged');

if (failures) { console.error(`\n${failures} validation check(s) failed.`); process.exit(1); }
console.log('\n16.0.189 source validation passed.');
