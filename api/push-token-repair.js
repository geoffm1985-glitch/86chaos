import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
const db = getFirestore();

const MASTER_EMAILS = new Set([
  (process.env.MASTER_ADMIN_EMAIL || 'geoffm1985@gmail.com').toLowerCase(),
  'geoffrm1985@gmail.com'
]);

const parseTimeMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value.toDate === 'function') {
    const ms = value.toDate().getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

async function getCaller(decoded) {
  const direct = await db.collection('users').doc(decoded.uid).get();
  if (direct.exists) return { id: direct.id, ...direct.data() };
  const email = (decoded.email || '').toLowerCase().trim();
  if (!email) return { id: decoded.uid, email: '' };
  const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
  return { id: decoded.uid, email };
}

function callerCanRepair(caller, decoded, restaurantId) {
  const email = (decoded.email || caller.email || '').toLowerCase().trim();
  if (decoded.superAdmin === true || caller.isSuperAdmin === true || MASTER_EMAILS.has(email)) return true;
  if (!restaurantId) return false;
  const memberships = caller.memberships || {};
  const member = memberships?.[restaurantId] || null;
  return Boolean(
    caller.restaurantId === restaurantId && (caller.isAdmin === true || caller.isOwner === true || caller.accountOwner === true) ||
    member && member.isActive !== false && (member.isAdmin === true || member.isOwner === true || member.accountOwner === true || member.workspaceOwner === true)
  );
}

function repairPayload({ mode = 'repair', clearToken = false, requestedBy = '', repairLink = '' } = {}) {
  const stamp = new Date().toISOString();
  const payload = {
    pushNeedsRepair: true,
    pushRepairMode: mode,
    pushRepairStatus: clearToken ? 'token-cleared-admin' : 'repair-requested',
    pushRepairRequestedAt: stamp,
    pushRepairFlaggedAt: stamp,
    pushRepairRequestedBy: requestedBy,
    pushRepairLink: repairLink || '',
    pushTokenRepairNonce: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    lastPushRepairError: null
  };
  if (mode === 'force-refresh') payload.pushForceServiceWorkerRefresh = true;
  if (clearToken) {
    payload.fcmToken = null;
    payload.pushDevices = {};
    payload.fcmTokenUpdatedAt = null;
    payload.lastPushFailureCode = null;
  }
  return payload;
}

async function writeAudit({ caller, action, target, restaurantId, details }) {
  return db.collection('auditLogs').add({
    restaurantId: restaurantId || 'platform',
    action,
    target,
    details,
    userId: caller.id || 'system-admin',
    userName: caller.email || caller.name || 'System Administrator',
    timestamp: new Date().toISOString(),
    source: 'api/push-token-repair'
  }).catch(() => null);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized: Missing Firebase ID token.' });

  let decoded;
  try { decoded = await getAuth().verifyIdToken(authHeader.slice('Bearer '.length)); }
  catch (err) { return res.status(403).json({ error: 'Forbidden: Invalid or expired Firebase ID token.' }); }

  try {
    const caller = await getCaller(decoded);
    const { action = 'request-repair', restaurantId = '', targetUserId = '', targetUserIds = [], maxAgeDays = 30, repairLink = '' } = req.body || {};
    const requestedBy = caller.email || decoded.email || caller.name || 'System Administrator';
    const ids = [...new Set([targetUserId, ...(Array.isArray(targetUserIds) ? targetUserIds : [])].filter(Boolean))];

    if (['request-repair', 'force-refresh', 'clear-token'].includes(action)) {
      if (!ids.length) return res.status(400).json({ error: 'Missing target user.' });
      const snaps = await Promise.all(ids.map(id => db.collection('users').doc(id).get()));
      const targets = snaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }));
      if (!targets.length) return res.status(404).json({ error: 'Target user not found.' });
      for (const target of targets) {
        const targetRestaurantId = restaurantId || target.restaurantId || target.activeRestaurantId || '';
        if (!callerCanRepair(caller, decoded, targetRestaurantId)) {
          return res.status(403).json({ error: `Forbidden: no push repair access for ${targetRestaurantId || target.id}.` });
        }
      }
      const mode = action === 'force-refresh' ? 'force-refresh' : 'repair';
      const clearToken = action === 'clear-token' || action === 'force-refresh';
      const writes = targets.map(target => db.collection('users').doc(target.id).set(repairPayload({ mode, clearToken, requestedBy, repairLink }), { merge: true }));
      await Promise.all(writes);
      await writeAudit({ caller, action: `PUSH_${action.replace(/-/g, '_').toUpperCase()}`, target: ids.join(','), restaurantId: restaurantId || targets[0]?.restaurantId || 'platform', details: `${targets.length} user(s) marked for push repair. clearToken=${clearToken}` });
      return res.status(200).json({ ok: true, action, updated: targets.length, users: targets.map(t => ({ id: t.id, email: t.email || '', restaurantId: t.restaurantId || '' })) });
    }

    if (action === 'prune-stale') {
      if (restaurantId && !callerCanRepair(caller, decoded, restaurantId)) return res.status(403).json({ error: 'Forbidden: no push repair access for this workspace.' });
      if (!restaurantId && !callerCanRepair(caller, decoded, '')) return res.status(403).json({ error: 'Forbidden: global stale-token pruning is Super Admin only.' });
      const maxAgeMs = Math.max(1, Number(maxAgeDays) || 30) * 86400000;
      const snap = restaurantId ? await db.collection('users').where('restaurantId', '==', restaurantId).get() : await db.collection('users').limit(1000).get();
      const stale = [];
      snap.forEach(doc => {
        const u = doc.data();
        if (!u.fcmToken) return;
        const ms = parseTimeMs(u.fcmTokenUpdatedAt || u.lastPushTokenSyncAt);
        if (!ms || Date.now() - ms > maxAgeMs) stale.push({ id: doc.id, ...u });
      });
      const batch = db.batch();
      stale.slice(0, 450).forEach(u => {
        batch.set(db.collection('users').doc(u.id), repairPayload({ mode: 'force-refresh', clearToken: true, requestedBy, repairLink }), { merge: true });
      });
      if (stale.length) await batch.commit();
      await writeAudit({ caller, action: 'PUSH_PRUNE_STALE_TOKENS', target: restaurantId || 'global', restaurantId: restaurantId || 'platform', details: `${Math.min(stale.length, 450)} stale token(s) cleared and marked for repair. maxAgeDays=${maxAgeDays}` });
      return res.status(200).json({ ok: true, action, pruned: Math.min(stale.length, 450), found: stale.length, maxAgeDays });
    }

    if (action === 'clear-repair-flag') {
      if (!ids.length) return res.status(400).json({ error: 'Missing target user.' });
      const snaps = await Promise.all(ids.map(id => db.collection('users').doc(id).get()));
      const targets = snaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }));
      for (const target of targets) {
        const targetRestaurantId = restaurantId || target.restaurantId || target.activeRestaurantId || '';
        if (!callerCanRepair(caller, decoded, targetRestaurantId)) return res.status(403).json({ error: `Forbidden: no push repair access for ${targetRestaurantId || target.id}.` });
      }
      await Promise.all(targets.map(target => db.collection('users').doc(target.id).set({
        pushNeedsRepair: false,
        pushForceServiceWorkerRefresh: false,
        pushRepairStatus: 'admin-cleared',
        pushRepairClearedAt: new Date().toISOString(),
        pushRepairClearedBy: requestedBy,
        lastPushRepairError: null
      }, { merge: true })));
      await writeAudit({ caller, action: 'PUSH_CLEAR_REPAIR_FLAG', target: ids.join(','), restaurantId: restaurantId || targets[0]?.restaurantId || 'platform', details: `${targets.length} user repair flag(s) cleared without changing token.` });
      return res.status(200).json({ ok: true, action, updated: targets.length });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('push-token-repair error:', error);
    return res.status(500).json({ error: error.message || 'Push token repair failed.' });
  }
}
