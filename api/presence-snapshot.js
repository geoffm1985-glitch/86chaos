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

function publicPresenceRowFromFirestore(doc) {
  const data = doc.data() || {};
  return publicPresenceRow({ id: doc.id, ...data, presenceSource: data.source || 'firestore-livePresence-fallback' });
}

function publicPresenceRow(data = {}) {
  const lastMs = Math.max(
    parseTimeMs(data.lastHeartbeatAt),
    parseTimeMs(data.presenceUpdatedAt),
    parseTimeMs(data.lastActive),
    parseTimeMs(data.lastSeen),
    parseTimeMs(data.heartbeatEpochMs),
    parseTimeMs(data.lastChanged),
    parseTimeMs(data.lastOnline),
    parseTimeMs(data.disconnectedAt)
  );
  const lastIso = lastMs ? new Date(lastMs).toISOString() : '';
  const onlineState = clean(data.onlineState || data.state || (data.online === true ? 'online' : data.online === false ? 'offline' : 'online'));
  return {
    id: clean(data.id || data.userId || data.uid || ''),
    userId: clean(data.userId || data.uid || data.id || ''),
    uid: clean(data.uid || data.userId || data.id || ''),
    restaurantId: clean(data.restaurantId || ''),
    userName: clean(data.userName || data.name || ''),
    name: clean(data.userName || data.name || ''),
    userEmail: clean(data.userEmail || data.email || ''),
    email: clean(data.userEmail || data.email || ''),
    role: clean(data.role || ''),
    photoURL: clean(data.photoURL || ''),
    onlineState,
    activeTab: clean(data.activeTab || ''),
    activeDevice: clean(data.activeDevice || data.device || ''),
    activeHost: clean(data.activeHost || data.host || ''),
    lastHeartbeatAt: data.lastHeartbeatAt || data.lastChanged || lastIso,
    presenceUpdatedAt: data.presenceUpdatedAt || data.lastChanged || lastIso,
    lastActive: data.lastActive || data.lastChanged || lastIso,
    lastSeen: data.lastSeen || data.lastOnline || data.lastChanged || lastIso,
    heartbeatEpochMs: data.heartbeatEpochMs || lastMs || 0,
    presenceSource: clean(data.presenceSource || data.source || 'rtdb-statusSummary'),
    _presenceLastMs: lastMs
  };
}

function flattenRtdbStatusSummary(value = {}, restaurantFilter = '') {
  const rows = [];
  for (const [restaurantId, users] of Object.entries(value || {})) {
    if (restaurantFilter && restaurantFilter !== 'all' && restaurantId !== restaurantFilter) continue;
    for (const [userId, row] of Object.entries(users || {})) {
      rows.push(publicPresenceRow({ id: userId, userId, restaurantId, ...(row || {}) }));
    }
  }
  return rows.filter(row => row.userId && row.restaurantId);
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
    const forceFirestoreFallback = String(req.query?.source || '').toLowerCase() === 'firestore';

    let rows = [];
    let source = 'rtdb-statusSummary';

    if (!forceFirestoreFallback) {
      try {
        const refPath = restaurantId && restaurantId !== 'all' ? `statusSummary/${restaurantId}` : 'statusSummary';
        const snap = await app.database().ref(refPath).once('value');
        const raw = snap.val() || {};
        rows = restaurantId && restaurantId !== 'all'
          ? flattenRtdbStatusSummary({ [restaurantId]: raw }, restaurantId)
          : flattenRtdbStatusSummary(raw, '');
      } catch (rtdbError) {
        source = 'firestore-livePresence-fallback';
        console.warn('RTDB presence snapshot failed, falling back to Firestore livePresence:', rtdbError?.message || rtdbError);
      }
    }

    if (!rows.length && source !== 'rtdb-statusSummary') {
      let liveQuery = db.collection('livePresence');
      if (restaurantId && restaurantId !== 'all') liveQuery = liveQuery.where('restaurantId', '==', restaurantId);
      const snap = await liveQuery.limit(limit).get();
      rows = snap.docs.map(publicPresenceRowFromFirestore).filter(row => row.userId && row.restaurantId);
      source = 'firestore-livePresence-fallback';
    }

    const limitedRows = rows.slice(0, limit);
    const online = limitedRows
      .filter(row => row._presenceLastMs >= cutoffMs && row.onlineState !== 'offline')
      .sort((a, b) => b._presenceLastMs - a._presenceLastMs);
    const recent = limitedRows
      .filter(row => row._presenceLastMs && row._presenceLastMs < cutoffMs && row._presenceLastMs >= Date.now() - 60 * 60 * 1000)
      .sort((a, b) => b._presenceLastMs - a._presenceLastMs)
      .slice(0, 100);

    await writeAudit(db, ctx, 'MANUAL_PRESENCE_SNAPSHOT', restaurantId || 'all-workspaces', `Manual presence snapshot read ${limitedRows.length} ${source} row(s); ${online.length} in the ${windowMinutes}-minute window.`, restaurantId || 'system');

    return res.status(200).json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      mode: 'manual-snapshot',
      source,
      restaurantId: restaurantId || 'all',
      windowMinutes,
      livePresenceCount: limitedRows.length,
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
