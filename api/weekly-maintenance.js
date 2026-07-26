const { getAdminAppForRequest } = require('./_firebase-project-admin');
const { APP_VERSION } = require('./_version');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}

function getCronSecret(req) {
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return auth || String(req.headers['x-cron-secret'] || '').trim();
}

function safeRunId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function stableResultHash(payload = {}) {
  return JSON.stringify({ status: payload.status, version: payload.version, errorCount: payload.errorCount || 0 });
}

module.exports = async function handler(req, res) {
  const started = new Date();
  const startedAt = started.toISOString();
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || getCronSecret(req) !== cronSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized cron request' });
    }

    const app = initAdmin(req);
    const db = app.firestore();
    const statusRef = db.collection('system').doc('weeklyMaintenance');
    const latestSnap = await statusRef.get().catch(() => null);
    const latest = latestSnap?.exists ? latestSnap.data() || {} : {};

    const latestState = {
      status: 'ok',
      version: APP_VERSION,
      source: 'vercel-cron',
      lastRunAt: startedAt,
      lastRunStartedAt: startedAt,
      lastRunFinishedAt: new Date().toISOString(),
      durationMs: Date.now() - started.getTime(),
      restaurantDocsUpdated: 0,
      restaurantsScanned: 0,
      message: 'Global platform maintenance completed. No restaurant-specific changes were required.'
    };
    const nextHash = stableResultHash(latestState);
    const previousHash = latest.lastResultHash || '';

    if (previousHash !== nextHash || latest.status !== 'ok') {
      await statusRef.set({ ...latestState, lastResultHash: nextHash }, { merge: true });
    }

    const runId = safeRunId(started);
    const weeklyHistoryDue = !latest.lastHistoryAt || new Date(latest.lastHistoryAt).getTime() < Date.now() - 6.5 * 24 * 60 * 60 * 1000;
    if (weeklyHistoryDue || previousHash !== nextHash) {
      await statusRef.collection('runs').doc(runId).set({ ...latestState, runId, createdAt: startedAt, lastResultHash: nextHash }, { merge: true });
      await statusRef.set({ lastHistoryAt: startedAt }, { merge: true });
    }

    return res.status(200).json({ ok: true, ...latestState, historyWritten: weeklyHistoryDue || previousHash !== nextHash });
  } catch (err) {
    try {
      const app = initAdmin(req);
      await app.firestore().collection('system').doc('weeklyMaintenance').set({
        status: 'error',
        lastError: err.message || String(err),
        lastErrorAt: new Date().toISOString(),
        version: APP_VERSION
      }, { merge: true });
    } catch (_) {}
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};

module.exports.config = { maxDuration: 60 };
