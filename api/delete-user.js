const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');
const { requireMfaIfEnforced, masterEmails } = require('./_chaos-admin');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}

async function verifySuperAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase ID token.');
  const app = initAdmin(req);
  const decoded = await app.auth().verifyIdToken(token);
  const db = app.firestore();
  const email = String(decoded.email || '').toLowerCase().trim();
  let profileSnap = await db.collection('users').doc(decoded.uid).get();
  let profile = profileSnap.exists ? (profileSnap.data() || {}) : {};
  if (!profileSnap.exists && email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) profile = byEmail.docs[0].data() || {};
  }
  const isSuperAdmin = decoded.superAdmin === true || profile.isSuperAdmin === true || profile.systemAccess?.superAdmin === true || masterEmails().includes(email);
  if (!isSuperAdmin) throw new Error('Super admin access required.');
  const mfa = requireMfaIfEnforced(decoded, profile, true);
  if (!mfa.ok) throw new Error(mfa.error);
  return decoded;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await verifySuperAdmin(req);
    const app = initAdmin(req);
    const { targetUid } = req.body || {};
    if (!targetUid) return res.status(400).json({ error: 'targetUid is required.' });
    if (targetUid === caller.uid) return res.status(400).json({ error: 'Refusing to delete the signed-in admin account.' });

    const protectedEmails = new Set(masterEmails());
    let targetEmail = '';
    let targetProfile = null;
    try {
      const target = await app.auth().getUser(targetUid);
      targetEmail = (target.email || '').toLowerCase();
      const profileSnap = await app.firestore().collection('users').doc(targetUid).get();
      targetProfile = profileSnap.exists ? profileSnap.data() : null;
      const targetIsProtectedAdmin = protectedEmails.has(targetEmail) || target.customClaims?.superAdmin === true || targetProfile?.isSuperAdmin === true || targetProfile?.systemAccess?.superAdmin === true;
      if (targetIsProtectedAdmin) return res.status(400).json({ error: 'Refusing to delete a protected administrator. Revoke administrator access first, then review again.' });
      await app.auth().deleteUser(targetUid);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') throw authErr;
    }

    await app.firestore().collection('users').doc(targetUid).delete().catch(() => {});
    await app.firestore().collection('auditLogs').add({
      userId: caller.uid,
      userName: caller.email || 'System Admin',
      action: 'DELETE_USER',
      target: targetUid,
      details: `Deleted auth/profile for ${targetEmail || targetUid}`,
      timestamp: new Date().toISOString(),
      restaurantId: 'system',
      isGhost: false
    }).catch(() => {});

    res.status(200).json({ ok: true, deletedUid: targetUid, email: targetEmail });
  } catch (err) {
    res.status(403).json({ error: err.message || 'Delete failed.' });
  }
};
