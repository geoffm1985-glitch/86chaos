'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { persistRecords, scopeRef } = require('./_shift4-storage');

function memoryDb() {
  const docs = new Map(); let transactionCount = 0; let failTransaction = 0;
  const ref = path => ({ path, id: path.split('/').pop(), collection: name => collection(`${path}/${name}`), async get() { return { exists: docs.has(path), id: this.id, data: () => docs.get(path) }; } });
  const collection = path => ({ doc: id => ref(`${path}/${id}`) });
  return {
    docs, collection, setFailure(value) { failTransaction = value; transactionCount = 0; },
    async runTransaction(fn) {
      transactionCount += 1; if (failTransaction && transactionCount === failTransaction) throw new Error('injected batch failure');
      const writes = []; const result = await fn({ get: target => target.get(), set: (target, value) => writes.push([target.path, value]) });
      writes.forEach(([path, value]) => docs.set(path, { ...value })); return result;
    }
  };
}
const record = (index, amount = 100) => ({ schemaVersion: 3, provider: 'shift4', providerProduct: 'shift4-dine', restaurantId: 'restaurant-a', providerLocationId: '17', recordType: 'ticket', sourceRecordId: `ticket-${index}`, businessDate: '2026-09-13', idempotencyKey: `new-${index}`, legacyIdempotencyKey: `legacy-${index}`, netAmountCents: amount, approvalRequired: true, status: 'draft', sourceCompleteness: 'api_contract_unverified' });

test('an older fetched snapshot cannot overwrite newer persisted content', async () => {
  const db = memoryDb(); const newer = await persistRecords(db, 'restaurant-a', '17', [record(1, 200)], { observedAtMs: 200 }); assert.equal(newer.inserted, 1);
  const older = await persistRecords(db, 'restaurant-a', '17', [record(1, 100)], { observedAtMs: 100 }); assert.equal(older.superseded, 1); assert.equal(older.scopedDocumentWritesCommitted, 0);
  const path = `${scopeRef(db, 'restaurant-a').path}/records/new-1`; assert.equal(db.docs.get(path).netAmountCents, 200);
});

test('partial transaction-batch failure preserves committed progress and retry finishes idempotently', async () => {
  const db = memoryDb(); const records = Array.from({ length: 151 }, (_, index) => record(index)); db.setFailure(2);
  const partial = await persistRecords(db, 'restaurant-a', '17', records, { observedAtMs: 100 }); assert.equal(partial.persistenceComplete, false); assert.equal(partial.inserted, 150); assert.equal(partial.failedBatch, 2);
  db.setFailure(0); const retry = await persistRecords(db, 'restaurant-a', '17', records, { observedAtMs: 100 }); assert.equal(retry.persistenceComplete, true); assert.equal(retry.unchanged, 150); assert.equal(retry.inserted, 1);
});

test('legacy candidate IDs are updated in place without creating duplicate history', async () => {
  const db = memoryDb(); const collectionPath = `${scopeRef(db, 'restaurant-a').path}/records`; db.docs.set(`${collectionPath}/legacy-1`, { ...record(1, 100), idempotencyKey: 'legacy-1', contentHash: 'old', sourceObservedAtMs: 1 });
  const result = await persistRecords(db, 'restaurant-a', '17', [record(1, 125)], { observedAtMs: 2 }); assert.equal(result.updated, 1); assert.equal(db.docs.has(`${collectionPath}/legacy-1`), true); assert.equal(db.docs.has(`${collectionPath}/new-1`), false); assert.equal(db.docs.get(`${collectionPath}/legacy-1`).canonicalIdentityKey, 'new-1');
});
