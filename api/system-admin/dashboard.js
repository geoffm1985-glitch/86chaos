const { admin, getAdminAppForRequest, authorize, clean } = require('../_chaos-admin');
const { safePlatformUser } = require('../system-admin-safe-rows.cjs');

const SECTION_ALLOWLIST = new Set(['core', 'forensics', 'ops', 'security']);
const SECRET_KEY_RE = /(privateKey|private_key|serviceAccount|credential|credentials|accessToken|refreshToken|authorization|password|passwordHash|fcmToken|fcmTokens|pushTokens|pushDevices|apiKey|secret|token)$/i;

function toIso(value) {
  if (!value) return '';
  try {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : '';
    if (typeof value.toDate === 'function') return toIso(value.toDate());
    if (typeof value.seconds === 'number') return new Date((value.seconds * 1000) + Math.floor((Number(value.nanoseconds || 0) || 0) / 1e6)).toISOString();
  } catch (_) {}
  return value;
}
function sanitizeValue(value, depth = 0) {
  if (depth > 8) return '[redacted-depth]';
  if (value == null) return value;
  if (typeof value === 'string') return value.slice(0, 5000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const iso = toIso(value);
  if (iso !== value) return iso;
  if (Array.isArray(value)) return value.slice(0, 200).map(item => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (SECRET_KEY_RE.test(key)) return;
      out[key] = sanitizeValue(entry, depth + 1);
    });
    return out;
  }
  return String(value).slice(0, 1000);
}
function safeRecord(docSnap) {
  return { id: docSnap.id, ...sanitizeValue(docSnap.data() || {}) };
}
async function listDocs(db, collectionName, { orderBy = admin.firestore.FieldPath.documentId(), direction = 'asc', limit = 50, where = null } = {}) {
  let q = db.collection(collectionName);
  if (where) q = q.where(where.field, where.op, where.value);
  q = q.orderBy(orderBy, direction).limit(limit);
  const snap = await q.get();
  const rows = snap.docs.map(safeRecord);
  return { rows, count: rows.length, limit, truncated: snap.size >= limit };
}
async function readSystemDoc(db, id) {
  const snap = await db.collection('system').doc(id).get();
  return snap.exists ? { id: snap.id, ...sanitizeValue(snap.data() || {}) } : null;
}
async function loadCore(db) {
  const [superAdminSnap, pricing, dataRetention, rolePermissionMatrix, operationsReview] = await Promise.all([
    db.collection('users').where('isSuperAdmin', '==', true).limit(25).get(),
    readSystemDoc(db, 'pricing'),
    readSystemDoc(db, 'dataRetention'),
    readSystemDoc(db, 'rolePermissionMatrix'),
    readSystemDoc(db, 'operationsReview')
  ]);
  return {
    superAdmins: superAdminSnap.docs.map(doc => safePlatformUser(doc)),
    pricing,
    dataRetention,
    rolePermissionMatrix,
    operationsReview
  };
}
async function loadForensics(db) {
  const [crashReports, auditLogs] = await Promise.all([
    listDocs(db, 'crashReports', { orderBy: 'time', direction: 'desc', limit: 50 }),
    listDocs(db, 'auditLogs', { orderBy: 'timestamp', direction: 'desc', limit: 100 })
  ]);
  return { crashReports, auditLogs };
}
async function loadOps(db) {
  const [restaurantAdminAlerts, opsIntelligenceReports, pythonAutomationRuns, pythonAutomationConfigs] = await Promise.all([
    listDocs(db, 'restaurantAdminAlerts', { where: { field: 'status', op: '==', value: 'open' }, orderBy: 'updatedAt', direction: 'desc', limit: 40 }),
    listDocs(db, 'opsIntelligenceReports', { orderBy: 'createdAt', direction: 'desc', limit: 50 }),
    listDocs(db, 'pythonAutomationRuns', { orderBy: 'startedAt', direction: 'desc', limit: 50 }),
    listDocs(db, 'pythonAutomationConfigs', { limit: 120 })
  ]);
  return { restaurantAdminAlerts, opsIntelligenceReports, pythonAutomationRuns, pythonAutomationConfigs };
}
async function loadSecurity(db) {
  const accountDeletionRequests = await listDocs(db, 'accountDeletionRequests', { orderBy: 'updatedAt', direction: 'desc', limit: 50 });
  return { accountDeletionRequests };
}
function parseSections(value = '') {
  const sections = String(value || 'core').split(',').map(part => clean(part)).filter(Boolean);
  const unique = [...new Set(sections)];
  if (!unique.length) return ['core'];
  const invalid = unique.filter(section => !SECTION_ALLOWLIST.has(section));
  if (invalid.length) throw new Error(`Unsupported System Administrator dashboard section: ${invalid.join(', ')}`);
  return unique;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET.' });
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) return res.status(ctx.status || 403).json({ ok: false, code: 'system-admin-required', error: ctx.error || 'System Administrator access is required.' });
  try {
    const sections = parseSections(req.query?.sections || 'core');
    const db = ctx.db || app.firestore();
    const out = { ok: true, source: 'server', sections, projectId: app.options?.projectId || '', fetchedAt: new Date().toISOString() };
    if (sections.includes('core')) out.core = await loadCore(db);
    if (sections.includes('forensics')) out.forensics = await loadForensics(db);
    if (sections.includes('ops')) out.ops = await loadOps(db);
    if (sections.includes('security')) out.security = await loadSecurity(db);
    return res.status(200).json(out);
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || error).slice(0, 300) });
  }
};
module.exports._test = { sanitizeValue, parseSections };
