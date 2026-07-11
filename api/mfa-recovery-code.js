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
const INVALID_RECOVERY_MESSAGE = 'Recovery could not be completed. Check the email and code, wait a moment, then try again.';

function recoveryRejected() {
  const err = new Error(INVALID_RECOVERY_MESSAGE);
  err.statusCode = 400;
  err.code = 'RECOVERY_REJECTED';
  return err;
}

function clearReservation(item = {}) {
  const {
    recoveryReservationId,
    recoveryReservedAt,
    recoveryReservationExpiresAt,
    recoveryReservedFromIp,
    ...rest
  } = item;
  return rest;
}

async function releaseRecoveryReservation(db, userRef, reservationId) {
  if (!reservationId) return;
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const user = snap.data() || {};
    const codes = Array.isArray(user.accountSecurity?.recoveryCodes) ? user.accountSecurity.recoveryCodes : [];
    if (!codes.some(item => item?.recoveryReservationId === reservationId)) return;
    tx.set(userRef, {
      accountSecurity: {
        ...(user.accountSecurity || {}),
        recoveryCodes: codes.map(item => item?.recoveryReservationId === reservationId ? clearReservation(item) : item)
      }
    }, { merge: true });
  }).catch(() => null);
}

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
    if (!authUser) return res.status(400).json({ ok: false, error: INVALID_RECOVERY_MESSAGE });
    const userRef = db.collection('users').doc(authUser.uid);
    const suppliedHash = hashRecoveryCode(code);
    const now = new Date().toISOString();
    const reservationId = crypto.randomBytes(16).toString('hex');
    const reservationExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const reservation = await db.runTransaction(async tx => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw recoveryRejected();
      const user = snap.data() || {};
      const codes = Array.isArray(user.accountSecurity?.recoveryCodes) ? user.accountSecurity.recoveryCodes : [];
      const matchIndex = codes.findIndex(item => item && !item.usedAt && item.hash === suppliedHash);
      if (matchIndex < 0) throw recoveryRejected();
      const matchedCode = codes[matchIndex] || {};
      const reservationActive = matchedCode.recoveryReservationId && new Date(matchedCode.recoveryReservationExpiresAt || 0).getTime() > Date.now();
      if (reservationActive) throw recoveryRejected();
      const nextCodes = codes.map((item, index) => index === matchIndex ? {
        ...clearReservation(item),
        recoveryReservationId: reservationId,
        recoveryReservedAt: now,
        recoveryReservationExpiresAt: reservationExpiresAt,
        recoveryReservedFromIp: ip
      } : item);
      tx.set(userRef, {
        accountSecurity: {
          ...(user.accountSecurity || {}),
          recoveryCodes: nextCodes
        }
      }, { merge: true });
      return { user, usedIndex: matchIndex + 1 };
    });

    try {
      await app.auth().updateUser(authUser.uid, { multiFactor: { enrolledFactors: [] } });
    } catch (authResetError) {
      await releaseRecoveryReservation(db, userRef, reservationId);
      const safeError = new Error('Two-step login could not be reset. The recovery code was not consumed; wait a moment and try again.');
      safeError.statusCode = 502;
      safeError.cause = authResetError;
      throw safeError;
    }

    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('Recovery profile disappeared before the reset could be finalized.');
      const user = snap.data() || {};
      const codes = Array.isArray(user.accountSecurity?.recoveryCodes) ? user.accountSecurity.recoveryCodes : [];
      const matchIndex = codes.findIndex(item => item?.recoveryReservationId === reservationId && item.hash === suppliedHash && !item.usedAt);
      if (matchIndex < 0) throw new Error('Recovery reservation could not be finalized.');
      const nextCodes = codes.map((item, index) => index === matchIndex ? {
        ...clearReservation(item),
        usedAt: now,
        usedFromIp: ip
      } : item);
      const remaining = nextCodes.filter(item => item?.hash && !item.usedAt).length;
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
    const statusCode = Number(err?.statusCode || 500);
    return res.status(statusCode).json({ ok: false, error: statusCode === 400 ? INVALID_RECOVERY_MESSAGE : (err.message || 'Recovery code failed.') });
  }
};
