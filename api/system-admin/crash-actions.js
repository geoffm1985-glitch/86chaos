const { getAdminAppForRequest, authorize, readBody, writeAudit, clean } = require('../_chaos-admin');
function safeId(value = '') { return clean(value).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180); }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) return res.status(ctx.status || 403).json({ ok: false, code: 'system-admin-required', error: ctx.error || 'System Administrator access is required.' });
  const body = await readBody(req);
  const action = clean(body.action || '');
  if (action !== 'clear-crash-reports') return res.status(400).json({ ok: false, error: 'Unsupported crash action.' });
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(safeId).filter(Boolean))].slice(0, 100) : [];
  if (!ids.length) return res.status(400).json({ ok: false, error: 'ids are required.' });
  const db = ctx.db || app.firestore();
  const batch = db.batch();
  ids.forEach(id => batch.delete(db.collection('crashReports').doc(id)));
  await batch.commit();
  await writeAudit(db, ctx, 'CRASH_REPORTS_CLEARED', 'crashReports', `Cleared ${ids.length} selected crash report(s).`, 'platform');
  return res.status(200).json({ ok: true, action, deleted: ids.length });
};
