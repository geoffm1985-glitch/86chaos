'use strict';
const crypto = require('node:crypto');
const { scopeRef, credentialRef } = require('./_shift4-storage');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const LEASE_MS = 5 * 60 * 1000;
const fail = (code, message) => { throw Object.assign(new Error(message), { code, statusCode:409 }); };
function importIntent(input) {
  return { restaurantId:String(input.restaurantId), providerLocationId:String(input.providerLocationId), from:String(input.from), to:String(input.to), connectionGeneration:Number(input.connectionGeneration) };
}
async function beginImport(db, input, now = Date.now()) {
  if (!/^[A-Za-z0-9_-]{16,160}$/.test(input.operationId || '')) fail('invalid_import_operation', 'A valid import operation identity is required.');
  const intent = importIntent(input), intentDigest = hash(intent);
  const ref = scopeRef(db, input.restaurantId).collection('importOperations').doc(input.operationId);
  const leaseRef = scopeRef(db, input.restaurantId).collection('importLeases').doc(intentDigest);
  return db.runTransaction(async tx => {
    const [prior, lease] = await Promise.all([tx.get(ref), tx.get(leaseRef)]);
    const state = prior.exists ? prior.data() : {};
    if (prior.exists && state.intentDigest !== intentDigest) fail('import_operation_mismatch', 'This import identity is bound to another range or connection.');
    if (state.status === 'finished') return { ref, leaseRef, restaurantId:input.restaurantId, completed:state.summary, operationId:input.operationId };
    if (lease.exists && lease.data().expiresAtMs > now && lease.data().status === 'active') fail('import_in_progress', 'This range already has an active import. Wait before retrying.');
    const generation = Number(state.generation || 0) + 1, token = crypto.randomUUID();
    const statePatch = { ...intent, operationId:input.operationId, intentDigest, generation, token, status:'running', phase:'retrieval', startedAt:new Date(now).toISOString(), expiresAtMs:now + LEASE_MS, observedAtMs:now, updatedAt:new Date(now).toISOString() };
    tx.set(ref, statePatch, { merge:true });
    tx.set(leaseRef, { operationId:input.operationId, generation, token, expiresAtMs:now + LEASE_MS, status:'active' });
    return { ref, leaseRef, ...statePatch };
  });
}
async function assertImportFence(tx, db, operation, now = Date.now()) {
  const [snap, lease, credential] = await Promise.all([tx.get(operation.ref), tx.get(operation.leaseRef), tx.get(credentialRef(db, operation.restaurantId))]);
  const state = snap.exists ? snap.data() : {}, active = lease.exists ? lease.data() : {};
  if (state.status !== 'running' || state.generation !== operation.generation || state.token !== operation.token || active.token !== operation.token || active.status !== 'active' || active.expiresAtMs <= now) fail('stale_import_fence', 'A newer import or an expired lease replaced this attempt.');
  if (!credential.exists || Number(credential.data().connectionGeneration) !== operation.connectionGeneration || String(credential.data().selectedLocation?.id) !== operation.providerLocationId) fail('credential_superseded', 'The POS connection or selected location changed.');
  return state;
}
async function checkpointImport(db, operation, phase, counts = {}, now = Date.now()) {
  if (!['normalization','persistence'].includes(phase)) fail('invalid_import_phase', 'Invalid import phase.');
  const allowed = Object.fromEntries(['received','normalized','committedBatches'].filter(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0).map(key => [key,counts[key]]));
  return db.runTransaction(async tx => {
    await assertImportFence(tx, db, operation, now);
    tx.set(operation.ref, { phase, counts:allowed, expiresAtMs:now + LEASE_MS, updatedAt:new Date(now).toISOString() }, { merge:true });
    tx.set(operation.leaseRef, { expiresAtMs:now + LEASE_MS }, { merge:true });
  });
}
async function finishImport(db, operation, summary, failureCode = '', now = Date.now()) {
  return db.runTransaction(async tx => {
    // Finalization is fenced but can release after expiry if no takeover occurred.
    const [snap, lease] = await Promise.all([tx.get(operation.ref),tx.get(operation.leaseRef)]);
    if (!snap.exists || snap.data().token !== operation.token || !lease.exists || lease.data().token !== operation.token) fail('stale_import_fence', 'A newer import replaced this attempt.');
    tx.set(operation.ref, { status:failureCode ? 'failed' : 'finished', phase:failureCode ? 'failed' : 'review', summary:summary || null, failureCode:String(failureCode).slice(0,80), finishedAt:new Date(now).toISOString(), updatedAt:new Date(now).toISOString() }, { merge:true });
    tx.set(operation.leaseRef, { status:'released', expiresAtMs:now }, { merge:true });
  });
}
module.exports = { LEASE_MS, importIntent, beginImport, assertImportFence, checkpointImport, finishImport };
