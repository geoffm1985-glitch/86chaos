'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fakeFirestore } = require('../test-tools/fakeFirestore.cjs');
const { credentialRef, persistRecords } = require('./_shift4-storage');
const { beginImport, assertImportFence, checkpointImport, finishImport, LEASE_MS } = require('./_shift4-import-recovery.cjs');
const input = { restaurantId:'tenant-a',operationId:'reviewed_import_operation_1',providerLocationId:'17',from:'2026-10-01',to:'2026-10-02',connectionGeneration:4 };
function database() { const db = fakeFirestore(); db.records.set(credentialRef(db,'tenant-a').path,{connectionGeneration:4,selectedLocation:{id:'17'}}); return db; }
test('POS range import is single-flight and a lost response replays its durable final review result', async () => {
  const db = database(), operation = await beginImport(db,input,1000);
  await assert.rejects(() => beginImport(db,input,1001), error => error.code === 'import_in_progress');
  await assert.rejects(() => beginImport(db,{...input,operationId:'reviewed_import_operation_2'},1001), error => error.code === 'import_in_progress');
  await checkpointImport(db,operation,'normalization',{received:5},1002);
  const summary = { status:'incomplete',normalizedRecords:5,retrievalCompleteness:'api_contract_unverified' };
  await finishImport(db,operation,summary,'',1003);
  assert.deepEqual((await beginImport(db,input,1004)).completed,summary);
  assert.equal([...db.records.keys()].every(key => /^(shift4Credentials|posSyncScopes)\//.test(key)),true);
});
test('POS recovery rejects reused IDs with a different tenant connection, location or range', async () => {
  const db = database(); await beginImport(db,input,1000);
  for (const change of [{from:'2026-10-03'},{to:'2026-10-04'},{providerLocationId:'18'},{connectionGeneration:5}]) await assert.rejects(() => beginImport(db,{...input,...change},1001), error => error.code === 'import_operation_mismatch');
});
test('expired POS lease can recover with a new fence and the old worker cannot persist or finalize', async () => {
  const db = database(), old = await beginImport(db,input,1000), fresh = await beginImport(db,input,1001+LEASE_MS);
  assert.equal(fresh.generation,2);
  await assert.rejects(() => checkpointImport(db,old,'persistence',{},1002+LEASE_MS), error => error.code === 'stale_import_fence');
  await assert.rejects(() => finishImport(db,old,{status:'complete'},'',1002+LEASE_MS), error => error.code === 'stale_import_fence');
  await db.runTransaction(tx => assertImportFence(tx,db,fresh,1002+LEASE_MS));
});
test('reconnecting or changing the selected POS location fences persistence before any record write', async () => {
  for (const change of [{connectionGeneration:5,selectedLocation:{id:'17'}},{connectionGeneration:4,selectedLocation:{id:'18'}}]) {
    const db = database(), operation = await beginImport(db,input,Date.now());
    db.records.set(credentialRef(db,'tenant-a').path,change); const before = db.writes.length;
    await assert.rejects(() => persistRecords(db,'tenant-a','17',[{idempotencyKey:'one',businessDate:'2026-10-01'}],{assertFence:tx=>assertImportFence(tx,db,operation)}),error=>error.code==='credential_superseded');
    assert.equal(db.writes.length,before);
  }
});
test('POS failure retains resumable evidence, releases only its own lease and excludes credential bodies', async () => {
  const db = database(), operation = await beginImport(db,input,1000);
  await checkpointImport(db,operation,'persistence',{normalized:7,accessToken:'should-not-save'},1001);
  await finishImport(db,operation,null,'network_error',1002);
  assert.doesNotMatch(JSON.stringify([...db.records]),/should-not-save/);
  assert.equal(db.records.get(operation.ref.path).failureCode,'network_error');
  assert.equal((await beginImport(db,input,1003)).generation,2);
});
