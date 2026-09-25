'use strict';

const fs = require('node:fs');
const path = require('node:path');

function packageVersion(packageName) {
  const entry = require.resolve(packageName);
  let directory = path.dirname(entry);
  while (directory !== path.dirname(directory)) {
    const packageFile = path.join(directory, 'package.json');
    if (fs.existsSync(packageFile)) {
      const metadata = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      if (metadata.name === packageName && metadata.version) return String(metadata.version);
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Unable to resolve installed package metadata for ${packageName}.`);
}

function sanitizeError(error) {
  if (!error) return null;
  return {
    name: String(error.name || 'Error').slice(0, 80),
    code: error.code === undefined ? null : String(error.code).slice(0, 80),
    message: String(error.message || '').replace(/[A-Za-z0-9_-]{80,}/g, '[redacted]').slice(0, 320),
    details: String(error.details || '').replace(/[A-Za-z0-9_-]{80,}/g, '[redacted]').slice(0, 320),
  };
}

function createTrace(testId, extra = {}) {
  const startedAt = Date.now();
  return {
    schemaVersion: 1,
    testId,
    fidelity: 'FIREBASE EMULATOR',
    generatedAt: new Date(startedAt).toISOString(),
    effectiveTarget: {
      projectId: String(process.env.GCLOUD_PROJECT || ''),
      firestoreHost: String(process.env.FIRESTORE_EMULATOR_HOST || ''),
      node: process.version,
      firestoreSdk: packageVersion('@google-cloud/firestore'),
      firebaseAdmin: packageVersion('firebase-admin'),
      firebaseTools: packageVersion('firebase-tools'),
    },
    ...extra,
    events: [],
    _startedAt: startedAt,
    _activeSdkReads: new Set(),
  };
}

function event(trace, type, details = {}) {
  trace.events.push({ atMs: Date.now() - trace._startedAt, type, ...details });
}

function createReadBarrier(parties, trace, label, timeoutMs = 15000) {
  if (!Number.isInteger(parties) || parties < 2) throw new Error('An emulator read barrier requires at least two callers.');
  const participants = new Set();
  let released = false;
  let resolveGate;
  let rejectGate;
  const gate = new Promise((resolve, reject) => { resolveGate = resolve; rejectGate = reject; });
  const timer = setTimeout(() => {
    if (!released) {
      event(trace, 'barrier-timeout', { label, arrivals:participants.size, parties, callers:[...participants].sort() });
      rejectGate(new Error(`Emulator read barrier ${label} timed out after ${timeoutMs}ms.`));
    }
  }, timeoutMs);
  timer.unref?.();
  return async callerId => {
    const caller=String(callerId||'').trim();
    if(!caller)throw new Error(`Emulator read barrier ${label} requires a caller ID.`);
    if(participants.has(caller)){
      const error=new Error(`Emulator read barrier ${label} received duplicate caller ${caller}.`);
      event(trace,'barrier-duplicate-caller',{label,callerId:caller,arrivals:participants.size,parties});
      rejectGate(error);clearTimeout(timer);throw error;
    }
    participants.add(caller);
    event(trace, 'barrier-arrival', { label, callerId:caller, arrivals:participants.size, parties });
    if (participants.size === parties) {
      released = true;
      clearTimeout(timer);
      event(trace, 'barrier-release', { label, arrivals:participants.size, parties, callers:[...participants].sort(), distinctCallers:true });
      resolveGate();
    }
    await gate;
    event(trace,'barrier-passed',{label,callerId:caller,parties});
  };
}

function instrumentFirestoreDb(db, { trace, callerId, beforeFirstRead = null } = {}) {
  const wrapped = Object.create(db);
  wrapped.collection = db.collection.bind(db);
  wrapped.runTransaction = async (callback, options) => {
    event(trace, 'transaction-run-start', { callerId });
    let callbackAttempt = 0;
    let firstReadReached = false;
    try {
      const result = await db.runTransaction(async transaction => {
        callbackAttempt += 1;
        let pendingReads = 0;
        event(trace, 'transaction-callback-enter', { callerId, callbackAttempt });
        const tx = Object.create(transaction);
        tx.get = async ref => {
          const target = String(ref?.path || ref?._queryOptions?.collectionId || ref?.constructor?.name || 'unknown').slice(0, 240);
          const readNumber = trace.events.filter(row => row.type === 'read-submit' && row.callerId === callerId && row.callbackAttempt === callbackAttempt).length + 1;
          if (!firstReadReached) {
            firstReadReached = true;
            if (beforeFirstRead) {
              event(trace,'read-barrier-wait',{callerId,callbackAttempt,readNumber,target});
              await beforeFirstRead(callerId);
            }
          }
          pendingReads += 1;
          const activeKey=`${callerId}:${callbackAttempt}:${readNumber}`;
          trace._activeSdkReads.add(activeKey);
          event(trace, 'read-submit', { callerId, callbackAttempt, readNumber, target, pendingReads, activeSdkReads:trace._activeSdkReads.size });
          if(trace._activeSdkReads.size>=2)event(trace,'read-overlap',{callerIds:[...new Set([...trace._activeSdkReads].map(value=>value.split(':')[0]))].sort(),activeSdkReads:trace._activeSdkReads.size});
          try {
            const value = await transaction.get(ref);
            pendingReads -= 1;
            trace._activeSdkReads.delete(activeKey);
            event(trace, 'read-settle', { callerId, callbackAttempt, readNumber, target, status: 'fulfilled', pendingReads });
            return value;
          } catch (error) {
            pendingReads -= 1;
            trace._activeSdkReads.delete(activeKey);
            event(trace, 'read-settle', { callerId, callbackAttempt, readNumber, target, status: 'rejected', pendingReads, error: sanitizeError(error) });
            throw error;
          }
        };
        try {
          const value = await callback(tx);
          event(trace, 'transaction-callback-exit', { callerId, callbackAttempt, status: 'fulfilled', pendingReads });
          return value;
        } catch (error) {
          event(trace, 'transaction-callback-exit', { callerId, callbackAttempt, status: 'rejected', pendingReads, error: sanitizeError(error) });
          throw error;
        }
      }, options);
      event(trace, 'transaction-commit', { callerId, callbackAttempts: callbackAttempt });
      return result;
    } catch (error) {
      event(trace, 'transaction-rollback', { callerId, callbackAttempts: callbackAttempt, error: sanitizeError(error) });
      throw error;
    }
  };
  return wrapped;
}

function recordSettlements(trace, settlements) {
  trace.settlements = settlements.map((row, index) => row.status === 'fulfilled'
    ? { index, status: 'fulfilled', receiptId: String(row.value?.receiptId || ''), outcome: String(row.value?.outcome || row.value?.status || '') }
    : { index, status: 'rejected', error: sanitizeError(row.reason) });
}

function writeTrace(trace, finalState = {}) {
  const output = { ...trace, finalState, operationWallTimeMs: Date.now() - trace._startedAt };
  delete output._startedAt;
  delete output._activeSdkReads;
  const root = process.env.CHAOS_RELEASE_GATE_RUN_DIR
    ? path.resolve(process.env.CHAOS_RELEASE_GATE_RUN_DIR)
    : path.resolve(process.cwd(), 'test-results', 'emulator-traces');
  const dir = process.env.CHAOS_RELEASE_GATE_RUN_DIR ? path.join(root, 'emulator-traces') : root;
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeId = String(trace.testId || 'trace').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 120);
  const file = path.join(dir, `${safeId}-${stamp}.json`);
  fs.writeFileSync(file, `${JSON.stringify(output, null, 2)}\n`);
  return file;
}

module.exports = { packageVersion, sanitizeError, createTrace, event, createReadBarrier, instrumentFirestoreDb, recordSettlements, writeTrace };
