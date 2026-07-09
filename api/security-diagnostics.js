const admin = require('firebase-admin');
const { requireMfaIfEnforced } = require('./_chaos-admin');

function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (raw) return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) }), admin;
  admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
  return admin;
}

const norm = (value = '') => String(value || '').toLowerCase().trim();
const hasEnv = (name) => Boolean(process.env[name] && String(process.env[name]).trim());
const roleNeedsMfa = (user = {}) => {
  const role = norm(user.role || user.accountRole || '');
  return Boolean(user.isSuperAdmin || user.isAdmin || user.isOwner || user.accountOwner || user.owner || user.workspaceOwner || ['owner', 'manager', 'admin', 'general manager', 'super admin'].some(token => role.includes(token)));
};
const userHasMfaFlag = (user = {}) => Boolean(user.mfaEnabled || user.multiFactorEnabled || user.security?.mfaEnabled || user.accountSecurity?.mfaEnabled);
const boolEnv = (name) => /^(1|true|yes|enforce)$/i.test(String(process.env[name] || '').trim());
const SECURITY_BUILD_VERSION = '15.0.31';
const mfaEnforcementEnabled = () => boolEnv('MFA_ENFORCE_ELEVATED_ROLES') || boolEnv('FIREBASE_MFA_ENFORCE_ELEVATED_ROLES') || boolEnv('REACT_APP_MFA_ENFORCE_ELEVATED_ROLES');
const decodedHasMfa = (decoded = {}) => Boolean(decoded.firebase?.sign_in_second_factor || decoded.firebase?.second_factor_identifier || decoded.sign_in_second_factor || decoded.mfa === true);
const authUserHasMfa = async (app, user) => {
  if (userHasMfaFlag(user)) return true;
  try {
    let authUser = null;
    if (user?.id) authUser = await app.auth().getUser(user.id).catch(() => null);
    if (!authUser && user?.email) authUser = await app.auth().getUserByEmail(user.email).catch(() => null);
    return (authUser?.multiFactor?.enrolledFactors || []).length > 0;
  } catch (_) {
    return false;
  }
};

async function verifyOptionalAppCheck(app, req) {
  const header = String(req.headers['x-firebase-appcheck'] || '').trim();
  const enforce = /^(1|true|yes)$/i.test(String(process.env.APP_CHECK_ENFORCE || process.env.FIREBASE_APP_CHECK_ENFORCE || ''));
  if (!header) return { configured: hasEnv('APP_CHECK_ENFORCE') || hasEnv('FIREBASE_APP_CHECK_ENFORCE'), enforcedByApi: enforce, headerReceived: false, tokenValid: false, status: enforce ? 'missing' : 'not-sent' };
  try {
    if (typeof app.appCheck !== 'function') return { configured: true, enforcedByApi: enforce, headerReceived: true, tokenValid: false, status: 'admin-sdk-no-appcheck' };
    await app.appCheck().verifyToken(header);
    return { configured: true, enforcedByApi: enforce, headerReceived: true, tokenValid: true, status: 'valid' };
  } catch (err) {
    return { configured: true, enforcedByApi: enforce, headerReceived: true, tokenValid: false, status: 'invalid', error: err.message };
  }
}

module.exports = async function handler(req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
    const app = initAdmin();
    const decoded = await app.auth().verifyIdToken(token);
    const masterEmails = [process.env.MASTER_ADMIN_EMAIL, process.env.MASTER_ADMIN_EMAILS]
      .filter(Boolean).flatMap(v => String(v).split(',')).map(norm);
    if (decoded.superAdmin !== true && !masterEmails.includes(norm(decoded.email))) return res.status(403).json({ ok: false, error: 'Super admin required' });
    const mfaGate = requireMfaIfEnforced(decoded, {}, true);
    if (!mfaGate.ok) return res.status(mfaGate.status || 403).json({ ok: false, error: mfaGate.error });

    const db = app.firestore();
    const [securityStatusSnap, backupStatusSnap, restoreDrillSnap, usersSnap, auditSnap, rateSnap] = await Promise.all([
      db.collection('system').doc('securityStatus').get().catch(() => null),
      db.collection('system').doc('backupStatus').get().catch(() => null),
      db.collection('system').doc('restoreDrillStatus').get().catch(() => null),
      db.collection('users').limit(500).get(),
      db.collection('auditLogs').orderBy('timestamp', 'desc').limit(250).get().catch(async () => db.collection('auditLogs').limit(250).get()),
      db.collection('apiRateLimits').orderBy('updatedAt', 'desc').limit(100).get().catch(async () => db.collection('apiRateLimits').limit(100).get())
    ]);

    const securityStatus = securityStatusSnap?.exists ? securityStatusSnap.data() : {};
    const backupStatus = backupStatusSnap?.exists ? backupStatusSnap.data() : {};
    const restoreDrillStatus = restoreDrillSnap?.exists ? restoreDrillSnap.data() : {};
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const elevatedUsers = users.filter(roleNeedsMfa);
    const elevatedMfaPairs = await Promise.all(elevatedUsers.slice(0, 200).map(async user => ({ user, hasMfa: await authUserHasMfa(app, user) })));
    const riskyUsers = elevatedMfaPairs
      .filter(row => !row.hasMfa)
      .slice(0, 50)
      .map(({ user }) => ({ id: user.id, name: user.name || '', email: user.email || '', role: user.role || user.accountRole || '', restaurantId: user.restaurantId || user.activeRestaurantId || '', risk: 'MFA missing for elevated account' }));

    const suspiciousTerms = /(permission_denied|denied|failed|invalid|unauthorized|security|scan_failed|upload|delete|bulk|danger|repair)/i;
    const suspiciousEvents = auditSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(row => suspiciousTerms.test(`${row.action || ''} ${row.details || ''} ${row.target || ''}`))
      .slice(0, 40)
      .map(row => ({ id: row.id, action: row.action || '', target: row.target || '', userName: row.userName || row.userEmail || '', restaurantId: row.restaurantId || '', timestamp: row.timestamp || '' }));

    const rateLimited = rateSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(row => Number(row.count || 0) >= Number(row.limit || 999999))
      .slice(0, 25)
      .map(row => ({ routeName: row.routeName || '', count: row.count || 0, limit: row.limit || 0, updatedAt: row.updatedAt || '', windowStart: row.windowStart || '' }));

    const envVars = [
      'CRON_SECRET', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY',
      'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_STORAGE_BUCKET',
      'MASTER_ADMIN_EMAIL', 'MASTER_ADMIN_EMAILS', 'APP_CHECK_ENFORCE', 'FIREBASE_APP_CHECK_ENFORCE',
      'MFA_ENFORCE_ELEVATED_ROLES', 'FIREBASE_MFA_ENFORCE_ELEVATED_ROLES',
      'REACT_APP_TEST_FIREBASE_PROJECT_ID', 'REACT_APP_PROD_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_APPCHECK_SITE_KEY'
    ].map(name => ({ name, present: hasEnv(name) }));

    const appCheck = await verifyOptionalAppCheck(app, req);
    if (appCheck.enforcedByApi && appCheck.status !== 'valid') return res.status(401).json({ ok: false, error: 'App Check verification is required for Security Center.', appCheck });
    const rulesVersion = securityStatus.currentRulesVersion || '15.0.13';
    const storageRulesVersion = securityStatus.currentStorageRulesVersion || '15.0.13';
    const report = {
      ok: true,
      generatedAt: new Date().toISOString(),
      caller: { uid: decoded.uid, email: decoded.email || '', superAdmin: decoded.superAdmin === true },
      security: {
        firestoreRules: { status: securityStatus.firestoreRulesStatus || 'publish-date-needed', currentRulesVersion: rulesVersion, lastPublishedAt: securityStatus.firestoreRulesPublishedAt || securityStatus.rulesPublishedAt || '', note: 'Record publish dates in system/securityStatus after Firebase rule publishes.' },
        storageRules: { status: securityStatus.storageRulesStatus || 'publish-date-needed', currentRulesVersion: storageRulesVersion, lastPublishedAt: securityStatus.storageRulesPublishedAt || '', note: 'Record publish dates in system/securityStatus after Storage rule publishes.' },
        appCheck,
        mfa: { requiredFor: 'owners, managers, admins, system admins; standard employees optional', riskyUserCount: riskyUsers.length, elevatedUserCount: elevatedUsers.length, status: riskyUsers.length ? 'action-needed' : 'clean', apiEnforcementEnabled: mfaEnforcementEnabled(), callerSecondFactor: decodedHasMfa(decoded), note: mfaEnforcementEnabled() ? 'Protected admin API routes require a second-factor sign-in where the shared guard is used.' : 'Enrollment can be tested safely. Enable MFA_ENFORCE_ELEVATED_ROLES only after elevated users enroll and the recovery reset flow has been tested.' },
        environmentSeparation: {
          mode: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
          projectId: process.env.FIREBASE_PROJECT_ID || (hasEnv('FIREBASE_SERVICE_ACCOUNT_KEY') ? 'from-service-account-json' : 'missing'),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'default-from-service-account',
          note: 'Testing and production should use separate Firebase projects, service keys, buckets, rules, and Vercel env vars.'
        }
      },
      app: { version: SECURITY_BUILD_VERSION, latestVersion: SECURITY_BUILD_VERSION, checkedAt: new Date().toISOString() },
      restoreDrill: { status: restoreDrillStatus.status || 'not-recorded', lastDrillAt: restoreDrillStatus.lastDrillAt || '', sourceBackupPath: restoreDrillStatus.sourceBackupPath || '', restoreProjectId: restoreDrillStatus.restoreProjectId || '', checklist: restoreDrillStatus.checklist || {} },
      envVars,
      cron: {
        cronSecretConfigured: hasEnv('CRON_SECRET'),
        lastBackupAt: backupStatus.lastSuccessfulBackupAt || backupStatus.lastBackupAt || backupStatus.lastRunAt || '',
        lastBackupStatus: backupStatus.status || backupStatus.lastStatus || 'unknown',
        reminderCronExpected: true,
        weeklyMaintenanceExpected: true
      },
      rateLimits: { recentLimitedRoutes: rateLimited, routeCount: rateLimited.length },
      riskyUsers,
      suspiciousActivity: { count: suspiciousEvents.length, events: suspiciousEvents }
    };

    await db.collection('system').doc('securityDiagnostics').set({
      lastRunAt: report.generatedAt,
      lastRunBy: decoded.email || decoded.uid,
      riskyUserCount: riskyUsers.length,
      suspiciousEventCount: suspiciousEvents.length,
      rateLimitedRouteCount: rateLimited.length,
      appCheckStatus: appCheck.status,
      rulesVersion,
      storageRulesVersion,
      restoreDrillStatus: restoreDrillStatus.status || 'not-recorded',
      restoreDrillAt: restoreDrillStatus.lastDrillAt || ''
    }, { merge: true }).catch(() => null);

    res.status(200).json(report);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
