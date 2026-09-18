'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
      firestoreSdk: require('@google-cloud/firestore/package.json').version,
      firebaseAdmin: require('firebase-admin/package.json').version,
      firebaseTools: require('firebase-tools/package.json').version,
    },
    ...extra,
    events: [],
    _startedAt: startedAt,
  };
}

function event(trace, type, details = {}) {
  trace.events.push({ atMs: Date.now() - trace._startedAt, type, ...details });
}

function createReadBarrier(parties, trace, label, timeoutMs = 15000) {
  let arrivals = 0;
  let released = false;
  let resolveGate;
  let rejectGate;
  const gate = new Promise((resolve, reject) => { resolveGate = resolve; rejectGate = reject; });
  const timer = setTimeout(() => {
    if (!released) {
      event(trace, 'barrier-timeout', { label, arrivals, parties });
      rejectGate(new Error(`Emulator read barrier ${label} timed out after ${timeoutMs}ms.`));
    }
  }, timeoutMs);
  timer.unref?.();
  return async callerId => {
    arrivals += 1;
    event(trace, 'barrier-arrival', { label, callerId, arrivals, parties });
    if (arrivals === parties) {
      released = true;
      clearTimeout(timer);
      event(trace, 'barrier-release', { label, arrivals, parties });
      resolveGate();
    }
    await gate;
  };
}

function instrumentFirestoreDb(db, { trace, callerId, beforeFirstRead = null } = {}) {
  const wrapped = Object.create(db);
  wrapped.collection = db.collection.bind(db);
  wrapped.runTransaction = async (callback, options) => {
    event(trace, 'transaction-run-start', { callerId });
    let callbackAttempt = 0;
    let firstReadSubmitted = false;
    try {
      const result = await db.runTransaction(async transaction => {
        callbackAttempt += 1;
        let pendingReads = 0;
        event(trace, 'transaction-callback-enter', { callerId, callbackAttempt });
        const tx = Object.create(transaction);
        tx.get = async ref => {
          const target = String(ref?.path || ref?._queryOptions?.collectionId || ref?.constructor?.name || 'unknown').slice(0, 240);
          const readNumber = trace.events.filter(row => row.type === 'read-submit' && row.callerId === callerId && row.callbackAttempt === callbackAttempt).length + 1;
          pendingReads += 1;
          event(trace, 'read-submit', { callerId, callbackAttempt, readNumber, target, pendingReads });
          if (!firstReadSubmitted) {
            firstReadSubmitted = true;
            if (beforeFirstRead) await beforeFirstRead(callerId);
          }
          try {
            const value = await transaction.get(ref);
            pendingReads -= 1;
            event(trace, 'read-settle', { callerId, callbackAttempt, readNumber, target, status: 'fulfilled', pendingReads });
            return value;
          } catch (error) {
            pendingReads -= 1;
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

module.exports = { sanitizeError, createTrace, event, createReadBarrier, instrumentFirestoreDb, recordSettlements, writeTrace };
