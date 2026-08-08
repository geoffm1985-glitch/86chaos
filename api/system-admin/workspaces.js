const { getAdminAppForRequest, authorize } = require('../_chaos-admin');
const { safeWorkspace } = require('../system-admin-safe-rows.cjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || !ctx.isSuperAdmin) return res.status(ctx.status || 403).json({ ok: false, code: 'system-admin-required', error: ctx.error || 'System Administrator access is required.' });
  const db = ctx.db || app.firestore();
  const limit = Math.max(1, Math.min(Number(req.query?.limit || 250) || 250, 500));
  const snap = await db.collection('restaurants').orderBy('name', 'asc').limit(limit).get();
  const workspaces = snap.docs.map(safeWorkspace).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  return res.status(200).json({ ok: true, source: 'server', projectId: app.options?.projectId || '', count: workspaces.length, workspaces, fetchedAt: new Date().toISOString() });
};
module.exports.safeWorkspace = safeWorkspace;
