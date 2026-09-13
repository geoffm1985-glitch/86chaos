'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

function loadRoute(file, mocks, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    module, exports: module.exports, require: name => mocks[name] || (() => {}),
    __dirname, process: { env }, Date, console,
  }, { filename: file });
  return module.exports;
}

function healthRoute({ readFails = false, authorized = true, appCheck = true, loaderFails = false } = {}) {
  let reads = 0;
  const db = { collection: name => { assert.equal(name, 'system'); return { doc: id => { assert.equal(id, 'backupStatus'); return { get: async () => { reads++; if (readFails) throw new Error('permission denied'); return { exists: true }; } }; } }; } };
  const app = { options: { projectId: 'test-project' }, firestore: () => db };
  const handler = loadRoute('health-checks.js', {
    fs: { existsSync: () => !loaderFails }, path,
    './_chaos-admin': { initAdmin: () => app, requireAppCheckIfEnforced: async () => ({ ok: appCheck, status: 401 }), authorize: async () => ({ ok: authorized, isSuperAdmin: authorized, status: 403, app, db }) },
    './_firebase-project-admin': { projectCredentialStatus: () => ({ configured: true }) },
  });
  return { handler, reads: () => reads };
}

test('health summary fails when its actual Firestore read fails, while preserving useful route diagnostics', async () => {
  const route = healthRoute({ readFails: true }); const res = response();
  await route.handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.ok, false);
  assert.equal(res.body.firestoreReadOk, false); assert.equal(res.body.firestoreErrorCategory, 'permission_denied');
  assert.equal(res.body.readyCount, res.body.count); assert.equal(route.reads(), 1);
});

test('a successful health check still performs exactly one bounded document read and no writes', async () => {
  const route = healthRoute(); const res = response(); await route.handler({ method: 'GET' }, res);
  assert.equal(res.body.ok, true); assert.equal(res.body.firestoreReadOk, true); assert.equal(route.reads(), 1);
});

test('handler-load failures still prevent healthy status', async () => {
  const route = healthRoute({ loaderFails: true }); const res = response(); await route.handler({ method: 'GET' }, res);
  assert.equal(res.body.ok, false); assert.ok(res.body.attentionCount > 0);
});

for (const [label, options, status] of [['authorization', { authorized: false }, 403], ['App Check', { appCheck: false }, 401]]) {
  test(`health ${label} rejection occurs before the diagnostic read`, async () => {
    const route = healthRoute(options); const res = response(); await route.handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, status); assert.equal(route.reads(), 0);
  });
}

test('restore records never invent independent verification or a target from environment variables', async () => {
  const writes = []; let audits = 0;
  const db = { collection: coll => ({ doc: () => ({ set: async data => writes.push({ coll, data }) }), add: async data => { writes.push({ coll, data }); return { id: 'drill' }; } }) };
  const handler = loadRoute('restore-drill.js', { './_chaos-admin': {
    initAdmin: () => ({ firestore: () => db }), authorize: async () => ({ ok: true, uid: 'admin' }),
    readBody: async () => ({ result: 'passed' }), writeAudit: async () => { audits++; },
  } }, { FIREBASE_PROJECT_ID: 'production-project', RESTORE_DRILL_PROJECT_ID: 'configured-but-not-reported' });
  const res = response(); await handler({ method: 'POST' }, res);
  const record = res.body.restoreDrillStatus;
  assert.equal(record.status, 'passed'); assert.equal(record.evidenceSource, 'administrator_reported');
  assert.equal(record.restoreProjectId, ''); assert.equal(record.checklist.backupSelected, false);
  for (const key of ['restoredIntoSafeProject', 'verifiedLogin', 'verifiedCriticalCollections', 'noProductionOverwrite']) assert.equal(record.checklist[key], null);
  assert.equal(writes.length, 2); assert.equal(audits, 1);
});

test('restore records preserve explicitly reported target and the existing authorization boundary', async () => {
  let authorized = false; let writes = 0;
  const handler = loadRoute('restore-drill.js', { './_chaos-admin': {
    initAdmin: () => ({ firestore: () => ({ collection: () => ({ doc: () => ({ set: async () => { writes++; } }), add: async () => { writes++; return { id: 'drill' }; } }) }) }),
    authorize: async (_req, _app, options) => { assert.equal(options.allowTenantAdmin, false); return { ok: authorized, status: 403, uid: 'admin' }; },
    readBody: async () => ({ result: 'planned', restoreProjectId: 'explicit-test-project' }), writeAudit: async () => {},
  } });
  const denied = response(); await handler({ method: 'POST' }, denied); assert.equal(denied.statusCode, 403); assert.equal(writes, 0);
  authorized = true; const allowed = response(); await handler({ method: 'POST' }, allowed);
  assert.equal(allowed.body.restoreDrillStatus.restoreProjectId, 'explicit-test-project');
});

test('existing admin screens consume explicit health evidence and retain unknown states', () => {
  const source = fs.readFileSync(path.join(root, 'src/features/management.jsx'), 'utf8');
  assert.match(source, /firestoreHealthEvidence\(routeManifestCheck\)/);
  assert.match(source, /restoreDrillNeedsAttention\(restoreDrillStatus\)/);
  assert.match(source, /deploymentEvidenceChecks\(/);
  assert.doesNotMatch(source, /firestoreReadOk !== false/);
  assert.match(source, /firestoreLatencyMs != null/);
  assert.match(source, /check\.ok === null/);
  assert.doesNotMatch(source, /next\.setUTCHours\(9, 0, 0, 0\)/);
  assert.match(source, /administrator-reported record/);
  assert.doesNotMatch(source, /\['Push notifications tested'/);
  assert.match(source, /\['Push device registered'/);
});
