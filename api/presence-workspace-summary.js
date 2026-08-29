const { initAdmin, authorize, clean } = require('./_chaos-admin');

const PRESENCE_SUMMARY_TIMEOUT_MS = Math.max(500, Math.min(parseInt(process.env.PRESENCE_SUMMARY_TIMEOUT_MS || '4500', 10) || 4500, 8000));
function withTimeout(promise, ms, label = 'operation') {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { code: 'presence-summary-timeout', status: 504 })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}


function parseTimeMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate().getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function publicRow(userId, restaurantId, row = {}) {
  const lastMs = Math.max(
    parseTimeMs(row.lastChanged),
    parseTimeMs(row.lastOnline),
    parseTimeMs(row.presenceUpdatedAt),
    parseTimeMs(row.lastActive),
    parseTimeMs(row.lastSeen),
    parseTimeMs(row.disconnectedAt)
  );
  const lastIso = lastMs ? new Date(lastMs).toISOString() : '';
  const online = row.online === true || row.state === 'online' || row.onlineState === 'online';
  return {
    id: clean(row.userId || userId),
    userId: clean(row.userId || userId),
    restaurantId: clean(row.restaurantId || restaurantId),
    name: clean(row.name || row.userName || ''),
    email: clean(row.email || row.userEmail || ''),
    role: clean(row.role || ''),
    online,
    state: online ? 'online' : 'offline',
    onlineState: online ? 'online' : 'offline',
    activeDevice: clean(row.activeDevice || row.device || ''),
    activeHost: clean(row.activeHost || row.host || ''),
    activeTab: clean(row.activeTab || ''),
    activeSessionCount: Number(row.activeSessionCount || (online ? 1 : 0)) || 0,
    lastActive: lastIso,
    lastSeen: lastIso,
    presenceUpdatedAt: lastIso,
    lastHeartbeatAt: lastIso,
    presenceSource: 'rtdb-statusSummary-api'
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const app = initAdmin(req);
    const restaurantId = clean(req.query?.restaurantId || '');
    const ctx = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId });
    if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error });
    if (!restaurantId || restaurantId !== ctx.restaurantId) return res.status(403).json({ ok: false, error: 'Workspace mismatch.' });

    const limit = Math.min(Math.max(parseInt(req.query?.limit || '400', 10) || 400, 1), 800);
    const snap = await withTimeout(ctx.app.database().ref(`statusSummary/${restaurantId}`).once('value'), PRESENCE_SUMMARY_TIMEOUT_MS, 'RTDB presence summary read');
    const raw = snap.val() || {};
    const users = Object.entries(raw)
      .map(([userId, row]) => publicRow(userId, restaurantId, row || {}))
      .filter(row => row.userId)
      .sort((a, b) => new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime())
      .slice(0, limit);

    return res.status(200).json({ ok: true, source: 'rtdb-statusSummary-api', restaurantId, fetchedAt: new Date().toISOString(), count: users.length, users });
  } catch (err) {
    console.error('Workspace presence summary failed:', err);
    const status = err?.status || (err?.code === 'presence-summary-timeout' ? 504 : 500);
    return res.status(status).json({ ok: false, code: err?.code || 'presence-summary-failed', retryable: true, error: err.message || 'Workspace presence summary failed.' });
  }
};
