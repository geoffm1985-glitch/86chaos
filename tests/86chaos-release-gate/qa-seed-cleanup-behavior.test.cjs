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
    admin: { firestore: { FieldValue: { arrayUnion: () => ({}), arrayRemove: () => ({}), delete: () => ({}) } } },
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
  return { runId, restaurantId, profile, ...seedScript.buildServerSeedDocuments(profile) };
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
