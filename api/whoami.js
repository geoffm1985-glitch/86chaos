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
    const decoded = await initAdmin().auth().verifyIdToken(token);
    res.status(200).json({ uid: decoded.uid, email: decoded.email, superAdmin: decoded.superAdmin === true, claims: decoded });
  } catch (err) { res.status(401).json({ error: err.message }); }
};
