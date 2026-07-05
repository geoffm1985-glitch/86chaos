const admin = require('firebase-admin');
const zlib = require('zlib');

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
    const masterEmail = (process.env.MASTER_ADMIN_EMAIL || 'geoffm1985@gmail.com').toLowerCase();
    const email = (decoded.email || '').toLowerCase();
    if (email === masterEmail || decoded.superAdmin === true) {
      return { ok: true, source: 'manual', actor: decoded.email || decoded.uid, uid: decoded.uid, email: decoded.email || '' };
    }
    return { ok: false, status: 403, error: 'Only the master admin or a super admin can run backups.' };
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

async function handler(req, res) {
  const startedAt = new Date();
  let db;
  try {
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Use GET for cron or POST for manual backup.' });

    const adminApp = initAdmin();
    db = adminApp.firestore();
    const auth = await authorize(req, adminApp);
    if (!auth.ok) return res.status(auth.status || 401).json({ ok: false, error: auth.error });

    const runId = isoSafe(startedAt);
    const mode = auth.source === 'vercel-cron' ? 'scheduled' : (req.query.mode || 'manual');
    const statusRef = db.collection('system').doc('backupStatus');
    await statusRef.set({
      status: 'running',
      mode,
      runId,
      startedAt: startedAt.toISOString(),
      lastRunAt: startedAt.toISOString(),
      actor: auth.actor,
      source: auth.source,
      version: '13.0.9'
    }, { merge: true });

    const collections = await db.listCollections();
    const backup = {
      metadata: {
        app: '86 Chaos',
        type: 'firestore-json-backup',
        version: '13.0.9',
        projectId: process.env.FIREBASE_PROJECT_ID || loadServiceAccount().project_id || loadServiceAccount().projectId || null,
        mode,
        runId,
        actor: auth.actor,
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
    await bucket.file(filePath).save(gzipped, {
      resumable: false,
      contentType: 'application/json',
      metadata: {
        contentEncoding: 'gzip',
        metadata: {
          runId,
          mode,
          actor: auth.actor,
          documentCount: String(counters.documentCount),
          collectionCount: String(counters.collectionCount)
        }
      }
    });

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
      deletedOldBackups,
      version: '13.0.9'
    };

    await statusRef.set(statusPayload, { merge: true });
    await db.collection('system').doc('backupStatus').collection('runs').doc(runId).set(statusPayload, { merge: true });

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
          version: '13.0.9'
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
module.exports.config = { maxDuration: 60 };
