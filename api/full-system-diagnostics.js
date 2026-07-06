const admin = require('firebase-admin');
const zlib = require('zlib');
const crypto = require('crypto');

function getMasterEmails() {
  const raw = [process.env.MASTER_ADMIN_EMAILS, process.env.MASTER_ADMIN_EMAIL, 'geoffrm1985@gmail.com', 'geoffm1985@gmail.com'].filter(Boolean).join(',');
  return new Set(String(raw).split(/[\s,;]+/).map(e => e.toLowerCase().trim()).filter(Boolean));
}
const APP_VERSION = '13.1.26';

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
    const masterEmails = getMasterEmails();
    const email = (decoded.email || '').toLowerCase().trim();
    if (masterEmails.has(email) || decoded.superAdmin === true) return { ok: true, uid: decoded.uid, email: decoded.email || '', actor: decoded.email || decoded.uid };
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

async function inspectLatestBackup(bucket, files) {
  const latest = files.find(file => file.name.endsWith('.json.gz'));
  if (!latest) return { ok: false, status: 'missing', message: 'No Firestore backup files found.' };
  const [metadata] = await latest.getMetadata().catch(() => [{}]);
  const custom = metadata?.metadata || {};
  const [buffer] = await latest.download();
  const hash = sha256(buffer);
  let parsed = null;
  try {
    parsed = JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
  } catch (err) {
    return { ok: false, status: 'failed', path: latest.name, sizeBytes: Number(metadata.size || buffer.length || 0), sha256: hash, error: `Latest backup cannot be decompressed/read: ${err.message}` };
  }
  const errors = [];
  if (!parsed?.metadata?.runId) errors.push('Missing runId metadata.');
  if (!parsed?.collections || typeof parsed.collections !== 'object') errors.push('Missing collections payload.');
  if (custom.sha256 && custom.sha256 !== hash) errors.push('Storage metadata checksum differs from downloaded checksum.');
  const documentCount = Number(parsed?.metadata?.documentCount || custom.documentCount || 0);
  const collectionCount = Number(parsed?.metadata?.collectionCount || custom.collectionCount || 0);
  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'verified' : 'warning',
    path: latest.name,
    runId: parsed?.metadata?.runId || custom.runId || '',
    mode: custom.mode || (latest.name.includes('/scheduled/') ? 'scheduled' : latest.name.includes('/manual/') ? 'manual' : 'unknown'),
    createdAt: metadata.timeCreated || null,
    updatedAt: metadata.updated || null,
    sizeBytes: Number(metadata.size || buffer.length || 0),
    sha256: hash,
    metadataSha256: custom.sha256 || '',
    documentCount,
    collectionCount,
    errors
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
      const backupFiles = allFiles.filter(file => file.name.startsWith('backups/firestore/') && file.name.endsWith('.json.gz')).sort((a, b) => b.name.localeCompare(a.name));
      let bucketBytes = 0;
      let backupBytes = 0;
      let scheduled = 0;
      let manual = 0;
      let verified = 0;
      for (const file of allFiles) {
        const [metadata] = await file.getMetadata().catch(() => [{}]);
        const size = Number(metadata?.size || 0);
        bucketBytes += size;
        if (file.name.startsWith('backups/firestore/') && file.name.endsWith('.json.gz')) {
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
      backupIntegrity: firestoreStatus.value?.backupIntegrity || storageList.value?.latestIntegrity || null
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
