#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
let failures = 0;
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function sha(file) { return crypto.createHash('sha256').update(read(file)).digest('hex'); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function assert(condition, message) { if (!condition) { failures += 1; console.error(`FAIL: ${message}`); } else console.log(`OK: ${message}`); }
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const app = read('src/App.js');
const hr = read('src/features/hr.jsx');
const intelligence = read('src/features/intelligence.jsx');
const management = read('src/features/management.jsx');
const schedule = read('src/features/schedule.jsx');
const planner = read('src/core/scheduleQueryPlanner.js');
const presenceSummary = read('api/presence-workspace-summary.js');
const presenceSnapshot = read('api/presence-snapshot.js');
const auditScript = read('scripts/audit-schedule-query-fields.js');
const preflight = read('scripts/86chaos-release-gate/dependency-preflight.cjs');
const repairPack = json('scripts/repair-regression-pack-16.0.193.json');
const browserPack = json('scripts/86chaos-release-gate/repair-regression-16.0.193.json');

assert(pkg.version === '16.0.193', 'package.json version is 16.0.193');
assert(lock.version === '16.0.193' && lock.packages?.['']?.version === '16.0.193', 'package-lock root version is 16.0.193');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-193.js', 'test:source points to 16.0.193 validator');
assert(pkg.scripts['test:repair-16-0-193'] === 'npm run test:repair-current', 'test:repair-16-0-193 exists');
assert(version.version === '16.0.193' && version.build === '16.0.193', 'public version/build are 16.0.193');
assert(/CURRENT_VERSION = '16\.0\.193'/.test(appCore), 'app core CURRENT_VERSION is 16.0.193');
assert(/APP_VERSION = '16\.0\.193'/.test(read('api/_version.js')), 'api version is 16.0.193');
assert(read('RUN_86CHAOS_FULL_TEST_SUITE.ps1').includes('test-16-0-193-targeted.cjs'), 'full suite uses 16.0.193 targeted validator');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');

assert(appCore.includes("LOW_COST_PRESENCE_TREE = 'status'"), 'presence writes use authorized status tree');
assert(appCore.includes("LOW_COST_PRESENCE_SUMMARY_TREE = 'statusSummary'"), 'presence summary uses authorized statusSummary tree');
assert(appCore.includes('auth?.currentUser?.uid') || appCore.includes('auth.currentUser?.uid'), 'presence path owner uses Firebase Auth UID');
assert(appCore.includes('rtdbOnDisconnect(sessionRef).remove()'), 'presence sessions are removed by onDisconnect');
assert(!management.includes('TRUE_ONLINE_WINDOW_MS'), 'System Administrator no longer uses 90-second authoritative online cutoff');
assert(management.includes('Online truth: Active RTDB sessions'), 'System Administrator labels active sessions as online truth');
assert(!appCore.includes('rtdbSet(summaryRef, { ...onlinePayload'), 'client connect does not duplicate online state to statusSummary');
assert(exists('docs/firebase-efficiency-16.0.192-report.md') && exists('docs/firebase-efficiency-16.0.192-report.json'), '16.0.192 before/after efficiency report exists');
assert(exists('api/firebase-efficiency-finalization-16-0-192.test.cjs'), '16.0.192 finalization behavioral tests exist');
assert(exists('api/app-only-package-hygiene-16-0-193.test.cjs'), '16.0.193 app-only package hygiene test exists');

assert(!appCore.includes("LOW_COST_PRESENCE_TREE = 'presence'"), 'unauthorized presence tree removed');
assert(presenceSummary.includes('status/${restaurantId}') && !presenceSummary.includes('presence/${restaurantId}'), 'workspace presence summary reads status sessions');
assert(presenceSnapshot.includes('status/${restaurantId}') || presenceSnapshot.includes('status/'), 'manual presence snapshot reads status sessions');
assert(presenceSnapshot.includes('active session row(s) online'), 'presence snapshot no longer describes heartbeat freshness as online truth');

assert(app.includes('workspacePresenceCacheRef') && app.includes('45_000'), 'Team presence path has bounded cache');
assert(app.includes('live: !wantsToday'), 'Today/Manager Brief collection reads use snapshot mode instead of permanent broad listeners');
assert(read('src/features/operations.jsx').includes("useLiveCollection('opsIntelligenceReports'") && read('src/features/operations.jsx').includes('live: false'), 'Today ops intelligence uses bounded snapshot reads');
assert(read('src/features/operations.jsx').includes('refresh-manager-brief'), 'Today exposes Refresh Brief control');
assert(app.includes('legacyScheduleDateKeyShiftClauses'), 'My Schedule preserves legacy date-key compatibility and hardened rescue wiring');
assert(planner.includes('scheduleUserId ? [...ownUserClause'), 'My Schedule uses canonical scheduleUserId query where available');
assert(hr.includes('getCountFromServer') && hr.includes('hrOverviewActive'), 'HR overview uses aggregate counts and gated section loading');
assert(intelligence.includes('dependencyGraphOpen') && intelligence.includes('scanCursor') && intelligence.includes('startAfter(scanCursor)'), 'Menu Intelligence dependency graph is lazy and scan history uses cursor pagination');
assert(management.includes('startAfter(auditCursor)') && management.includes('AUDIT_PAGE_SIZE = 50'), 'Audit Log uses cursor pagination');
assert(management.includes('Firebase Efficiency') && management.includes('getFirebaseUsageDiagnostics'), 'System Administrator exposes local Firebase efficiency diagnostics');
assert(schedule.includes('buildCanonicalShiftDateFields') && schedule.includes('shiftDate') && schedule.includes('scheduleMonth'), 'active schedule write paths use canonical date fields');
assert(exists('scripts/audit-schedule-query-fields.js'), 'read-only schedule query-field audit utility exists');
assert(!/batch\.commit\(|updateDoc|setDoc|deleteDoc/.test(auditScript), 'schedule audit utility contains no write capability');
assert(exists('public/wisco.png'), 'unrelated wisco.png asset restored/preserved');

assert(app.includes("cacheScope: wantsToday ? \'today-brief\' : \'\'"), 'Today snapshot queries carry today-brief cache scope');
assert(app.includes("cacheScope: 'today-brief'"), 'Refresh Brief invalidates today-brief cache scope only');
assert(!app.includes('45_000 + todayRefreshNonce'), 'Refresh Brief no longer mutates Today TTL');
assert(app.includes('roster: users || []'), 'live My Schedule rescue uses loaded roster for legacy identity safety');
assert(!app.includes('maxPages: 12'), 'live My Schedule rescue has no silent maxPages=12 ceiling');
assert(exists('src/core/cacheScope.cjs'), 'shared cache scope matcher exists');
assert(exists('src/core/scheduleRescueDiagnostics.cjs'), 'shared My Schedule rescue diagnostics helper exists');
assert(exists('docs/firebase-efficiency-16.0.192-report.md') && exists('docs/firebase-efficiency-16.0.192-report.json'), '16.0.192 before/after efficiency report exists');
assert(exists('api/firebase-efficiency-finalization-16-0-192.test.cjs'), '16.0.192 behavior tests exist');
assert(exists('api/app-only-package-hygiene-16-0-193.test.cjs'), '16.0.193 package hygiene test exists');
assert(exists('src/core/scheduleIdentity.cjs'), 'shared My Schedule identity module exists');
assert(!planner.includes('const MY_SCHEDULE_ID_FIELDS') && !planner.includes('function normalizeMyScheduleEmailValue') && !planner.includes('const uniqueRosterMatch'), 'scheduleQueryPlanner has no duplicate My Schedule identity algorithm');
assert(planner.includes('scheduleIdentity.shiftMatchesMyScheduleIdentity(shift, user, roster)'), 'scheduleQueryPlanner delegates to shared My Schedule identity matcher');
assert(app.includes('buildMyScheduleRosterIdentityFingerprint'), 'live My Schedule rescue reruns on roster identity-state changes');
assert(schedule.includes('Schedule may be incomplete') && schedule.includes('Retry legacy shifts'), 'My Schedule exposes incomplete legacy rescue warning and retry');
assert(schedule.includes('scheduleRescueWarningView.technicalError') && !schedule.includes('permissions?.schedule) && myScheduleLegacyRescueState?.error'), 'technical rescue error is not gated by ordinary schedule permission');
assert(read('src/core/scheduleEfficiency.cjs').includes('employeeIdIndexedQueryCount: 0'), 'legacy planner removes redundant employeeId indexed fanout');
assert(read('src/core/scheduleEfficiency.cjs').includes('advanceMyScheduleRescueRetryTelemetry'), 'legacy rescue retry telemetry helper exists');
assert(exists('docs/firebase-efficiency-16.0.192-report.md') && exists('docs/firebase-efficiency-16.0.192-report.json'), '16.0.192 before/after efficiency report exists');


assert(exists('api/authenticated-section-load-runtime-16-0-193.test.cjs'), '16.0.193 authenticated section-load runtime regression exists');
const liveStateStart = appCore.indexOf('export const useLiveCollectionState');
const liveStateEnd = appCore.indexOf('export const makeLiveDocumentKey', liveStateStart);
const liveStateHook = liveStateStart >= 0 && liveStateEnd > liveStateStart ? appCore.slice(liveStateStart, liveStateEnd) : '';
assert(/debugLabel\s*=\s*['"]['"]\s*,\s*cacheScope\s*=\s*['"]['"]/.test(liveStateHook), 'useLiveCollectionState binds cacheScope before using it');
assert(/acquireSharedLiveCollection\(\{[^}]*cacheScope[^}]*\}\)/s.test(liveStateHook), 'useLiveCollectionState propagates cacheScope to shared listener');
assert(/\[[^\]]*cacheScope[^\]]*normalizeWhereClausesForKey/s.test(liveStateHook), 'useLiveCollectionState tracks cacheScope in effect dependencies');

assert(preflight.includes('require.resolve(name, { paths: [root] })'), 'dependency preflight resolves package entrypoint first');
assert(!/Required local test module is missing[^\n]+package\.json subpath/.test(preflight), 'dependency preflight does not use package.json subpath as presence test');
assert(preflight.includes('packageJsonExportErrorCode') || preflight.includes('ERR_PACKAGE_PATH_NOT_EXPORTED'), 'dependency preflight distinguishes package exports metadata failures');
assert(exists('api/firebase-efficiency-finalization-16-0-192.test.cjs'), '16.0.192 Firebase efficiency completion regression exists');
assert(exists('scripts/test-16-0-193-targeted.cjs'), '16.0.193 targeted test script exists');
assert(repairPack.version === '16.0.193', 'repair local manifest version is 16.0.193');
assert(browserPack.version === '16.0.193', 'repair browser manifest version is 16.0.193');
assert(read('scripts/run-repair-regression-pack.cjs').includes('repair-regression-pack-16.0.193.json'), 'repair local pointer uses 16.0.193');
assert(read('scripts/run-repair-browser-regression.cjs').includes('repair-regression-16.0.193.json'), 'repair browser pointer uses 16.0.193');

if (failures) { console.error(`\n16.0.193 source validation failed with ${failures} issue(s).`); process.exit(1); }
console.log('\n16.0.193 source validation passed.');
