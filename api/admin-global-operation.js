const { getAdminAppForRequest, authorize, readBody, requireAppCheckIfEnforced, writeAudit } = require('./_chaos-admin');
const { isProtectedRootAdminEmail } = require('./_protected-root-admin');

const PAGE_SIZE = 450;
function cleanText(value = '', max = 1000) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); }
async function requireSystemAdmin(req) {
  const app = getAdminAppForRequest(req);
  const appCheck = await requireAppCheckIfEnforced(app, req);
  if (!appCheck.ok) return { app, ok: false, status: appCheck.status || 401, error: appCheck.error };
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || !ctx.isSuperAdmin) return { app, ok: false, status: ctx.status || 403, error: ctx.error || 'System Administrator access is required.' };
  return { app, db: ctx.db || app.firestore(), ctx, ok: true };
}
async function pageCollection(db, collectionName, worker) {
  let last = null;
  let scanned = 0;
  let affected = 0;
  const errors = [];
  for (;;) {
    let q = db.collection(collectionName).orderBy('__name__').limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    scanned += snap.size;
    const batch = db.batch();
    let batchCount = 0;
    for (const docSnap of snap.docs) {
      try {
        const update = await worker(docSnap);
        if (update && Object.keys(update).length) {
          batch.set(docSnap.ref, update, { merge: true });
          batchCount += 1;
        }
      } catch (err) {
        errors.push({ id: docSnap.id, error: String(err?.message || err).slice(0, 180) });
      }
    }
    if (batchCount) {
      await batch.commit();
      affected += batchCount;
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }
  return { scanned, affected, errors };
}
async function pageRestaurants(db, worker) { return pageCollection(db, 'restaurants', worker); }
async function pageUsers(db, worker) { return pageCollection(db, 'users', worker); }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const auth = await requireSystemAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
  const body = await readBody(req);
  const action = cleanText(body.action, 80);
  const target = cleanText(body.target || 'ALL', 120);
  const now = new Date().toISOString();
  const idempotencyKey = cleanText(body.idempotencyKey || `${action}_${target}_${now.slice(0,16)}`, 160);
  const destructiveAll = target === 'ALL' && ['setBanner','clearBanner','forceRefresh','lockdown','unlock','megaphone','logoutNonAdmins'].includes(action);
  if (destructiveAll && body.confirmation !== `CONFIRM ${action} ALL`) return res.status(400).json({ ok: false, error: `CONFIRM ${action} ALL confirmation required.` });
  try {
    let result;
    if (action === 'setBanner') {
      const text = cleanText(body.text, 800);
      if (!text) return res.status(400).json({ ok: false, error: 'Banner text required.' });
      if (target === 'ALL') result = await pageRestaurants(auth.db, () => ({ systemBanner: text, systemBannerUpdatedAt: now }));
      else { const targetRef = auth.db.collection('restaurants').doc(target); const targetSnap = await targetRef.get(); if (!targetSnap.exists) return res.status(404).json({ ok:false, error:'Target restaurant does not exist.' }); await targetRef.set({ systemBanner: text, systemBannerUpdatedAt: now }, { merge: true }); result = { scanned: 1, affected: 1, errors: [] }; }
    } else if (action === 'clearBanner') {
      if (target === 'ALL') result = await pageRestaurants(auth.db, () => ({ systemBanner: null, systemBannerUpdatedAt: null }));
      else { const targetRef = auth.db.collection('restaurants').doc(target); const targetSnap = await targetRef.get(); if (!targetSnap.exists) return res.status(404).json({ ok:false, error:'Target restaurant does not exist.' }); await targetRef.set({ systemBanner: null, systemBannerUpdatedAt: null }, { merge: true }); result = { scanned: 1, affected: 1, errors: [] }; }
    } else if (action === 'forceRefresh') {
      if (target !== 'ALL') return res.status(400).json({ ok: false, error: 'Global refresh endpoint only accepts target ALL.' });
      const reason = cleanText(body.reason || 'system-admin-global-refresh', 160);
      const restaurantResult = await pageRestaurants(auth.db, () => ({ forceRefresh: now, forceRefreshAt: now, forceRefreshReason: reason }));
      const userResult = await pageUsers(auth.db, () => ({ forceRefreshAt: now, clientRefreshAt: now, forceRefreshReason: reason, forceRefreshBy: auth.ctx.uid || auth.ctx.email || 'system-admin' }));
      result = {
        scanned: (restaurantResult.scanned || 0) + (userResult.scanned || 0),
        affected: (restaurantResult.affected || 0) + (userResult.affected || 0),
        restaurantsScanned: restaurantResult.scanned || 0,
        restaurantsAffected: restaurantResult.affected || 0,
        usersScanned: userResult.scanned || 0,
        usersAffected: userResult.affected || 0,
        errors: [...(restaurantResult.errors || []), ...(userResult.errors || [])]
      };
    } else if (action === 'logoutNonAdmins') {
      if (target !== 'ALL') return res.status(400).json({ ok: false, error: 'Global logout endpoint only accepts target ALL.' });
      let last = null;
      let scanned = 0;
      let affected = 0;
      let protectedSkipped = 0;
      let adminSkipped = 0;
      const errors = [];
      for (;;) {
        let q = auth.db.collection('users').orderBy('__name__').limit(PAGE_SIZE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        scanned += snap.size;
        const batch = auth.db.batch();
        let batchCount = 0;
        for (const userSnap of snap.docs) {
          const data = userSnap.data() || {};
          const email = cleanText(data.email || '', 180).toLowerCase();
          const roleText = `${data.role || ''} ${data.accountRole || ''} ${data.roleName || ''}`.toLowerCase();
          const isProtected = isProtectedRootAdminEmail(email);
          const isAdmin = data.isSuperAdmin === true || data.systemAccess?.superAdmin === true || /system\s*administrator|super\s*admin|master\s*admin/.test(roleText);
          if (isProtected) { protectedSkipped += 1; continue; }
          if (isAdmin) { adminSkipped += 1; continue; }
          batch.set(userSnap.ref, { forceLogout: true, forceLogoutAt: now, forceLogoutNonce: idempotencyKey, forceLogoutBy: auth.ctx.uid || auth.ctx.email || 'system-admin', forceLogoutByName: auth.ctx.email || 'System Administrator', forceLogoutReason: cleanText(body.reason || 'system-admin-global-logout', 160) }, { merge: true });
          batchCount += 1;
        }
        if (batchCount) {
          try { await batch.commit(); affected += batchCount; }
          catch (err) { errors.push({ after: last?.id || '', count: batchCount, error: cleanText(err?.message || err, 180) }); }
        }
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE_SIZE) break;
      }
      result = { scanned, affected, loggedOut: affected, protectedSkipped, adminSkipped, errors };
    } else if (action === 'lockdown' || action === 'unlock') {
      if (target !== 'ALL') return res.status(400).json({ ok: false, error: 'Global maintenance endpoint only accepts target ALL.' });
      result = await pageRestaurants(auth.db, () => ({ platformMaintenanceLock: action === 'lockdown', platformMaintenanceUpdatedAt: now, platformMaintenanceUpdatedBy: auth.ctx.uid || auth.ctx.email || 'system-admin' }));
    } else if (action === 'megaphone') {
      if (target !== 'ALL') return res.status(400).json({ ok: false, error: 'Global megaphone endpoint only accepts target ALL.' });
      const title = cleanText(body.title || '86 Chaos Alert', 120);
      const message = cleanText(body.message || body.text || '', 800);
      if (!message) return res.status(400).json({ ok: false, error: 'Megaphone message required.' });
      const broadcastId = cleanText(body.broadcastId || `broadcast_${Date.now()}`, 120);
      let last = null;
      let scanned = 0;
      let affected = 0;
      const errors = [];
      for (;;) {
        let q = auth.db.collection('restaurants').orderBy('__name__').limit(PAGE_SIZE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        scanned += snap.size;
        const batch = auth.db.batch();
        snap.docs.forEach(restaurantSnap => {
          const eventRef = auth.db.collection('events').doc(`${broadcastId}_${restaurantSnap.id}`.slice(0, 1400));
          batch.set(eventRef, { date: now, title: message, broadcastTitle: title, type: 'note', author: 'System Alert', isImportant: true, restaurantId: restaurantSnap.id, workspaceId: restaurantSnap.id, replies: [], platformBroadcastId: broadcastId, targetScope: 'all-restaurants', createdAt: now, createdBy: auth.ctx.uid || auth.ctx.email || 'system-admin' }, { merge: true });
        });
        try { await batch.commit(); affected += snap.size; }
        catch (err) { errors.push({ after: last?.id || '', count: snap.size, error: cleanText(err?.message || err, 180) }); }
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE_SIZE) break;
      }
      result = { scanned, affected, broadcastId, errors };
    } else {
      return res.status(400).json({ ok: false, error: `Unsupported global operation: ${action}` });
    }
    await writeAudit(auth.db, auth.ctx, `SYSTEM_GLOBAL_${action.toUpperCase()}`, target, JSON.stringify({ ...result, action, idempotencyKey }), 'platform');
    return res.status(result.errors?.length ? 207 : 200).json({ ok: !result.errors?.length, action, target, idempotencyKey, ...result });
  } catch (err) {
    const message = String(err?.message || 'Global operation failed.').replace(/(token|secret|private[_ -]?key|authorization)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]').slice(0, 220);
    return res.status(500).json({ ok: false, error: message, action, target });
  }
};
module.exports.config = { maxDuration: 300 };
