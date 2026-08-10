const { admin, getAdminAppForRequest, authorize, readBody, writeAudit, clean } = require('../_chaos-admin');
async function requireSystemAdmin(req) {
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) return { ok: false, status: ctx.status || 403, error: ctx.error || 'System Administrator access is required.' };
  return { ok: true, app, ctx, db: ctx.db || app.firestore() };
}
function safeId(value = '') { return clean(value).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180); }
function sanitize(value, depth = 0) {
  if (depth > 8) return null;
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 200).map(item => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (/credential|secret|privateKey|password|token/i.test(key)) return;
      out[key] = sanitize(entry, depth + 1);
    });
    return out;
  }
  return String(value || '').slice(0, 1000);
}
const WORKSPACE_UPDATE_KEYS = new Set(['name','ownerName','ownerEmail','ownerPhone','systemSettings','planId','subscriptionStatus','billingStatus','subscription','integrationsLocked','isFounderBeta','founderDiscountPercent','founderDiscountEndsAt','customPrice','trialDays','isActive','isReadOnly','features','labs']);
async function loadRestaurant(db, id) {
  const ref = db.collection('restaurants').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Workspace was not found.');
  return { ref, data: snap.data() || {} };
}
function historyWith(beforeData, entry) {
  const existing = Array.isArray(beforeData.settingsHistory) ? beforeData.settingsHistory.slice(-24) : [];
  return [...existing, sanitize(entry)].filter(Boolean);
}
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  const auth = await requireSystemAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, code: 'system-admin-required', error: auth.error });
  const body = await readBody(req);
  const action = clean(body.action || '');
  const now = new Date().toISOString();
  try {
    if (action === 'schedule-delete') {
      const workspaceId = safeId(body.workspaceId || '');
      const { ref } = await loadRestaurant(auth.db, workspaceId);
      const deletedAt = admin.firestore.Timestamp.now();
      const deletionScheduledFor = admin.firestore.Timestamp.fromMillis(deletedAt.toMillis() + (30 * 24 * 60 * 60 * 1000));
      await ref.set({ isActive: false, archived: true, deleted_at: deletedAt, deletionScheduledFor, deletionStatus: 'scheduled', deletedBy: auth.ctx.email || auth.ctx.uid || 'system-administrator', updatedAt: now }, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'WORKSPACE_DELETION_SCHEDULED', `restaurants/${workspaceId}`, 'Workspace scheduled for deletion.', workspaceId);
      return res.status(200).json({ ok: true, action, workspaceId });
    }
    if (action === 'restore-deleted') {
      const workspaceId = safeId(body.workspaceId || '');
      const { ref } = await loadRestaurant(auth.db, workspaceId);
      await ref.set({ isActive: true, archived: false, deleted_at: admin.firestore.FieldValue.delete(), deletionScheduledFor: admin.firestore.FieldValue.delete(), deletionStatus: admin.firestore.FieldValue.delete(), deletedBy: admin.firestore.FieldValue.delete(), restoredAt: now, restoredBy: auth.ctx.email || auth.ctx.uid || 'system-administrator', updatedAt: now }, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'WORKSPACE_RESTORED', `restaurants/${workspaceId}`, 'Workspace restored from scheduled deletion.', workspaceId);
      return res.status(200).json({ ok: true, action, workspaceId });
    }
    if (action === 'stamp-missing-created-at') {
      const workspaceIds = Array.isArray(body.workspaceIds) ? body.workspaceIds.map(safeId).filter(Boolean).slice(0, 500) : [];
      if (!workspaceIds.length) return res.status(400).json({ ok: false, error: 'workspaceIds required.' });
      const batch = auth.db.batch();
      let count = 0;
      for (const id of workspaceIds) {
        const { ref, data } = await loadRestaurant(auth.db, id);
        if (data.createdAt) continue;
        batch.set(ref, { createdAt: now, createdAtEstimated: true, createdAtBackfilledAt: now, createdAtSource: 'admin_backfill' }, { merge: true });
        count += 1;
      }
      if (count) await batch.commit();
      await writeAudit(auth.db, auth.ctx, 'WORKSPACE_CREATED_AT_BACKFILLED', 'restaurants', `Backfilled createdAt for ${count} workspace(s).`, 'platform');
      return res.status(200).json({ ok: true, action, count });
    }
    if (action === 'update-workspace') {
      const workspaceId = safeId(body.workspaceId || '');
      const { ref, data: beforeData } = await loadRestaurant(auth.db, workspaceId);
      const input = body.update || {};
      const patch = {};
      Object.entries(input).forEach(([key, value]) => { if (WORKSPACE_UPDATE_KEYS.has(key)) patch[key] = sanitize(value); });
      if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: 'No supported workspace fields supplied.' });
      const historyEntry = sanitize(body.historyEntry || { type: 'platform_workspace_settings', at: now, by: auth.ctx.email || auth.ctx.uid || 'System Administrator', summary: 'Workspace settings changed from System Administrator.', before: beforeData, after: patch });
      patch.settingsHistory = historyWith(beforeData, historyEntry);
      patch.updatedAt = now;
      await ref.set(patch, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'WORKSPACE_SETTINGS_UPDATED', `restaurants/${workspaceId}`, 'Workspace settings changed from System Administrator.', workspaceId);
      return res.status(200).json({ ok: true, action, workspaceId, update: patch });
    }
    if (action === 'set-maintenance') {
      const workspaceIds = Array.isArray(body.workspaceIds) ? body.workspaceIds.map(safeId).filter(Boolean).slice(0, 500) : [];
      const payload = sanitize(body.payload || {});
      if (!workspaceIds.length) return res.status(400).json({ ok: false, error: 'workspaceIds required.' });
      const batch = auth.db.batch();
      let count = 0;
      for (const id of workspaceIds) {
        const { ref, data } = await loadRestaurant(auth.db, id);
        const historyEntry = sanitize(body.historyEntry || { type: 'maintenance_mode', at: now, by: auth.ctx.email || auth.ctx.uid || 'System Administrator', before: data, after: payload });
        batch.set(ref, { ...payload, settingsHistory: historyWith(data, historyEntry) }, { merge: true });
        count += 1;
      }
      await batch.commit();
      await writeAudit(auth.db, auth.ctx, 'WORKSPACE_MAINTENANCE_UPDATED', 'restaurants', `Maintenance mode updated for ${count} workspace(s).`, 'platform');
      return res.status(200).json({ ok: true, action, count });
    }
    if (action === 'save-branding') {
      const workspaceId = safeId(body.workspaceId || '');
      const { ref, data } = await loadRestaurant(auth.db, workspaceId);
      const branding = sanitize(body.branding || {});
      const historyEntry = { type: 'branding_display_settings', at: now, by: auth.ctx.email || auth.ctx.uid || 'System Administrator', summary: 'Branding / Display settings changed.', before: { branding: data.branding || {} }, after: { branding } };
      await ref.set({ branding, settingsHistory: historyWith(data, historyEntry) }, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'WORKSPACE_BRANDING_UPDATED', `restaurants/${workspaceId}`, 'Workspace branding/display settings changed.', workspaceId);
      return res.status(200).json({ ok: true, action, workspaceId, branding });
    }
    if (action === 'restore-settings-history') {
      const workspaceId = safeId(body.workspaceId || '');
      const allowed = sanitize(body.restore || {});
      const { ref, data } = await loadRestaurant(auth.db, workspaceId);
      const historyEntry = { type: 'settings_restore', at: now, by: auth.ctx.email || auth.ctx.uid || 'System Administrator', summary: clean(body.summary || 'Restored settings snapshot.'), before: data, after: allowed };
      await ref.set({ ...allowed, settingsHistory: historyWith(data, historyEntry) }, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'WORKSPACE_SETTINGS_RESTORED', `restaurants/${workspaceId}`, 'Workspace settings restored from history snapshot.', workspaceId);
      return res.status(200).json({ ok: true, action, workspaceId });
    }
    return res.status(400).json({ ok: false, error: `Unsupported workspace action: ${action}` });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || error).slice(0, 300) });
  }
};
