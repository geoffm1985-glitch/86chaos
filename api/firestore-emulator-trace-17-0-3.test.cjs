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
