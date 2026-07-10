import { getFirestore } from 'firebase-admin/firestore';
import projectAdmin from './_firebase-project-admin.js';

const { verifyRequestToken } = projectAdmin;

async function requireAppCheckIfEnforced(req, res, app) {
  const enforced = ['true', '1', 'yes', 'enforce'].includes(String(process.env.APP_CHECK_ENFORCE || '').toLowerCase().trim());
  if (!enforced) return true;
  const token = String(req.headers['x-firebase-appcheck'] || req.headers['X-Firebase-AppCheck'] || '').trim();
  if (!token) {
    res.status(401).json({ error: 'App Check verification is required. Refresh the app after deployment and try again.' });
    return false;
  }
  try {
    const { getAppCheck } = await import('firebase-admin/app-check');
    await getAppCheck(app).verifyToken(token);
    return true;
  } catch (err) {
    res.status(401).json({ error: `App Check verification failed: ${err.message}` });
    return false;
  }
}


const MASTER_EMAILS = new Set([
  (process.env.MASTER_ADMIN_EMAIL || '').toLowerCase()
].filter(Boolean));
if (process.env.MASTER_ADMIN_EMAILS) {
  process.env.MASTER_ADMIN_EMAILS.split(',').map(v => v.toLowerCase().trim()).filter(Boolean).forEach(email => MASTER_EMAILS.add(email));
}


async function enforceRouteRateLimit(db, req, res, decoded, routeName, limit = 30, windowMs = 60 * 1000) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const key = `${routeName}:${decoded?.uid || decoded?.email || ip || 'unknown'}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180);
  const ref = db.collection('apiRateLimits').doc(`${key}:${windowStart}`);
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data().count || 0) : 0;
    const count = current + 1;
    tx.set(ref, { key, routeName, count, limit, windowMs, windowStart: new Date(windowStart).toISOString(), updatedAt: new Date(now).toISOString(), expiresAt: new Date(windowStart + windowMs * 3).toISOString() }, { merge: true });
    return { ok: count <= limit, count, resetAt: new Date(windowStart + windowMs).toISOString() };
  });
  if (!result.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000)));
    res.status(429).json({ error: 'Too many requests. Wait a minute and try again.', rateLimited: true, resetAt: result.resetAt });
    return false;
  }
  return true;
}

const norm = (value = '') => String(value || '').toLowerCase().trim();
const cleanId = (value = '') => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);
const memberDocId = (uid, restaurantId) => `${cleanId(uid)}_${cleanId(restaurantId)}`.slice(0, 240);

function userHasWorkspace(user, restaurantId) {
  return Boolean(
    user?.restaurantId === restaurantId ||
    user?.activeRestaurantId === restaurantId ||
    user?.defaultRestaurantId === restaurantId ||
    user?.workspaceIds?.includes?.(restaurantId) ||
    user?.memberships?.[restaurantId]?.isActive === true
  );
}

async function readWorkspaceMember(db, uid, email, restaurantId) {
  if (!restaurantId) return null;
  const direct = await db.collection('workspaceMembers').doc(memberDocId(uid, restaurantId)).get();
  if (direct.exists && direct.data()?.isActive !== false) return { id: direct.id, ...direct.data() };
  if (email) {
    const byEmail = await db.collection('workspaceMembers')
      .where('restaurantId', '==', restaurantId)
      .where('email', '==', norm(email))
      .limit(1)
      .get();
    if (!byEmail.empty && byEmail.docs[0].data()?.isActive !== false) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
  }
  return null;
}

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

async function getCaller(db, decoded) {
  const direct = await db.collection('users').doc(decoded.uid).get();
  if (direct.exists) return { id: direct.id, ...direct.data() };
  const email = (decoded.email || '').toLowerCase().trim();
  if (!email) return { id: decoded.uid, email: '' };
  const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
  return { id: decoded.uid, email };
}

async function callerCanRepair(db, caller, decoded, restaurantId) {
  const email = (decoded.email || caller.email || '').toLowerCase().trim();
  if (decoded.superAdmin === true || caller.isSuperAdmin === true || caller.systemAccess?.superAdmin === true || MASTER_EMAILS.has(email)) return true;
  if (!restaurantId) return false;
  const memberships = caller.memberships || {};
  const member = memberships?.[restaurantId] || await readWorkspaceMember(db, decoded.uid, email, restaurantId);
  const legacyWorkspace = userHasWorkspace(caller, restaurantId);
  const permissions = { ...((legacyWorkspace && caller.permissions) || {}), ...(member?.permissions || {}) };
  return Boolean(
    legacyWorkspace && (caller.isAdmin === true || caller.isOwner === true || caller.accountOwner === true || permissions.team === true || permissions.settings === true) ||
    member && member.isActive !== false && (member.isAdmin === true || member.isOwner === true || member.accountOwner === true || member.workspaceOwner === true || permissions.team === true || permissions.settings === true)
  );
}

async function loadUsersForRestaurant(db, restaurantId) {
  const userMap = new Map();
  const usersSnap = await db.collection('users').where('restaurantId', '==', restaurantId).get();
  usersSnap.forEach(doc => userMap.set(doc.id, { id: doc.id, ...doc.data() }));

  const membersSnap = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).get().catch(() => null);
  const memberIds = [];
  const memberEmails = [];
  membersSnap?.forEach(memberDoc => {
    const m = memberDoc.data() || {};
    if (m.isActive === false) return;
    if (m.userId || m.uid) memberIds.push(m.userId || m.uid);
    if (m.email) memberEmails.push(norm(m.email));
  });
  await Promise.all([...new Set(memberIds.filter(Boolean))].slice(0, 200).map(async id => {
    if (userMap.has(id)) return;
    const snap = await db.collection('users').doc(id).get();
    if (snap.exists) userMap.set(snap.id, { id: snap.id, ...snap.data(), restaurantId });
  }));
  await Promise.all([...new Set(memberEmails.filter(Boolean))].slice(0, 50).map(async email => {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    snap.forEach(doc => { if (!userMap.has(doc.id)) userMap.set(doc.id, { id: doc.id, ...doc.data(), restaurantId }); });
  }));
  return [...userMap.values()];
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

async function writeAudit(db, { caller, action, target, restaurantId, details }) {
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

  let authContext;
  try {
    authContext = await verifyRequestToken(req, { requireProjectCredentials: true });
  } catch (error) {
    return res.status(403).json({ error: `Push repair authorization failed: ${error.message}` });
  }

  const { app, decoded, projectId } = authContext;
  const db = getFirestore(app);
  if (!await requireAppCheckIfEnforced(req, res, app)) return;
  if (!await enforceRouteRateLimit(db, req, res, decoded, 'push-token-repair', Number(process.env.PUSH_REPAIR_RATE_LIMIT || 25), 60 * 1000)) return;

  try {
    const caller = await getCaller(db, decoded);
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
        if (!await callerCanRepair(db, caller, decoded, targetRestaurantId)) {
          return res.status(403).json({ error: `Forbidden: no push repair access for ${targetRestaurantId || target.id}.` });
        }
      }
      const mode = action === 'force-refresh' ? 'force-refresh' : 'repair';
      const clearToken = action === 'clear-token' || action === 'force-refresh';
      const writes = targets.map(target => db.collection('users').doc(target.id).set(repairPayload({ mode, clearToken, requestedBy, repairLink }), { merge: true }));
      await Promise.all(writes);
      await writeAudit(db, { caller, action: `PUSH_${action.replace(/-/g, '_').toUpperCase()}`, target: ids.join(','), restaurantId: restaurantId || targets[0]?.restaurantId || 'platform', details: `${targets.length} user(s) marked for push repair. clearToken=${clearToken}` });
      return res.status(200).json({ ok: true, action, updated: targets.length, users: targets.map(t => ({ id: t.id, email: t.email || '', restaurantId: t.restaurantId || '' })) });
    }

    if (action === 'prune-stale') {
      if (restaurantId && !await callerCanRepair(db, caller, decoded, restaurantId)) return res.status(403).json({ error: 'Forbidden: no push repair access for this workspace.' });
      if (!restaurantId && !await callerCanRepair(db, caller, decoded, '')) return res.status(403).json({ error: 'Forbidden: global stale-token pruning is Super Admin only.' });
      const maxAgeMs = Math.max(1, Number(maxAgeDays) || 30) * 86400000;
      const users = restaurantId
        ? await loadUsersForRestaurant(db, restaurantId)
        : (await db.collection('users').limit(1000).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const stale = [];
      users.forEach(u => {
        if (!u.fcmToken) return;
        const ms = parseTimeMs(u.fcmTokenUpdatedAt || u.lastPushTokenSyncAt);
        if (!ms || Date.now() - ms > maxAgeMs) stale.push(u);
      });
      const batch = db.batch();
      stale.slice(0, 450).forEach(u => {
        batch.set(db.collection('users').doc(u.id), repairPayload({ mode: 'force-refresh', clearToken: true, requestedBy, repairLink }), { merge: true });
      });
      if (stale.length) await batch.commit();
      await writeAudit(db, { caller, action: 'PUSH_PRUNE_STALE_TOKENS', target: restaurantId || 'global', restaurantId: restaurantId || 'platform', details: `${Math.min(stale.length, 450)} stale token(s) cleared and marked for repair. maxAgeDays=${maxAgeDays}` });
      return res.status(200).json({ ok: true, action, pruned: Math.min(stale.length, 450), found: stale.length, maxAgeDays });
    }

    if (action === 'clear-repair-flag') {
      if (!ids.length) return res.status(400).json({ error: 'Missing target user.' });
      const snaps = await Promise.all(ids.map(id => db.collection('users').doc(id).get()));
      const targets = snaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }));
      for (const target of targets) {
        const targetRestaurantId = restaurantId || target.restaurantId || target.activeRestaurantId || '';
        if (!await callerCanRepair(db, caller, decoded, targetRestaurantId)) return res.status(403).json({ error: `Forbidden: no push repair access for ${targetRestaurantId || target.id}.` });
      }
      await Promise.all(targets.map(target => db.collection('users').doc(target.id).set({
        pushNeedsRepair: false,
        pushForceServiceWorkerRefresh: false,
        pushRepairStatus: 'admin-cleared',
        pushRepairClearedAt: new Date().toISOString(),
        pushRepairClearedBy: requestedBy,
        lastPushRepairError: null
      }, { merge: true })));
      await writeAudit(db, { caller, action: 'PUSH_CLEAR_REPAIR_FLAG', target: ids.join(','), restaurantId: restaurantId || targets[0]?.restaurantId || 'platform', details: `${targets.length} user repair flag(s) cleared without changing token.` });
      return res.status(200).json({ ok: true, action, updated: targets.length });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('push-token-repair error:', error);
    return res.status(500).json({ error: error.message || 'Push token repair failed.', firebaseProject: projectId });
  }
}
