const admin = require('firebase-admin');
function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) }), admin;
  admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
  return admin;
}
module.exports = async function handler(req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const app = initAdmin();
    const decoded = await app.auth().verifyIdToken(token);
    const masterEmail = (process.env.MASTER_ADMIN_EMAIL || 'geoffm1985@gmail.com').toLowerCase();
    if (decoded.superAdmin !== true && (decoded.email || '').toLowerCase() !== masterEmail) return res.status(403).json({ error: 'Super admin required' });
    const checks = {
      firebaseAdmin: true,
      projectId: process.env.FIREBASE_PROJECT_ID || (process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'from service account json' : 'missing'),
      masterEmailConfigured: !!process.env.MASTER_ADMIN_EMAIL,
      appCheckHeaderReceived: !!req.headers['x-firebase-appcheck'],
      caller: { uid: decoded.uid, email: decoded.email, superAdmin: decoded.superAdmin === true }
    };
    res.status(200).json({ ok: true, checks, generatedAt: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
