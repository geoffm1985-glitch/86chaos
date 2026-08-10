const { admin, getAdminAppForRequest, authorize } = require('../_chaos-admin');
const { safePlatformUser, clean } = require('../system-admin-safe-rows.cjs');

function clampLimit(raw) {
  const parsed = Number(raw || 200);
  if (!Number.isFinite(parsed)) return 200;
  return Math.max(1, Math.min(Math.floor(parsed), 250));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) {
    return res.status(ctx.status || 403).json({ ok: false, code: 'system-admin-required', error: ctx.error || 'System Administrator access is required.' });
  }
  const db = ctx.db || app.firestore();
  const limit = clampLimit(req.query?.limit);
  const cursor = clean(req.query?.cursor || '');
  let q = db.collection('users')
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(limit + 1);
  if (cursor) q = q.startAfter(cursor);
  const snap = await q.get();
  const docs = snap.docs || [];
  const pageDocs = docs.slice(0, limit);
  const hasMore = docs.length > limit;
  const users = pageDocs.map(safePlatformUser);
  const nextCursor = hasMore && pageDocs.length ? pageDocs[pageDocs.length - 1].id : '';
  return res.status(200).json({
    ok: true,
    source: 'server',
    projectId: (ctx.app || app).options?.projectId || '',
    count: users.length,
    users,
    hasMore,
    nextCursor,
    fetchedAt: new Date().toISOString()
  });
};
module.exports.safePlatformUser = safePlatformUser;
