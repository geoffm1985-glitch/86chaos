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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
    const app = initAdmin(req);
    const authClient = getAuthClient(app);
    const decoded = await authClient.verifyIdToken(token);
    const callerEmail = norm(decoded.email);
    const masterEmailConfig = parseMasterEmailEnv();
    const masterEmails = getMasterEmails();
    const serverMasterAdminMatched = !!callerEmail && masterEmails.includes(callerEmail);

    let firestoreProfile = null;
    try {
      const db = getDbClient(app);
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
    } catch (profileErr) {
      firestoreProfile = { profileReadError: profileErr?.message || 'Could not read profile.' };
    }

    const platformAuthority = decidePlatformAdminAuthority({
      decoded,
      profile: firestoreProfile && !firestoreProfile.profileReadError ? firestoreProfile : null,
      masterEmails,
      protectedRootEmails: protectedRootAdminEmails()
    });
    const firestoreProfileRoleText = platformAuthority.firestoreRoleText || '';
    const firestoreRoleLooksSystemAdmin = /system\s*administrator|super\s*admin|master\s*admin/i.test(firestoreProfileRoleText);
    const firestoreProfileDisabled = platformAuthority.firestoreProfileDisabled === true;
    const firestoreSuperAdminFlag = platformAuthority.firestoreSuperAdminFlag === true;
    const firestoreSuperAdmin = platformAuthority.firestoreSuperAdmin === true;
    // Role text is display/diagnostic only. Platform System Administrator authority
    // comes from protected-root, server master email, custom claim, or explicit
    // server-owned profile flags, never from the restaurant/workspace role string.
    const firestoreSystemAdministrator = firestoreSuperAdmin;
    const customClaimSuperAdmin = platformAuthority.customClaimSuperAdmin === true;
    const protectedRootAdminMatched = platformAuthority.protectedRootAdminMatched === true;
    const superAdmin = platformAuthority.superAdmin === true;

    res.status(200).json({
      ok: true,
      version: APP_VERSION,
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
      firestoreProfileFound: !!(firestoreProfile && !firestoreProfile.profileReadError),
      firestoreProfileId: firestoreProfile?.id || '',
      firestoreProfileRole: firestoreProfile?.role || '',
      firestoreRestaurantId: firestoreProfile?.restaurantId || '',
      claims: decoded
    });
  } catch (err) { res.status(401).json({ ok: false, version: APP_VERSION, error: err.message }); }
};
