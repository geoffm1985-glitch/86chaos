const { admin, initAdmin, norm, clean, parseMasterEmailEnv, masterEmails: getMasterEmails } = require('./_chaos-admin');
const { protectedRootAdminEmails } = require('./_protected-root-admin');
const { decidePlatformAdminAuthority } = require('./_platform-admin-authority.cjs');
const { APP_VERSION } = require('./_version');

function getAuthClient(app) {
  if (app && typeof app.auth === 'function') return app.auth();
  return admin.auth(app);
}
function getDbClient(app) {
  if (app && typeof app.firestore === 'function') return app.firestore();
  return admin.firestore(app);
}
function getRuntimeProjectId(app) {
  const fromApp = clean(app?.options?.projectId || '');
  if (fromApp) return fromApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS || '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return clean(parsed.project_id || parsed.projectId || '');
    } catch (_) {}
  }
  return clean(process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '');
}

function authFailureStatus(error = {}) {
  const code = String(error.code || error.errorInfo?.code || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  if (/id-token|argument|auth\/|jwt|token|credential|expired|revoked|invalid|malformed/.test(`${code} ${message}`)) return 401;
  return 503;
}

function respondTemporary(res, status, category, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    version: APP_VERSION,
    appVersion: APP_VERSION,
    superAdmin: false,
    platformSuperAdmin: false,
    retryable: true,
    reasonCategory: category,
    error: message,
    platformAuthority: {
      superAdmin: false,
      protected: false,
      authoritative: false,
      temporarilyUnavailable: true,
      source: '',
      workspaceRole: '',
      restaurantRole: ''
    },
    platformAuthorityProtected: false,
    platformAuthorityAuthoritative: false,
    platformAuthorityTemporarilyUnavailable: true,
    ...extra
  });
}

function publicPlatformPayload({ app, decoded, firestoreProfile, platformAuthority, masterEmails, masterEmailConfig, serverMasterAdminMatched }) {
  const firestoreProfileRoleText = platformAuthority.firestoreRoleText || '';
  const firestoreRoleLooksSystemAdmin = /system\s*administrator|super\s*admin|master\s*admin/i.test(firestoreProfileRoleText);
  const firestoreSuperAdminFlag = platformAuthority.firestoreSuperAdminFlag === true;
  const firestoreSuperAdmin = platformAuthority.firestoreSuperAdmin === true;
  const firestoreSystemAdministrator = firestoreSuperAdmin;
  const customClaimSuperAdmin = platformAuthority.customClaimSuperAdmin === true;
  const protectedRootAdminMatched = platformAuthority.protectedRootAdminMatched === true;
  const superAdmin = platformAuthority.superAdmin === true;
  return {
    ok: true,
    version: APP_VERSION,
    appVersion: APP_VERSION,
    runtime: {
      firebaseProjectId: getRuntimeProjectId(app),
      firebaseStorageBucket: clean(app?.options?.storageBucket || process.env.FIREBASE_STORAGE_BUCKET || ''),
      vercelEnv: clean(process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown')
    },
    uid: decoded.uid,
    email: decoded.email,
    superAdmin,
    platformSuperAdmin: superAdmin,
    platformAuthority: {
      superAdmin,
      protected: platformAuthority.protected === true,
      authoritative: platformAuthority.authoritative === true,
      temporarilyUnavailable: false,
      source: platformAuthority.source || '',
      workspaceRole: platformAuthority.workspaceRole || '',
      restaurantRole: firestoreProfile?.role || ''
    },
    platformAuthorityProtected: platformAuthority.protected === true,
    platformAuthorityAuthoritative: platformAuthority.authoritative === true,
    platformAuthorityTemporarilyUnavailable: false,
    customClaimSuperAdmin,
    protectedRootAdminMatched,
    serverMasterAdminMatched,
    firestoreSuperAdmin,
    firestoreSystemAdministrator,
    firestoreSuperAdminFlag,
    firestoreRoleLooksSystemAdmin,
    masterAdminEnvConfigured: masterEmails.length > 0,
    masterAdminEmailCount: masterEmails.length,
    skippedMasterAdminEmails: masterEmailConfig.skipped,
    firestoreProfileFound: !!firestoreProfile,
    firestoreProfileId: firestoreProfile?.id || '',
    firestoreProfileRole: firestoreProfile?.role || '',
    firestoreRestaurantId: firestoreProfile?.restaurantId || '',
    reasonCategory: superAdmin ? 'platform-admin-verified' : 'not-platform-admin',
    retryable: false
  };
}

async function loadFirestoreProfile(db, decoded, callerEmail) {
  let firestoreProfile = null;
  const direct = decoded.uid ? await db.collection('users').doc(decoded.uid).get() : null;
  if (direct?.exists) firestoreProfile = { id: direct.id, ...direct.data() };
  if (!firestoreProfile && callerEmail) {
    const byEmail = await db.collection('users').where('email', '==', callerEmail).limit(1).get();
    if (!byEmail.empty) firestoreProfile = { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
  }
  if (!firestoreProfile && callerEmail) {
    const byEmailLower = await db.collection('users').where('emailLower', '==', callerEmail).limit(1).get().catch(() => null);
    if (byEmailLower && !byEmailLower.empty) firestoreProfile = { id: byEmailLower.docs[0].id, ...byEmailLower.docs[0].data() };
  }
  return firestoreProfile;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({
    ok: false,
    version: APP_VERSION,
    appVersion: APP_VERSION,
    superAdmin: false,
    retryable: false,
    reasonCategory: 'missing-token',
    error: 'Missing token',
    platformAuthority: { superAdmin: false, authoritative: true, temporarilyUnavailable: false, protected: false, source: '' }
  });

  let app;
  try {
    app = initAdmin(req);
  } catch (err) {
    return respondTemporary(res, 503, 'firebase-admin-initialization', 'System Administrator verification is temporarily unavailable.', {
      diagnostic: clean(err?.message || 'Firebase Admin initialization failed.')
    });
  }

  let decoded;
  try {
    decoded = await getAuthClient(app).verifyIdToken(token);
  } catch (err) {
    const status = authFailureStatus(err);
    if (status === 401) {
      return res.status(401).json({
        ok: false,
        version: APP_VERSION,
        appVersion: APP_VERSION,
        superAdmin: false,
        retryable: false,
        reasonCategory: 'invalid-token',
        error: 'Invalid or expired Firebase token.',
        platformAuthority: { superAdmin: false, authoritative: true, temporarilyUnavailable: false, protected: false, source: '' }
      });
    }
    return respondTemporary(res, 503, 'firebase-auth-service-unavailable', 'Firebase authentication verification is temporarily unavailable.', {
      diagnostic: clean(err?.message || 'Firebase token verification failed.')
    });
  }

  const callerEmail = norm(decoded.email);
  const masterEmailConfig = parseMasterEmailEnv();
  const masterEmails = getMasterEmails();
  const serverMasterAdminMatched = !!callerEmail && masterEmails.includes(callerEmail);
  const protectedEmails = protectedRootAdminEmails();
  let firestoreProfile = null;
  let profileReadError = null;

  try {
    firestoreProfile = await loadFirestoreProfile(getDbClient(app), decoded, callerEmail);
  } catch (err) {
    profileReadError = err;
  }

  const authorityWithoutProfile = decidePlatformAdminAuthority({
    decoded,
    profile: null,
    masterEmails,
    protectedRootEmails: protectedEmails
  });

  if (profileReadError && authorityWithoutProfile.superAdmin !== true) {
    return respondTemporary(res, 503, 'firestore-profile-read-unavailable', 'System Administrator verification could not read the account profile yet.', {
      uid: decoded.uid,
      email: decoded.email,
      diagnostic: clean(profileReadError?.message || 'Profile read failed.')
    });
  }

  const platformAuthority = decidePlatformAdminAuthority({
    decoded,
    profile: firestoreProfile,
    masterEmails,
    protectedRootEmails: protectedEmails
  });
  const payload = publicPlatformPayload({ app, decoded, firestoreProfile, platformAuthority, masterEmails, masterEmailConfig, serverMasterAdminMatched });

  if (!platformAuthority.superAdmin) {
    return res.status(403).json({
      ...payload,
      ok: false,
      error: 'This account is not a platform System Administrator.',
      reasonCategory: 'not-platform-admin'
    });
  }

  return res.status(200).json(payload);
};

module.exports._test = {
  authFailureStatus,
  publicPlatformPayload,
  loadFirestoreProfile
};
