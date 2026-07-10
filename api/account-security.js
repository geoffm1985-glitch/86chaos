const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');
const crypto = require('crypto');


function norm(value = '') { return String(value || '').toLowerCase().trim(); }

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
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

function readJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

function masterEmails() {
  return [
    process.env.MASTER_ADMIN_EMAIL,
    process.env.MASTER_ADMIN_EMAILS
  ].filter(Boolean).flatMap(v => String(v).split(',')).map(norm).filter(Boolean);
}

function safeNameFromEmail(email = '') {
  const local = String(email || '').split('@')[0] || '86 Chaos User';
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()).trim() || '86 Chaos User';
}


function recoveryCodeSecretConfigured() {
  return String(process.env.RECOVERY_CODE_SECRET || '').trim().length >= 32;
}

function recoveryCodeSecret() {
  const secret = String(process.env.RECOVERY_CODE_SECRET || '').trim();
  if (secret.length < 32) throw new Error('RECOVERY_CODE_SECRET is required and should be at least 32 characters before recovery codes can be generated or used.');
  return secret;
}

function normalizeRecoveryCode(value = '') {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashRecoveryCode(value = '') {
  const normalized = normalizeRecoveryCode(value);
  return crypto.createHmac('sha256', recoveryCodeSecret()).update(normalized).digest('hex');
}

function formatRecoveryCode(raw = '') {
  const clean = normalizeRecoveryCode(raw).slice(0, 12).padEnd(12, 'X');
  return `86C-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

function generateRecoveryCodes(count = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = crypto.randomBytes(12);
    let raw = '';
    for (let b of bytes) raw += alphabet[b % alphabet.length];
    codes.push(formatRecoveryCode(raw));
  }
  return codes;
}

function recoveryCodeStatus(user = {}) {
  const codes = Array.isArray(user?.accountSecurity?.recoveryCodes) ? user.accountSecurity.recoveryCodes : [];
  const active = codes.filter(code => !code.usedAt && code.hash).length;
  const used = codes.filter(code => !!code.usedAt).length;
  return {
    recoveryCodesReady: active > 0,
    recoveryCodeCount: codes.length,
    unusedRecoveryCodeCount: active,
    usedRecoveryCodeCount: used,
    recoveryCodeSecretConfigured: recoveryCodeSecretConfigured(),
    recoveryCodesGeneratedAt: user?.accountSecurity?.recoveryCodesGeneratedAt || '',
    recoveryCodesLastUsedAt: user?.accountSecurity?.recoveryCodesLastUsedAt || ''
  };
}

async function writeUserSecurityNotice(db, userId, notice = {}) {
  if (!userId) return;
  const now = new Date().toISOString();
  await db.collection('userSecurityAlerts').add({
    userId,
    targetUserId: userId,
    type: notice.type || 'account-security',
    severity: notice.severity || 'warning',
    title: notice.title || 'Account security notice',
    body: notice.body || '',
    createdAt: now,
    isRead: false,
    source: 'account-security',
    ...notice
  }).catch(() => null);
}

async function bestEffortPush(app, targetUser = {}, title = '86 Chaos Security Alert', body = '') {
  const token = targetUser.fcmToken || targetUser.pushToken || targetUser.messagingToken || targetUser.deviceToken;
  if (!token) return false;
  try {
    await app.messaging().send({ token, notification: { title, body } });
    return true;
  } catch (_) { return false; }
}

async function audit(db, entry) {
  try { await db.collection('auditLogs').add(entry); } catch (_) {}
}

async function buildStatus({ app, db, decoded, authUser, action = 'sync', extra = {} }) {
  const userRef = db.collection('users').doc(decoded.uid);
  const snap = await userRef.get();
  const user = snap.exists ? (snap.data() || {}) : { email: decoded.email || authUser.email || '' };
  const factors = factorSummary(authUser);
  const recoveryStatus = recoveryCodeStatus(user);
  const enabled = factors.length > 0;
  const elevated = roleNeedsMfa(user, decoded);
  const secondFactorThisSession = decodedHadSecondFactor(decoded);
  const now = new Date().toISOString();
  const email = decoded.email || authUser.email || '';
  const emailNorm = norm(email);
  const isMaster = masterEmails().includes(emailNorm);
  const canAdminVerifyEmail = Boolean(isMaster || user.isSuperAdmin === true || user.systemAccess?.superAdmin === true);
  const canMfaRecovery = Boolean(isMaster || user.isSuperAdmin === true || user.systemAccess?.superAdmin === true);
  const firebaseProjectId = app.app().options?.projectId || process.env.FIREBASE_PROJECT_ID || '';
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
      ...recoveryCodeStatus(user),
      lastSyncAt: now
    }
  };

  // Normal sync updates an existing Firestore profile but does not silently create a missing profile.
  // Missing profiles are repaired by the explicit repair-profile action so the UI can show what happened.
  if (snap.exists) await userRef.set(payload, { merge: true }).catch(() => null);

  await audit(db, {
    userId: decoded.uid,
    userName: user.name || email || 'User',
    userEmail: email,
    action: action === 'sync' ? 'ACCOUNT_SECURITY_SYNC' : `ACCOUNT_SECURITY_${String(action).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
    target: decoded.uid,
    details: `Account security ${action}. emailVerified=${authUser.emailVerified === true}; mfaEnabled=${enabled}; factors=${factors.length}; elevated=${elevated}; firestoreUserDocExists=${snap.exists}; secondFactorThisSession=${secondFactorThisSession}`,
    timestamp: now,
    restaurantId: user.activeRestaurantId || user.restaurantId || user.defaultRestaurantId || extra.restaurantId || 'system',
    securityLevel: 'account-security'
  });

  return {
    ok: true,
    uid: decoded.uid,
    authUid: decoded.uid,
    email,
    authEmail: authUser.email || decoded.email || '',
    tokenEmail: decoded.email || '',
    emailVerified: authUser.emailVerified === true,
    mfaEnabled: enabled,
    multiFactorEnabled: enabled,
    mfaFactorCount: factors.length,
    factors,
    elevatedRole: elevated,
    mfaRequired: elevated,
    ...recoveryStatus,
    mfaEnforcementEnabled: mfaEnforcementEnabled(),
    secondFactorThisSession,
    firestoreUserDocExists: snap.exists,
    firestoreUserDocExistedBeforeSync: snap.exists,
    firestoreUserEmail: user.email || '',
    firestoreUserRestaurantId: user.restaurantId || user.activeRestaurantId || user.defaultRestaurantId || '',
    firestoreUserRole: user.role || user.accountRole || '',
    firebaseProjectId,
    canAdminVerifyEmail,
    canMfaRecovery,
    isMasterAdminEmail: isMaster,
    syncedAt: now,
    debug: {
      authUid: decoded.uid,
      authEmail: authUser.email || decoded.email || '',
      tokenEmail: decoded.email || '',
      firebaseProjectId,
      firestoreUserDocExists: snap.exists,
      firestoreUserEmail: user.email || '',
      firestoreUserRestaurantId: user.restaurantId || user.activeRestaurantId || user.defaultRestaurantId || '',
      firestoreUserRole: user.role || user.accountRole || '',
      providerIds: (authUser.providerData || []).map(p => p.providerId).filter(Boolean),
      emailVerified: authUser.emailVerified === true,
      mfaFactorCount: factors.length,
      recoveryCodesReady: recoveryStatus.recoveryCodesReady,
      unusedRecoveryCodeCount: recoveryStatus.unusedRecoveryCodeCount,
      mfaEnforcementEnabled: mfaEnforcementEnabled()
    }
  };
}


async function resolveTargetAuthUser(app, { targetUid = '', targetEmail = '' } = {}) {
  const uid = String(targetUid || '').trim();
  const email = String(targetEmail || '').trim();
  if (uid) return app.auth().getUser(uid);
  if (email) return app.auth().getUserByEmail(email);
  throw new Error('Choose a user to recover first.');
}

function canUseMfaRecovery(existingUser = {}, isMaster = false) {
  return Boolean(isMaster || existingUser.isSuperAdmin === true || existingUser.systemAccess?.superAdmin === true);
}

function describeFactors(factors = []) {
  if (!factors.length) return 'no enrolled factors';
  return factors.map(f => `${f.displayName || f.factorId || 'factor'} ${f.phoneNumberMasked || ''}`.trim()).join(', ');
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase ID token.' });

    const app = initAdmin(req);
    const decoded = await app.auth().verifyIdToken(token);
    let authUser = await app.auth().getUser(decoded.uid);
    const db = app.firestore();
    const body = readJsonBody(req);
    const action = req.method === 'POST' ? String(body.action || 'sync').trim() : 'sync';
    const userRef = db.collection('users').doc(decoded.uid);
    const snap = await userRef.get();
    const existingUser = snap.exists ? (snap.data() || {}) : {};
    const email = decoded.email || authUser.email || '';
    const isMaster = masterEmails().includes(norm(email));
    const canAdminVerifyEmail = Boolean(isMaster || existingUser.isSuperAdmin === true || existingUser.systemAccess?.superAdmin === true);
    const canMfaRecovery = canUseMfaRecovery(existingUser, isMaster);
    const now = new Date().toISOString();

    if (action === 'repair-profile') {
      const requestedRestaurantId = String(body.restaurantId || existingUser.restaurantId || existingUser.activeRestaurantId || existingUser.defaultRestaurantId || decoded.restaurantId || '').trim();
      const safeRole = String(existingUser.role || body.role || 'Staff').trim() || 'Staff';
      const baseProfile = {
        email,
        name: existingUser.name || String(body.name || authUser.displayName || safeNameFromEmail(email)).trim(),
        phone: existingUser.phone || String(body.phone || authUser.phoneNumber || '').trim(),
        role: safeRole,
        restaurantId: requestedRestaurantId,
        activeRestaurantId: requestedRestaurantId,
        defaultRestaurantId: requestedRestaurantId,
        isActive: existingUser.isActive !== false,
        profileRepairLastRunAt: now,
        profileRepairSource: 'account-security',
        updatedAt: now
      };
      if (!snap.exists) baseProfile.createdAt = now;
      if (isMaster || existingUser.isSuperAdmin === true) {
        baseProfile.isSuperAdmin = true;
        baseProfile.isAdmin = true;
        baseProfile.role = existingUser.role || body.role || 'System Administrator';
      } else if (existingUser.isAdmin === true) {
        baseProfile.isAdmin = true;
      }
      await userRef.set(baseProfile, { merge: true });
      await audit(db, {
        userId: decoded.uid,
        userName: baseProfile.name || email || 'User',
        userEmail: email,
        action: 'ACCOUNT_PROFILE_REPAIR',
        target: decoded.uid,
        details: `Account profile repair completed. existedBefore=${snap.exists}; restaurantId=${requestedRestaurantId || 'missing'}; role=${baseProfile.role || 'Staff'}`,
        timestamp: now,
        restaurantId: requestedRestaurantId || 'system',
        securityLevel: 'account-security'
      });
      authUser = await app.auth().getUser(decoded.uid);
      const status = await buildStatus({ app, db, decoded, authUser, action, extra: { restaurantId: requestedRestaurantId } });
      return res.status(200).json({ ...status, profileRepairApplied: true, profileRepairCreatedDoc: !snap.exists, message: snap.exists ? 'Profile refreshed.' : 'Missing Firestore user profile was created.' });
    }

    if (action === 'generate-recovery-codes') {
      if (!recoveryCodeSecretConfigured()) return res.status(500).json({ ok: false, error: 'RECOVERY_CODE_SECRET is missing or too short. Add a dedicated 32+ character secret in Vercel, redeploy, then generate recovery codes.' });
      if (!authUser.emailVerified) return res.status(400).json({ ok: false, error: 'Verify your email before generating recovery codes.' });
      const codes = generateRecoveryCodes(10);
      const stampedAt = new Date().toISOString();
      const recoveryCodes = codes.map((code, index) => ({
        id: crypto.randomBytes(8).toString('hex'),
        hash: hashRecoveryCode(code),
        createdAt: stampedAt,
        usedAt: '',
        index: index + 1
      }));
      await userRef.set({
        accountSecurity: {
          ...(existingUser.accountSecurity || {}),
          recoveryCodes,
          recoveryCodesGeneratedAt: stampedAt,
          recoveryCodesLastShownAt: stampedAt,
          recoveryCodesReady: true,
          unusedRecoveryCodeCount: recoveryCodes.length
        }
      }, { merge: true });
      await audit(db, {
        userId: decoded.uid,
        userName: existingUser.name || email || 'User',
        userEmail: email,
        action: 'ACCOUNT_SECURITY_GENERATE_RECOVERY_CODES',
        target: decoded.uid,
        details: `Generated ${codes.length} one-time MFA recovery codes. Existing codes were replaced. Plaintext codes were returned once only.`,
        timestamp: stampedAt,
        restaurantId: existingUser.activeRestaurantId || existingUser.restaurantId || existingUser.defaultRestaurantId || 'system',
        securityLevel: 'account-security'
      });
      authUser = await app.auth().getUser(decoded.uid);
      const updatedSnap = await userRef.get();
      const updatedUser = updatedSnap.exists ? (updatedSnap.data() || {}) : existingUser;
      const status = await buildStatus({ app, db, decoded, authUser, action });
      return res.status(200).json({ ...status, ...recoveryCodeStatus(updatedUser), recoveryCodes: codes, message: 'Recovery codes generated. Save them now; they will not be shown again.' });
    }

    if (action === 'generate-verification-link') {
      if (!authUser.email) return res.status(400).json({ ok: false, error: 'This Firebase Auth user has no email address to verify.' });
      const link = await app.auth().generateEmailVerificationLink(authUser.email);
      await audit(db, {
        userId: decoded.uid,
        userName: existingUser.name || email || 'User',
        userEmail: email,
        action: 'ACCOUNT_SECURITY_GENERATE_VERIFICATION_LINK',
        target: decoded.uid,
        details: 'Generated a self-service Firebase email verification action link because email delivery was not reaching the inbox.',
        timestamp: now,
        restaurantId: existingUser.activeRestaurantId || existingUser.restaurantId || existingUser.defaultRestaurantId || 'system',
        securityLevel: 'account-security'
      });
      const status = await buildStatus({ app, db, decoded, authUser, action });
      return res.status(200).json({ ...status, verificationLink: link, message: 'Verification rescue link generated. Open it in this browser, then refresh email status.' });
    }

    if (action === 'admin-verify-email-self') {
      if (!canAdminVerifyEmail) return res.status(403).json({ ok: false, error: 'Only the master admin or a System Administrator can use the direct email verification rescue.' });
      await app.auth().updateUser(decoded.uid, { emailVerified: true });
      authUser = await app.auth().getUser(decoded.uid);
      await audit(db, {
        userId: decoded.uid,
        userName: existingUser.name || email || 'User',
        userEmail: email,
        action: 'ACCOUNT_SECURITY_ADMIN_VERIFY_EMAIL_SELF',
        target: decoded.uid,
        details: 'Direct admin rescue marked the current Firebase Auth email as verified for MFA enrollment.',
        timestamp: now,
        restaurantId: existingUser.activeRestaurantId || existingUser.restaurantId || existingUser.defaultRestaurantId || 'system',
        securityLevel: 'account-security'
      });
      const status = await buildStatus({ app, db, decoded, authUser, action });
      return res.status(200).json({ ...status, message: 'Email marked verified for this Firebase Auth account.' });
    }


    if (action === 'admin-get-user-mfa' || action === 'admin-reset-user-mfa') {
      if (!canMfaRecovery) return res.status(403).json({ ok: false, error: 'Only the master admin or a System Administrator can use MFA recovery.' });
      const targetAuthUser = await resolveTargetAuthUser(app, { targetUid: body.targetUid, targetEmail: body.targetEmail });
      const targetSnap = await db.collection('users').doc(targetAuthUser.uid).get();
      const targetUser = targetSnap.exists ? (targetSnap.data() || {}) : {};
      const targetFactors = factorSummary(targetAuthUser);
      const targetEmail = targetAuthUser.email || targetUser.email || String(body.targetEmail || '').trim();
      const targetStatus = {
        uid: targetAuthUser.uid,
        email: targetEmail,
        name: targetUser.name || targetAuthUser.displayName || safeNameFromEmail(targetEmail),
        role: targetUser.role || targetUser.accountRole || '',
        restaurantId: targetUser.activeRestaurantId || targetUser.restaurantId || targetUser.defaultRestaurantId || '',
        emailVerified: targetAuthUser.emailVerified === true,
        mfaEnabled: targetFactors.length > 0,
        mfaFactorCount: targetFactors.length,
        factors: targetFactors
      };

      if (action === 'admin-get-user-mfa') {
        const status = await buildStatus({ app, db, decoded, authUser, action });
        return res.status(200).json({ ...status, targetMfa: targetStatus, message: targetFactors.length ? 'Target MFA status loaded.' : 'Target has no enrolled MFA factors.' });
      }

      const reason = String(body.reason || '').trim();
      if (reason.length < 8) return res.status(400).json({ ok: false, error: 'Add a recovery reason with at least 8 characters before resetting MFA.' });
      await app.auth().updateUser(targetAuthUser.uid, { multiFactor: { enrolledFactors: [] } });
      const resetAt = new Date().toISOString();
      if (targetSnap.exists) {
        await db.collection('users').doc(targetAuthUser.uid).set({
          mfaEnabled: false,
          multiFactorEnabled: false,
          mfaFactorCount: 0,
          accountSecurity: {
            ...(targetUser.accountSecurity || {}),
            mfaEnabled: false,
            multiFactorEnabled: false,
            mfaFactorCount: 0,
            mfaMethods: [],
            mfaFactors: [],
            mfaRecoveryRequired: true,
            mfaRecoveryLastResetAt: resetAt,
            mfaRecoveryLastResetBy: decoded.uid,
            mfaRecoveryLastResetByEmail: email,
            mfaRecoveryLastReason: reason,
            lastSyncAt: resetAt
          },
          mfaRecoveryRequired: true,
          mfaRecoveryLastResetAt: resetAt,
          mfaRecoveryLastResetBy: decoded.uid,
          updatedAt: resetAt
        }, { merge: true });
      }
      await audit(db, {
        userId: decoded.uid,
        userName: existingUser.name || email || 'System Administrator',
        userEmail: email,
        action: 'ACCOUNT_SECURITY_ADMIN_RESET_MFA',
        target: targetAuthUser.uid,
        details: `MFA recovery reset for ${targetEmail || targetAuthUser.uid}. Removed ${targetFactors.length} factor(s): ${describeFactors(targetFactors)}. Reason: ${reason}`,
        timestamp: resetAt,
        restaurantId: targetUser.activeRestaurantId || targetUser.restaurantId || targetUser.defaultRestaurantId || existingUser.activeRestaurantId || existingUser.restaurantId || 'system',
        securityLevel: 'account-security'
      });
      await writeUserSecurityNotice(db, targetAuthUser.uid, {
        type: 'mfa-reset',
        severity: 'critical',
        title: 'Two-step login was reset',
        body: `A System Administrator reset MFA for this account. Reason: ${reason}. If this was not expected, contact your owner or support before re-enrolling.`,
        actorUserId: decoded.uid,
        actorEmail: email,
        targetEmail,
        restaurantId: targetUser.activeRestaurantId || targetUser.restaurantId || targetUser.defaultRestaurantId || existingUser.activeRestaurantId || existingUser.restaurantId || 'system'
      });
      await bestEffortPush(app, targetUser, '86 Chaos Security Alert', 'Your two-step login was reset by a System Administrator. Open Account Security to re-enroll.');
      const refreshedTargetAuthUser = await app.auth().getUser(targetAuthUser.uid);
      const status = await buildStatus({ app, db, decoded, authUser, action });
      return res.status(200).json({
        ...status,
        recoveryReset: true,
        targetMfa: { ...targetStatus, mfaEnabled: false, mfaFactorCount: 0, factors: factorSummary(refreshedTargetAuthUser) },
        message: `MFA was reset for ${targetEmail || targetAuthUser.uid}. They must enroll a new phone before elevated enforcement is enabled for their account.`
      });
    }

    const status = await buildStatus({ app, db, decoded, authUser, action: 'sync' });
    return res.status(200).json(status);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Account security sync failed.' });
  }
};
