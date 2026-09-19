const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');

process.env.CHAOS_RELEASE_GATE_RUN_ID = process.env.CHAOS_RELEASE_GATE_RUN_ID || 'qa-seed-cleanup-behavior-unit';
process.env.CHAOS_FULL_AUDIT_RUN_ID = process.env.CHAOS_FULL_AUDIT_RUN_ID || process.env.CHAOS_RELEASE_GATE_RUN_ID;

const seedScript = require('../../scripts/86chaos-full-audit/seed-fake-restaurant.cjs');
const { buildFakeRestaurantProfile } = require('../86chaos-full-audit/utils/fake-restaurant-profile.cjs');
const chaosAdminPath = path.resolve(__dirname, '../../api/_chaos-admin.js');
const qaSeedApiModulePath = path.resolve(__dirname, '../../api/full-audit-qa-seed.js');
delete require.cache[chaosAdminPath];
delete require.cache[qaSeedApiModulePath];
require.cache[chaosAdminPath] = {
  id: chaosAdminPath,
  filename: chaosAdminPath,
  loaded: true,
  exports: {
    admin: { firestore: { FieldValue: { arrayUnion: () => ({}), arrayRemove: () => ({}), delete: () => ({ __fieldValueDelete: true }) } } },
    initAdmin: () => ({}),
    authorize: async () => ({ ok: true, isSuperAdmin: true, uid: 'system-admin', email: 'system-admin@example.test' }),
    readBody: async () => ({}),
    writeAudit: async () => {},
    clean: (value = '', fallback = '') => String(value == null ? fallback : value).trim(),
    norm: (value = '') => String(value || '').toLowerCase().trim(),
    memberDocId: (uid = '', restaurantId = '') => `${String(uid).trim()}__${String(restaurantId).trim()}`,
  },
};
const qaSeedApi = require(qaSeedApiModulePath);
const cleanupScriptPath = path.resolve(__dirname, '../../scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');
const qaSeedApiPath = path.resolve(__dirname, '../../api/full-audit-qa-seed.js');

function buildSeedPayload() {
  const runId = 'qa-seed-cleanup-behavior-unit';
  const restaurantId = 'qa_seed_cleanup_behavior_unit';
  const profile = buildFakeRestaurantProfile({ restaurantId, runId, anchorDate: new Date('2026-08-04T12:00:00-05:00') });
  const serverSeed = seedScript.buildServerSeedDocuments(profile);
  const reminderParticipant = serverSeed.ids?.userIdsByKey?.manager || serverSeed.ids?.userIdsByKey?.owner || 'qa-reminder-participant';
  for (const row of serverSeed.docs || []) {
    if (row.collection === 'personalReminders') {
      row.data.participantSchemaVersion = 1;
      row.data.participantUserIds = row.data.participantUserIds?.length ? row.data.participantUserIds : [reminderParticipant];
      row.data.qaCreatedBy = row.data.qaCreatedBy || '86chaos-full-audit';
    }
  }
  return { runId, restaurantId, profile, ...serverSeed };
}

function makeStorageFile(name, options = {}) {
  const row = {
    name,
    deleted: false,
    getMetadata: async () => [{ name, metadata: options.metadata || {} }],
    delete: async () => {
      if (options.deleteError) throw new Error(options.deleteError);
      row.deleted = true;
    },
  };
  return row;
}

function makeStorageApp({ firstFiles = [], remainingFiles = [] } = {}) {
  const prefixes = [];
  let callCount = 0;
  return {
    prefixes,
    storage: () => ({
      bucket: () => ({
        getFiles: async (query) => {
          prefixes.push(query.prefix);
          const files = callCount === 0 ? firstFiles : remainingFiles;
          callCount += 1;
          return [files, null, {}];
        },
      }),
    }),
  };
}

test('request-off seed transformation preserves QA ownership marker while resolving employee UIDs', () => {
  const { docs, ids, restaurantId, runId } = buildSeedPayload();
  const requestOffDocs = docs.filter(row => row.collection === 'timeOffRequests');
  assert.equal(requestOffDocs.length, 2);
  const userIds = ids.userIdsByKey;
  const byName = Object.fromEntries(requestOffDocs.map(row => [row.data.employeeName, row.data]));

  assert.equal(byName['Allen QA'].userId, userIds.allen);
  assert.equal(byName['Allen QA'].employeeId, userIds.allen);
  assert.equal(byName['Sara QA'].userId, userIds.sara);
  assert.equal(byName['Sara QA'].employeeId, userIds.sara);
  for (const row of requestOffDocs) {
    assert.equal(row.data.createdBy, '86chaos-full-audit');
    assert.equal(row.data.qaOwned, true);
    assert.equal(row.data.qaRunId, runId);
    assert.equal(row.data.restaurantId, restaurantId);
    assert.equal(Object.prototype.hasOwnProperty.call(row.data, 'userKey'), false);
  }
});

test('server seed documents satisfy and enforce the QA ownership-marker contract', () => {
  const { docs, restaurantId, runId } = buildSeedPayload();
  const validation = qaSeedApi.validateDocuments(docs, restaurantId, runId);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  for (const row of docs) {
    assert.equal(row.data.createdBy, '86chaos-full-audit', `${row.collection}/${row.id}`);
    assert.equal(row.data.qaOwned, true, `${row.collection}/${row.id}`);
    assert.equal(row.data.qaRunId, runId, `${row.collection}/${row.id}`);
    assert.equal(row.data.restaurantId, restaurantId, `${row.collection}/${row.id}`);
  }

  const changed = docs.map(row => ({ ...row, data: { ...row.data } }));
  const request = changed.find(row => row.collection === 'timeOffRequests');
  request.data.createdBy = request.data.userId || 'uid-that-should-not-be-accepted';
  const rejected = qaSeedApi.validateDocuments(changed, restaurantId, runId);
  assert.equal(rejected.ok, false);
  assert.match(rejected.errors.join('\n'), /createdBy must be 86chaos-full-audit/);
});

test('server Document Vault cleanup inspects only the exact current-run QA prefix and reports successful counts', async () => {
  const restaurantId = 'qa_storage_success';
  const runId = 'run-storage-success';
  const prefix = qaSeedApi.documentVaultPrefix(restaurantId);
  const file = makeStorageFile(`${prefix}doc.pdf`, { metadata: { restaurantId, qaRunId: runId, qaOwned: 'true' } });
  const app = makeStorageApp({ firstFiles: [file], remainingFiles: [] });
  const result = await qaSeedApi.cleanupCurrentRunDocumentVaultStorage(app, restaurantId, runId);
  assert.deepEqual(app.prefixes, [prefix, prefix]);
  assert.equal(file.deleted, true);
  assert.equal(result.ok, true);
  assert.equal(result.objectsFound, 1);
  assert.equal(result.objectsDeleted, 1);
  assert.equal(result.objectsRemaining, 0);
});

test('server Document Vault cleanup refuses unrelated prefixes and explicit delete failures', async () => {
  const restaurantId = 'qa_storage_failure';
  const runId = 'run-storage-failure';
  const safePrefix = qaSeedApi.documentVaultPrefix(restaurantId);
  const wrongPath = makeStorageFile('restaurants/other/back-office/document-vault/doc.pdf', { metadata: { restaurantId: 'other', qaRunId: runId, qaOwned: 'true' } });
  const undeletable = makeStorageFile(`${safePrefix}locked.pdf`, { metadata: { restaurantId, qaRunId: runId, qaOwned: 'true' }, deleteError: 'delete failed in mock' });
  const app = makeStorageApp({ firstFiles: [wrongPath, undeletable], remainingFiles: [undeletable] });
  const result = await qaSeedApi.cleanupCurrentRunDocumentVaultStorage(app, restaurantId, runId);
  assert.equal(wrongPath.deleted, false);
  assert.equal(result.ok, false);
  assert.equal(result.unresolved.length, 1);
  assert.match(result.unresolved[0].errors.join('\n'), /outside the exact current-run Document Vault prefix/);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].error, /delete failed in mock/);
  assert.equal(result.objectsRemaining, 1);
});

test('cleanup script no longer performs a second client-token Storage REST cleanup after server cleanup', () => {
  const source = fs.readFileSync(cleanupScriptPath, 'utf8');
  assert.match(source, /callQaSeedApi\('cleanup'/);
  assert.doesNotMatch(source, /cleanupDocumentVaultStorage\(nodeFetchPage\(\),\s*storage/);
  assert.doesNotMatch(source, /storageRest\(config,\s*signed\.idToken\)/);
});

test('server cleanup keeps storage cleanup before Firestore restaurant deletion', () => {
  const source = fs.readFileSync(qaSeedApiPath, 'utf8');
  const storageIndex = source.indexOf('cleanupCurrentRunDocumentVaultStorage(app, base.restaurantId, base.runId)');
  const refsIndex = source.indexOf('const refs = new Map();');
  const restaurantDeleteIndex = source.indexOf("writes.push({ type: 'delete', ref: restaurantRef })");
  assert.ok(storageIndex > 0, 'storage cleanup call exists');
  assert.ok(refsIndex > storageIndex, 'seeded Firestore ref collection begins after storage cleanup');
  assert.ok(restaurantDeleteIndex > storageIndex, 'restaurant delete is scheduled after storage cleanup');
});

test('cleanup validation classifies rejected pre-write seed as safe no-op evidence', () => {
  const { validateSeedForCleanup } = require('../../scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');
  const validation = validateSeedForCleanup({ ok: false, error: 'server validation rejected payload' }, 'no-op-run', {});
  assert.equal(validation.ok, false);
  assert.equal(validation.writesStarted, false);
  assert.match(validation.errors.join('\n'), /No current-run writes were recorded/);
});


test('cleanup script only reports restaurantDeleted after the server confirms it', () => {
  const source = fs.readFileSync(cleanupScriptPath, 'utf8');
  assert.match(source, /report\.restaurantExisted = apiResult\.restaurantExisted === true/);
  assert.match(source, /report\.restaurantDeleted = apiResult\.restaurantDeleted === true \? 1 : 0/);
  assert.doesNotMatch(source, /restaurantDeleted = apiResult\.remaining\?\.some\?\./);
});


function makeResetResponse() {
  return {
    statusCode: 0,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function makeResetDb({ runId = 'qa-seed-cleanup-behavior-unit', restaurantId = 'qa_seed_cleanup_behavior_unit', employeeKey = 'sara', qaOwned = true, qaRunId = null, docRestaurantId = null, employeeName = null, expectedUserId = null, createdBy = '86chaos-full-audit', userPatch = {} } = {}) {
  const isAllen = employeeKey === 'allen';
  const name = employeeName || (isAllen ? 'Allen QA' : 'Sara QA');
  const uid = expectedUserId || (isAllen ? 'uid-allen' : 'uid-sara');
  const docId = `qa_${runId}_timeOffRequests_${isAllen ? '0_Allen_QA' : '1_Sara_QA'}`;
  const requestData = {
    qaOwned,
    qaRunId: qaRunId || runId,
    restaurantId: docRestaurantId || restaurantId,
    createdBy,
    employeeName: name,
    userName: name,
    userId: uid,
    employeeId: uid,
    date: '2026-08-10',
    requestDate: '2026-08-10',
    reason: 'QA fixture',
    requestedAt: '2026-08-01T00:00:00.000Z',
    approvedAt: 'old-approval',
    archived: true,
  };
  const userData = {
    qaOwned: true,
    qaRunId: runId,
    restaurantId,
    name,
    createdBy: '86chaos-full-audit',
    ...userPatch,
  };
  const updates = [];
  const collections = {
    timeOffRequests: { [docId]: requestData },
    users: { [uid]: userData },
  };
  const db = {
    collection(collectionName) {
      if (collectionName === 'auditLogs') return { add: async () => ({ id: 'audit' }) };
      return {
        doc(id) {
          return {
            path: `${collectionName}/${id}`,
            async get() {
              const data = collections[collectionName]?.[id];
              return { exists: Boolean(data), data: () => data || {} };
            },
            async update(patch) {
              updates.push({ collection: collectionName, id, patch });
              collections[collectionName][id] = { ...(collections[collectionName][id] || {}), ...patch };
            },
          };
        },
      };
    },
  };
  return { db, docId, uid, updates, runId, restaurantId };
}

async function callResetFixture(options = {}) {
  const fixture = makeResetDb(options);
  const employeeKey = options.employeeKey || 'sara';
  const res = makeResetResponse();
  await qaSeedApi.resetRequestOffFixture({}, res, {
    auth: { uid: 'system-admin', email: 'system-admin@example.test', user: { name: 'System Admin' } },
    db: fixture.db,
    projectId: 'chaos-test-d1601',
    base: { runId: fixture.runId, restaurantId: fixture.restaurantId, workspaceName: `86 Chaos Release Gate QA ${fixture.runId}` },
    body: { employeeKey, documentId: fixture.docId, expectedUserId: fixture.uid },
  });
  return { ...fixture, res };
}

test('reset-request-off-fixture restores Sara and Allen baseline states with delete markers', async () => {
  const sara = await callResetFixture({ employeeKey: 'sara' });
  assert.equal(sara.res.statusCode, 200);
  assert.equal(sara.res.payload.ok, true);
  assert.equal(sara.res.payload.status, 'pending');
  assert.equal(sara.updates[0].patch.status, 'pending');
  assert.equal(sara.updates[0].patch.userId, sara.uid);
  assert.equal(sara.updates[0].patch.employeeId, sara.uid);
  assert.deepEqual(sara.updates[0].patch.approvedAt, { __fieldValueDelete: true });
  assert.deepEqual(sara.updates[0].patch.archived, { __fieldValueDelete: true });

  const allen = await callResetFixture({ employeeKey: 'allen' });
  assert.equal(allen.res.statusCode, 200);
  assert.equal(allen.res.payload.status, 'approved');
  assert.equal(allen.updates[0].patch.status, 'approved');
  assert.equal(allen.updates[0].patch.userId, allen.uid);
  assert.equal(allen.updates[0].patch.employeeId, allen.uid);
});

test('reset-request-off-fixture fails closed for wrong key, ownership, run, restaurant, employee, and user', async () => {
  for (const options of [
    { employeeKey: 'chuck' },
    { employeeKey: 'sara', qaOwned: false },
    { employeeKey: 'sara', qaRunId: 'wrong-run' },
    { employeeKey: 'sara', docRestaurantId: 'wrong_restaurant' },
    { employeeKey: 'sara', employeeName: 'Not Sara QA' },
    { employeeKey: 'sara', userPatch: { qaOwned: false } },
    { employeeKey: 'sara', userPatch: { qaRunId: 'wrong-run' } },
    { employeeKey: 'sara', userPatch: { restaurantId: 'wrong_restaurant' } },
    { employeeKey: 'sara', userPatch: { name: 'Not Sara QA' } },
  ]) {
    const result = await callResetFixture(options);
    assert.notEqual(result.res.statusCode, 200, `expected rejection for ${JSON.stringify(options)}`);
    assert.equal(result.updates.length, 0, `no update should be written for ${JSON.stringify(options)}`);
  }
});

test('reset-request-off-fixture source is narrow and cannot accept arbitrary collection, patch, status, or production project', () => {
  const source = fs.readFileSync(qaSeedApiPath, 'utf8');
  assert.match(source, /reset-request-off-fixture/);
  assert.match(source, /REQUEST_OFF_RESET_SUBJECTS/);
  assert.match(source, /allen:[\s\S]*baselineStatus: 'approved'/);
  assert.match(source, /sara:[\s\S]*baselineStatus: 'pending'/);
  assert.match(source, /db\.collection\('timeOffRequests'\)\.doc\(documentId\)/);
  assert.doesNotMatch(source, /body\.collection/);
  assert.doesNotMatch(source, /body\.patch/);
  assert.doesNotMatch(source, /body\.status/);
  assert.match(source, /TESTING_PROJECT_ID = 'chaos-test-d1601'/);
});
