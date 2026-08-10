const { getAdminAppForRequest, authorize, readBody, writeAudit, clean } = require('../_chaos-admin');
const { isProtectedRootAdminEmail } = require('../_protected-root-admin');
async function requireSystemAdmin(req) {
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) return { ok: false, status: ctx.status || 403, error: ctx.error || 'System Administrator access is required.' };
  return { ok: true, app, ctx, db: ctx.db || app.firestore() };
}
function safeId(value = '') { return clean(value).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180); }
function bool(value) { return value === true; }
const PERMISSION_KEYS = new Set(['schedule','events','ops','inventory','prep','sales','team','labor']);
function safePermissions(raw = {}) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([key, value]) => { if (PERMISSION_KEYS.has(key)) out[key] = value === true; });
  }
  return out;
}
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  const auth = await requireSystemAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, code: 'system-admin-required', error: auth.error });
  const body = await readBody(req);
  const action = clean(body.action || '');
  const userId = safeId(body.userId || body.id || '');
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required.' });
  const ref = auth.db.collection('users').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: 'User was not found.' });
  const current = snap.data() || {};
  const email = clean(current.email || body.email || '').toLowerCase();
  const protectedRoot = isProtectedRootAdminEmail(email);
  const now = new Date().toISOString();
  try {
    if (action === 'support-update') {
      const input = body.updates || {};
      const restaurantId = clean(input.restaurantId || '');
      if (!clean(input.name || '')) return res.status(400).json({ ok: false, error: 'name is required.' });
      if (!restaurantId) return res.status(400).json({ ok: false, error: 'restaurantId is required.' });
      const restSnap = await auth.db.collection('restaurants').doc(restaurantId).get();
      if (!restSnap.exists) return res.status(400).json({ ok: false, error: 'Target workspace was not found.' });
      if (protectedRoot && restaurantId !== clean(current.restaurantId || '')) return res.status(403).json({ ok: false, error: 'Protected root administrator cannot be moved.' });
      if (protectedRoot && input.email && clean(input.email).toLowerCase() !== email) return res.status(403).json({ ok: false, error: 'Protected root administrator email cannot be changed.' });
      if (protectedRoot && input.isActive === false) return res.status(403).json({ ok: false, error: 'Protected root administrator cannot be disabled.' });
      const rest = restSnap.data() || {};
      const patch = {
        name: clean(input.name).slice(0, 160),
        phone: clean(input.phone || '').slice(0, 60),
        role: clean(input.role || 'Staff').slice(0, 80),
        wage: Number.isFinite(Number(input.wage)) ? Number(input.wage) : 0,
        restaurantId,
        restaurantName: clean(rest.name || input.restaurantName || restaurantId).slice(0, 200),
        isAdmin: bool(input.isAdmin),
        isActive: input.isActive !== false,
        forcePasswordChange: bool(input.forcePasswordChange),
        permissions: safePermissions(input.permissions || {}),
        supportEditedAt: now,
        supportEditedBy: auth.ctx.email || auth.ctx.uid || 'System Administrator'
      };
      if (input.email) patch.email = clean(input.email).toLowerCase().slice(0, 180);
      await ref.set(patch, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'SUPPORT_USER_EDIT', `users/${userId}`, `Support edited ${patch.email || email || userId}; workspace=${patch.restaurantName}; role=${patch.role}; admin=${patch.isAdmin}; active=${patch.isActive}.`, patch.restaurantId || 'platform');
      return res.status(200).json({ ok: true, action, user: { id: userId, ...patch } });
    }
    if (action === 'force-logout') {
      const patch = { forceLogout: true, forceLogoutAt: now, forceLogoutReason: clean(body.reason || 'system-admin-user-cache-clear').slice(0, 160) };
      await ref.set(patch, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'SUPPORT_USER_FORCE_LOGOUT', `users/${userId}`, 'System Administrator sent a force logout signal.', current.restaurantId || 'platform');
      return res.status(200).json({ ok: true, action, userId });
    }
    if (action === 'force-password-change') {
      if (protectedRoot) return res.status(403).json({ ok: false, error: 'Protected root administrator cannot be forced through this support path.' });
      await ref.set({ forcePasswordChange: true, forcePasswordChangeAt: now }, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'SUPPORT_USER_FORCE_PASSWORD_CHANGE', `users/${userId}`, 'System Administrator required a password change.', current.restaurantId || 'platform');
      return res.status(200).json({ ok: true, action, userId });
    }
    return res.status(400).json({ ok: false, error: `Unsupported user action: ${action}` });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || error).slice(0, 300) });
  }
};
module.exports._test = { safePermissions };
