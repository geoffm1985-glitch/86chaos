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
const app = read('src/App.js');
const appCore = read('src/core/appCore.js');
const planner = read('src/core/scheduleQueryPlanner.js');
const apiVersion = read('api/_version.js');
const vercel = json('vercel.json');
const management = read('src/features/management.jsx');
const customShiftApi = read('api/custom-shift-presets.js');
const schedule = read('src/features/schedule.jsx');
const presenceApi = read('api/presence-workspace-summary.js');
const sinceRunner = read('scripts/run-tests-since-16-0-170.cjs');

assert(pkg.version === '16.0.201', 'package.json version is 16.0.201');
assert(lock.version === '16.0.201' && lock.packages?.['']?.version === '16.0.201', 'package-lock root versions are 16.0.201');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-201.js', 'test:source points to 16.0.201 validator');
assert(version.version === '16.0.201' && version.build === '16.0.201', 'public/version.json version/build are 16.0.201');
assert(version.releaseTitle === 'Firebase Cost and Maturity Optimization Pass', '16.0.201 release title identifies cost optimization pass');
assert(appCore.includes("CURRENT_VERSION = '16.0.201'"), 'app core CURRENT_VERSION is 16.0.201');
assert(apiVersion.includes("APP_VERSION = '16.0.201'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.201'"), 'api version reports 16.0.201');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');

const cronPaths = (vercel.crons || []).map(c => c.path);
assert(!cronPaths.includes('/api/firestore-backup'), 'legacy JSON Firestore backup is no longer automatically invoked by Vercel cron');
assert(cronPaths.includes('/api/firestore-backup-watchdog'), 'native Firestore backup watchdog cron remains scheduled');
assert(fs.existsSync(path.join(root, 'api/firestore-backup.js')), 'manual/emergency JSON Firestore backup endpoint remains present');
assert(management.includes('manual/emergency-only') && management.includes('native Firestore scheduled backups'), 'Backup UI/manual text explains native automatic backups and manual JSON exporter');
assert(!/confirm \/api\/firestore-backup ran near|both backup cron routes/.test(management), 'Backup help no longer instructs admins to expect daily custom JSON backup cron');

assert(planner.includes('shouldEnableScheduleDateKeyRescue') && planner.includes('scheduleLegacyRescueKnownForRange'), 'schedule planner exposes canonical-first legacy rescue decision');
assert(app.includes("const rawDateShiftsState = useLiveCollectionState('shifts'") && app.includes('enableScheduleDateKeyRescue = shouldEnableScheduleDateKeyRescue'), 'App loads canonical date shifts first before scheduleDateKey rescue');
assert(app.includes('enabled: !!rId && enableScheduleDateKeyRescue') && !app.includes('enabled: !!rId && wantsShiftData && wantsScheduleScreen, whereClauses: scheduleDateKeyShiftClauses'), 'scheduleDateKey rescue listener is no longer blindly enabled for every schedule screen');
assert(read('src/core/scheduleQueryPlanner.test.js').includes('scheduleDateKey rescue stays off when canonical schedule rows are loaded'), 'schedule query tests cover canonical-only windows skipping rescue');
assert(read('src/core/scheduleQueryPlanner.test.js').includes('scheduleDateKey rescue turns on for empty canonical windows or known legacy rescue months'), 'schedule query tests cover legacy rescue activation');

assert(app.includes('debouncedGlobalSearchQuery') && app.includes('globalSearchHasMeaningfulQuery = isGlobalSearchOpen && debouncedGlobalSearchQuery.length >= 2'), 'Global Search uses meaningful debounced query demand signal');
const demandBlock = app.slice(app.indexOf('const wantsInventoryData'), app.indexOf("const users = useLiveCollection('users'"));
assert(demandBlock.includes('globalSearchHasMeaningfulQuery') && !demandBlock.includes('|| isGlobalSearchOpen'), 'Global Search no longer opens heavyweight app-level listeners merely because the modal opens');
assert(demandBlock.includes('const wantsRecipesData = globalSearchHasMeaningfulQuery'), 'recipe listener demand is search-text driven');

assert(appCore.includes('adaptiveReleaseGraceMs') && appCore.includes('RELEASE_GRACE_BY_COLLECTION'), 'shared listener retention is adaptive by collection/local diagnostics');
assert(appCore.includes('documentsReceivedInitial') && appCore.includes('documentsReceivedChanges') && appCore.includes('releaseGraceMs'), 'listener diagnostics include read/change counts and selected retention grace');

assert(customShiftApi.includes('writeSkipped: true') && customShiftApi.includes('noChange: true'), 'custom shift update skips no-op writes after authorized existing read');
assert(customShiftApi.includes("return res.status(200).json({ ok: true, action, restaurantId, preset });"), 'custom shift create/update returns changed object without full collection reread');
assert(customShiftApi.includes("return res.status(200).json({ ok: true, action: 'delete', restaurantId, id });"), 'custom shift delete returns ID/status without full collection reread');
assert((customShiftApi.match(/dedupePresets\(await readRows\(db, restaurantId\)\)/g) || []).length === 2, 'custom shift readRows is limited to GET/list and merge pre-dedupe, not post-mutation refreshes');
assert(schedule.includes('json.presets ? dedupePresetClient') && schedule.includes("filter(preset => String(preset.id || '') !== String(id || ''))"), 'Schedule Builder updates local custom preset state from mutation result when server does not reread collection');

assert(presenceApi.includes('PRESENCE_SUMMARY_TIMEOUT_MS') && presenceApi.includes('withTimeout(ctx.app.database().ref(`statusSummary/${restaurantId}`).once'), 'presence summary RTDB read has bounded internal timeout');
assert(presenceApi.includes("err?.code === 'presence-summary-timeout' ? 504 : 500"), 'presence summary returns controlled 504 on bounded timeout');
assert(app.includes('keeping last-known-good summary') && !/Workspace presence summary unavailable:[\s\S]{0,140}setWorkspacePresenceRecords\(\[\]\)/.test(app), 'client keeps last-known-good workspace presence rows on refresh failure');

assert(sinceRunner.includes('api/firebase-cost-optimization-16-0-201.test.cjs'), 'targeted runner includes 16.0.201 Firebase cost optimization regression');
assert(fs.existsSync(path.join(root, 'api/failed-only-browser-gate-16-0-200.test.cjs')), '16.0.200 failed-only browser gate regression remains present');
assert(fs.existsSync(path.join(root, 'scripts/validate-16-0-200.js')), '16.0.200 validator remains available');

if (failures) {
  console.error(`16.0.201 source validation failed with ${failures} failure(s).`);
  process.exit(1);
}
console.log('16.0.201 source validation passed.');
