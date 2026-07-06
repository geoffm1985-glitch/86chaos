const admin = require('firebase-admin');

function getMasterEmails() {
  const raw = [process.env.MASTER_ADMIN_EMAILS, process.env.MASTER_ADMIN_EMAIL, 'geoffrm1985@gmail.com', 'geoffm1985@gmail.com'].filter(Boolean).join(',');
  return new Set(String(raw).split(/[\s,;]+/).map(e => e.toLowerCase().trim()).filter(Boolean));
}
function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) }), admin;
  admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
  return admin;
}

async function verifySuperAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase ID token.');
  const app = initAdmin();
  const decoded = await app.auth().verifyIdToken(token);
  const masterEmails = getMasterEmails();
  if (decoded.superAdmin !== true && !masterEmails.has((decoded.email || '').toLowerCase().trim())) throw new Error('Super admin access required.');
  return decoded;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await verifySuperAdmin(req);
    const app = initAdmin();
    const { targetUid } = req.body || {};
    if (!targetUid) return res.status(400).json({ error: 'targetUid is required.' });
    if (targetUid === caller.uid) return res.status(400).json({ error: 'Refusing to delete the signed-in admin account.' });

    const masterEmails = getMasterEmails();
    let targetEmail = '';
    try {
      const target = await app.auth().getUser(targetUid);
      targetEmail = (target.email || '').toLowerCase();
      if (masterEmails.has(targetEmail)) return res.status(400).json({ error: 'Refusing to delete master admin.' });
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
