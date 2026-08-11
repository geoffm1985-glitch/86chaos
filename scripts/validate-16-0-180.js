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
const scheduleMonthPrint = read('src/core/scheduleMonthPrint.cjs');
const printLayoutTest = read('api/print-calendar-layout.test.cjs');
const monthPrintTest = read('api/month-view-print-16-0-172.test.cjs');
const appScheduleImport = read('src/App.js');
const appCoreSource = read('src/core/appCore.js');
const inventory = read('src/features/inventory.jsx');
const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
const failedConfig = read('playwright.failed-release.config.cjs');
const manifestUtils = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260810-015004.json');
const rows = manifest.selected || [];
const vercel = read('vercel.json');

const tabMonthStart = schedule.indexOf('const TabMonth =');
const tabMonthEnd = schedule.indexOf('const TabAvailability', tabMonthStart);
const tabMonth = tabMonthStart >= 0 && tabMonthEnd > tabMonthStart ? schedule.slice(tabMonthStart, tabMonthEnd) : '';

assert(pkg.version === '16.0.180', 'package.json version is 16.0.180');
assert(lock.version === '16.0.180' && lock.packages?.['']?.version === '16.0.180', 'package-lock root versions are 16.0.180');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-180.js', 'test:source points to 16.0.180 validator');
assert(version.version === '16.0.180' && version.build === '16.0.180', 'public/version.json version/build are 16.0.180');
assert(version.releaseTitle === 'Vercel Clean Install Lockfile Integrity Repair', 'release title is correct');
assert(appCore.includes("CURRENT_VERSION = '16.0.180'"), 'app core CURRENT_VERSION is 16.0.180');
assert(apiVersion.includes("APP_VERSION = '16.0.180'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.180'"), 'api version reports 16.0.180');

assert(pkg.dependencies?.['react-scripts'] === undefined, 'react-scripts direct dependency removed after CRA HIGH audit blocker');
assert(pkg.dependencies?.vite === '8.1.5', 'vite is pinned to 8.1.5');
assert(pkg.dependencies?.['@vitejs/plugin-react'] === '6.0.4', '@vitejs/plugin-react is pinned to 6.0.4');
assert(pkg.scripts?.build === 'node scripts/vite-build-with-asset-manifest.cjs', 'build uses Vite wrapper with asset-manifest generation');
assert(pkg.scripts?.['test:client'] === 'jest --watchAll=false', 'client tests use direct Jest instead of react-scripts');
assert(fs.existsSync(path.join(root, 'vite.config.js')), 'vite.config.js exists');
assert(fs.existsSync(path.join(root, 'index.html')), 'Vite root index.html exists');
assert(fs.existsSync(path.join(root, 'jest.config.cjs')), 'Jest config exists for direct client tests');
assert(fs.existsSync(path.join(root, 'babel.config.cjs')), 'Babel config exists for direct client tests');
assert(fs.existsSync(path.join(root, 'scripts/generate-vite-asset-manifest.cjs')), 'Vite asset manifest generator exists');
assert(vercel.includes('"framework": "vite"'), 'Vercel framework is Vite');
assert(vercel.includes('"outputDirectory": "build"'), 'Vercel output directory remains build');

assert(!fs.existsSync(path.join(root, 'scripts/validate-16-0-170.js')), 'older 16.0.170 validator is not current');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');

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

assert(fs.existsSync(path.join(root, 'api/system-admin/dashboard.js')), 'System Administrator dashboard API exists');
assert(fs.existsSync(path.join(root, 'api/system-admin/platform-config.js')), 'System Administrator platform-config action API exists');
assert(fs.existsSync(path.join(root, 'api/system-admin/user-actions.js')), 'System Administrator user-actions API exists');
assert(fs.existsSync(path.join(root, 'api/system-admin/workspace-actions.js')), 'System Administrator workspace-actions API exists');
assert(fs.existsSync(path.join(root, 'api/system-admin/automation.js')), 'System Administrator automation API exists');
const tabGodMode = management.slice(management.indexOf('const TabGodMode'), management.indexOf('const TabLabor') > management.indexOf('const TabGodMode') ? management.indexOf('const TabLabor') : management.length);
for (const prohibited of ['superAdmins', 'crashReports', 'auditLogs', 'restaurantAdminAlerts', 'opsIntelligenceReports', 'pythonAutomationRuns', 'pythonAutomationConfigs', 'accountDeletionRequests']) {
  assert(!new RegExp(`listen\\(\\s*['"]${prohibited}['"]`).test(tabGodMode), `TabGodMode has no direct browser listener for ${prohibited}`);
}
for (const prohibited of ['pricing', 'dataRetention', 'rolePermissionMatrix', 'operationsReview', 'restoreDrillStatus']) {
  assert(!new RegExp(`doc\\(db,\\s*['"]system['"],\\s*['"]${prohibited}['"]`).test(tabGodMode), `TabGodMode has no direct browser system doc access for ${prohibited}`);
}
assert(!/doc\(db,\s*['"]pythonAutomationConfigs['"]/.test(tabGodMode), 'TabGodMode no longer directly writes pythonAutomationConfigs');
assert(!/doc\(db,\s*['"]aiRecommendationQueue['"]/.test(tabGodMode), 'TabGodMode no longer directly writes aiRecommendationQueue');
assert(fs.existsSync(path.join(root, 'scripts/run-repair-regression-pack.cjs')), 'repair regression pack runner exists');
assert(fs.existsSync(path.join(root, 'scripts/run-repair-browser-regression.cjs')), 'repair browser regression runner exists');
assert(fs.existsSync(path.join(root, 'scripts/repair-regression-pack-16.0.180.json')), 'repair regression pack manifest exists');
assert(fs.existsSync(path.join(root, 'scripts/86chaos-release-gate/repair-regression-16.0.180.json')), 'repair browser regression manifest exists');
for (const name of ['test:repair-current','test:repair-current:local','test:repair-current:browser','test:repair-current:strict','test:repair-16-0-174']) {
  assert(Boolean(pkg.scripts[name]), `${name} package script exists`);
}
const repairManifest = json('scripts/86chaos-release-gate/repair-regression-16.0.180.json');
const stable = new Set();
let dupes = 0;
for (const row of repairManifest.selected || []) {
  const key = [row.specPath, row.fullSuitePath, row.leafTitle, row.project].join('\0');
  if (stable.has(key)) dupes += 1;
  stable.add(key);
}
assert(dupes === 0, 'repair browser manifest has zero duplicate stable identities');


// Month View deterministic print repair.
assert(fs.existsSync(path.join(root, 'src/core/scheduleMonthPrint.cjs')), 'scheduleMonthPrint pure print module exists');

assert(schedule.includes("import scheduleMonthPrint from '../core/scheduleMonthPrint.cjs';"), 'Month View imports CommonJS print helper through default import for production build compatibility');
assert(!schedule.includes("import * as scheduleMonthPrint from '../core/scheduleMonthPrint.cjs';"), 'Month View no longer namespace-imports the CommonJS print helper');
assert(!/import\s*\{[^}]*openScheduleMonthPrintWindow[^}]*\}\s*from\s*['"]\.\.\/core\/scheduleMonthPrint\.cjs['"]/.test(schedule), 'Month View does not named-import openScheduleMonthPrintWindow from CommonJS helper');

assert(appScheduleImport.includes("import('./features/schedule')"), 'App still loads active Schedule from ./features/schedule');
assert(tabMonth.includes('monthCalendarModel') && tabMonth.includes('dayRows'), 'active Month View builds a shared monthCalendarModel/dayRows model');
assert(tabMonth.includes('scheduleMonthPrint.openScheduleMonthPrintWindow(monthCalendarModel)'), 'active Month View invokes dedicated print helper with frozen model');
assert(!/window\.print\s*\(/.test(tabMonth), 'active Month View button does not call main-window window.print');
assert(!/body \*\s*\{\s*visibility:\s*hidden/.test(tabMonth), 'active Month View no longer uses body-wide print visibility hijack');
assert(!/print-container/.test(tabMonth), 'active Month View official print root no longer uses generic print-container');
assert(scheduleMonthPrint.includes('data-calendar-month') && scheduleMonthPrint.includes('buildScheduleMonthPrintHtml'), 'print document exposes data-calendar-month identity');
assert(scheduleMonthPrint.includes('assertValidMonthKey') && !/new Date\(\)/.test(scheduleMonthPrint), 'print module validates explicit month and does not fall back to current date');
assert(scheduleMonthPrint.includes('<!doctype html>') && scheduleMonthPrint.includes('<html>') && scheduleMonthPrint.includes('<style>'), 'print document is standalone HTML with inline CSS');
assert(scheduleMonthPrint.includes('print-shift-stack') && scheduleMonthPrint.includes('print-day-dense') && scheduleMonthPrint.includes('font-size: 7px'), 'existing dense shift print layout remains represented');
assert(tabMonth.includes('fullLabel: labels.full') && tabMonth.includes('{s.fullLabel}'), 'full shift labels remain represented for screen and print model');
assert(monthPrintTest.includes('2026-08') && monthPrintTest.includes('2026-09') && monthPrintTest.includes('Invalid schedule print month') && monthPrintTest.includes('data-calendar-month="2026-07"'), 'month print pure regression covers deterministic months, invalid input, escaping, and frozen snapshots');
assert(printLayoutTest.includes('active Month View print path uses a dedicated isolated print helper') && printLayoutTest.includes('active Month View no longer relies on SPA-wide print visibility hijacking'), 'print layout source contract targets active Month View and helper');
assert(fs.existsSync(path.join(root, 'tests/e2e/month-view-print.spec.cjs')), 'Month View Playwright print regression spec exists');
assert(read('tests/e2e/month-view-print.spec.cjs').includes('Month View Print Calendar prints the currently selected month'), 'Month View Playwright print identity exists');
assert(fs.existsSync(path.join(root, 'scripts/repair-regression-pack-16.0.180.json')), '16.0.180 repair local manifest exists');
assert(fs.existsSync(path.join(root, 'scripts/86chaos-release-gate/repair-regression-16.0.180.json')), '16.0.180 repair browser manifest exists');
assert(read('scripts/run-repair-regression-pack.cjs').includes('repair-regression-pack-16.0.180.json'), 'repair pack runner points to 16.0.180 manifest');
assert(read('scripts/run-repair-browser-regression.cjs').includes('repair-regression-16.0.180.json'), 'repair browser runner points to 16.0.180 manifest');
const repairLocal172 = json('scripts/repair-regression-pack-16.0.180.json');
assert(repairLocal172.version === '16.0.180', 'repair local manifest version is 16.0.180');
assert((repairLocal172.localCommands || []).some((entry) => entry.group === 'Current Source Validator' && Array.isArray(entry.cmd) && entry.cmd.includes('scripts/validate-16-0-180.js')), 'repair local current source validator points to 16.0.180');
assert((repairLocal172.localCommands || []).some(entry => entry.group === 'Month View Print' && entry.cmd.includes('api/month-view-print-16-0-172.test.cjs') && entry.cmd.includes('api/print-calendar-layout.test.cjs')), 'Month View print local regression is included in repair pack');
const repairBrowser172 = json('scripts/86chaos-release-gate/repair-regression-16.0.180.json');
assert(repairBrowser172.version === '16.0.180', 'repair browser manifest version is 16.0.180');
assert((repairBrowser172.selected || []).some(row => row.specPath === 'tests/e2e/month-view-print.spec.cjs' && row.leafTitle === 'Month View Print Calendar prints the currently selected month' && row.project === 'chromium'), 'Month View browser print chromium identity is included');
assert((repairBrowser172.selected || []).some(row => row.specPath === 'tests/e2e/month-view-print.spec.cjs' && row.leafTitle === 'Month View Print Calendar prints the currently selected month' && row.project === 'mobile-chromium'), 'Month View browser print mobile identity is included');
assert(Boolean(pkg.scripts['test:repair-16-0-174']), 'test:repair-16-0-174 package script exists');
assert(pkg.scripts['test:play-store:failed-current'], 'failed-only infrastructure package script remains present');


// 16.0.180 staff login email edit and full-suite reporting repair.
const staffMember = read('api/staff-member.js');
const userActions = read('api/system-admin/user-actions.js');
const emailHelper = read('api/_account-email-change.cjs');
const fullSuite = read('RUN_86CHAOS_FULL_TEST_SUITE.ps1');
assert(fs.existsSync(path.join(root, 'api/_account-email-change.cjs')), 'canonical account email-change helper exists');
assert(emailHelper.includes('auth.updateUser(authUid, { email: newEmail, emailVerified: false })'), 'helper updates Firebase Auth email and sets emailVerified false');
assert(!/password\s*:/.test(emailHelper), 'helper never sets password in auth.updateUser');
assert(emailHelper.includes('auth.getUserByEmail(newEmail)') && emailHelper.includes('email-conflict'), 'helper detects Firebase email conflict');
assert(emailHelper.includes("db.collection('workspaceMembers')") && emailHelper.includes('membershipEmailPatch'), 'helper synchronizes workspaceMembers email aliases');
assert(emailHelper.includes('resolveAuthUser') && emailHelper.includes('getUserByEmail(currentEmail)'), 'helper supports legacy Auth/profile identity resolution');
assert(!emailHelper.includes('targetRef = db.collection') && emailHelper.includes('targetRef'), 'helper updates existing profile ref without renaming legacy profile doc IDs');
assert(emailHelper.includes('multi-workspace-email-change-requires-system-admin'), 'ordinary manager cannot globally change multi-workspace login email');
assert(emailHelper.includes('ctx.isSuperAdmin !== true') && emailHelper.includes('activeWorkspaceIds.length > 1'), 'System Administrator multi-workspace policy is explicit');
assert(emailHelper.includes('targetIsPrivileged') && emailHelper.includes('isProtectedRootAdminEmail'), 'owner/platform/protected-root target email changes are blocked');
assert(emailHelper.includes("forceLogoutReason: 'staff-email-changed'") && emailHelper.includes('auth.revokeRefreshTokens(authUid)'), 'successful change forces logout and attempts token revocation');
assert(emailHelper.includes('rolledBack: true') && emailHelper.includes('emailChangePartialFailure'), 'Firestore failure path contains Auth rollback handling and partial failure reporting');
assert(emailHelper.includes('STAFF_EMAIL_UPDATE'), 'STAFF_EMAIL_UPDATE audit action is present');
assert(staffMember.includes('changeAccountLoginEmail') && staffMember.includes('submittedEmail !== currentEmail'), 'staff-member update uses canonical helper when submitted email differs');
assert(!staffMember.includes('current.email || targetUser.email || body.email'), 'staff-member update no longer forces old email over body.email');
assert(userActions.includes('changeAccountLoginEmail') && userActions.includes("action === 'support-update'"), 'System Admin Support Edit uses the same canonical email helper');
const tabTeam = management.slice(management.indexOf('const TabTeam'), management.indexOf('const TabDailyClose') > management.indexOf('const TabTeam') ? management.indexOf('const TabDailyClose') : management.indexOf('const TabGodMode'));
assert(!tabTeam.includes('Cannot be changed after creation'), 'active Staff Roster edit email restriction text is gone');
assert(!/disabled=\{!!editingUserId\}/.test(tabTeam), 'active Staff Roster edit email field is enabled');
assert(tabTeam.includes("Changing this email changes the employee's login email"), 'Staff Roster explains login-email/session effect');
assert(!tabTeam.includes('updateEmail('), 'Staff Roster does not use client Firebase updateEmail');
assert(fs.existsSync(path.join(root, 'api/staff-email-change-16-0-173.test.cjs')), 'staff-email-change test exists');
assert(fs.existsSync(path.join(root, 'api/staff-email-edit-source-16-0-173.test.cjs')), 'staff-email-edit source test exists');
assert(fs.existsSync(path.join(root, 'tests/e2e/staff-email-edit.spec.cjs')), 'Staff email Playwright spec exists');
const repair173 = json('scripts/repair-regression-pack-16.0.180.json');
assert((repair173.localCommands || []).some(entry => entry.group === 'Staff Email Editing'), '16.0.180 repair local manifest includes Staff Email Editing');
const repairBrowser173 = json('scripts/86chaos-release-gate/repair-regression-16.0.180.json');
assert((repairBrowser173.selected || []).some(row => row.specPath === 'tests/e2e/staff-email-edit.spec.cjs' && row.leafTitle === 'Manager changes an employee login email and the new email authenticates' && row.project === 'chromium'), '16.0.180 repair browser manifest includes staff email chromium identity');
assert((repairBrowser173.selected || []).some(row => row.specPath === 'tests/e2e/staff-email-edit.spec.cjs' && row.project === 'mobile-chromium'), '16.0.180 repair browser manifest includes staff email mobile identity');
assert(fullSuite.includes('[PASS]') && fullSuite.includes('[FAIL]') && fullSuite.includes('[BLOCKED]') && fullSuite.includes('Add-BlockedStep'), 'exhaustive full-suite runner records PASS/FAIL/BLOCKED');
assert(fullSuite.includes('tests/86chaos-release-gate/*.test.cjs'), 'exhaustive runner runs ALL release-gate harness Node tests');
assert(fullSuite.includes('api/*.test.cjs'), 'exhaustive runner runs server tests');
assert(fullSuite.includes('npm run test:client'), 'exhaustive runner runs client tests');
assert(fullSuite.includes('npm run test:rules'), 'exhaustive runner runs rules tests');
assert(fullSuite.includes('npm run test:cost'), 'exhaustive runner runs cost tests');
assert(fullSuite.includes('npm run test:repair-current:local'), 'exhaustive runner runs repair-current:local');
assert(fullSuite.includes('npm run lint'), 'exhaustive runner runs lint');
assert(fullSuite.includes('npm run build'), 'exhaustive runner runs build');
assert(fullSuite.includes('npm run test:play-store'), 'exhaustive runner attempts full Play Store release gate');
assert(fullSuite.includes('FAILED-TESTS.txt') && fullSuite.includes('BLOCKED-TESTS.txt') && fullSuite.includes('TEST-SUMMARY.txt'), 'exhaustive runner creates readable summaries');
assert(fullSuite.includes('86chaos-FULL-SUITE-UPLOAD-ME-16.0.180'), 'full-suite upload ZIP is versioned and finalized');
assert(pkg.scripts['test:full-suite'] && pkg.scripts['test:full-suite:local'], 'full-suite package scripts exist');
assert(pkg.scripts['test:repair-16-0-180'] === 'npm run test:repair-current', 'test:repair-16-0-180 package script exists');
assert(fs.existsSync(path.join(root, 'scripts/test-16-0-180-targeted.cjs')), '16.0.180 targeted test script exists');



// 16.0.180 zero-fail orchestration/resilience/source contracts.
const eslintConfig = read('.eslintrc.cjs');
const costRunner = read('scripts/run-cost-regression-tests.js');
const costSpec176 = read('tests/e2e/cost-regression.spec.cjs');
const presenceWorkspaceSummary = read('api/presence-workspace-summary.js');
const systemAdminUserActions = read('api/system-admin/user-actions.js');
const runner176 = read('RUN_86CHAOS_FULL_TEST_SUITE.ps1');
assert(fs.existsSync(path.join(root, '.eslintrc.cjs')), 'root ESLint config exists');
assert(pkg.scripts.lint.includes('src/**/*.{js,jsx}') && pkg.scripts.lint.includes('api/**/*.js'), 'lint still covers src and api scopes');
assert(!pkg.scripts.lint.includes('|| exit 0') && !eslintConfig.includes('ignorePatterns'), 'lint is not bypassed or blanket ignored');
assert(eslintConfig.includes('no-unreachable') && eslintConfig.includes('valid-typeof'), 'ESLint catches unsafe JavaScript conditions');
assert(runner176.includes('Read-EnvFileMap') && runner176.includes('.env.test.local') && runner176.includes('Import-TestEnvFileForMutatingSuite'), 'full-suite reads .env.test.local for QA target resolution');
assert(runner176.includes('SafeProjectBlockReason') && runner176.includes('cheers-34b8d') && runner176.includes('__conflict__'), 'full-suite rejects production, conflicting, or unknown Firebase targets');
assert(runner176.includes('node scripts/setup-native-firestore-backup.js --dry-run --project=chaos-test-d1601'), 'backup dry run is explicitly scoped to QA');
assert(runner176.includes('node scripts/migrate-workspace-memberships.js --project=chaos-test-d1601'), 'workspace-memberships dry run is explicitly scoped to QA');
assert(runner176.includes('node scripts/migrate-reminder-dispatch-queue.js --dry-run --project=chaos-test-d1601'), 'reminder dry run is explicitly scoped to QA');
assert(runner176.includes('node scripts/migrate-schedule-query-fields.js --dry-run --project=chaos-test-d1601'), 'schedule dry run is explicitly scoped to QA');
assert(runner176.includes('node scripts/migrate-reminder-participants.js --dry-run --project=chaos-test-d1601'), 'participant dry run is explicitly scoped to QA');
assert(runner176.indexOf("Add-PlannedStep 'Cost / Firestore Regression'") > runner176.indexOf("Add-PlannedStep 'Full Browser Release Gate'"), 'cost regression is planned after browser producer');
assert(runner176.includes('Prepare-CostReportValidationEnv') && runner176.includes('.last-run.json'), 'cost regression requires current browser-run handoff');
assert(!runner176.includes('FIRESTORE_EMULATOR_HOST is not configured.'), 'cost report validation no longer blocks on unrelated emulator host');
assert(costRunner.includes('CHAOS_COST_EXPECTED_RUN_ID') && costRunner.includes('stale or wrong runId') && costRunner.includes('production Firebase'), 'cost validator enforces current-run/project/version provenance');
assert(costSpec176.includes('runId: process.env.CHAOS_RELEASE_GATE_RUN_ID') && costSpec176.includes('firebaseProjectId') && costSpec176.includes('expectedVersion') && costSpec176.includes('appUrl'), 'cost scenario reports contain provenance');
assert(presenceWorkspaceSummary.includes('withTimeout') && presenceWorkspaceSummary.includes('firestore-livePresence-fallback') && presenceWorkspaceSummary.includes("where('restaurantId', '==', restaurantId)") && presenceWorkspaceSummary.includes('empty-safe-fallback'), 'presence-workspace-summary has bounded RTDB and tenant-scoped fallback');
assert(management.includes("action: 'purge-workspace-users'") && management.includes("postSystemAdminAction('/api/system-admin/user-actions'"), 'Nuke Users UI routes user lifecycle through System Admin server action');
const nukeStart = management.indexOf('const handleNukeData');
const nukeEnd = management.indexOf('// --- SHOWCASE GENERATOR', nukeStart);
const usersNukeBranch = management.slice(management.indexOf("if (c === 'users')", nukeStart), management.indexOf('continue;', management.indexOf("if (c === 'users')", nukeStart)) + 'continue;'.length);
assert(!usersNukeBranch.includes('deleteDoc('), 'Nuke Users user-profile path no longer directly deleteDoc()s user profiles');
assert(systemAdminUserActions.includes('purge-workspace-users') && systemAdminUserActions.includes('workspaceMembers') && systemAdminUserActions.includes('multiWorkspacePreserved') && systemAdminUserActions.includes('SYSTEM_ADMIN_PURGE_WORKSPACE_USERS'), 'server purge uses canonical workspace membership lifecycle and audit');
assert(fs.existsSync(path.join(root, 'api/release-integrity-account-lifecycle-16-0-177.test.cjs')), '16.0.180 release-integrity/account-lifecycle regression exists');
assert(fs.existsSync(path.join(root, 'api/full-suite-windows-runner-16-0-176.test.cjs')), 'full-suite runner regression baseline remains present');
assert(fs.existsSync(path.join(root, 'api/presence-workspace-summary-16-0-176.test.cjs')), 'presence resilience regression baseline remains present');
assert(fs.existsSync(path.join(root, 'api/system-admin-nuke-users-16-0-176.test.cjs')), 'Nuke Users regression baseline remains present');
assert(fs.existsSync(path.join(root, 'api/cost-provenance-16-0-176.test.cjs')), 'cost provenance regression baseline remains present');
assert(fs.existsSync(path.join(root, 'api/lint-config-16-0-176.test.cjs')), 'lint regression baseline remains present');
assert(fs.existsSync(path.join(root, 'api/dependency-security-16-0-176.test.cjs')), 'dependency-security regression baseline remains present');

assert(fs.existsSync(path.join(root, 'api/vite-lock-integrity-16-0-180.test.cjs')), '16.0.180 Vite lock integrity regression exists');

if (failures) { console.error(`\n${failures} validation check(s) failed.`); process.exit(1); }

assert(read('scripts/validate-16-0-176.js').includes("scripts/test-16-0-176-targeted.cjs"), 'historical 16.0.176 validator checks the 16.0.176 targeted script');
const historical176Manifest = json('scripts/repair-regression-pack-16.0.176.json');
assert((historical176Manifest.localCommands || []).some(entry => entry.group === 'Current Source Validator' && (entry.cmd || []).join(' ') === 'node scripts/validate-16-0-176.js'), 'historical 16.0.176 repair manifest uses the 16.0.176 validator');
assert(fs.existsSync(path.join(root, 'api/release-integrity-account-lifecycle-16-0-177.test.cjs')), '16.0.180 release integrity/account lifecycle regression exists');
assert(read('RUN_86CHAOS_FULL_TEST_SUITE.ps1').includes('Cost regression depends on a successful current Full Playwright release gate.'), 'cost regression depends on current browser PASS');
assert(read('api/system-admin/user-actions.js').includes('authRollbackAttempted'), 'Nuke Users purge records Auth rollback attempts');
assert(read('api/system-admin/user-actions.js').includes('ownerUid'), 'Nuke Users purge protects restaurant ownerUid');


// 16.0.180 ESLint ESM API parser-scope repair.
const eslintConfig179 = read('.eslintrc.cjs');
assert(eslintConfig179.includes("files: ['api/**/*.js']") && eslintConfig179.includes("sourceType: 'script'"), 'general API ESLint override remains script/CommonJS scoped');
assert(eslintConfig179.includes("files: ['api/alerts.js', 'api/scan.js', 'api/send-push.js', 'api/send-schedule-alert.js']"), 'four ESM API endpoints have a narrow ESLint override');
assert(eslintConfig179.includes("parserOptions: { sourceType: 'module', ecmaVersion: 2022 }"), 'ESM API override parses import/export as modules');
assert(fs.existsSync(path.join(root, 'api/lint-esm-api-16-0-179.test.cjs')), '16.0.180 ESM API lint regression exists');

console.log('\n16.0.180 source validation passed.');
