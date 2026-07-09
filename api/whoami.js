const admin = require('firebase-admin');
function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) }), admin;
  admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
  return admin;
}
function normalizeEmail(value) { return String(value || '').toLowerCase().trim(); }
function configuredMasterEmails() {
  return Array.from(new Set([
    process.env.MASTER_ADMIN_EMAIL,
    ...(process.env.MASTER_ADMIN_EMAILS || '').split(',')
  ].map(normalizeEmail).filter(Boolean)));
}
module.exports = async function handler(req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
    const firebaseAdmin = initAdmin();
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const callerEmail = normalizeEmail(decoded.email);
    const masterEmails = configuredMasterEmails();
    const serverMasterAdminMatched = !!callerEmail && masterEmails.includes(callerEmail);

    let firestoreProfile = null;
    try {
      const db = firebaseAdmin.firestore();
      const direct = decoded.uid ? await db.collection('users').doc(decoded.uid).get() : null;
      if (direct?.exists) firestoreProfile = { id: direct.id, ...direct.data() };
      if (!firestoreProfile && callerEmail) {
        const byEmail = await db.collection('users').where('email', '==', callerEmail).limit(1).get();
        if (!byEmail.empty) firestoreProfile = { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
      }
    } catch (profileErr) {
      firestoreProfile = { profileReadError: profileErr?.message || 'Could not read profile.' };
    }

    const firestoreSuperAdmin = Boolean(
      firestoreProfile?.isSuperAdmin === true ||
      firestoreProfile?.systemAccess?.superAdmin === true
    );
    const customClaimSuperAdmin = decoded.superAdmin === true;
    const superAdmin = Boolean(customClaimSuperAdmin || serverMasterAdminMatched || firestoreSuperAdmin);

    res.status(200).json({
      ok: true,
      uid: decoded.uid,
      email: decoded.email,
      superAdmin,
      customClaimSuperAdmin,
      serverMasterAdminMatched,
      firestoreSuperAdmin,
      masterAdminEnvConfigured: masterEmails.length > 0,
      masterAdminEmailCount: masterEmails.length,
      firestoreProfileFound: !!(firestoreProfile && !firestoreProfile.profileReadError),
      firestoreProfileId: firestoreProfile?.id || '',
      firestoreProfileRole: firestoreProfile?.role || '',
      firestoreRestaurantId: firestoreProfile?.restaurantId || '',
      claims: decoded
    });
  } catch (err) { res.status(401).json({ ok: false, error: err.message }); }
};
