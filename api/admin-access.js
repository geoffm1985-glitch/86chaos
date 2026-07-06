const admin = require('firebase-admin');

function getMasterEmails() {
  const raw = [process.env.MASTER_ADMIN_EMAILS, process.env.MASTER_ADMIN_EMAIL, 'geoffrm1985@gmail.com', 'geoffm1985@gmail.com'].filter(Boolean).join(',');
  return new Set(String(raw).split(/[\s,;]+/).map(e => e.toLowerCase().trim()).filter(Boolean));
}
function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin;
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
  return admin;
}

async function verifySuperAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase ID token.');
  const app = initAdmin();
  const decoded = await app.auth().verifyIdToken(token);
  const masterEmails = getMasterEmails();
  if (decoded.superAdmin !== true && !masterEmails.has((decoded.email || '').toLowerCase().trim())) {
    throw new Error('Super admin access required.');
  }
  return decoded;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await verifySuperAdmin(req);
    const app = initAdmin();
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
