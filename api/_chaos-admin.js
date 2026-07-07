const admin = require('firebase-admin');
const zlib = require('zlib');

function norm(v) { return String(v || '').toLowerCase().trim(); }
function clean(v, fallback = '') { return String(v == null ? fallback : v).trim(); }
function memberDocId(uid, restaurantId) { return `${clean(uid).replace(/[^A-Za-z0-9_-]/g, '_')}_${clean(restaurantId).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240); }
function userHasWorkspace(user, restaurantId) { return Boolean(user?.restaurantId === restaurantId || user?.activeRestaurantId === restaurantId || user?.defaultRestaurantId === restaurantId || user?.workspaceIds?.includes?.(restaurantId) || user?.memberships?.[restaurantId]?.isActive === true); }
async function readWorkspaceMember(db, uid, email, restaurantId) {
  if (!restaurantId) return null;
  const direct = await db.collection('workspaceMembers').doc(memberDocId(uid, restaurantId)).get();
  if (direct.exists && direct.data()?.isActive !== false) return { id: direct.id, ...direct.data() };
  if (email) {
    const snap = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).where('email', '==', norm(email)).limit(1).get();
    if (!snap.empty && snap.docs[0].data()?.isActive !== false) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
}
function profileForWorkspace(user, member, restaurantId) {
  const legacy = user?.restaurantId === restaurantId || user?.activeRestaurantId === restaurantId || user?.defaultRestaurantId === restaurantId;
  const source = member || (legacy ? user : {});
  return {
    ...(user || {}),
    ...(source || {}),
    id: user?.id,
    restaurantId,
    permissions: { ...((legacy && user?.permissions) || {}), ...(source?.permissions || {}) },
    isAdmin: source?.isAdmin === true || (legacy && user?.isAdmin === true),
    isOwner: source?.isOwner === true || source?.accountOwner === true || source?.workspaceOwner === true || (legacy && (user?.isOwner === true || user?.accountOwner === true || user?.workspaceOwner === true || norm(user?.accountRole) === 'owner'))
  };
}
function masterEmails() {
  return [process.env.MASTER_ADMIN_EMAIL, process.env.MASTER_ADMIN_EMAILS, 'geoffm1985@gmail.com', 'geoffrm1985@gmail.com']
    .filter(Boolean).flatMap(v => String(v).split(',')).map(norm).filter(Boolean);
}
function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (raw) {
    try { return JSON.parse(raw); }
    catch (_) { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.'); }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
}
function initAdmin() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = loadServiceAccount();
  const projectId = serviceAccount.project_id || serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Missing Firebase service account project id.');
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket });
}
async function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}
async function authorize(req, app, { allowTenantAdmin = false, targetRestaurantId = '' } = {}) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Missing Firebase authorization token.' };
  try {
    const decoded = await app.auth().verifyIdToken(token);
    const db = app.firestore();
    const email = norm(decoded.email);
    let userSnap = await db.collection('users').doc(decoded.uid).get();
    let userDocId = decoded.uid;
    let user = userSnap.exists ? userSnap.data() : null;
    if (!user && email) {
      const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!byEmail.empty) { userSnap = byEmail.docs[0]; userDocId = userSnap.id; user = userSnap.data(); }
    }
    const isSuperAdmin = Boolean(decoded.superAdmin === true || user?.isSuperAdmin === true || user?.systemAccess?.superAdmin === true || masterEmails().includes(email));
    const restaurantId = clean(targetRestaurantId || user?.activeRestaurantId || user?.restaurantId || user?.defaultRestaurantId || '');
    const member = restaurantId && !isSuperAdmin ? (userHasWorkspace(user, restaurantId) ? (user?.memberships?.[restaurantId] || null) : await readWorkspaceMember(db, decoded.uid, email, restaurantId)) : null;
    const workspaceUser = profileForWorkspace({ ...(user || {}), id: userDocId }, member, restaurantId);
    const permissions = workspaceUser?.permissions || {};
    const tenantAdmin = Boolean(allowTenantAdmin && restaurantId && (isSuperAdmin || member || userHasWorkspace(user, restaurantId)) && (workspaceUser?.isAdmin === true || workspaceUser?.isOwner === true || workspaceUser?.accountOwner === true || permissions.settings === true || permissions.team === true));
    if (!isSuperAdmin && !tenantAdmin) return { ok: false, status: 403, error: 'System Administrator access is required for this tool.' };
    return { ok: true, decoded, uid: decoded.uid, userDocId, email: decoded.email || '', user: workspaceUser || user || {}, accountUser: user || {}, workspaceMember: member, isSuperAdmin, restaurantId, permissions };
  } catch (err) {
    return { ok: false, status: 401, error: `Invalid authorization token: ${err.message}` };
  }
}
function isGzipBuffer(buffer) { return buffer && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b; }
function parseBackupBuffer(buffer) {
  const text = isGzipBuffer(buffer) ? zlib.gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
  const backup = JSON.parse(text);
  return { backup, storageFormat: isGzipBuffer(buffer) ? 'gzip' : 'plain-json' };
}
function serializeIssue(severity, collection, id, message, repairable = false, field = '') {
  return { severity, collection, id, field, message, repairable };
}
async function writeAudit(db, ctx, action, target, details, restaurantId = '') {
  try {
    await db.collection('auditLogs').add({
      userId: ctx.userDocId || ctx.uid || 'system',
      userName: ctx.user?.name || ctx.email || 'System Administrator',
      userEmail: ctx.email || '',
      action, target, details,
      timestamp: new Date().toISOString(),
      restaurantId: restaurantId || ctx.restaurantId || 'system',
      securityLevel: 'system'
    });
  } catch (_) {}
}
module.exports = { admin, initAdmin, readBody, authorize, parseBackupBuffer, serializeIssue, writeAudit, norm, clean, masterEmails, memberDocId, userHasWorkspace, readWorkspaceMember, profileForWorkspace };
