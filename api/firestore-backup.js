const admin = require('firebase-admin');
const { requireMfaIfEnforced, masterEmails } = require('./_chaos-admin');
const zlib = require('zlib');
const crypto = require('crypto');

const APP_VERSION = '15.0.41';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. Copy the full Firebase service account JSON into Vercel.');
    }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
}

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount.project_id && !serviceAccount.projectId) {
    throw new Error('Missing Firebase service account project id. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.');
  }
  const projectId = serviceAccount.project_id || serviceAccount.projectId;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket
  });
}

function isoSafe(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function getNextDailyBackupAt(from = new Date()) {
  const next = new Date(from.getTime());
  next.setUTCHours(9, 0, 0, 0); // Vercel cron: 0 9 * * *
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function serializeValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === 'function') return { __type: 'timestamp', value: value.toDate().toISOString() };
  if (typeof value?.isEqual === 'function' && typeof value?.path === 'string') return { __type: 'documentReference', path: value.path };
  if (typeof value?.latitude === 'number' && typeof value?.longitude === 'number') return { __type: 'geoPoint', latitude: value.latitude, longitude: value.longitude };
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = serializeValue(v); });
    return out;
  }
  return value;
}

function deserializeValue(value, db) {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(v => deserializeValue(v, db));
  if (value && typeof value === 'object') {
    if (value.__type === 'timestamp' && value.value) {
      return admin.firestore.Timestamp.fromDate(new Date(value.value));
    }
    if (value.__type === 'documentReference' && value.path) {
      return db.doc(value.path);
    }
    if (value.__type === 'geoPoint' && typeof value.latitude === 'number' && typeof value.longitude === 'number') {
      return new admin.firestore.GeoPoint(value.latitude, value.longitude);
    }
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = deserializeValue(v, db); });
    return out;
  }
  return value;
}

async function readJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

async function restoreBackupFromStorage({ adminApp, db, storagePath, actor }) {
  if (!storagePath || !String(storagePath).endsWith('.json.gz')) {
    throw new Error('Provide a valid Firebase Storage backup path ending in .json.gz.');
  }
  const bucket = adminApp.storage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`Backup file not found in Storage: ${storagePath}`);

  const { buffer } = await downloadBackupBytes(file);
  const parsed = parseBackupBytes(buffer);
  const backup = parsed.backup;
  if (!backup?.collections || typeof backup.collections !== 'object') {
    throw new Error('Backup file is missing the expected collections payload.');
  }

  const startedAt = new Date();
  const runId = `restore-${isoSafe(startedAt)}`;
  let restoredDocumentCount = 0;
  let skippedDocumentCount = 0;
  let batch = db.batch();
  let batchCount = 0;

  const commitBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  for (const [, payload] of Object.entries(backup.collections)) {
    const docs = Array.isArray(payload?.docs) ? payload.docs : [];
    for (const item of docs) {
      if (!item?.path || !item?.data) continue;
      // Never roll back backup status history while restoring a backup.
      if (item.path === 'system/backupStatus' || item.path.startsWith('system/backupStatus/')) {
        skippedDocumentCount += 1;
        continue;
      }
      const ref = db.doc(item.path);
      batch.set(ref, deserializeValue(item.data, db), { merge: true });
      restoredDocumentCount += 1;
      batchCount += 1;
      if (batchCount >= 400) await commitBatch();
    }
  }

  await commitBatch();
  const finishedAt = new Date();
  const result = {
    status: 'restore-ok',
    lastRestoreAt: finishedAt.toISOString(),
    restoreStartedAt: startedAt.toISOString(),
    restoreFinishedAt: finishedAt.toISOString(),
    restoreRunId: runId,
    restoredFromPath: storagePath,
    restoredDocumentCount,
    skippedDocumentCount,
    actor,
    version: APP_VERSION
  };
  await db.collection('system').doc('backupStatus').set(result, { merge: true });
  await db.collection('system').doc('backupStatus').collection('restores').doc(runId).set(result, { merge: true });
  return result;
}

async function authorize(req, adminApp) {
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true, source: 'vercel-cron', actor: 'Vercel Cron' };
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Missing authorization token.' };

  try {
    const decoded = await adminApp.auth().verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase().trim();
    const userSnap = await adminApp.firestore().collection('users').doc(decoded.uid).get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    if (masterEmails().includes(email) || decoded.superAdmin === true || user.isSuperAdmin === true || user.systemAccess?.superAdmin === true) {
      const mfa = requireMfaIfEnforced(decoded, user, true);
      if (!mfa.ok) return mfa;
      return { ok: true, source: 'manual', actor: decoded.email || decoded.uid, uid: decoded.uid, email: decoded.email || '', mfa };
    }
    return { ok: false, status: 403, error: 'Only a System Administrator can run backups.' };
  } catch (err) {
    return { ok: false, status: 401, error: `Invalid authorization token: ${err.message}` };
  }
}

async function exportCollection(collectionRef, collectionPath, backup, counters) {
  const snap = await collectionRef.get();
  backup.collections[collectionPath] = { count: snap.size, docs: [] };
  counters.collectionCount += 1;

  for (const docSnap of snap.docs) {
    counters.documentCount += 1;
    backup.collections[collectionPath].docs.push({
      id: docSnap.id,
      path: docSnap.ref.path,
      createTime: docSnap.createTime?.toDate?.().toISOString?.() || null,
      updateTime: docSnap.updateTime?.toDate?.().toISOString?.() || null,
      data: serializeValue(docSnap.data())
    });

    const subcollections = await docSnap.ref.listCollections();
    for (const sub of subcollections) {
      await exportCollection(sub, `${docSnap.ref.path}/${sub.id}`, backup, counters);
    }
  }
}

async function pruneOldBackups(bucket, keepCount = 35) {
  try {
    const [files] = await bucket.getFiles({ prefix: 'backups/firestore/' });
    const backupFiles = files
      .filter(file => file.name.endsWith('.json.gz'))
      .sort((a, b) => b.name.localeCompare(a.name));
    const toDelete = backupFiles.slice(keepCount);
    await Promise.all(toDelete.map(file => file.delete().catch(() => null)));
    return toDelete.length;
  } catch (_) {
    return 0;
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isGzipBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function parseBackupBytes(buffer) {
  const format = isGzipBuffer(buffer) ? 'gzip' : 'plain-json';
  const text = format === 'gzip' ? zlib.gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
  return { backup: JSON.parse(text), format };
}

async function downloadBackupBytes(file) {
  try {
    const [buffer] = await file.download({ decompress: false });
    return { buffer, rawDownload: true };
  } catch (_) {
    const [buffer] = await file.download();
    return { buffer, rawDownload: false };
  }
}

function buildIntegrityResult({ backup, downloadedBackup, expectedHash, downloadedHash, gzippedBytes, downloadedBytes, storagePath, storageFormat, rawDownload }) {
  const errors = [];
  const warnings = [];
  if (!downloadedBackup?.metadata) errors.push('Missing backup metadata after download.');
  if (!downloadedBackup?.collections || typeof downloadedBackup.collections !== 'object') errors.push('Missing collections payload after download.');
  if (downloadedBackup?.metadata?.runId !== backup.metadata.runId) errors.push('Run ID mismatch after download.');
  if (downloadedBackup?.metadata?.documentCount !== backup.metadata.documentCount) errors.push('Document count mismatch after download.');
  if (downloadedBackup?.metadata?.collectionCount !== backup.metadata.collectionCount) errors.push('Collection count mismatch after download.');
  if (expectedHash !== downloadedHash) {
    if (storageFormat === 'gzip') errors.push('SHA-256 checksum mismatch after raw Storage round trip.');
    else warnings.push('Storage client returned readable plain JSON for a .json.gz backup; checksum comparison used parsed content instead of compressed bytes.');
  }
  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? (warnings.length ? 'warning' : 'verified') : 'failed',
    verifiedAt: new Date().toISOString(),
    storagePath,
    sha256: expectedHash,
    roundTripSha256: downloadedHash,
    compressedBytes: gzippedBytes,
    downloadedBytes,
    storageFormat,
    rawDownload,
    documentCount: backup.metadata.documentCount || 0,
    collectionCount: backup.metadata.collectionCount || 0,
    errors,
    warnings
  };
}

async function verifyUploadedBackup({ file, backup, gzipped, storagePath }) {
  const expectedHash = sha256(gzipped);
  const { buffer: downloaded, rawDownload } = await downloadBackupBytes(file);
  const downloadedHash = sha256(downloaded);
  let parsed = null;
  try {
    parsed = parseBackupBytes(downloaded);
  } catch (err) {
    return {
      ok: false,
      status: 'failed',
      verifiedAt: new Date().toISOString(),
      storagePath,
      sha256: expectedHash,
      roundTripSha256: downloadedHash,
      compressedBytes: gzipped.length,
      downloadedBytes: downloaded.length,
      storageFormat: isGzipBuffer(downloaded) ? 'gzip' : 'unreadable',
      rawDownload,
      documentCount: backup.metadata.documentCount || 0,
      collectionCount: backup.metadata.collectionCount || 0,
      errors: [`Downloaded backup could not be decompressed or parsed as JSON: ${err.message}`],
      warnings: []
    };
  }
  return buildIntegrityResult({ backup, downloadedBackup: parsed.backup, expectedHash, downloadedHash, gzippedBytes: gzipped.length, downloadedBytes: downloaded.length, storagePath, storageFormat: parsed.format, rawDownload });
}


async function handler(req, res) {
  const startedAt = new Date();
  let db;
  try {
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Use GET for cron or POST for manual backup.' });

    const adminApp = initAdmin();
    db = adminApp.firestore();
    const auth = await authorize(req, adminApp);
    if (!auth.ok) return res.status(auth.status || 401).json({ ok: false, error: auth.error });

    const cronInvocation = {
      scheduleHeader: req.headers['x-vercel-cron-schedule'] || '',
      userAgent: req.headers['user-agent'] || '',
      watchdogHeader: req.headers['x-86chaos-watchdog'] || '',
      host: req.headers['x-forwarded-host'] || req.headers.host || '',
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
    };

    const requestedMode = req.query.mode || 'manual';
    if (requestedMode === 'restore') {
      const body = await readJsonBody(req);
      const result = await restoreBackupFromStorage({ adminApp, db, storagePath: body.storagePath || body.path, actor: auth.actor });
      return res.status(200).json({ ok: true, ...result });
    }

    const runId = isoSafe(startedAt);
    const mode = cronInvocation.watchdogHeader ? 'watchdog' : (auth.source === 'vercel-cron' ? 'scheduled' : requestedMode);
    const statusRef = db.collection('system').doc('backupStatus');
    await statusRef.set({
      status: 'running',
      mode,
      runId,
      startedAt: startedAt.toISOString(),
      lastRunAt: startedAt.toISOString(),
      actor: auth.actor,
      source: auth.source,
      version: APP_VERSION
    }, { merge: true });

    const collections = await db.listCollections();
    const backup = {
      metadata: {
        app: '86 Chaos',
        type: 'firestore-json-backup',
        version: APP_VERSION,
        projectId: process.env.FIREBASE_PROJECT_ID || loadServiceAccount().project_id || loadServiceAccount().projectId || null,
        mode,
        runId,
        actor: auth.actor,
        source: auth.source,
        cronInvocation,
        startedAt: startedAt.toISOString()
      },
      collections: {}
    };
    const counters = { collectionCount: 0, documentCount: 0 };

    for (const col of collections) {
      await exportCollection(col, col.id, backup, counters);
    }

    const finishedAt = new Date();
    backup.metadata.finishedAt = finishedAt.toISOString();
    backup.metadata.collectionCount = counters.collectionCount;
    backup.metadata.documentCount = counters.documentCount;

    const json = JSON.stringify(backup);
    const gzipped = zlib.gzipSync(Buffer.from(json, 'utf8'));
    const bucket = adminApp.storage().bucket();
    const filePath = `backups/firestore/${mode}/${runId}.json.gz`;
    const backupFile = bucket.file(filePath);
    const initialSha256 = sha256(gzipped);
    await backupFile.save(gzipped, {
      resumable: false,
      contentType: 'application/json',
      metadata: {
        contentEncoding: 'gzip',
        metadata: {
          runId,
          mode,
          actor: auth.actor,
          documentCount: String(counters.documentCount),
          collectionCount: String(counters.collectionCount),
          sha256: initialSha256,
          integrityStatus: 'pending'
        }
      }
    });

    const integrity = await verifyUploadedBackup({ file: backupFile, backup, gzipped, storagePath: filePath });
    await backupFile.setMetadata({
      metadata: {
        runId,
        mode,
        actor: auth.actor,
        documentCount: String(counters.documentCount),
        collectionCount: String(counters.collectionCount),
        sha256: integrity.sha256,
        integrityStatus: integrity.status,
        integrityVerifiedAt: integrity.verifiedAt,
        integrityErrors: integrity.errors.join(' | ')
      }
    }).catch(() => null);

    const deletedOldBackups = await pruneOldBackups(bucket);

    const statusPayload = {
      status: 'ok',
      lastStatus: 'ok',
      lastBackupAt: finishedAt.toISOString(),
      lastSuccessfulBackupAt: finishedAt.toISOString(),
      lastRunAt: startedAt.toISOString(),
      runFinishedAt: finishedAt.toISOString(),
      mode,
      runId,
      actor: auth.actor,
      source: auth.source,
      storageBucket: bucket.name,
      storagePath: filePath,
      collectionCount: counters.collectionCount,
      documentCount: counters.documentCount,
      compressedBytes: gzipped.length,
      rawBytes: Buffer.byteLength(json, 'utf8'),
      backupIntegrity: integrity,
      lastIntegrityStatus: integrity.status,
      lastIntegrityVerifiedAt: integrity.verifiedAt,
      backupSha256: integrity.sha256,
      deletedOldBackups,
      nextScheduledAt: getNextDailyBackupAt(finishedAt),
      nextBackupAt: getNextDailyBackupAt(finishedAt),
      cronSchedule: '0 9 * * *',
      cronFallbackSchedule: '0 21 * * *',
      cronScheduleHeader: cronInvocation.scheduleHeader,
      cronUserAgent: cronInvocation.userAgent,
      cronHost: cronInvocation.host,
      cronWatchdogHeader: cronInvocation.watchdogHeader,
      ...(auth.source === 'vercel-cron' ? { cronSeenAt: startedAt.toISOString(), lastScheduledBackupAt: finishedAt.toISOString() } : {}),
      version: APP_VERSION
    };

    await statusRef.set(statusPayload, { merge: true });
    await db.collection('system').doc('backupStatus').collection('runs').doc(runId).set(statusPayload, { merge: true });
    await db.collection('auditLogs').add({
      restaurantId: 'platform',
      action: integrity.ok ? 'BACKUP_INTEGRITY_VERIFIED' : 'BACKUP_INTEGRITY_FAILED',
      target: filePath,
      details: integrity.ok
        ? `Backup ${runId} verified after Storage round trip. ${counters.documentCount} docs, ${counters.collectionCount} collections.`
        : `Backup ${runId} failed integrity verification: ${integrity.errors.join(' | ')}`,
      userId: auth.uid || 'system-backup',
      userName: auth.actor || 'System Backup',
      timestamp: integrity.verifiedAt,
      sessionId: runId,
      sessionSource: mode,
      isGhost: false
    }).catch(() => null);

    return res.status(200).json({ ok: true, ...statusPayload });
  } catch (err) {
    try {
      if (db) {
        const failedAt = new Date().toISOString();
        await db.collection('system').doc('backupStatus').set({
          status: 'error',
          lastStatus: 'error',
          lastError: err.message,
          lastErrorAt: failedAt,
          runFinishedAt: failedAt,
          version: APP_VERSION
        }, { merge: true });
        await db.collection('system').doc('backupStatus').collection('errors').add({
          message: err.message,
          stack: err.stack || '',
          time: failedAt
        });
      }
    } catch (_) {}
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 300 };
