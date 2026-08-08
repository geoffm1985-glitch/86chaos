const { getAdminAppForRequest, authorize } = require('../_chaos-admin');
const { clean, norm, safeUser } = require('../system-admin-safe-rows.cjs');
async function queryOne(db, field, value) {
  if (!value) return [];
  const snap = await db.collection('users').where(field, '==', value).limit(10).get();
  return snap.docs;
}
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || !ctx.isSuperAdmin) return res.status(ctx.status || 403).json({ ok: false, code: 'system-admin-required', error: ctx.error || 'System Administrator access is required.' });
  const db = ctx.db || app.firestore();
  const email = norm(req.query?.email || '');
  const uid = clean(req.query?.uid || req.query?.authUid || '');
  const userId = clean(req.query?.userId || req.query?.id || '');
  const restaurantId = clean(req.query?.restaurantId || '');
  const docs = new Map();
  if (userId) { const doc = await db.collection('users').doc(userId).get(); if (doc.exists) docs.set(doc.id, doc); }
  for (const doc of await queryOne(db, 'email', email)) docs.set(doc.id, doc);
  for (const doc of await queryOne(db, 'emailLower', email)) docs.set(doc.id, doc);
  for (const doc of await queryOne(db, 'authUid', uid)) docs.set(doc.id, doc);
  for (const doc of await queryOne(db, 'uid', uid)) docs.set(doc.id, doc);
  const users = [...docs.values()].map(safeUser).filter(user => !restaurantId || user.restaurantId === restaurantId || user.workspaceIds?.includes?.(restaurantId));
  return res.status(200).json({ ok: true, source: 'server', count: users.length, users, fetchedAt: new Date().toISOString() });
};
module.exports.safeUser = safeUser;
