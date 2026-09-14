const test = require('node:test');
const assert = require('node:assert/strict');
const auditHandler = require('./schedule-integrity-audit');
const schemaDoctor = require('./schema-doctor');

function snap(id, data = {}) { return { id, data: () => data }; }

function completePageDb(streams) {
  return {
    collection() {
      let field = '';
      let after = '';
      let pageSize = 100;
      return {
        where(nextField) { field = nextField; return this; },
        orderBy() { return this; },
        limit(value) { pageSize = value; return this; },
        startAfter(value) { after = value; return this; },
        async get() {
          const rows = streams[field] || [];
          const start = after ? rows.findIndex(row => row.id === after) + 1 : 0;
          return { docs: rows.slice(start, start + pageSize) };
        }
      };
    }
  };
}

test('complete audit cursor never restarts an exhausted tenant stream', async () => {
  const db = completePageDb({
    restaurantId: [snap('r-a', { restaurantId: 'r1' })],
    workspaceId: [snap('w-a', { workspaceId: 'r1' }), snap('w-b', { workspaceId: 'r1' }), snap('w-c', { workspaceId: 'r1' })]
  });
  const first = await auditHandler._test.readCompleteShiftPage(db, 'r1', 2, {});
  assert.deepEqual(first.rows.map(row => row.id).sort(), ['r-a', 'w-a', 'w-b']);
  assert.equal(first.nextCursor.restaurantId.done, true);
  const second = await auditHandler._test.readCompleteShiftPage(db, 'r1', 2, first.nextCursor);
  assert.deepEqual(second.rows.map(row => row.id), ['w-c']);
  const combinedIds = [...first.rows, ...second.rows].map(row => row.id);
  assert.equal(new Set(combinedIds).size, combinedIds.length);
  assert.equal(second.nextCursor, null);
  assert.equal(second.complete, true);
});

test('workspace alias scan does not duplicate primary-tenant rows or expose a conflicting foreign tenant', async () => {
  const db = completePageDb({
    restaurantId: [snap('both', { restaurantId: 'r1', workspaceId: 'r1' })],
    workspaceId: [snap('both', { restaurantId: 'r1', workspaceId: 'r1' }), snap('legacy', { workspaceId: 'r1' }), snap('foreign', { restaurantId: 'r2', workspaceId: 'r1', employeeName: 'Private Person' })]
  });
  const result = await auditHandler._test.readCompleteShiftPage(db, 'r1', 10, {});
  assert.deepEqual(result.rows.map(row => row.id).sort(), ['both', 'legacy']);
  assert.equal(result.redactedScopeConflicts, 1);
  assert.equal(result.complete, false);
  assert.equal(JSON.stringify(result.rows).includes('Private Person'), false);
});

test('identity lookup merges the same authorized user across primary, workspaceIds and membership evidence', async () => {
  const db = {
    collection(collectionName) {
      let whereField = '';
      return {
        where(field) { whereField = field; return this; },
        limit() { return this; },
        async get() {
          if (collectionName === 'workspaceMembers') return { docs: [snap('member-r1', { userId: 'u1', restaurantId: 'r1', name: 'Alex' })] };
          return { docs: [snap('u1', { restaurantId: 'r1', workspaceIds: ['r1'], name: 'Alex', queryField: whereField })] };
        }
      };
    }
  };
  const result = await auditHandler._test.readAuthorizedPeople(db, 'r1');
  assert.equal(result.people.length, 1);
  assert.deepEqual(result.people[0].identitySources.sort(), ['users-primary', 'users-workspaceIds', 'workspaceMembers'].sort());
  assert.equal(result.queryAttempts, 3);
  assert.equal(result.querySuccesses, 3);
});

test('raw copies of the same shift merge by document id while retaining query evidence', () => {
  const merged = auditHandler._test.mergeRawRows([
    { id: 's1', date: '2026-09-01', _auditSources: ['window:restaurant-date:canonical'] },
    { id: 's1', scheduleDateKey: '2026-09-01', _auditSources: ['window:restaurant-scheduleDateKey:rescue'] }
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0]._auditSources, ['window:restaurant-date:canonical', 'window:restaurant-scheduleDateKey:rescue']);
});

test('schema doctor tenant query failure fails closed and never invokes an unscoped fallback', async () => {
  let fallbackReads = 0;
  const db = { collection: () => ({ limit: () => ({ get: async () => { fallbackReads += 1; return { docs: [snap('foreign')] }; } }) }) };
  const scopedQuery = { get: async () => { throw new Error('missing index'); } };
  await assert.rejects(() => schemaDoctor._test.readSchemaDoctorDocuments(db, 'shifts', 'r1', scopedQuery), /failed closed/);
  assert.equal(fallbackReads, 0);
});

test('schema doctor retains bounded fallback only for an explicitly unscoped super-admin scan', async () => {
  const db = { collection: () => ({ limit: () => ({ get: async () => ({ docs: [snap('one')] }) }) }) };
  const brokenQuery = { get: async () => { throw new Error('temporary'); } };
  const docs = await schemaDoctor._test.readSchemaDoctorDocuments(db, 'shifts', '', brokenQuery);
  assert.deepEqual(docs.map(row => row.id), ['one']);
});
