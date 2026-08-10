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

assert(pkg.version === '16.0.170', 'package.json version is 16.0.170');
assert(lock.version === '16.0.170' && lock.packages?.['']?.version === '16.0.170', 'package-lock root versions are 16.0.170');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-170.js', 'test:source points to 16.0.170 validator');
assert(version.version === '16.0.170' && version.build === '16.0.170', 'public/version.json version/build are 16.0.170');
assert(version.releaseTitle === 'System Administrator Authoritative People Directory Repair', 'release title is correct');
assert(appCore.includes("CURRENT_VERSION = '16.0.170'"), 'app core CURRENT_VERSION is 16.0.170');
assert(apiVersion.includes("APP_VERSION = '16.0.170'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.170'"), 'api version reports 16.0.170');
assert(!fs.existsSync(path.join(root, 'scripts/validate-16-0-169.js')), 'previous validator was replaced');

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

if (failures) { console.error(`\n${failures} validation check(s) failed.`); process.exit(1); }
console.log('\n16.0.170 source validation passed.');
