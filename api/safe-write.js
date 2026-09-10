const { foodSafety } = require('./_food-safety');
const { authorizeAiScanWorkspace } = require('./_ai-usage');
const { verifyRequestToken } = require('./_firebase-project-admin');
const { requireMfaIfEnforced } = require('./_chaos-admin');
const { initAdmin, readBody, authorize, writeAudit, clean } = require('./_chaos-admin');
const { requireAppCheckIfEnforced } = require('./_chaos-admin');
const { approveInvoice } = require('./_invoice-approval');
const { vendorMemory } = require('./_vendor-memory');
const { approveMenu } = require('./_menu-approval');
const { recipeCosting } = require('./_recipe-costing');

const PERMS = {
  shifts: ['schedule','team'], timeOffRequests: ['schedule','team'], scheduleTemplates: ['schedule','team'], scheduleCoverageTargets: ['schedule','team'],
  inventoryItems: ['inventory','team'], vendors: ['inventory','team'], orders: ['inventory','team'], invoices: ['inventory','team'],
  prepItems: ['prep','team'], prepCategories: ['prep','team'], lineCheckItems: ['prep','team'], recipes: ['prep','team'], menuDependencies: ['prep','inventory','team'],
  sales: ['sales','labor','team'], timePunches: ['labor','team'],
  tasks: ['prep','team'], tempLogs: ['prep','team'], wasteLogs: ['inventory','prep','team'],
  maintenanceLogs: ['team'], pmSchedules: ['team'], events: ['events','schedule','team'], messages: ['messages','team']
};
function canWrite(ctx, collectionName, restaurantId) {
  if (ctx.isSuperAdmin) return true;
  if (!restaurantId || ctx.restaurantId !== restaurantId) return false;
  if (ctx.user?.isAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.user?.workspaceOwner) return true;
  return (PERMS[collectionName] || []).some(p => ctx.permissions?.[p] === true);
}
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const app = initAdmin(req);
    const db = app.firestore();
    const body = await readBody(req);
    const collectionName = clean(body.collectionName || '');
    const action = clean(body.action || 'set');
    const docId = clean(body.docId || '');
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    const restaurantId = clean(data.restaurantId || body.restaurantId || '');
    if (action.startsWith('food-safety-')) {
      const verified = await verifyRequestToken(req, { requireProjectCredentials: true });
      const check = await requireAppCheckIfEnforced(verified.app, req);
      if (!check.ok) return res.status(check.status || 401).json({ ok: false, error: check.error });
      const workspace = await authorizeAiScanWorkspace({ app: verified.app, decoded: verified.decoded, restaurantId, scanType: 'recipe' });
      const mfa = requireMfaIfEnforced(verified.decoded, workspace.workspaceUser, workspace.isSuperAdmin);
      if (!mfa.ok) return res.status(mfa.status || 403).json({ ok: false, error: mfa.error });
      const ctx = { ...workspace, uid: verified.decoded.uid, user: workspace.workspaceUser, permissions: workspace.workspaceUser?.permissions || {} };
      return res.status(200).json({ ok: true, ...await foodSafety({ db: workspace.db, ctx, body }) });
    }
    const auth = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    if (action === 'invoice-approve' || action === 'menu-approve' || action.startsWith('vendor-memory-') || action.startsWith('recipe-costing-')) {
      const appCheck = await requireAppCheckIfEnforced(auth.app || app, req);
      if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
      if (!canWrite(auth, action === 'menu-approve' || action.startsWith('recipe-costing-') ? 'menuDependencies' : 'inventoryItems', restaurantId)) return res.status(403).json({ ok: false, error: 'Inventory or recipe approval permission is required.' });
      const result = action.startsWith('recipe-costing-') ? await recipeCosting({ db: auth.db || db, ctx: auth, body }) : action === 'menu-approve' ? await approveMenu({ db: auth.db || db, ctx: auth, scan: body.scan, approved: body.approved }) : action === 'invoice-approve'
        ? await approveInvoice({ db: auth.db || db, ctx: auth, invoice: body.invoice, approved: body.approved })
        : await vendorMemory({ db: auth.db || db, ctx: auth, body });
      return res.status(200).json({ ok: true, ...result });
    }
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
    return res.status(err.statusCode || 500).json({ ok: false, code: err.code, error: err.message });
  }
};
