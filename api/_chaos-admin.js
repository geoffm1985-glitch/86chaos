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
function parseMasterEmailEnv() {
  const rawValues = [process.env.MASTER_ADMIN_EMAIL, process.env.MASTER_ADMIN_EMAILS]
    .filter(Boolean)
    .flatMap(v => String(v).split(/[\s,;]+/));
  const skipped = [];
  const valid = [];
  const seen = new Set();
  for (const raw of rawValues) {
    const email = norm(raw);
    if (!email) continue;
    const looksPlaceholder = /^(second_admin_email_here|admin@example\.com|your-email@example\.com|email@example\.com|none|null|undefined|todo|replace_me)$/i.test(email) || email.includes('placeholder') || email.includes('<') || email.includes('>');
    const looksEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (looksPlaceholder || !looksEmail) {
      skipped.push({ value: email, reason: looksPlaceholder ? 'placeholder' : 'invalid-email-format' });
      continue;
    }
    if (!seen.has(email)) {
      seen.add(email);
      valid.push(email);
    }
  }
  return { valid, skipped, rawCount: rawValues.filter(v => String(v || '').trim()).length };
}
function masterEmails() {
  return parseMasterEmailEnv().valid;
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

function boolEnv(name) { return ['true', '1', 'yes', 'enforce'].includes(String(process.env[name] || '').toLowerCase().trim()); }
function mfaEnforcementEnabled() { return boolEnv('MFA_ENFORCE_ELEVATED_ROLES') || boolEnv('FIREBASE_MFA_ENFORCE_ELEVATED_ROLES') || boolEnv('REACT_APP_MFA_ENFORCE_ELEVATED_ROLES'); }
function decodedHasMfa(decoded = {}) { const fb = decoded.firebase || {}; return Boolean(fb.sign_in_second_factor || fb.second_factor_identifier || decoded.sign_in_second_factor || decoded.mfa === true); }
function roleNeedsMfa(user = {}, decoded = {}, isSuperAdmin = false) {
  const role = norm(user.role || user.accountRole || decoded.role || '');
  return Boolean(isSuperAdmin || decoded.superAdmin === true || user.isSuperAdmin === true || user.systemAccess?.superAdmin === true || user.isAdmin === true || user.isOwner === true || user.accountOwner === true || user.owner === true || user.workspaceOwner === true || ['owner', 'manager', 'admin', 'general manager', 'super admin', 'system administrator'].some(token => role.includes(token)));
}
function requireMfaIfEnforced(decoded = {}, user = {}, isSuperAdmin = false) {
  if (!mfaEnforcementEnabled()) return { ok: true, enforced: false };
  if (!roleNeedsMfa(user, decoded, isSuperAdmin)) return { ok: true, enforced: true, required: false };
  if (decodedHasMfa(decoded)) return { ok: true, enforced: true, required: true };
  return { ok: false, status: 403, error: 'Two-step login is required for this elevated account. Log out, sign in again, and complete MFA before using protected admin tools.' };
}

function appCheckEnforced() {
  return ['true', '1', 'yes', 'enforce'].includes(String(process.env.APP_CHECK_ENFORCE || '').toLowerCase().trim());
}
async function requireAppCheckIfEnforced(app, req) {
  if (!appCheckEnforced()) return { ok: true, enforced: false };
  const token = String(req.headers['x-firebase-appcheck'] || req.headers['X-Firebase-AppCheck'] || '').trim();
  if (!token) return { ok: false, status: 401, error: 'App Check verification is required. Refresh the app after deployment and try again.' };
  try {
    const verifier = typeof app?.appCheck === 'function' ? app.appCheck() : (typeof admin.appCheck === 'function' ? admin.appCheck(app) : null);
    if (!verifier || typeof verifier.verifyToken !== 'function') throw new Error('Firebase Admin App Check verifier is not available in this runtime.');
    await verifier.verifyToken(token);
    return { ok: true, enforced: true };
  } catch (err) {
    return { ok: false, status: 401, error: `App Check verification failed: ${err.message}` };
  }
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
    const mfa = requireMfaIfEnforced(decoded, workspaceUser || user || {}, isSuperAdmin);
    if (!mfa.ok) return mfa;
    return { ok: true, decoded, uid: decoded.uid, userDocId, email: decoded.email || '', user: workspaceUser || user || {}, accountUser: user || {}, workspaceMember: member, isSuperAdmin, restaurantId, permissions, mfa };
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
module.exports = { admin, initAdmin, readBody, authorize, requireAppCheckIfEnforced, parseBackupBuffer, serializeIssue, writeAudit, norm, clean, masterEmails, parseMasterEmailEnv, memberDocId, userHasWorkspace, readWorkspaceMember, profileForWorkspace, mfaEnforcementEnabled, decodedHasMfa, roleNeedsMfa, requireMfaIfEnforced };
