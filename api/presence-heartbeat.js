const admin = require('firebase-admin');

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (raw) {
    try { return JSON.parse(raw); }
    catch (_) { throw new Error('Firebase service account JSON is invalid. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.'); }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
}

function initAdmin() {
  if (admin.apps.length) return admin;
  admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) });
  return admin;
}

function safeString(value, fallback = '') {
  return String(value || fallback || '').slice(0, 300);
}

function safeSessionId(value, uid) {
  const raw = String(value || `${uid}_${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);
  return raw || `${uid}_${Date.now()}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase login token.' });

    const app = initAdmin();
    const decoded = await app.auth().verifyIdToken(token);
    const db = app.firestore();
    const uid = decoded.uid;

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ ok: false, error: 'User profile was not found for this login.' });

    const user = userSnap.data() || {};
    const restaurantId = safeString(req.body?.restaurantId || user.restaurantId);
    if (!restaurantId) return res.status(400).json({ ok: false, error: 'Missing restaurant ID for heartbeat.' });

    const isSuperAdmin = decoded.superAdmin === true || user.isSuperAdmin === true;
    if (!isSuperAdmin && user.restaurantId !== restaurantId) {
      return res.status(403).json({ ok: false, error: 'Heartbeat restaurant does not match this user profile.' });
    }

    const now = new Date();
    const stamp = safeString(req.body?.stamp || now.toISOString());
    const state = req.body?.state === 'offline' ? 'offline' : req.body?.state === 'away' ? 'away' : 'online';
    const heartbeatEpochMs = Number(req.body?.heartbeatEpochMs || Date.now());
    const sessionId = safeSessionId(req.body?.sessionId, uid);
    const deviceDiagnostics = typeof req.body?.deviceDiagnostics === 'object' && req.body.deviceDiagnostics
      ? req.body.deviceDiagnostics
      : {};

    const basePresence = {
      lastActive: stamp,
      lastSeen: stamp,
      lastHeartbeatAt: stamp,
      presenceUpdatedAt: stamp,
      heartbeatEpochMs,
      onlineState: state,
      activeTab: safeString(req.body?.activeTab || ''),
      activeSessionId: sessionId,
      activeDevice: safeString(req.body?.device || req.headers['user-agent'] || 'Unknown device', ''),
      activeHost: safeString(req.headers.origin || req.headers.referer || req.headers.host || ''),
      notificationPermission: safeString(req.body?.notificationPermission || deviceDiagnostics.notifications || 'unknown'),
      gpsPermission: safeString(req.body?.gpsPermission || deviceDiagnostics.gpsPermission || 'unknown'),
      deviceDiagnostics
    };

    const livePresence = {
      ...basePresence,
      userId: uid,
      uid,
      restaurantId,
      userName: safeString(user.name || decoded.name || ''),
      userEmail: safeString(user.email || decoded.email || ''),
      email: safeString(user.email || decoded.email || ''),
      role: safeString(user.role || ''),
      photoURL: safeString(user.photoURL || ''),
      createdAt: user.createdAt || stamp,
      updatedAt: stamp,
      source: 'api-heartbeat'
    };

    const batch = db.batch();
    batch.set(db.collection('livePresence').doc(uid), livePresence);
    batch.set(db.collection('presenceSessions').doc(sessionId), { ...livePresence, sessionId });
    batch.set(userRef, basePresence, { merge: true });
    batch.set(db.collection('restaurants').doc(restaurantId), {
      lastActive: stamp,
      lastActiveUserId: uid,
      lastActiveUserName: livePresence.userName || livePresence.userEmail || uid
    }, { merge: true });
    await batch.commit();

    return res.status(200).json({
      ok: true,
      uid,
      restaurantId,
      state,
      sessionId,
      projectId: process.env.FIREBASE_PROJECT_ID || loadServiceAccount()?.project_id || loadServiceAccount()?.projectId || '',
      written: ['livePresence', 'presenceSessions', 'users', 'restaurants']
    });
  } catch (err) {
    console.error('Presence heartbeat failed:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Presence heartbeat failed.' });
  }
};
