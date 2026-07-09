const admin = require('firebase-admin');

function norm(value = '') { return String(value || '').toLowerCase().trim(); }

function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (raw) {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined });
    return admin;
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
  });
  return admin;
}

function boolEnv(name) {
  return /^(1|true|yes|enforce)$/i.test(String(process.env[name] || '').trim());
}

function mfaEnforcementEnabled() {
  return boolEnv('MFA_ENFORCE_ELEVATED_ROLES') || boolEnv('FIREBASE_MFA_ENFORCE_ELEVATED_ROLES') || boolEnv('REACT_APP_MFA_ENFORCE_ELEVATED_ROLES');
}

function decodedHadSecondFactor(decoded = {}) {
  const firebase = decoded.firebase || {};
  return Boolean(firebase.sign_in_second_factor || firebase.second_factor_identifier || decoded.sign_in_second_factor || decoded.mfa === true);
}

function roleNeedsMfa(user = {}, decoded = {}) {
  const role = norm(user.role || user.accountRole || decoded.role || '');
  return Boolean(
    decoded.superAdmin === true ||
    user.isSuperAdmin === true ||
    user.systemAccess?.superAdmin === true ||
    user.isAdmin === true ||
    user.isOwner === true ||
    user.accountOwner === true ||
    user.owner === true ||
    user.workspaceOwner === true ||
    ['owner', 'manager', 'admin', 'general manager', 'super admin', 'system administrator'].some(token => role.includes(token))
  );
}

function factorSummary(authUser = {}) {
  const factors = authUser.multiFactor?.enrolledFactors || [];
  return factors.map(factor => ({
    uid: factor.uid || '',
    displayName: factor.displayName || 'SMS two-step login',
    factorId: factor.factorId || 'phone',
    phoneNumberMasked: factor.phoneNumber ? `••••${String(factor.phoneNumber).slice(-4)}` : '',
    enrollmentTime: factor.enrollmentTime || ''
  }));
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase ID token.' });

    const app = initAdmin();
    const decoded = await app.auth().verifyIdToken(token);
    const authUser = await app.auth().getUser(decoded.uid);
    const db = app.firestore();
    const userRef = db.collection('users').doc(decoded.uid);
    const snap = await userRef.get();
    const user = snap.exists ? snap.data() : { email: decoded.email || authUser.email || '' };
    const factors = factorSummary(authUser);
    const enabled = factors.length > 0;
    const elevated = roleNeedsMfa(user, decoded);
    const secondFactorThisSession = decodedHadSecondFactor(decoded);
    const now = new Date().toISOString();
    const payload = {
      emailVerified: authUser.emailVerified === true,
      mfaEnabled: enabled,
      multiFactorEnabled: enabled,
      mfaFactorCount: factors.length,
      mfaMethods: factors.map(f => f.factorId || 'phone'),
      mfaRequired: elevated,
      mfaLastSyncAt: now,
      accountSecurity: {
        ...(user.accountSecurity || {}),
        emailVerified: authUser.emailVerified === true,
        mfaEnabled: enabled,
        multiFactorEnabled: enabled,
        mfaFactorCount: factors.length,
        mfaMethods: factors.map(f => f.factorId || 'phone'),
        mfaFactors: factors,
        mfaRequired: elevated,
        mfaEnforcementReady: elevated && enabled,
        mfaEnforcementEnabled: mfaEnforcementEnabled(),
        secondFactorThisSession,
        lastSecondFactorAt: secondFactorThisSession ? now : (user.accountSecurity?.lastSecondFactorAt || ''),
        lastSyncAt: now
      }
    };

    await userRef.set(payload, { merge: true }).catch(() => null);
    await db.collection('auditLogs').add({
      userId: decoded.uid,
      userName: user.name || decoded.email || authUser.email || 'User',
      userEmail: decoded.email || authUser.email || '',
      action: 'ACCOUNT_SECURITY_SYNC',
      target: decoded.uid,
      details: `Account security synced. emailVerified=${authUser.emailVerified === true}; mfaEnabled=${enabled}; factors=${factors.length}; elevated=${elevated}; secondFactorThisSession=${secondFactorThisSession}`,
      timestamp: now,
      restaurantId: user.activeRestaurantId || user.restaurantId || user.defaultRestaurantId || 'system',
      securityLevel: 'account-security'
    }).catch(() => null);

    return res.status(200).json({
      ok: true,
      uid: decoded.uid,
      email: decoded.email || authUser.email || '',
      emailVerified: authUser.emailVerified === true,
      mfaEnabled: enabled,
      multiFactorEnabled: enabled,
      mfaFactorCount: factors.length,
      factors,
      elevatedRole: elevated,
      mfaRequired: elevated,
      mfaEnforcementEnabled: mfaEnforcementEnabled(),
      secondFactorThisSession,
      syncedAt: now
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Account security sync failed.' });
  }
};
