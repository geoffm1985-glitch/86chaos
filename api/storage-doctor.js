const { initAdmin, readBody, authorize, writeAudit, clean } = require('./_chaos-admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use GET or POST.' });
  const started = Date.now();
  try {
    const app = initAdmin();
    const body = await readBody(req);
    const targetRestaurantId = clean(body.restaurantId || req.query?.restaurantId || '');
    const auth = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    const db = app.firestore();
    const bucket = app.storage().bucket();
    const report = {
      ok: false,
      generatedAt: new Date().toISOString(),
      targetRestaurantId: targetRestaurantId || auth.restaurantId || '',
      projectId: app.options?.projectId || process.env.FIREBASE_PROJECT_ID || '',
      bucket: bucket?.name || '',
      route: '/api/storage-doctor',
      checks: [],
      durationMs: 0
    };
    const add = (id, ok, detail, fix = '') => report.checks.push({ id, ok: !!ok, detail, fix });
    add('service-account', !!(app.options?.credential), 'Firebase Admin initialized on the server.', 'Check FIREBASE_SERVICE_ACCOUNT_KEY in Vercel if this fails.');
    add('bucket-name', !!bucket?.name, `Server bucket: ${bucket?.name || 'missing'}`, 'Set FIREBASE_STORAGE_BUCKET to the live Firebase Storage bucket.');
    const storagePath = `${report.targetRestaurantId || 'system'}/diagnostics/storage-doctor-${Date.now()}.txt`;
    try {
      const file = bucket.file(storagePath);
      await file.save(Buffer.from(`86 Chaos Storage Doctor ${new Date().toISOString()}`), { resumable: false, metadata: { contentType: 'text/plain', metadata: { purpose: 'storage-doctor', restaurantId: report.targetRestaurantId || '' } } });
      const [exists] = await file.exists();
      add('write-read', exists, `Test file created at ${storagePath}`, 'Confirm the service account has Storage Object Admin rights.');
      await file.delete({ ignoreNotFound: true });
      add('cleanup', true, 'Diagnostic file cleaned up.', 'Manual cleanup may be needed if this fails.');
    } catch (err) {
      add('write-read', false, `Storage write failed: ${err.message}`, 'Publish storage.rules and verify Vercel FIREBASE_STORAGE_BUCKET / service account project match this deployment.');
    }
    try {
      const restId = report.targetRestaurantId;
      if (restId) {
        const rest = await db.collection('restaurants').doc(restId).get();
        add('restaurant-doc', rest.exists, rest.exists ? `Workspace ${restId} exists.` : `Workspace ${restId} was not found.`, 'Use the exact restaurantId from the app session.');
      } else {
        add('restaurant-doc', false, 'No restaurantId was provided for tenant upload testing.', 'Choose a workspace before running the Storage Doctor.');
      }
    } catch (err) {
      add('restaurant-doc', false, `Restaurant lookup failed: ${err.message}`, 'Check Firestore service account permissions.');
    }
    report.ok = report.checks.every(c => c.ok);
    report.durationMs = Date.now() - started;
    await writeAudit(db, auth, 'STORAGE_DOCTOR_RUN', report.targetRestaurantId || 'system', `Storage Doctor ${report.ok ? 'passed' : 'found issues'} for bucket ${report.bucket}.`, report.targetRestaurantId);
    return res.status(200).json(report);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, durationMs: Date.now() - started });
  }
};
