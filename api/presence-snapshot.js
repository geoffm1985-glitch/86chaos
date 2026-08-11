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

function timeoutAfter(ms, label) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms));
}

async function withTimeout(promise, ms, label) {
  return Promise.race([promise, timeoutAfter(ms, label)]);
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
  const onlineState = clean(data.onlineState || data.state || (data.online === true ? 'online' : data.online === false ? 'offline' : 'unknown'));
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
    online: data.online === true || onlineState === 'online',
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


function flattenRtdbDevicePresence(value = {}, restaurantFilter = '') {
  const rows = [];
  for (const [restaurantId, users] of Object.entries(value || {})) {
    if (restaurantFilter && restaurantFilter !== 'all' && restaurantId !== restaurantFilter) continue;
    for (const [userId, devices] of Object.entries(users || {})) {
      const sessionMap = devices?.sessions && typeof devices.sessions === 'object' ? devices.sessions : devices;
      const deviceRows = Object.values(sessionMap || {}).filter(row => row && typeof row === 'object');
      if (!deviceRows.length) continue;
      const decorated = deviceRows.map(row => ({ row, lastMs: Math.max(
        parseTimeMs(row.lastChanged),
        parseTimeMs(row.lastOnline),
        parseTimeMs(row.connectedAt),
        parseTimeMs(row.disconnectedAt),
        parseTimeMs(row.presenceUpdatedAt),
        parseTimeMs(row.lastActive),
        parseTimeMs(row.lastSeen),
        parseTimeMs(row.lastHeartbeatAt)
      ) })).sort((a, b) => b.lastMs - a.lastMs);
      const onlineDevices = decorated.filter(item => item.row.online === true || item.row.state === 'online');
      const representative = (onlineDevices[0] || decorated[0]).row || {};
      const lastMs = (onlineDevices[0] || decorated[0]).lastMs || 0;
      rows.push(publicPresenceRow({
        id: userId,
        userId,
        restaurantId,
        ...representative,
        online: onlineDevices.length > 0,
        state: onlineDevices.length > 0 ? 'online' : 'offline',
        onlineState: onlineDevices.length > 0 ? 'online' : 'offline',
        activeSessionCount: onlineDevices.length,
        activeDeviceCount: onlineDevices.length,
        lastChanged: lastMs || representative.lastChanged,
        lastOnline: lastMs || representative.lastOnline,
        presenceSource: 'rtdb-status-sessions-rest'
      }));
    }
  }
  return rows.filter(row => row.userId && row.restaurantId);
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

function databaseUrlFromApp(app) {
  const direct = String(app?.options?.databaseURL || '').trim().replace(/\/+$/g, '');
  if (direct) return direct;
  const projectId = clean(app?.options?.projectId || process.env.FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID || '');
  if (!projectId) return '';
  return `https://${projectId}-default-rtdb.firebaseio.com`;
}

async function readRtdbStatusSummaryViaRest(app, refPath, timeoutMs) {
  const databaseURL = databaseUrlFromApp(app);
  if (!databaseURL) throw new Error('Realtime Database URL is not configured for this Firebase Admin app.');
  const credential = app?.options?.credential;
  if (!credential || typeof credential.getAccessToken !== 'function') throw new Error('Firebase Admin credential cannot create an RTDB REST token.');
  const token = await withTimeout(credential.getAccessToken(), Math.min(timeoutMs, 2500), 'RTDB auth token');
  const accessToken = token?.access_token || token?.accessToken;
  if (!accessToken) throw new Error('Firebase Admin credential returned no RTDB REST token.');

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const safePath = String(refPath || 'statusSummary').split('/').map(part => encodeURIComponent(part)).join('/');
    const response = await fetch(`${databaseURL}/${safePath}.json`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller?.signal
    });
    if (!response.ok) throw new Error(`RTDB REST ${response.status}`);
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readFirestorePresenceFallback(db, restaurantId, limit, timeoutMs) {
  let liveQuery = db.collection('livePresence');
  if (restaurantId && restaurantId !== 'all') liveQuery = liveQuery.where('restaurantId', '==', restaurantId);
  const snap = await withTimeout(liveQuery.limit(limit).get(), timeoutMs, 'Firestore livePresence fallback');
  return snap.docs.map(publicPresenceRowFromFirestore).filter(row => row.userId && row.restaurantId);
}

function startOfLocalDayMs(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function markPresenceBucket(row, bucket) {
  return { ...row, presenceBucket: bucket };
}

function buildBuckets(rows, limit, windowMinutes, onlineSeconds = 90) {
  const now = Date.now();
  const onlineCutoffMs = now - Math.max(30, Math.min(Number(onlineSeconds) || 90, 180)) * 1000;
  const recentCutoffMs = now - Math.max(2, Math.min(Number(windowMinutes) || 15, 240)) * 60 * 1000;
  const todayCutoffMs = startOfLocalDayMs(new Date(now));
  const limitedRows = rows
    .filter(row => row && row.userId && row.restaurantId)
    .sort((a, b) => (b._presenceLastMs || 0) - (a._presenceLastMs || 0))
    .slice(0, limit);

  const isOffline = row => row.online === false || row.onlineState === 'offline' || row.state === 'offline';
  const isAuthoritativeSessionPresence = row => /rtdb-status-sessions|rtdb-device-presence/i.test(String(row.presenceSource || ''));
  const isOnlineNow = row => (row.online === true && isAuthoritativeSessionPresence(row)) || (!!row._presenceLastMs && row._presenceLastMs >= onlineCutoffMs && !isOffline(row));

  const online = limitedRows
    .filter(isOnlineNow)
    .map(row => markPresenceBucket(row, 'onlineNow'))
    .sort((a, b) => b._presenceLastMs - a._presenceLastMs);
  const recent = limitedRows
    .filter(row => row._presenceLastMs && !isOnlineNow(row) && row._presenceLastMs >= recentCutoffMs)
    .map(row => markPresenceBucket(row, 'recentlyActive'))
    .sort((a, b) => b._presenceLastMs - a._presenceLastMs)
    .slice(0, 100);
  const activeToday = limitedRows
    .filter(row => row._presenceLastMs && !isOnlineNow(row) && row._presenceLastMs < recentCutoffMs && row._presenceLastMs >= todayCutoffMs)
    .map(row => markPresenceBucket(row, 'activeToday'))
    .sort((a, b) => b._presenceLastMs - a._presenceLastMs)
    .slice(0, 150);
  const lastSeen = limitedRows
    .filter(row => row._presenceLastMs && !isOnlineNow(row) && row._presenceLastMs < todayCutoffMs)
    .map(row => markPresenceBucket(row, 'lastSeen'))
    .sort((a, b) => b._presenceLastMs - a._presenceLastMs)
    .slice(0, 150);
  return { limitedRows, online, recent, activeToday, lastSeen, onlineSeconds: Math.max(30, Math.min(Number(onlineSeconds) || 90, 180)) };
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
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '500', 10) || 500, 1), 800);
    const windowMinutes = Math.min(Math.max(parseInt(req.query?.windowMinutes || '15', 10) || 15, 1), 240);
    const timeoutMs = Math.min(Math.max(parseInt(req.query?.timeoutMs || '3200', 10) || 3200, 1200), 6000);
    const onlineSeconds = Math.min(Math.max(parseInt(req.query?.onlineSeconds || '90', 10) || 90, 30), 180);
    const forceFirestoreFallback = String(req.query?.source || '').toLowerCase() === 'firestore';

    let rows = [];
    let source = 'rtdb-status-sessions-rest';
    const warnings = [];

    if (!forceFirestoreFallback) {
      try {
        const refPath = restaurantId && restaurantId !== 'all' ? `status/${restaurantId}` : 'status';
        const raw = await readRtdbStatusSummaryViaRest(app, refPath, timeoutMs);
        rows = restaurantId && restaurantId !== 'all'
          ? flattenRtdbDevicePresence({ [restaurantId]: raw || {} }, restaurantId)
          : flattenRtdbDevicePresence(raw || {}, '');
      } catch (rtdbError) {
        source = 'rtdb-statusSummary-rest-legacy-fallback';
        warnings.push('Status session presence source unavailable. Trying legacy summary fallback.');
        console.warn('RTDB status session presence snapshot failed, trying legacy summary:', rtdbError?.message || rtdbError);
      }
      if (!rows.length && source === 'rtdb-statusSummary-rest-legacy-fallback') {
        try {
          const refPath = restaurantId && restaurantId !== 'all' ? `statusSummary/${restaurantId}` : 'statusSummary';
          const raw = await readRtdbStatusSummaryViaRest(app, refPath, Math.min(timeoutMs, 3000));
          rows = restaurantId && restaurantId !== 'all'
            ? flattenRtdbStatusSummary({ [restaurantId]: raw || {} }, restaurantId)
            : flattenRtdbStatusSummary(raw || {}, '');
        } catch (legacyError) {
          source = 'firestore-livePresence-fallback';
          warnings.push('Legacy presence summary unavailable. Showing last-seen fallback.');
          console.warn('RTDB legacy presence snapshot failed, using bounded fallback:', legacyError?.message || legacyError);
        }
      }
    } else {
      source = 'firestore-livePresence-fallback';
    }

    if (!rows.length) {
      try {
        rows = await readFirestorePresenceFallback(db, restaurantId, limit, Math.min(timeoutMs, 3000));
        if (source === 'rtdb-status-sessions-rest') source = 'firestore-livePresence-fallback-empty-rtdb';
      } catch (fallbackError) {
        source = 'empty-safe-fallback';
        warnings.push('Last-seen fallback unavailable. Showing an empty safe snapshot.');
        console.warn('Firestore presence fallback failed; returning empty safe snapshot:', fallbackError?.message || fallbackError);
        rows = [];
      }
    }

    const { limitedRows, online, recent, activeToday, lastSeen } = buildBuckets(rows, limit, windowMinutes, onlineSeconds);

    writeAudit(db, ctx, 'MANUAL_PRESENCE_SNAPSHOT', restaurantId || 'all-workspaces', `Manual presence snapshot read ${limitedRows.length} ${source} row(s); ${online.length} active session row(s) online.`, restaurantId || 'system')
      .catch(err => console.warn('Manual presence snapshot audit write skipped:', err?.message || err));

    return res.status(200).json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      mode: 'bounded-manual-snapshot',
      source,
      warning: warnings.join(' | '),
      restaurantId: restaurantId || 'all',
      windowMinutes,
      onlineSeconds,
      timeoutMs,
      livePresenceCount: limitedRows.length,
      onlineCount: online.length,
      recentCount: recent.length,
      activeTodayCount: activeToday.length,
      lastSeenCount: lastSeen.length,
      users: online,
      recentUsers: recent,
      activeTodayUsers: activeToday,
      lastSeenUsers: lastSeen
    });
  } catch (err) {
    console.error('Manual presence snapshot authorization/bootstrap failed:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Manual presence snapshot failed.' });
  }
};
