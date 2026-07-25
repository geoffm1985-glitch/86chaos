const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');
const { requireMfaIfEnforced } = require('./_chaos-admin');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}

async function verifySuperAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase ID token.');
  const app = initAdmin(req);
  const decoded = await app.auth().verifyIdToken(token);
  const normalizeEmail = (value) => String(value || '').toLowerCase().trim();
  const masterEmails = Array.from(new Set([process.env.MASTER_ADMIN_EMAIL, ...(process.env.MASTER_ADMIN_EMAILS || '').split(',')].map(normalizeEmail).filter(Boolean)));
  const callerEmail = normalizeEmail(decoded.email);
  const callerSnap = await app.firestore().collection('users').doc(decoded.uid).get();
  const caller = callerSnap.exists ? (callerSnap.data() || {}) : {};
  if (decoded.superAdmin !== true && caller.isSuperAdmin !== true && caller.systemAccess?.superAdmin !== true && !masterEmails.includes(callerEmail)) {
    throw new Error('Super admin access required.');
  }
  const mfa = requireMfaIfEnforced(decoded, caller, true);
  if (!mfa.ok) throw new Error(mfa.error);
  return decoded;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await verifySuperAdmin(req);
    const app = initAdmin(req);
    const { action, email } = req.body || {};
    const targetEmail = (email || '').toLowerCase().trim();
    if (!['grant', 'revoke'].includes(action)) return res.status(400).json({ error: 'Use action grant or revoke.' });
    if (!targetEmail) return res.status(400).json({ error: 'Email is required.' });

    const target = await app.auth().getUserByEmail(targetEmail);
    const currentClaims = target.customClaims || {};
    const nextClaims = { ...currentClaims };
    if (action === 'grant') nextClaims.superAdmin = true;
    if (action === 'revoke') delete nextClaims.superAdmin;
    await app.auth().setCustomUserClaims(target.uid, nextClaims);

    await app.firestore().collection('users').doc(target.uid).set({
      email: targetEmail,
      isSuperAdmin: action === 'grant',
      superAdminUpdatedAt: new Date().toISOString(),
      superAdminUpdatedBy: caller.email || caller.uid,
      superAdminAccessSource: 'api/admin-access'
    }, { merge: true });

    await app.firestore().collection('auditLogs').add({
      userId: caller.uid,
      userName: caller.email || 'System Admin',
      action: action === 'grant' ? 'GRANT_SUPER_ADMIN' : 'REVOKE_SUPER_ADMIN',
      target: target.uid,
      details: `${action} superAdmin custom claim for ${targetEmail}`,
      timestamp: new Date().toISOString(),
      restaurantId: 'system',
      isGhost: false
    }).catch(() => {});

    return res.status(200).json({ ok: true, uid: target.uid, email: targetEmail, action, claims: nextClaims });
  } catch (err) {
    return res.status(403).json({ error: err.message || 'Access update failed.' });
  }
};
