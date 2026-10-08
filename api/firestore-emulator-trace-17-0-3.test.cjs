'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTrace,
  createReadBarrier,
  instrumentFirestoreDb,
} = require('../test-tools/firestore-emulator-trace.cjs');

test('plain Node trace construction uses supported package metadata lookup', () => {
  const trace = createTrace('plain-node-smoke');
  assert.match(trace.effectiveTarget.firebaseAdmin, /^\d+\.\d+\.\d+/);
  assert.match(trace.effectiveTarget.firestoreSdk, /^\d+\.\d+\.\d+/);
  assert.match(trace.effectiveTarget.firebaseTools, /^\d+\.\d+\.\d+/);
});

test('read barrier requires distinct callers and records arrival before SDK submission', async () => {
  const trace = createTrace('plain-node-overlap');
  const barrier = createReadBarrier(2, trace, 'first-read', 1000);
  let releaseReads;
  const reads = new Promise(resolve => { releaseReads = resolve; });
  const db = {
    collection() {},
    async runTransaction(callback) {
      return callback({ get: async () => { await reads; return { exists:true, data:()=>({}) }; } });
    },
  };
  const first = instrumentFirestoreDb(db, { trace, callerId:'caller-a', beforeFirstRead:barrier })
    .runTransaction(tx => tx.get({ path:'records/a' }));
  const second = instrumentFirestoreDb(db, { trace, callerId:'caller-b', beforeFirstRead:barrier })
    .runTransaction(tx => tx.get({ path:'records/b' }));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(trace.events.filter(row => row.type === 'barrier-arrival').map(row => row.callerId).sort(), ['caller-a','caller-b']);
  assert.equal(trace.events.filter(row => row.type === 'read-submit').length, 2);
  assert.equal(trace.events.some(row => row.type === 'read-overlap' && row.callerIds.length === 2), true);
  const releaseIndex = trace.events.findIndex(row => row.type === 'barrier-release');
  assert.equal(trace.events.filter(row => row.type === 'read-submit').every(row => trace.events.indexOf(row) > releaseIndex), true);
  releaseReads();
  await Promise.all([first, second]);
  assert.equal(trace.events.filter(row => row.type === 'read-settle').every(row => row.pendingReads === 0), true);
});

test('barrier rejection does not manufacture submitted or pending reads', async () => {
  const trace = createTrace('plain-node-barrier-rejection');
  const barrier = createReadBarrier(2, trace, 'duplicate-caller', 1000);
  const one = barrier('same-caller');
  await assert.rejects(barrier('same-caller'), /duplicate caller/);
  await assert.rejects(one, /duplicate caller/);
  assert.equal(trace.events.some(row => row.type === 'read-submit'), false);
});


test('a caller can retry a failed transaction after the initial concurrency barrier', async () => {
  const trace = createTrace('application-transaction-retry');
  const barrier = createReadBarrier(2, trace, 'initial-read', 1000);
  const options = { maxAttempts: 3 };
  const reads = [];
  let failedOnce = false;
  const db = {
    collection() {},
    async runTransaction(callback, receivedOptions) {
      assert.equal(receivedOptions, options);
      const value = await callback({ get: async ref => { reads.push(ref.path); return ref.path; } });
      if (value === 'records/a' && !failedOnce) {
        failedOnce = true;
        throw Object.assign(new Error('Transaction is invalid or closed.'), { code: 3 });
      }
      return value;
    },
  };
  const a = instrumentFirestoreDb(db, { trace, callerId: 'caller-a', beforeFirstRead: barrier });
  const b = instrumentFirestoreDb(db, { trace, callerId: 'caller-b', beforeFirstRead: barrier });
  const settled = await Promise.allSettled([
    a.runTransaction(tx => tx.get({ path: 'records/a' }), options),
    b.runTransaction(tx => tx.get({ path: 'records/b' }), options),
  ]);
  assert.equal(settled[0].status, 'rejected');
  assert.equal(settled[0].reason.code, 3);
  assert.equal(settled[1].value, 'records/b');
  assert.equal(await a.runTransaction(tx => tx.get({ path: 'records/a' }), options), 'records/a');
  assert.deepEqual(reads.sort(), ['records/a', 'records/a', 'records/b']);
  assert.deepEqual(trace.events.filter(row => row.type === 'barrier-arrival').map(row => row.callerId).sort(), ['caller-a', 'caller-b']);
  assert.equal(trace.events.filter(row => row.type === 'transaction-rollback').length, 1);
  assert.equal(trace.events.filter(row => row.type === 'transaction-commit').length, 2);
  assert.equal(trace.events.filter(row => row.type === 'read-submit').length, 3);
  assert.equal(trace.events.filter(row => row.type === 'read-settle' && row.status === 'fulfilled').length, 3);
  assert.equal(trace._activeSdkReads.size, 0);
});

test('SDK callback retries continue submitting real reads after the initial barrier', async () => {
  const trace = createTrace('sdk-callback-retry');
  const barrier = createReadBarrier(2, trace, 'initial-read', 1000);
  let submittedReads = 0;
  const db = {
    collection() {},
    async runTransaction(callback) {
      const tx = { get: async ref => { submittedReads += 1; return ref.path; } };
      await callback(tx);
      return callback(tx);
    },
  };
  const results = await Promise.all(['a', 'b'].map(id =>
    instrumentFirestoreDb(db, { trace, callerId: id, beforeFirstRead: barrier })
      .runTransaction(tx => tx.get({ path: 'records/' + id }))));
  assert.deepEqual(results, ['records/a', 'records/b']);
  assert.equal(submittedReads, 4);
  assert.equal(trace.events.filter(row => row.type === 'barrier-arrival').length, 2);
  assert.equal(trace.events.filter(row => row.type === 'read-submit').length, 4);
  assert.equal(trace.events.filter(row => row.type === 'transaction-commit').every(row => row.callbackAttempts === 2), true);
  assert.equal(trace._activeSdkReads.size, 0);
});
