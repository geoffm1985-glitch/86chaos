'use strict';

const crypto = require('crypto');
const admin = require('firebase-admin');
const { encryptTokenBundle, decryptTokenBundle } = require('./_shift4-crypto');

const MAX_PAGE_SIZE = 500;
const MAX_EXPORT_RECORDS = 50000;
const PERSIST_BATCH_SIZE = 150;
const LEGACY_SCAN_FACTOR = 10;
const scopeIdFor = restaurantId => crypto.createHash('sha256').update(`shift4|${String(restaurantId || '').trim()}`).digest('hex');
const locationScopeIdFor = locationId => crypto.createHash('sha256').update(`shift4-location|${String(locationId || '').trim()}`).digest('hex');
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => !['importRunId','sourceRetrievalRunId','persistedAt','sourceObservedAtMs','contentHash','canonicalIdentityKey','locationDateKey'].includes(key)).map(key => [key, canonical(value[key])]));
  return value;
};
const contentHash = record => crypto.createHash('sha256').update(JSON.stringify(canonical(record))).digest('hex');

function credentialRef(db, restaurantId) { return db.collection('shift4Credentials').doc(scopeIdFor(restaurantId)); }
function connectionControlRef(db, restaurantId) { return db.collection('shift4ConnectionControls').doc(scopeIdFor(restaurantId)); }
function scopeRef(db, restaurantId) { return db.collection('posSyncScopes').doc(scopeIdFor(restaurantId)); }
function recordsCollection(db, restaurantId) { return scopeRef(db, restaurantId).collection('records'); }
function locationDateKey(locationId, businessDate) { return `${locationScopeIdFor(locationId)}|${String(businessDate || '')}`; }

async function allocateConnectionAttempt(db, restaurantId, stateDigest, nowIso = new Date().toISOString()) {
  const ref = connectionControlRef(db, restaurantId);
  let generation = 0;
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    generation = Math.max(0, Number(snap.exists ? snap.data()?.generation : 0) || 0) + 1;
    transaction.set(ref, { restaurantIdHash: scopeIdFor(restaurantId), provider: 'shift4', generation, latestStateHash: stateDigest, attemptCreatedAt: nowIso }, { merge: true });
  });
  return generation;
}

async function saveCredentialForAttempt(db, restaurantId, tokenBundle, safeMetadata = {}, options = {}) {
  let envelope;
  try { envelope = encryptTokenBundle(tokenBundle, restaurantId, options); }
  catch (error) { throw Object.assign(new Error('Shift4 credentials could not be encrypted.'), { code: 'credential_encryption_failed', statusCode: 500, cause: error }); }
  const credential = credentialRef(db, restaurantId);
  const control = connectionControlRef(db, restaurantId);
  const generation = Number(safeMetadata.connectionGeneration || 0);
  await db.runTransaction(async transaction => {
    const current = await transaction.get(control);
    const controlData = current.exists ? current.data() || {} : {};
    if (!current.exists || Number(controlData.generation) !== generation || String(controlData.latestStateHash || '') !== String(safeMetadata.stateHash || '')) {
      throw Object.assign(new Error('A newer Shift4 connection attempt superseded this callback.'), { code: 'superseded_state', statusCode: 409 });
    }
    transaction.set(credential, {
      restaurantIdHash: scopeIdFor(restaurantId), provider: 'shift4', providerProduct: 'shift4-dine', envelope,
      connectionGeneration: generation, tokenRevision: 1, connectionStatus: 'connected',
      connectedAt: safeMetadata.connectedAt || new Date().toISOString(), authorizedByUid: String(safeMetadata.authorizedByUid || ''),
      permissions: Array.isArray(tokenBundle.permissions) ? tokenBundle.permissions : [], selectedLocation: null,
      lastRefreshAt: null, refreshFailureAt: null, updatedAt: new Date().toISOString()
    }, { merge: false });
    transaction.set(control, { completedGeneration: generation, completedAt: new Date().toISOString() }, { merge: true });
  });
}

async function saveCredential(db, restaurantId, tokenBundle, safeMetadata = {}, options = {}) {
  const envelope = encryptTokenBundle(tokenBundle, restaurantId, options);
  await credentialRef(db, restaurantId).set({
    restaurantIdHash: scopeIdFor(restaurantId), provider: 'shift4', providerProduct: 'shift4-dine', envelope,
    connectionStatus: 'connected', connectedAt: safeMetadata.connectedAt || new Date().toISOString(),
    authorizedByUid: String(safeMetadata.authorizedByUid || ''), permissions: Array.isArray(tokenBundle.permissions) ? tokenBundle.permissions : [],
    selectedLocation: safeMetadata.selectedLocation || null, lastRefreshAt: safeMetadata.lastRefreshAt || null,
    lastSuccessfulImportAt: safeMetadata.lastSuccessfulImportAt || null, latestImportStatus: safeMetadata.latestImportStatus || null,
    connectionGeneration: Number(safeMetadata.connectionGeneration || 0), tokenRevision: Number(safeMetadata.tokenRevision || 1), updatedAt: new Date().toISOString()
  }, { merge: true });
}

async function readCredentialMetadata(db, restaurantId) {
  const snap = await credentialRef(db, restaurantId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    provider: data.provider, providerProduct: data.providerProduct, connectionStatus: data.connectionStatus,
    connectedAt: data.connectedAt || null, permissions: Array.isArray(data.permissions) ? data.permissions : [],
    selectedLocation: data.selectedLocation || null, lastRefreshAt: data.lastRefreshAt || null,
    lastSuccessfulImportAt: data.lastSuccessfulImportAt || null, latestImportStatus: data.latestImportStatus || null,
    connectionGeneration: Number(data.connectionGeneration || 0), tokenRevision: Number(data.tokenRevision || 0)
  };
}

async function readCredential(db, restaurantId, options = {}) {
  const snap = await credentialRef(db, restaurantId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  try { return { data, tokenBundle: decryptTokenBundle(data.envelope, restaurantId, options) }; }
  catch (error) { throw Object.assign(new Error('Stored Shift4 credentials could not be decrypted.'), { code: 'credential_decryption_failed', statusCode: 500, cause: error }); }
}

async function updateCredentialMetadata(db, restaurantId, patch, options = {}) {
  const ref = credentialRef(db, restaurantId);
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw Object.assign(new Error('Shift4 is not connected for this workspace.'), { code: 'not_connected', statusCode: 409 });
    const data = snap.data() || {};
    if (options.expectedGeneration != null && Number(data.connectionGeneration || 0) !== Number(options.expectedGeneration)) {
      throw Object.assign(new Error('The Shift4 connection changed during this operation.'), { code: 'credential_superseded', statusCode: 409 });
    }
    transaction.set(ref, { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  });
}

async function refreshCredentialTokens(db, restaurantId, prior, tokenBundle, options = {}) {
  let envelope;
  try { envelope = encryptTokenBundle(tokenBundle, restaurantId, options.cryptoOptions || {}); }
  catch (error) { throw Object.assign(new Error('Refreshed Shift4 credentials could not be encrypted.'), { code: 'credential_encryption_failed', statusCode: 500, cause: error }); }
  const ref = credentialRef(db, restaurantId);
  let result;
  try {
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw Object.assign(new Error('Shift4 is no longer connected.'), { code: 'credential_superseded', statusCode: 409 });
      const data = snap.data() || {};
      if (Number(data.connectionGeneration || 0) !== Number(prior.data.connectionGeneration || 0) || Number(data.tokenRevision || 0) !== Number(prior.data.tokenRevision || 0)) {
        throw Object.assign(new Error('Newer Shift4 credentials are already stored.'), { code: 'credential_superseded', statusCode: 409 });
      }
      const tokenRevision = Number(data.tokenRevision || 0) + 1;
      transaction.set(ref, { envelope, permissions: tokenBundle.permissions, tokenRevision, lastRefreshAt: new Date().toISOString(), refreshFailureAt: null, updatedAt: new Date().toISOString() }, { merge: true });
      result = { data: { ...data, tokenRevision, lastRefreshAt: new Date().toISOString() }, tokenBundle };
    });
  } catch (error) {
    if (error?.code) throw error;
    throw Object.assign(new Error('Refreshed Shift4 credentials could not be saved.'), { code: 'credential_save_failed', statusCode: 500, cause: error });
  }
  return result;
}

function buildPersistencePlan(records = [], existingById = new Map()) {
  const inserts = []; const updates = []; const unchanged = []; const conflicts = []; let duplicates = 0;
  const unique = new Map();
  for (const record of records) {
    if (!record?.idempotencyKey) continue;
    const hash = contentHash(record);
    const prior = unique.get(record.idempotencyKey);
    if (prior) {
      if (prior.hash === hash) duplicates += 1;
      else conflicts.push({ id: record.idempotencyKey, reason: 'conflicting_same_source_identity' });
      continue;
    }
    unique.set(record.idempotencyKey, { record, hash });
  }
  const conflicted = new Set(conflicts.map(row => row.id));
  for (const [id, entry] of unique) {
    if (conflicted.has(id)) continue;
    const existing = existingById.get(id) || (entry.record.legacyIdempotencyKey ? existingById.get(entry.record.legacyIdempotencyKey) : null);
    const planned = { id: existing?.__documentId || id, canonicalId: id, record: { ...entry.record, contentHash: entry.hash } };
    if (!existing) inserts.push(planned);
    else if (existing.contentHash === entry.hash || contentHash(existing) === entry.hash) unchanged.push(planned);
    else updates.push(planned);
  }
  return { inserts, updates, unchanged, conflicts, duplicates };
}

async function persistRecords(db, restaurantId, providerLocationId, records = [], options = {}) {
  const collection = recordsCollection(db, restaurantId);
  const observedAtMs = Number(options.observedAtMs || Date.now());
  const deduped = [...new Map(records.filter(row => row?.idempotencyKey).map(row => [row.idempotencyKey, row])).values()];
  const stats = { inserted: 0, updated: 0, unchanged: 0, superseded: 0, conflicts: 0, duplicateInputRecords: records.length - deduped.length, scopedDocumentReads: 0, scopedDocumentWritesCommitted: 0, committedBatches: 0, persistenceComplete: true, failedBatch: null };
  for (let index = 0; index < deduped.length; index += PERSIST_BATCH_SIZE) {
    const chunk = deduped.slice(index, index + PERSIST_BATCH_SIZE);
    try {
      const batchStats = await db.runTransaction(async transaction => {
        const rows = [];
        for (const record of chunk) {
          const nextRef = collection.doc(record.idempotencyKey);
          const legacyRef = record.legacyIdempotencyKey && record.legacyIdempotencyKey !== record.idempotencyKey ? collection.doc(record.legacyIdempotencyKey) : null;
          const nextSnap = await transaction.get(nextRef);
          const legacySnap = !nextSnap.exists && legacyRef ? await transaction.get(legacyRef) : null;
          rows.push({ record, nextRef, snap: nextSnap.exists ? nextSnap : legacySnap, targetRef: nextSnap.exists ? nextRef : (legacySnap?.exists ? legacyRef : nextRef), reads: legacySnap ? 2 : 1 });
        }
        const local = { inserted: 0, updated: 0, unchanged: 0, superseded: 0, conflicts: 0, reads: 0, writes: 0 };
        for (const row of rows) {
          local.reads += row.reads;
          const nextHash = contentHash(row.record);
          const existing = row.snap?.exists ? row.snap.data() || {} : null;
          if (existing && Number(existing.sourceObservedAtMs || 0) > observedAtMs) { local.superseded += 1; continue; }
          if (existing && existing.contentHash === nextHash) { local.unchanged += 1; continue; }
          if (existing && Number(existing.sourceObservedAtMs || 0) === observedAtMs && existing.contentHash && existing.contentHash !== nextHash) { local.conflicts += 1; continue; }
          const persisted = { ...row.record, canonicalIdentityKey: row.record.idempotencyKey, locationDateKey: locationDateKey(providerLocationId, row.record.businessDate), contentHash: nextHash, sourceObservedAtMs: observedAtMs, persistedAt: new Date().toISOString() };
          transaction.set(row.targetRef, persisted, { merge: false });
          local.writes += 1;
          if (existing) local.updated += 1; else local.inserted += 1;
        }
        return local;
      });
      stats.inserted += batchStats.inserted; stats.updated += batchStats.updated; stats.unchanged += batchStats.unchanged;
      stats.superseded += batchStats.superseded; stats.conflicts += batchStats.conflicts;
      stats.scopedDocumentReads += batchStats.reads; stats.scopedDocumentWritesCommitted += batchStats.writes; stats.committedBatches += 1;
    } catch (error) {
      stats.persistenceComplete = false; stats.failedBatch = Math.floor(index / PERSIST_BATCH_SIZE) + 1; stats.failureCode = 'persistence_batch_failed'; break;
    }
  }
  return stats;
}

async function writeRun(db, restaurantId, runId, metadata) {
  await scopeRef(db, restaurantId).collection('runs').doc(runId).set({ ...metadata, restaurantId, provider: 'shift4', providerProduct: 'shift4-dine' }, { merge: true });
}

function encodeCursor(cursor) { return cursor ? Buffer.from(JSON.stringify(cursor)).toString('base64url') : null; }
function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (parsed?.v !== 1) throw new Error('version');
    return parsed;
  } catch (_) { throw Object.assign(new Error('The review cursor is invalid.'), { code: 'invalid_cursor', statusCode: 400 }); }
}

async function fetchStream(query, cursor, fetchLimit) {
  let active = query;
  if (cursor?.date && cursor?.id) active = active.startAfter(cursor.date, cursor.id);
  const snap = await active.limit(fetchLimit).get();
  return snap.docs;
}

async function listRecordsPage(db, restaurantId, { providerLocationId, from, to, pageSize = 100, cursor = '' }) {
  if (!providerLocationId) throw Object.assign(new Error('A selected Shift4 location is required.'), { code: 'unverified_pos', statusCode: 409 });
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || 100));
  const decoded = decodeCursor(cursor) || { v: 1, modern: null, legacy: null, modernDone: false, legacyDone: false };
  const collection = recordsCollection(db, restaurantId);
  const docId = admin.firestore.FieldPath.documentId();
  const prefix = locationScopeIdFor(providerLocationId);
  let modernDocs = [];
  if (!decoded.modernDone) {
    const query = collection.where('locationDateKey', '>=', `${prefix}|${from}`).where('locationDateKey', '<=', `${prefix}|${to}`).orderBy('locationDateKey', 'asc').orderBy(docId, 'asc');
    modernDocs = await fetchStream(query, decoded.modern, size + 1);
  }
  const modernRows = modernDocs.slice(0, size).map(doc => ({ id: doc.id, ...doc.data() }));
  const remaining = Math.max(0, size - modernRows.length);
  let legacyDocs = []; let scannedLegacy = 0;
  if (remaining && !decoded.legacyDone) {
    const query = collection.where('businessDate', '>=', from).where('businessDate', '<=', to).orderBy('businessDate', 'asc').orderBy(docId, 'asc');
    let legacyCursor = decoded.legacy; const scanLimit = Math.max(remaining + 1, remaining * LEGACY_SCAN_FACTOR);
    while (legacyDocs.filter(doc => !doc.data()?.locationDateKey && String(doc.data()?.providerLocationId || '') === String(providerLocationId)).length < remaining + 1 && scannedLegacy < scanLimit) {
      const docs = await fetchStream(query, legacyCursor, Math.min(500, scanLimit - scannedLegacy));
      if (!docs.length) { decoded.legacyDone = true; break; }
      legacyDocs.push(...docs); scannedLegacy += docs.length;
      const last = docs[docs.length - 1]; legacyCursor = { date: last.data()?.businessDate, id: last.id };
      decoded.legacy = legacyCursor;
      if (docs.length < Math.min(500, scanLimit - (scannedLegacy - docs.length))) { decoded.legacyDone = true; break; }
    }
  }
  const legacyMatches = legacyDocs.filter(doc => !doc.data()?.locationDateKey && String(doc.data()?.providerLocationId || '') === String(providerLocationId));
  const legacyRows = legacyMatches.slice(0, remaining).map(doc => ({ id: doc.id, ...doc.data() }));
  if (modernDocs.length <= size) decoded.modernDone = true;
  else { const last = modernDocs[size - 1]; decoded.modern = { date: last.data()?.locationDateKey, id: last.id }; }
  if (legacyMatches.length > remaining) {
    const lastIncluded = legacyMatches[remaining - 1];
    decoded.legacy = lastIncluded ? { date: lastIncluded.data()?.businessDate, id: lastIncluded.id } : decoded.legacy;
    decoded.legacyDone = false;
  } else if (scannedLegacy >= Math.max(remaining + 1, remaining * LEGACY_SCAN_FACTOR) && !decoded.legacyDone) {
    decoded.legacyScanBounded = true;
  }
  const rows = [...modernRows, ...legacyRows].sort((a, b) => String(a.businessDate).localeCompare(String(b.businessDate)) || String(a.id).localeCompare(String(b.id))).slice(0, size);
  const hasMore = !decoded.modernDone || !decoded.legacyDone;
  return { records: rows, pageSize: size, returned: rows.length, hasMore, nextCursor: hasMore ? encodeCursor(decoded) : null, completeness: decoded.legacyScanBounded ? 'bounded_legacy_scan' : (hasMore ? 'page' : 'complete_stored_range'), scopedDocumentReads: modernDocs.length + legacyDocs.length };
}

async function listAllRecords(db, restaurantId, options = {}) {
  const maxRecords = Math.min(MAX_EXPORT_RECORDS, Math.max(1, Number(options.maxRecords || MAX_EXPORT_RECORDS)));
  return collectAllRecordPages(cursor => listRecordsPage(db, restaurantId, { ...options, pageSize: 500, cursor }), maxRecords);
}

async function collectAllRecordPages(loadPage, maxRecords = MAX_EXPORT_RECORDS) {
  const records = []; let cursor = ''; let reads = 0; let pages = 0; let page; const seenCursors = new Set();
  do {
    page = await loadPage(cursor); records.push(...(page.records || [])); reads += Number(page.scopedDocumentReads || 0); pages += 1;
    if (page.completeness === 'bounded_legacy_scan') return { records: records.slice(0, maxRecords), complete: false, reason: 'bounded_legacy_scan', scopedDocumentReads: reads, pages };
    if (!page.hasMore) break;
    const next = String(page.nextCursor || '');
    if (!next || seenCursors.has(next)) return { records: records.slice(0, maxRecords), complete: false, reason: 'repeated_cursor', scopedDocumentReads: reads, pages };
    seenCursors.add(next); cursor = next;
  } while (records.length <= maxRecords && pages < 200);
  if (page?.hasMore || records.length > maxRecords) return { records: records.slice(0, maxRecords), complete: false, reason: records.length > maxRecords ? 'record_limit_exceeded' : 'page_limit_exceeded', scopedDocumentReads: reads, pages };
  return { records, complete: true, reason: '', scopedDocumentReads: reads, pages };
}

module.exports = {
  MAX_PAGE_SIZE, MAX_EXPORT_RECORDS, PERSIST_BATCH_SIZE, scopeIdFor, locationScopeIdFor, locationDateKey,
  contentHash, credentialRef, connectionControlRef, scopeRef, allocateConnectionAttempt, saveCredentialForAttempt,
  saveCredential, readCredentialMetadata, readCredential, updateCredentialMetadata, refreshCredentialTokens,
  buildPersistencePlan, persistRecords, writeRun, encodeCursor, decodeCursor, listRecordsPage, listAllRecords, collectAllRecordPages
};
