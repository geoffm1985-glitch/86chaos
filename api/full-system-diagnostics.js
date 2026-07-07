const admin = require('firebase-admin');
const zlib = require('zlib');
const crypto = require('crypto');

const APP_VERSION = '14.0.0';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try { return JSON.parse(raw); }
    catch (_) { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.'); }
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
  const projectId = serviceAccount.project_id || serviceAccount.projectId;
  if (!projectId) throw new Error('Missing Firebase service account project id.');
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket });
}

async function authorize(req, adminApp) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Missing authorization token.' };
  try {
    const decoded = await adminApp.auth().verifyIdToken(token);
    const masterEmail = (process.env.MASTER_ADMIN_EMAIL || 'geoffm1985@gmail.com').toLowerCase();
    const email = (decoded.email || '').toLowerCase();
    if (email === masterEmail || decoded.superAdmin === true) return { ok: true, uid: decoded.uid, email: decoded.email || '', actor: decoded.email || decoded.uid };
    return { ok: false, status: 403, error: 'Super admin required.' };
  } catch (err) {
    return { ok: false, status: 401, error: `Invalid authorization token: ${err.message}` };
  }
}

async function timed(label, fn) {
  const started = Date.now();
  try {
    const value = await fn();
    return { label, ok: true, ms: Date.now() - started, value };
  } catch (err) {
    return { label, ok: false, ms: Date.now() - started, error: err.message };
  }
}

async function countCollection(db, name) {
  try {
    if (typeof db.collection(name).count === 'function') {
      const snap = await db.collection(name).count().get();
      return snap.data().count || 0;
    }
  } catch (_) {}
  const snap = await db.collection(name).limit(1000).get();
  return snap.size;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isGzipBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function parseBackupBytes(buffer) {
  const storageFormat = isGzipBuffer(buffer) ? 'gzip' : 'plain-json';
  const text = storageFormat === 'gzip' ? zlib.gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
  return { parsed: JSON.parse(text), storageFormat };
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

async function inspectLatestBackup(bucket, files) {
  const latest = files.find(file => file.name.endsWith('.json.gz') || file.name.endsWith('.json'));
  if (!latest) return { ok: false, status: 'missing', message: 'No Firestore backup files found.' };
  const [metadata] = await latest.getMetadata().catch(() => [{}]);
  const custom = metadata?.metadata || {};
  const { buffer, rawDownload } = await downloadBackupBytes(latest);
  const hash = sha256(buffer);
  let parsed = null;
  let storageFormat = 'unknown';
  try {
    const result = parseBackupBytes(buffer);
    parsed = result.parsed;
    storageFormat = result.storageFormat;
  } catch (err) {
    return { ok: false, status: 'failed', path: latest.name, sizeBytes: Number(metadata.size || buffer.length || 0), sha256: hash, storageFormat: isGzipBuffer(buffer) ? 'gzip-unreadable' : 'plain-json-unreadable', rawDownload, error: `Latest backup cannot be decompressed or parsed as JSON: ${err.message}` };
  }
  const errors = [];
  const warnings = [];
  if (!parsed?.metadata?.runId) errors.push('Missing runId metadata.');
  if (!parsed?.collections || typeof parsed.collections !== 'object') errors.push('Missing collections payload.');
  if (latest.name.endsWith('.json.gz') && storageFormat !== 'gzip') warnings.push('Backup is named .json.gz, but Storage returned readable plain JSON. This can happen when Google Storage auto-decompresses gzip content; backup data is still readable.');
  if (custom.sha256 && custom.sha256 !== hash) {
    if (storageFormat === 'gzip') errors.push('Storage metadata checksum differs from downloaded compressed checksum.');
    else warnings.push('Checksum comparison skipped because downloaded bytes were readable plain JSON instead of compressed gzip bytes.');
  }
  const documentCount = Number(parsed?.metadata?.documentCount || custom.documentCount || 0);
  const collectionCount = Number(parsed?.metadata?.collectionCount || custom.collectionCount || 0);
  return {
    ok: errors.length === 0,
    status: errors.length ? 'failed' : (warnings.length ? 'warning' : 'verified'),
    path: latest.name,
    runId: parsed?.metadata?.runId || custom.runId || '',
    mode: custom.mode || (latest.name.includes('/scheduled/') ? 'scheduled' : latest.name.includes('/manual/') ? 'manual' : 'unknown'),
    createdAt: metadata.timeCreated || null,
    updatedAt: metadata.updated || null,
    sizeBytes: Number(metadata.size || buffer.length || 0),
    sha256: hash,
    metadataSha256: custom.sha256 || '',
    storageFormat,
    rawDownload,
    documentCount,
    collectionCount,
    errors,
    warnings
  };
}

module.exports = async function handler(req, res) {
  const startedAt = new Date();
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use GET or POST.' });
    const adminApp = initAdmin();
    const auth = await authorize(req, adminApp);
    if (!auth.ok) return res.status(auth.status || 401).json({ ok: false, error: auth.error });

    const db = adminApp.firestore();
    const bucket = adminApp.storage().bucket();

    const firestoreStatus = await timed('firestoreStatusRead', async () => {
      const snap = await db.collection('system').doc('backupStatus').get();
      return snap.exists ? snap.data() : null;
    });

    const storageList = await timed('storageUsageAndBackups', async () => {
      const [allFiles] = await bucket.getFiles();
      const backupFiles = allFiles.filter(file => file.name.startsWith('backups/firestore/') && (file.name.endsWith('.json.gz') || file.name.endsWith('.json'))).sort((a, b) => b.name.localeCompare(a.name));
      let bucketBytes = 0;
      let backupBytes = 0;
      let scheduled = 0;
      let manual = 0;
      let verified = 0;
      for (const file of allFiles) {
        const [metadata] = await file.getMetadata().catch(() => [{}]);
        const size = Number(metadata?.size || 0);
        bucketBytes += size;
        if (file.name.startsWith('backups/firestore/') && (file.name.endsWith('.json.gz') || file.name.endsWith('.json'))) {
          backupBytes += size;
          if (file.name.includes('/scheduled/')) scheduled++;
          if (file.name.includes('/manual/')) manual++;
          if (metadata?.metadata?.integrityStatus === 'verified') verified++;
        }
      }
      const latestIntegrity = await inspectLatestBackup(bucket, backupFiles);
      return { bucket: bucket.name, totalFiles: allFiles.length, totalBytes: bucketBytes, backupFileCount: backupFiles.length, backupBytes, scheduled, manual, verified, latestIntegrity };
    });

    const countChecks = await timed('coreCollectionCounts', async () => {
      const names = ['restaurants', 'users', 'auditLogs', 'crashReports', 'timePunches', 'shifts'];
      const results = {};
      for (const name of names) results[name] = await countCollection(db, name);
      return results;
    });

    const finishedAt = new Date();
    const report = {
      ok: true,
      app: '86 Chaos',
      version: APP_VERSION,
      generatedAt: finishedAt.toISOString(),
      startedAt: startedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      generatedBy: auth.actor,
      environment: {
        projectId: process.env.FIREBASE_PROJECT_ID || (process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'from service account json' : 'missing'),
        storageBucket: bucket.name,
        masterEmailConfigured: !!process.env.MASTER_ADMIN_EMAIL,
        cronSecretConfigured: !!process.env.CRON_SECRET,
        serviceAccountMode: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'json' : 'split-env'
      },
      checks: {
        firestoreStatus,
        storageList,
        coreCollectionCounts: countChecks
      },
      lastSuccessfulSync: firestoreStatus.value?.lastSuccessfulBackupAt || firestoreStatus.value?.lastBackupAt || firestoreStatus.value?.lastRunAt || null,
      backupIntegrity: storageList.value?.latestIntegrity || firestoreStatus.value?.backupIntegrity || null
    };

    await db.collection('system').doc('fullSystemDiagnostics').set({
      lastRunAt: report.generatedAt,
      lastRunBy: auth.actor,
      lastDurationMs: report.durationMs,
      lastStatus: 'ok',
      lastFirestoreLatencyMs: firestoreStatus.ms,
      lastStorageLatencyMs: storageList.ms,
      lastBackupIntegrityStatus: report.backupIntegrity?.status || 'unknown',
      version: APP_VERSION
    }, { merge: true }).catch(() => null);

    await db.collection('auditLogs').add({
      restaurantId: 'platform',
      action: 'FULL_SYSTEM_DIAGNOSTICS_RUN',
      target: 'system/fullSystemDiagnostics',
      details: `Full system diagnostics generated in ${report.durationMs}ms. Firestore ${firestoreStatus.ms}ms; Storage ${storageList.ms}ms; Backup integrity ${report.backupIntegrity?.status || 'unknown'}.`,
      userId: auth.uid || 'system-admin',
      userName: auth.actor,
      timestamp: report.generatedAt,
      sessionId: req.headers['x-chaos-session-id'] || '',
      isGhost: false
    }).catch(() => null);

    return res.status(200).json(report);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports.config = { maxDuration: 60 };
