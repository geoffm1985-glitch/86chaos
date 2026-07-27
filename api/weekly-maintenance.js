const { initAdmin } = require('./_chaos-admin');
const { APP_VERSION } = require('./_version');
function getCronSecret(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || String(req.headers['x-cron-secret'] || '').trim();
}
function safeError(err) {
  const message = String(err?.message || err || 'Weekly maintenance failed.');
  if (/credential|private[_ -]?key|token|secret|authorization|private key/i.test(message)) return 'Weekly maintenance failed due to server configuration.';
  return message.slice(0, 240);
}
module.exports = async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return res.status(503).json({ ok: false, error: 'CRON_SECRET is not configured. Weekly maintenance refused to run and wrote nothing.' });
  if (getCronSecret(req) !== expectedSecret) return res.status(401).json({ ok: false, error: 'Unauthorized cron request.' });
  const started = new Date();
  let db;
  try {
    const app = initAdmin(req);
    db = app.firestore();
    // This weekly job currently records the global platform-maintenance heartbeat only.
    // It intentionally does not scan or rewrite restaurant documents.
    const workFinished = new Date();
    const payload = {
      status: 'ok',
      lastAttemptedAt: started.toISOString(),
      lastRunStartedAt: started.toISOString(),
      lastRunFinishedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      lastRunAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      lastSuccessAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      workDurationMs: workFinished.getTime() - started.getTime(),
      durationMeasurement: 'work-before-final-status-commit',
      version: APP_VERSION,
      error: null,
      restaurantDocumentsWritten: 0,
      mode: 'global-system-state-only'
    };
    const historyId = `weekly_${started.getTime()}_${Math.random().toString(36).slice(2,8)}`;
    const batch = db.batch();
    batch.set(db.collection('system').doc('weeklyMaintenance'), payload, { merge: true });
    batch.set(db.collection('weeklyMaintenanceRuns').doc(historyId), { ...payload, id: historyId, createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp() }, { merge: true });
    const commitStarted = Date.now();
    await batch.commit();
    const committedAt = new Date();
    return res.status(200).json({ ok: true, status: payload.status, version: APP_VERSION, restaurantDocumentsWritten: 0, mode: payload.mode, startedAt: started.toISOString(), committedAt: committedAt.toISOString(), workDurationMs: payload.workDurationMs, statusCommitDurationMs: committedAt.getTime() - commitStarted, totalDurationMs: committedAt.getTime() - started.getTime() });
  } catch (err) {
    const finished = new Date();
    const failure = {
      status: 'failed',
      lastAttemptedAt: started.toISOString(),
      lastRunStartedAt: started.toISOString(),
      lastRunFinishedAt: finished.toISOString(),
      durationMs: finished.getTime() - started.getTime(),
      version: APP_VERSION,
      error: safeError(err),
      restaurantDocumentsWritten: 0,
      mode: 'global-system-state-only'
    };
    if (db) {
      try {
        const historyId = `weekly_failed_${started.getTime()}_${Math.random().toString(36).slice(2,8)}`;
        const batch = db.batch();
        batch.set(db.collection('system').doc('weeklyMaintenance'), failure, { merge: true });
        batch.set(db.collection('weeklyMaintenanceRuns').doc(historyId), { ...failure, id: historyId, createdAt: finished.toISOString() }, { merge: true });
        await batch.commit();
      } catch (_) {}
    }
    return res.status(500).json({ ok: false, ...failure });
  }
};
module.exports.config = { maxDuration: 60 };
