const { getAdminAppForRequest, authorize, readBody, writeAudit, clean } = require('../_chaos-admin');

const ROLE_MANAGER_ROLES = new Set(['Owner', 'Super Admin', 'Admin', 'Manager', 'Kitchen Lead', 'Bartender', 'Server', 'Staff']);
const ROLE_MANAGER_PERMISSION_KEYS = new Set(['staffEditing', 'scheduleEditing', 'financials', 'inventoryEditing', 'recipeEditing', 'adminAccess', 'forensicsAccess']);
const RETENTION_ALLOWED_KEYS = new Set(['policySource','policyVersion','activeCoreData','transientDays','rawAiDays','deletedWorkspaceDays','backupDays','auditSecurityDays','workforceArchiveAfterDays','workforceDeleteAfterYears','notes','app','appVersion','updatedAt','updatedBy','automations','requiredFunctionEnv','setupStatus']);
function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function sanitizeValue(value, depth = 0) {
  if (depth > 8) return null;
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, entry]) => { out[String(key).slice(0, 80)] = sanitizeValue(entry, depth + 1); });
    return out;
  }
  return String(value || '').slice(0, 1000);
}
function validateRetentionPayload(raw) {
  const input = requirePlainObject(raw, 'retention payload');
  const out = {};
  Object.entries(input).forEach(([key, value]) => {
    if (!RETENTION_ALLOWED_KEYS.has(key)) throw new Error(`Unsupported retention field: ${key}`);
    out[key] = sanitizeValue(value);
  });
  out.updatedAt = new Date().toISOString();
  return out;
}
function validateRoleMatrix(raw) {
  const matrix = requirePlainObject(raw, 'role permission matrix');
  const out = {};
  Object.entries(matrix).forEach(([role, permissions]) => {
    if (!ROLE_MANAGER_ROLES.has(role)) throw new Error(`Unsupported role: ${role}`);
    const permissionMap = requirePlainObject(permissions, `${role} permissions`);
    out[role] = {};
    Object.entries(permissionMap).forEach(([key, value]) => {
      if (!ROLE_MANAGER_PERMISSION_KEYS.has(key)) throw new Error(`Unsupported permission: ${key}`);
      if (typeof value !== 'boolean') throw new Error(`Permission ${role}.${key} must be boolean.`);
      out[role][key] = value;
    });
  });
  return out;
}
async function requireSystemAdmin(req) {
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) return { ok: false, status: ctx.status || 403, error: ctx.error || 'System Administrator access is required.' };
  return { ok: true, app, ctx, db: ctx.db || app.firestore() };
}
module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  const auth = await requireSystemAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, code: 'system-admin-required', error: auth.error });
  const body = await readBody(req);
  const action = clean(body.action || '');
  const now = new Date().toISOString();
  try {
    if (action === 'update-data-retention') {
      const payload = validateRetentionPayload(body.payload || body.dataRetention || {});
      payload.updatedBy = payload.updatedBy || auth.ctx.email || auth.ctx.uid || 'System Administrator';
      await auth.db.collection('system').doc('dataRetention').set(payload, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'DATA_RETENTION_CONFIG_INITIALIZED', 'system/dataRetention', 'Legal data retention configuration updated through server System Administrator platform-config.', 'platform');
      return res.status(200).json({ ok: true, action, dataRetention: { id: 'dataRetention', ...payload } });
    }
    if (action === 'update-role-permission-matrix') {
      const matrix = validateRoleMatrix(body.matrix || body.payload || {});
      const payload = { matrix, updatedAt: now, updatedBy: auth.ctx.email || auth.ctx.uid || 'System Administrator' };
      await auth.db.collection('system').doc('rolePermissionMatrix').set(payload, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'ROLE_PERMISSION_MATRIX_UPDATED', 'system/rolePermissionMatrix', 'Platform role permission guide updated through server System Administrator platform-config.', 'platform');
      return res.status(200).json({ ok: true, action, rolePermissionMatrix: { id: 'rolePermissionMatrix', ...payload } });
    }
    if (action === 'stamp-operations-review') {
      const payload = sanitizeValue(requirePlainObject(body.payload || {}, 'operations review payload'));
      payload.lastReviewedAt = now;
      payload.lastReviewedBy = auth.ctx.email || auth.ctx.uid || 'System Administrator';
      await auth.db.collection('system').doc('operationsReview').set(payload, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'SYSTEM_OPERATIONS_REVIEW_STAMP', 'system/operationsReview', `Operations review stamped. Status: ${clean(payload.platformStatus || 'unknown')}.`, 'platform');
      return res.status(200).json({ ok: true, action, operationsReview: { id: 'operationsReview', ...payload } });
    }
    return res.status(400).json({ ok: false, error: `Unsupported platform-config action: ${action}` });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || error).slice(0, 300) });
  }
};
module.exports._test = { validateRetentionPayload, validateRoleMatrix };
