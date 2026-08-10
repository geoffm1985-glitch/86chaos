const { getAdminAppForRequest, authorize, clean } = require('../_chaos-admin');
const ALLOWED_COLLECTIONS = new Set(['users','restaurants','workspaceMembers','recipes','inventoryItems','vendors','invoices','shifts','timeOffRequests','shiftSwaps','events','sales','maintenanceLogs','auditLogs','crashReports','system']);
const SECRET_KEY_RE = /(privateKey|private_key|serviceAccount|credential|credentials|accessToken|refreshToken|authorization|password|passwordHash|fcmToken|fcmTokens|pushTokens|pushDevices|apiKey|secret|token)$/i;
function safeId(value = '') { return clean(value).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180); }
function redact(value, depth = 0) {
  if (depth > 8) return '[redacted-depth]';
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.slice(0, 200).map(item => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, entry]) => {
      out[key] = SECRET_KEY_RE.test(key) ? '[redacted]' : redact(entry, depth + 1);
    });
    return out;
  }
  return String(value).slice(0, 1000);
}
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET.' });
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) return res.status(ctx.status || 403).json({ ok: false, code: 'system-admin-required', error: ctx.error || 'System Administrator access is required.' });
  const collectionName = clean(req.query?.collection || '');
  const documentId = safeId(req.query?.documentId || req.query?.id || '');
  if (!ALLOWED_COLLECTIONS.has(collectionName)) return res.status(400).json({ ok: false, error: 'Unsupported inspector collection.' });
  if (!documentId) return res.status(400).json({ ok: false, error: 'documentId is required.' });
  if (collectionName === 'system' && /credential|secret|key|service/i.test(documentId)) return res.status(403).json({ ok: false, error: 'That system document is not available through the support inspector.' });
  const db = ctx.db || app.firestore();
  const snap = await db.collection(collectionName).doc(documentId).get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: 'No document found.' });
  return res.status(200).json({ ok: true, collection: collectionName, documentId, data: { id: snap.id, ...redact(snap.data() || {}) } });
};
