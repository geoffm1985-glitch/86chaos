const { getAdminAppForRequest, authorize, readBody, writeAudit, clean } = require('../_chaos-admin');
async function requireSystemAdmin(req) {
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) return { ok: false, status: ctx.status || 403, error: ctx.error || 'System Administrator access is required.' };
  return { ok: true, app, ctx, db: ctx.db || app.firestore() };
}
function safeId(value = '') { return clean(value).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180); }
const REVIEW_STATUSES = new Set(['approved', 'dismissed', 'rejected', 'ignored', 'done', 'needs_review', 'reviewed']);
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  const auth = await requireSystemAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, code: 'system-admin-required', error: auth.error });
  const body = await readBody(req);
  const action = clean(body.action || '');
  const now = new Date().toISOString();
  try {
    if (action === 'set-automation-paused') {
      const workspaceId = safeId(body.workspaceId || body.restaurantId || '');
      if (!workspaceId) return res.status(400).json({ ok: false, error: 'workspaceId is required.' });
      if (typeof body.paused !== 'boolean') return res.status(400).json({ ok: false, error: 'paused boolean is required.' });
      const restSnap = await auth.db.collection('restaurants').doc(workspaceId).get();
      if (!restSnap.exists) return res.status(404).json({ ok: false, error: 'Workspace does not exist.' });
      const previousSnap = await auth.db.collection('pythonAutomationConfigs').doc(workspaceId).get();
      const previous = previousSnap.exists ? previousSnap.data() || {} : {};
      const rest = restSnap.data() || {};
      const payload = {
        restaurantId: workspaceId,
        workspaceId,
        restaurantName: rest.name || previous.restaurantName || workspaceId,
        paused: body.paused,
        jobs: previous.jobs || {},
        updatedAt: now,
        updatedBy: auth.ctx.uid || auth.ctx.email || 'system-admin',
        updatedByName: auth.ctx.user?.name || auth.ctx.email || 'System Administrator'
      };
      await auth.db.collection('pythonAutomationConfigs').doc(workspaceId).set(payload, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'PYTHON_AUTOMATION_PAUSE_UPDATED', `pythonAutomationConfigs/${workspaceId}`, `Automation paused=${body.paused}.`, workspaceId);
      return res.status(200).json({ ok: true, action, config: { id: workspaceId, ...payload } });
    }
    if (action === 'review-recommendation') {
      const recommendationId = safeId(body.recommendationId || body.id || '');
      const status = clean(body.status || '').toLowerCase();
      if (!recommendationId) return res.status(400).json({ ok: false, error: 'recommendationId is required.' });
      if (!REVIEW_STATUSES.has(status)) return res.status(400).json({ ok: false, error: 'Unsupported recommendation status.' });
      const ref = auth.db.collection('aiRecommendationQueue').doc(recommendationId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: 'Recommendation was not found.' });
      const current = snap.data() || {};
      const payload = { status, reviewedAt: now, reviewedBy: auth.ctx.uid || auth.ctx.email || '', reviewedByName: auth.ctx.user?.name || auth.ctx.email || 'System Administrator', updatedAt: now };
      await ref.set(payload, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'AI_RECOMMENDATION_REVIEWED', `aiRecommendationQueue/${recommendationId}`, `Recommendation ${current.title || recommendationId} marked ${status}.`, current.restaurantId || 'platform');
      return res.status(200).json({ ok: true, action, id: recommendationId, status });
    }
    return res.status(400).json({ ok: false, error: `Unsupported automation action: ${action}` });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || error).slice(0, 300) });
  }
};
