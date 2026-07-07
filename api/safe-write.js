const { initAdmin, readBody, authorize, writeAudit, clean } = require('./_chaos-admin');

const PERMS = {
  shifts: ['schedule','team'], timeOffRequests: ['schedule','team'],
  inventoryItems: ['inventory','team'], vendors: ['inventory','team'], orders: ['inventory','team'], invoices: ['inventory','team'],
  prepItems: ['prep','team'], prepCategories: ['prep','team'], lineCheckItems: ['prep','team'], recipes: ['prep','team'], menuDependencies: ['prep','inventory','team'],
  sales: ['sales','labor','team'], timePunches: ['labor','team'],
  tasks: ['prep','team'], tempLogs: ['prep','team'], wasteLogs: ['inventory','prep','team'],
  maintenanceLogs: ['team'], pmSchedules: ['team'], events: ['events','schedule','team'], messages: ['messages','team']
};
function canWrite(ctx, collectionName, restaurantId) {
  if (ctx.isSuperAdmin) return true;
  if (!restaurantId || ctx.user?.restaurantId !== restaurantId) return false;
  if (ctx.user?.isAdmin || ctx.user?.isOwner || ctx.user?.accountOwner) return true;
  return (PERMS[collectionName] || []).some(p => ctx.permissions?.[p] === true);
}
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const app = initAdmin();
    const db = app.firestore();
    const body = await readBody(req);
    const collectionName = clean(body.collectionName || '');
    const action = clean(body.action || 'set');
    const docId = clean(body.docId || '');
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    const restaurantId = clean(data.restaurantId || body.restaurantId || '');
    const auth = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    if (!collectionName || !/^[A-Za-z0-9_-]+$/.test(collectionName)) return res.status(400).json({ ok: false, error: 'Invalid collection name.' });
    if (!canWrite(auth, collectionName, restaurantId)) return res.status(403).json({ ok: false, error: `Missing write permission for ${collectionName}.` });
    const payload = { ...data, restaurantId: restaurantId || auth.restaurantId || data.restaurantId, updatedAt: new Date().toISOString(), updatedBy: auth.email || auth.uid, writeEngine: 'v14-safe-write' };
    let out = {};
    if (action === 'add') {
      const ref = await db.collection(collectionName).add(payload);
      out = { id: ref.id, path: `${collectionName}/${ref.id}` };
    } else if (action === 'delete') {
      if (!docId) return res.status(400).json({ ok: false, error: 'docId is required for delete.' });
      await db.collection(collectionName).doc(docId).delete(); out = { id: docId, path: `${collectionName}/${docId}` };
    } else {
      if (!docId) return res.status(400).json({ ok: false, error: 'docId is required for set/update.' });
      await db.collection(collectionName).doc(docId).set(payload, { merge: action !== 'replace' }); out = { id: docId, path: `${collectionName}/${docId}` };
    }
    await writeAudit(db, auth, `SAFE_WRITE_${action.toUpperCase()}`, out.path, body.label || 'Safe Write Engine route', restaurantId || auth.restaurantId);
    return res.status(200).json({ ok: true, ...out });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
