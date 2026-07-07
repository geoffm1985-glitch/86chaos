const { initAdmin, readBody, authorize, parseBackupBuffer, writeAudit, clean } = require('./_chaos-admin');

function containsSensitive(data) {
  const hits = [];
  const walk = (obj, path = '', depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 4) return;
    for (const [k, v] of Object.entries(obj)) {
      const keyPath = path ? `${path}.${k}` : k;
      if (['password','temporaryPassword','ssn','wage','hourlyRate','payRate','fcmToken','phone','email','address'].some(s => k.toLowerCase().includes(s.toLowerCase())) && v) hits.push(keyPath);
      if (v && typeof v === 'object') walk(v, keyPath, depth + 1);
    }
  };
  walk(data);
  return hits;
}
function deserialize(value, admin, db) {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(v => deserialize(v, admin, db));
  if (value && typeof value === 'object') {
    if (value.__type === 'timestamp' && value.value) return admin.firestore.Timestamp.fromDate(new Date(value.value));
    if (value.__type === 'documentReference' && value.path) return db.doc(value.path);
    if (value.__type === 'geoPoint' && typeof value.latitude === 'number' && typeof value.longitude === 'number') return new admin.firestore.GeoPoint(value.latitude, value.longitude);
    const out = {}; Object.entries(value).forEach(([k,v]) => { out[k] = deserialize(v, admin, db); }); return out;
  }
  return value;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  const started = Date.now();
  try {
    const app = initAdmin();
    const body = await readBody(req);
    const storagePath = clean(body.storagePath || '');
    const action = clean(body.action || 'preview');
    const selectedCollections = Array.isArray(body.selectedCollections) ? body.selectedCollections.map(clean).filter(Boolean) : [];
    if (!storagePath) return res.status(400).json({ ok: false, error: 'Backup Storage path is required.' });
    const auth = await authorize(req, app, { allowTenantAdmin: false });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    const db = app.firestore();
    const bucket = app.storage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ ok: false, error: `Backup not found: ${storagePath}` });
    const [buffer] = await file.download();
    const { backup, storageFormat } = parseBackupBuffer(buffer);
    const collections = backup?.collections || {};
    const rows = [];
    const restaurantIds = new Set();
    let totalDocs = 0;
    let sensitiveFieldCount = 0;
    for (const [collectionName, payload] of Object.entries(collections)) {
      const docs = Array.isArray(payload?.docs) ? payload.docs : [];
      totalDocs += docs.length;
      const ids = new Set();
      const sensitive = new Set();
      docs.slice(0, 2000).forEach(d => {
        const rest = d?.data?.restaurantId || (collectionName === 'restaurants' ? d.id || String(d.path || '').split('/').pop() : '');
        if (rest) { restaurantIds.add(rest); ids.add(rest); }
        containsSensitive(d?.data || {}).forEach(h => sensitive.add(h));
      });
      sensitiveFieldCount += sensitive.size;
      rows.push({ collectionName, count: docs.length, restaurantIds: Array.from(ids).slice(0, 8), sensitiveFields: Array.from(sensitive).slice(0, 12), selected: selectedCollections.length ? selectedCollections.includes(collectionName) : true });
    }
    const warnings = [];
    if (!backup?.metadata?.runId) warnings.push('Backup metadata is missing runId.');
    if (restaurantIds.size > 1) warnings.push(`Backup includes ${restaurantIds.size} restaurant IDs. Use selective restore carefully.`);
    if (sensitiveFieldCount > 0) warnings.push('Backup contains sensitive fields. Treat downloads and restores as private admin material.');
    let restored = null;
    if (action === 'restoreSelected') {
      if (clean(body.confirmText) !== 'RESTORE') return res.status(400).json({ ok: false, error: 'Type RESTORE to run a selective restore.' });
      if (!selectedCollections.length) return res.status(400).json({ ok: false, error: 'Choose at least one collection for selective restore.' });
      let batch = db.batch(); let batchCount = 0; let restoredDocuments = 0; let skippedDocuments = 0;
      const commit = async () => { if (batchCount) { await batch.commit(); batch = db.batch(); batchCount = 0; } };
      for (const [collectionName, payload] of Object.entries(collections)) {
        if (!selectedCollections.includes(collectionName)) continue;
        for (const d of (payload?.docs || [])) {
          if (!d?.path || !d?.data) continue;
          if (d.path === 'system/backupStatus' || d.path.startsWith('system/backupStatus/')) { skippedDocuments += 1; continue; }
          batch.set(db.doc(d.path), deserialize(d.data, require('firebase-admin'), db), { merge: true });
          restoredDocuments += 1; batchCount += 1;
          if (batchCount >= 400) await commit();
        }
      }
      await commit();
      restored = { restoredDocuments, skippedDocuments, selectedCollections, finishedAt: new Date().toISOString() };
      await db.collection('system').doc('backupStatus').set({ lastSelectiveRestoreAt: restored.finishedAt, lastSelectiveRestorePath: storagePath, lastSelectiveRestoreCollections: selectedCollections, lastSelectiveRestoreDocuments: restoredDocuments, actor: auth.email || auth.uid, version: '14.0.1' }, { merge: true });
    }
    const result = { ok: true, action, restored, storagePath, bucket: bucket.name, storageFormat, metadata: backup?.metadata || {}, totalDocs, collectionCount: rows.length, restaurantIds: Array.from(restaurantIds), warnings, rows: rows.sort((a,b)=>b.count-a.count), durationMs: Date.now() - started, generatedAt: new Date().toISOString() };
    await writeAudit(db, auth, action === 'restoreSelected' ? 'SELECTIVE_RESTORE' : 'BACKUP_PREVIEW', storagePath, `${action} ${storagePath}; docs ${totalDocs}; collections ${rows.length}.`, auth.restaurantId || 'system');
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, durationMs: Date.now() - started });
  }
};
