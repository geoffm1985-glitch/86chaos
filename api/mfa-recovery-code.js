const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');
const crypto = require('crypto');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}

function readJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

function norm(value = '') { return String(value || '').toLowerCase().trim(); }
function recoveryCodeSecret() {
  const secret = String(process.env.RECOVERY_CODE_SECRET || '').trim();
  if (secret.length < 32) throw new Error('RECOVERY_CODE_SECRET is missing or too short. Ask a System Administrator to set it in Vercel and redeploy before using recovery codes.');
  return secret;
}
function normalizeRecoveryCode(value = '') { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function hashRecoveryCode(value = '') { return crypto.createHmac('sha256', recoveryCodeSecret()).update(normalizeRecoveryCode(value)).digest('hex'); }

async function rateLimit(db, key, limit = 6, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const safeKey = String(key || 'unknown').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180);
  const ref = db.collection('apiRateLimits').doc(`mfa-recovery-code:${safeKey}:${windowStart}`);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data().count || 0) : 0;
    const count = current + 1;
    tx.set(ref, {
      key: safeKey,
      routeName: 'mfa-recovery-code',
      count,
      limit,
      windowMs,
      windowStart: new Date(windowStart).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(windowStart + windowMs * 3).toISOString()
    }, { merge: true });
    return { ok: count <= limit, count, resetAt: new Date(windowStart + windowMs).toISOString() };
  });
}

async function audit(db, entry) {
  try { await db.collection('auditLogs').add(entry); } catch (_) {}
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const app = initAdmin(req);
    const db = app.firestore();
    const body = readJsonBody(req);
    const email = norm(body.email);
    const code = String(body.code || '').trim();
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'unknown-ip';
    const limiter = await rateLimit(db, `${email || 'missing'}:${ip}`);
    if (!limiter.ok) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((new Date(limiter.resetAt).getTime() - Date.now()) / 1000)));
      return res.status(429).json({ ok: false, error: 'Too many recovery attempts. Wait a few minutes and try again.', resetAt: limiter.resetAt });
    }
    if (!email || !code) return res.status(400).json({ ok: false, error: 'Email and recovery code are required.' });
    const authUser = await app.auth().getUserByEmail(email).catch(() => null);
    if (!authUser) return res.status(404).json({ ok: false, error: 'No Firebase Auth user found for that email.' });
    const userRef = db.collection('users').doc(authUser.uid);
    const suppliedHash = hashRecoveryCode(code);
    const now = new Date().toISOString();
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('This account is missing its Firestore user profile. Ask a System Administrator to repair it.');
      const user = snap.data() || {};
      const codes = Array.isArray(user.accountSecurity?.recoveryCodes) ? user.accountSecurity.recoveryCodes : [];
      const matchIndex = codes.findIndex(item => item && !item.usedAt && item.hash === suppliedHash);
      if (matchIndex < 0) throw new Error('Recovery code was not accepted. Check the code or ask a System Administrator to reset MFA.');
      const nextCodes = codes.map((item, index) => index === matchIndex ? { ...item, usedAt: now, usedFromIp: ip } : item);
      const remaining = nextCodes.filter(item => item.hash && !item.usedAt).length;
      tx.set(userRef, {
        mfaEnabled: false,
        multiFactorEnabled: false,
        mfaFactorCount: 0,
        accountSecurity: {
          ...(user.accountSecurity || {}),
          recoveryCodes: nextCodes,
          recoveryCodesLastUsedAt: now,
          unusedRecoveryCodeCount: remaining,
          recoveryCodesReady: remaining > 0,
          mfaEnabled: false,
          multiFactorEnabled: false,
          mfaFactorCount: 0,
          mfaRecoveryRequired: true,
          mfaRecoveryLastResetAt: now,
          mfaRecoveryLastReason: 'Self-service recovery code used at sign-in.'
        },
        mfaRecoveryRequired: true,
        mfaRecoveryLastResetAt: now,
        updatedAt: now
      }, { merge: true });
      return { user, remaining, usedIndex: matchIndex + 1 };
    });

    await app.auth().updateUser(authUser.uid, { multiFactor: { enrolledFactors: [] } });
    await db.collection('userSecurityAlerts').add({
      userId: authUser.uid,
      targetUserId: authUser.uid,
      type: 'mfa-recovery-code-used',
      severity: 'critical',
      title: 'Recovery code used',
      body: 'A one-time recovery code reset two-step login for this account. Re-enroll a phone from Account Security before elevated enforcement is turned on.',
      createdAt: now,
      isRead: false,
      source: 'mfa-recovery-code',
      ip
    }).catch(() => null);
    await audit(db, {
      userId: authUser.uid,
      userName: result.user.name || authUser.email || 'User',
      userEmail: authUser.email || email,
      action: 'ACCOUNT_SECURITY_RECOVERY_CODE_USED',
      target: authUser.uid,
      details: `A self-service MFA recovery code was used at sign-in. Code index ${result.usedIndex}. Remaining unused codes: ${result.remaining}.`,
      timestamp: now,
      restaurantId: result.user.activeRestaurantId || result.user.restaurantId || result.user.defaultRestaurantId || 'system',
      securityLevel: 'account-security'
    });
    return res.status(200).json({ ok: true, message: 'Recovery code accepted. Two-step login was reset. Sign in again and re-enroll a phone from Account Security.', remainingRecoveryCodes: result.remaining });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Recovery code failed.' });
  }
};
