#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const sha = file => crypto.createHash('sha256').update(read(file)).digest('hex');
let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log(`OK: ${message}`);
  else { failures += 1; console.error(`FAIL: ${message}`); }
};

const inherited = childProcess.spawnSync(process.execPath, ['scripts/validate-16-0-231.js'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    CHAOS_VALIDATION_VERSION: '16.0.232',
    CHAOS_VALIDATION_RELEASE_TITLE: 'Schedule Integrity Evidence and Canonical Date Writes',
    CHAOS_VALIDATION_SCRIPT: 'scripts/validate-16-0-232.js'
  }
});
if (inherited.stdout) process.stdout.write(inherited.stdout);
if (inherited.stderr) process.stderr.write(inherited.stderr);
assert(inherited.status === 0, 'all inherited 16.0.231 source, security, UI, reminder, AI and release-evidence invariants pass');

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const apiVersion = read('api/_version.js');
const appCore = read('src/core/appCore.js');
const app = read('src/App.js');
const schedule = read('src/features/schedule.jsx');
const management = read('src/features/management.jsx');
const shared = read('src/core/scheduleIntegrity.shared.js');
const browser = read('src/core/scheduleIntegrity.js');
const audit = read('api/schedule-integrity-audit.js');
const schemaDoctor = read('api/schema-doctor.js');

assert(pkg.version === '16.0.232', 'package.json version is 16.0.232');
assert(lock.version === '16.0.232' && lock.packages?.['']?.version === '16.0.232', 'package-lock root versions are 16.0.232');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-232.js' && pkg.scripts['validate:16.0.232'] === 'node scripts/validate-16-0-232.js', 'source and explicit 16.0.232 validators are wired');
assert(version.version === '16.0.232' && version.build === '16.0.232' && version.releaseTitle === 'Schedule Integrity Evidence and Canonical Date Writes', 'public version metadata and release title identify 16.0.232');
assert(apiVersion.includes("APP_VERSION = '16.0.232'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.232'"), 'API reports 16.0.232');
assert(appCore.includes("CURRENT_VERSION = '16.0.232'"), 'app reports 16.0.232');
assert(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '16.0.232'") && read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '16.0.232'"), 'customer help version mirrors remain synchronized');

assert(shared.includes('buildCanonicalScheduleDatePatch') && shared.includes('scheduleDateKey: date') && shared.includes("scheduleMonth: date.slice(0, 7)"), 'one pure helper constructs canonical date mirrors');
assert(shared.includes('buildScheduleQuickEditMutation') && shared.includes('changedFields.length === 0'), 'pure quick-edit planner suppresses unchanged mutations');
assert(browser.includes("import './scheduleIntegrity.shared.js'"), 'browser schedule integrity entry point uses the shared pure implementation');
assert(schedule.includes('...buildCanonicalScheduleCreateFields(d, appUser.restaurantId)') && schedule.includes('buildCanonicalScheduleCreateFields(date, appUser.restaurantId)'), 'Builder, templates and Smart Fill use canonical new-shift fields');
assert(schedule.includes("const canonicalFields = buildCanonicalScheduleCreateFields(date, appUser.restaurantId)") && schedule.includes("source: 'schedule_copy_week'"), 'Copy Previous Week uses canonical date and tenant mirrors');
assert(schedule.includes("const mutation = buildScheduleQuickEditMutation(shift, { date: targetDate }") && schedule.includes("getShiftDateKey(shift) === targetDate"), 'desktop drag uses canonical mutation planning and same-date no-op suppression');
assert(schedule.includes("getShiftDateKey(shift) === String(patch.date || '').trim()") && schedule.includes("recordScheduleOperationDiagnostic('skippedNoOpWrites')"), 'mobile move and quick edit suppress same-value writes');
assert(schedule.includes("resolvedPerson || { ...sourceShift, id: '' }") && schedule.includes("matchedPerson || { ...s, id: '' }"), 'new shift paths explicitly prevent a shift document id becoming person identity');

for (const classification of ['HEALTHY', 'LEGACY_BUT_VALID', 'AMBIGUOUS', 'ORPHANED', 'MALFORMED', 'DUPLICATE_CANDIDATE', 'UNVERIFIABLE']) {
  assert(shared.includes(`${classification}: '${classification}'`), `audit classifier supports ${classification}`);
}
assert(shared.includes("incomplete identity lookup") && shared.includes("incomplete scan") && shared.includes("missing tenant attribution"), 'incomplete evidence is explicit and cannot silently pass as healthy');
assert(audit.includes("allowTenantAdmin: true, targetRestaurantId: restaurantId") && audit.includes("where(plan.field, '==', restaurantId)"), 'audit authorization and complete scans remain workspace-scoped');
assert(audit.includes('readOnly: true') && audit.includes('writesPerformed: 0') && !/writeAudit\s*\(|\b(?:addDoc|updateDoc|deleteDoc|setDoc|writeBatch)\s*\(|\bdb\.batch\s*\(/.test(audit), 'Schedule Integrity Audit contains no Firestore mutation operation');
assert(audit.includes('streamCursor.done === true') && audit.includes('nextCursor[plan.key] = { after:'), 'complete audit cursor preserves independent tenant-stream exhaustion');
assert(audit.includes('sdkQueryAttempts') && audit.includes('scheduleDocumentsReturned') && audit.includes("not an exact Firestore billing calculation"), 'audit returns measured operation evidence without an unsupported billing claim');
assert(management.includes("secureFetch('/api/schedule-integrity-audit'") && management.includes('Schedule Integrity Audit (Read Only)'), 'existing System Administrator hardening panel exposes the read-only audit');

assert(schemaDoctor.includes('Tenant-scoped ${collectionName} scan failed closed') && !schemaDoctor.includes("query.get().catch(async () => db.collection(collectionName).limit(200).get())"), 'Schema Doctor cannot fall back from a tenant query to an unscoped scan');
assert(fs.existsSync(path.join(root, 'api/schedule-integrity-audit.test.cjs')) && fs.existsSync(path.join(root, 'src/core/scheduleIntegrity.test.js')), 'focused server and client schedule integrity regressions are included');
assert(read('docs/16.0.232-deferred-risks.md').includes('Existing schedule records are deleted') && read('docs/16.0.232-deferred-risks.md').includes('does not redesign restore semantics'), 'verified destructive restore delivery-order risk is documented and deferred');
assert(appCore.includes("includes('scheduleDateKey-rescue')") && appCore.includes('scheduleDiagnostics.rescueQueryExecutions += 1') && app.includes("recordScheduleOperationDiagnostic('rescueActivation'"), 'rescue execution and activation reasons are measured without replacing listeners');
assert(appCore.includes('directSdkWrites') && appCore.includes('batchedWriteOperations') && appCore.includes('auditWrites: 0'), 'schedule diagnostics distinguish direct, batched, no-op and zero-write audit evidence');

const unchanged = {
  'firestore.rules': '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9',
  'firestore.indexes.json': 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b',
  'storage.rules': '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c',
  'database.rules.json': '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138',
  'firebase.json': 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4',
  'public/firebase-messaging-sw.js': '46c7f5760350721d424ba6db9a3a9127449fbb670a24b04328e71d3a74ed2366',
  'vercel.json': '3a42afbec525fe1abfe52f28d9b973c9494bdaca6edf3b0ed1a43f30c69db276'
};
for (const [file, expected] of Object.entries(unchanged)) assert(sha(file) === expected, `${file} unchanged`);

if (failures) {
  console.error(`16.0.232 source validation failed with ${failures} failure(s).`);
  process.exit(1);
}
console.log('16.0.232 source validation passed.');
