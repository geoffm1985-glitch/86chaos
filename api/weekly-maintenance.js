const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}

async function commitChunks(db, writes, chunkSize = 450) {
  let committed = 0;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    writes.slice(i, i + chunkSize).forEach(fn => fn(batch));
    await batch.commit();
    committed += writes.slice(i, i + chunkSize).length;
  }
  return committed;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization || '';

    // Vercel sends Authorization: Bearer <CRON_SECRET> automatically when CRON_SECRET exists.
    // Keep this endpoint locked so random visitors cannot run database maintenance.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ ok: false, error: 'Unauthorized cron request' });
    }

    const app = initAdmin(req);
    const db = app.firestore();
    const runStartedAt = new Date().toISOString();
    const version = '13.1.1';

    const restaurantsSnap = await db.collection('restaurants').get();
    const writes = [];

    restaurantsSnap.forEach(restDoc => {
      const ref = restDoc.ref;
      writes.push(batch => batch.set(ref, {
        lastWeeklyMaintenanceAt: runStartedAt,
        weeklyMaintenance: {
          lastRunAt: runStartedAt,
          source: 'vercel-cron',
          version,
          status: 'ok'
        }
      }, { merge: true }));
    });

    const committed = await commitChunks(db, writes);

    const logRef = db.collection('system').doc('weeklyMaintenance').collection('runs').doc(runStartedAt.replace(/[:.]/g, '-'));
    await logRef.set({
      runStartedAt,
      runFinishedAt: new Date().toISOString(),
      version,
      source: 'vercel-cron',
      restaurantsScanned: restaurantsSnap.size,
      restaurantDocsUpdated: committed,
      status: 'ok'
    }, { merge: true });

    return res.status(200).json({
      ok: true,
      message: 'Weekly workspace maintenance completed.',
      restaurantsScanned: restaurantsSnap.size,
      restaurantDocsUpdated: committed,
      runStartedAt
    });
  } catch (err) {
    try {
      const app = initAdmin(req);
      await app.firestore().collection('system').doc('weeklyMaintenance').collection('errors').add({
        message: err.message,
        stack: err.stack || '',
        time: new Date().toISOString()
      });
    } catch (_) {}
    return res.status(500).json({ ok: false, error: err.message });
  }
};
