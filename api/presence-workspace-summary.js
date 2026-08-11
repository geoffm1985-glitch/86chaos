const { initAdmin, authorize, clean } = require('./_chaos-admin');

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
function timeoutAfter(ms, label) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms));
}
async function withTimeout(promise, ms, label) {
  return Promise.race([promise, timeoutAfter(ms, label)]);
}
function publicRow(userId, restaurantId, row = {}, source = 'rtdb-statusSummary-api') {
  const lastMs = Math.max(
    parseTimeMs(row.lastChanged),
    parseTimeMs(row.lastOnline),
    parseTimeMs(row.presenceUpdatedAt),
    parseTimeMs(row.lastActive),
    parseTimeMs(row.lastSeen),
    parseTimeMs(row.lastHeartbeatAt),
    parseTimeMs(row.heartbeatEpochMs),
    parseTimeMs(row.disconnectedAt)
  );
  const lastIso = lastMs ? new Date(lastMs).toISOString() : '';
  const online = row.online === true || row.state === 'online' || row.onlineState === 'online';
  return {
    id: clean(row.userId || row.uid || row.id || userId),
    userId: clean(row.userId || row.uid || row.id || userId),
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
    presenceSource: source,
    _presenceLastMs: lastMs
  };
}
async function readFirestorePresenceFallback(db, restaurantId, limit, timeoutMs) {
  const snap = await withTimeout(
    db.collection('livePresence').where('restaurantId', '==', restaurantId).limit(limit).get(),
    timeoutMs,
    'Firestore livePresence fallback'
  );
  return snap.docs
    .map(doc => publicRow(doc.id, restaurantId, doc.data() || {}, 'firestore-livePresence-fallback'))
    .filter(row => row.userId && row.restaurantId === restaurantId);
}
function sortedLimitedUsers(rows, limit) {
  return rows
    .filter(row => row.userId)
    .sort((a, b) => (b._presenceLastMs || 0) - (a._presenceLastMs || 0))
    .slice(0, limit)
    .map(({ _presenceLastMs, ...row }) => row);
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
    const timeoutMs = Math.min(Math.max(parseInt(req.query?.timeoutMs || '3200', 10) || 3200, 1200), 6000);
    let source = 'rtdb-statusSummary-api';
    const warnings = [];
    let users = [];

    try {
      const snap = await withTimeout(ctx.app.database().ref(`statusSummary/${restaurantId}`).once('value'), timeoutMs, 'RTDB statusSummary read');
      const raw = snap.val() || {};
      users = sortedLimitedUsers(Object.entries(raw).map(([userId, row]) => publicRow(userId, restaurantId, row || {}, source)), limit);
    } catch (rtdbError) {
      source = 'firestore-livePresence-fallback';
      warnings.push('Live presence source unavailable. Showing last-seen fallback.');
      console.warn('Workspace presence RTDB summary failed, using bounded Firestore fallback:', rtdbError?.message || rtdbError);
      try {
        const fallbackRows = await readFirestorePresenceFallback(ctx.app.firestore(), restaurantId, limit, Math.min(timeoutMs, 3000));
        users = sortedLimitedUsers(fallbackRows, limit);
      } catch (fallbackError) {
        source = 'empty-safe-fallback';
        warnings.push('Last-seen fallback unavailable. Showing an empty safe summary.');
        console.warn('Workspace presence Firestore fallback failed; returning empty safe summary:', fallbackError?.message || fallbackError);
        users = [];
      }
    }

    return res.status(200).json({ ok: true, source, warning: warnings.join(' | '), restaurantId, timeoutMs, fetchedAt: new Date().toISOString(), count: users.length, users });
  } catch (err) {
    console.error('Workspace presence summary authorization/bootstrap failed:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Workspace presence summary failed.' });
  }
};
module.exports._test = { parseTimeMs, timeoutAfter, withTimeout, publicRow, readFirestorePresenceFallback };
