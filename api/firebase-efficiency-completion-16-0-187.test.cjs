'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'firebase-admin') {
    return { apps: [], initializeApp: () => ({}), credential: { cert: () => ({}) }, firestore: { FieldPath: { documentId: () => '__name__' }, Timestamp: { now: () => ({}) } } };
  }
  if (String(request).endsWith('/_firebase-project-admin') || request === './_firebase-project-admin') {
    return { TRUSTED_PROJECTS: new Set(['chaos-test-d1601', 'cheers-34b8d']), getAdminAppForProject: () => ({ firestore: () => ({}) }) };
  }
  return originalLoad.apply(this, arguments);
};
const presenceSummary = require('./presence-workspace-summary.js')._test;
const scheduleAudit = require('../scripts/audit-schedule-query-fields.js');
Module._load = originalLoad;

test('presence aggregation follows frozen RTDB status/session contract and multi-device truth', () => {
  const old = Date.now() - (12 * 60 * 1000);
  const rows = presenceSummary.aggregateRtdbDevicePresence({
    firebaseUidA: {
      sessions: {
        desktop: { online: true, connectedAt: old, deviceId: 'device-desktop', userId: 'appUserA' },
        phone: { online: true, connectedAt: old + 1000, deviceId: 'device-phone', userId: 'appUserA' }
      }
    },
    firebaseUidB: { sessions: {} }
  }, 'cheers');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].online, true);
  assert.equal(rows[0].activeSessionCount, 2);
  assert.equal(rows[0].firebaseAuthUid, 'firebaseUidA');
  assert.equal(rows[0].presenceSource, 'rtdb-status-sessions-api');

  const oneSessionLeft = presenceSummary.aggregateRtdbDevicePresence({ firebaseUidA: { sessions: { phone: { online: true, connectedAt: old } } } }, 'cheers');
  assert.equal(oneSessionLeft[0].online, true);
  assert.equal(oneSessionLeft[0].activeSessionCount, 1);

  const noSessionsLeft = presenceSummary.aggregateRtdbDevicePresence({ firebaseUidA: { sessions: {} } }, 'cheers');
  assert.equal(noSessionsLeft.length, 0);
});

test('client presence uses Firebase Auth UID status path and avoids unauthorized presence tree/heartbeat', () => {
  const appCore = read('src/core/appCore.js');
  const dbRules = read('database.rules.json');
  assert.match(dbRules, /"status"/);
  assert.match(dbRules, /"statusSummary"/);
  assert.doesNotMatch(dbRules, /"presence"\s*:/);
  assert.match(appCore, /LOW_COST_PRESENCE_TREE = 'status'/);
  assert.match(appCore, /LOW_COST_PRESENCE_SUMMARY_TREE = 'statusSummary'/);
  assert.match(appCore, /auth\?\.currentUser\?\.uid/);
  assert.match(appCore, /authUidKey/);
  assert.match(appCore, /rtdbOnDisconnect\(sessionRef\)\.remove\(\)/);
  assert.doesNotMatch(appCore, /LOW_COST_PRESENCE_TREE = 'presence'/);
  assert.doesNotMatch(appCore, /setInterval\([^)]*presence/i);
  assert.doesNotMatch(appCore, /collectionName:\s*['"]livePresence['"]/);
});

test('Today, HR overview, Menu Intelligence, and Audit Log use bounded demand loading paths', () => {
  const app = read('src/App.js');
  const hr = read('src/features/hr.jsx');
  const intelligence = read('src/features/intelligence.jsx');
  const management = read('src/features/management.jsx');
  assert.match(app, /live:\s*!wantsToday/);
  assert.match(app, /legacyScheduleDateKeyShiftClauses/);
  assert.match(hr, /getCountFromServer/);
  assert.match(hr, /hrOverviewActive/);
  assert.match(hr, /activeTab === 'manuals'/);
  assert.match(intelligence, /dependencyGraphOpen/);
  assert.match(intelligence, /scanCursor/);
  assert.match(intelligence, /startAfter\(scanCursor\)/);
  assert.doesNotMatch(intelligence, /setScanPageLimit\(v => v \+ 20\)/);
  assert.match(management, /startAfter\(auditCursor\)/);
  assert.match(management, /AUDIT_PAGE_SIZE = 50/);
  assert.doesNotMatch(management, /const logs = useLiveCollection\('auditLogs'/);
});

test('schedule canonical writes and read-only audit utility preserve legacy rescue without mutation', () => {
  const schedule = read('src/features/schedule.jsx');
  const app = read('src/App.js');
  const planner = read('src/core/scheduleQueryPlanner.js');
  const auditScript = read('scripts/audit-schedule-query-fields.js');
  assert.match(schedule, /buildCanonicalShiftDateFields/);
  assert.match(schedule, /scheduleDateKey/);
  assert.match(schedule, /shiftDate/);
  assert.match(schedule, /scheduleMonth/);
  assert.match(planner, /ownUserClause/);
  assert.match(planner, /scheduleUserId \? \[\.\.\.ownUserClause/);
  assert.match(app, /legacyScheduleDateKeyShiftClauses/);
  assert.doesNotMatch(auditScript, /batch\.commit\(/);
  assert.doesNotMatch(auditScript, /updateDoc|setDoc|deleteDoc|batch\.commit/);
  assert.match(auditScript, /READ ONLY/);
  const summary = scheduleAudit.analyze([
    { id: 'good', scheduleUserId: 'u1', date: '2026-08-11', scheduleDateKey: '2026-08-11', scheduleMonth: '2026-08' },
    { id: 'legacy', employeeId: 'u2', shiftDate: '2026-08-12' },
    { id: 'bad', scheduleUserId: 'u3', date: '2026-08-13', scheduleDateKey: '2026-08-14' }
  ]);
  assert.equal(summary.totalShiftRecordsInspected, 3);
  assert.equal(summary.legacyDateFieldUsage, 1);
  assert.equal(summary.conflictingDateVersusScheduleDateKey, 1);
});

test('System Administrator local Firebase efficiency panel reads local diagnostics only', () => {
  const management = read('src/features/management.jsx');
  assert.match(management, /Firebase Efficiency/);
  assert.match(management, /getFirebaseUsageDiagnostics/);
  assert.match(management, /resetFirebaseUsageDiagnostics/);
  assert.match(management, /does not call Firebase/);
  assert.doesNotMatch(management, /secureFetch\([^)]*firebase-efficiency/i);
});

test('release-gate dependency preflight repair and mode-specific rerun reporting remain intact', () => {
  const preflight = read('scripts/86chaos-release-gate/dependency-preflight.cjs');
  const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
  assert.match(preflight, /require\.resolve\(name, \{ paths: \[root\] \}\)/);
  assert.doesNotMatch(preflight, /Required local test module is missing[^\n]+package\.json subpath/);
  assert.match(preflight, /packageJsonExportErrorCode|ERR_PACKAGE_PATH_NOT_EXPORTED/);
  assert.match(collector, /test:play-store:delta/);
  assert.match(collector, /test:play-store/);
});
