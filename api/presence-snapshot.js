const { initAdmin, authorize, writeAudit, clean } = require('./_chaos-admin');

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

function publicPresenceRow(doc) {
  const data = doc.data() || {};
  const lastMs = Math.max(
    parseTimeMs(data.lastHeartbeatAt),
    parseTimeMs(data.presenceUpdatedAt),
    parseTimeMs(data.lastActive),
    parseTimeMs(data.lastSeen),
    parseTimeMs(data.heartbeatEpochMs)
  );
  const lastIso = lastMs ? new Date(lastMs).toISOString() : '';
  return {
    id: doc.id,
    userId: clean(data.userId || data.uid || ''),
    uid: clean(data.uid || data.userId || ''),
    restaurantId: clean(data.restaurantId || ''),
    userName: clean(data.userName || data.name || ''),
    name: clean(data.userName || data.name || ''),
    userEmail: clean(data.userEmail || data.email || ''),
    email: clean(data.userEmail || data.email || ''),
    role: clean(data.role || ''),
    photoURL: clean(data.photoURL || ''),
    onlineState: clean(data.onlineState || 'online'),
    activeTab: clean(data.activeTab || ''),
    activeDevice: clean(data.activeDevice || ''),
    activeHost: clean(data.activeHost || ''),
    lastHeartbeatAt: data.lastHeartbeatAt || lastIso,
    presenceUpdatedAt: data.presenceUpdatedAt || lastIso,
    lastActive: data.lastActive || lastIso,
    lastSeen: data.lastSeen || lastIso,
    heartbeatEpochMs: data.heartbeatEpochMs || lastMs || 0,
    presenceSource: clean(data.source || 'manual-snapshot'),
    _presenceLastMs: lastMs
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });

  try {
    const app = initAdmin(req);
    const ctx = await authorize(req, app, { allowTenantAdmin: false });
    if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error });
    if (!ctx.isSuperAdmin) return res.status(403).json({ ok: false, error: 'Manual presence snapshots are Super Admin only.' });

    const db = app.firestore();
    const restaurantId = clean(req.query?.restaurantId || '');
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '800', 10) || 800, 1), 1500);
    const windowMinutes = Math.min(Math.max(parseInt(req.query?.windowMinutes || '15', 10) || 15, 1), 240);
    const cutoffMs = Date.now() - windowMinutes * 60 * 1000;

    let liveQuery = db.collection('livePresence');
    if (restaurantId && restaurantId !== 'all') liveQuery = liveQuery.where('restaurantId', '==', restaurantId);
    const snap = await liveQuery.limit(limit).get();
    const rows = snap.docs.map(publicPresenceRow).filter(row => row.userId && row.restaurantId);
    const online = rows
      .filter(row => row._presenceLastMs >= cutoffMs && row.onlineState !== 'offline')
      .sort((a, b) => b._presenceLastMs - a._presenceLastMs);
    const recent = rows
      .filter(row => row._presenceLastMs && row._presenceLastMs < cutoffMs && row._presenceLastMs >= Date.now() - 60 * 60 * 1000)
      .sort((a, b) => b._presenceLastMs - a._presenceLastMs)
      .slice(0, 100);

    await writeAudit(db, ctx, 'MANUAL_PRESENCE_SNAPSHOT', restaurantId || 'all-workspaces', `Manual presence snapshot read ${snap.size} livePresence document(s); ${online.length} in the ${windowMinutes}-minute window.`, restaurantId || 'system');

    return res.status(200).json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      mode: 'manual-snapshot',
      restaurantId: restaurantId || 'all',
      windowMinutes,
      livePresenceCount: snap.size,
      onlineCount: online.length,
      recentCount: recent.length,
      users: online,
      recentUsers: recent
    });
  } catch (err) {
    console.error('Manual presence snapshot failed:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Manual presence snapshot failed.' });
  }
};
