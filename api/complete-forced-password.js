'use strict';
const { getAdminAppForRequest } = require('./_firebase-project-admin');

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const RECENT_AUTH_WINDOW_SECONDS = 15 * 60;

function clean(value = '') {
  return String(value == null ? '' : value).trim();
}

function norm(value = '') {
  return clean(value).toLowerCase();
}

function bearerToken(req) {
  return clean(req?.headers?.authorization).replace(/^Bearer\s+/i, '').trim();
}

function passwordValidationError(password) {
  if (typeof password !== 'string') return 'Enter a new password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  return '';
}

function authIsRecent(decoded, nowSeconds = Math.floor(Date.now() / 1000)) {
  const authTime = Number(decoded?.auth_time || 0);
  return Number.isFinite(authTime) && authTime > 0 && nowSeconds - authTime <= RECENT_AUTH_WINDOW_SECONDS;
}

async function findUserProfile(db, decoded) {
  const uid = clean(decoded?.uid || decoded?.sub);
  const rawEmail = clean(decoded?.email);
  const email = norm(rawEmail);

  if (uid) {
    const snap = await db.collection('users').doc(uid).get();
    if (snap.exists) return snap;
  }

  for (const docId of [...new Set([email, rawEmail].filter(Boolean))]) {
    const snap = await db.collection('users').doc(docId).get();
    if (snap.exists) return snap;
  }

  for (const field of ['emailLowercase', 'normalizedEmail', 'authEmail', 'email']) {
    for (const value of [...new Set([email, rawEmail].filter(Boolean))]) {
      const result = await db.collection('users').where(field, '==', value).limit(1).get();
      if (!result.empty) return result.docs[0];
    }
  }

  return null;
}

function statusForError(error) {
  const code = clean(error?.code);
  const message = clean(error?.message);
  if (code.includes('id-token') || /authorization token|recent sign-in|sign in again/i.test(message)) return 401;
  if (code === 'auth/weak-password' || /password must|enter a new password/i.test(message)) return 400;
  if (/credential|service account|firebase admin|temporarily unavailable/i.test(message)) return 503;
  return 500;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });

  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Your login session is missing. Sign in again.' });

    const newPassword = req?.body?.newPassword;
    const validationError = passwordValidationError(newPassword);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });

    const app = getAdminAppForRequest(req, { requireCredentials: true });
    const auth = app.auth();
    const db = app.firestore();
    const decoded = await auth.verifyIdToken(token, true);

    if (!authIsRecent(decoded)) {
      return res.status(401).json({
        ok: false,
        code: 'recent-login-required',
        error: 'For your security, sign in again before changing this temporary password.'
      });
    }

    const signInProvider = clean(decoded?.firebase?.sign_in_provider);
    if (signInProvider && signInProvider !== 'password') {
      return res.status(403).json({ ok: false, error: 'This forced-password flow is available only for email and password accounts.' });
    }

    const profileSnap = await findUserProfile(db, decoded);
    if (!profileSnap) return res.status(404).json({ ok: false, error: 'Your 86 Chaos user profile could not be found.' });

    const profile = profileSnap.data() || {};
    if (profile.forcePasswordChange !== true) {
      return res.status(409).json({ ok: false, error: 'This account is not waiting for a forced password change.' });
    }

    const uid = clean(decoded.uid || decoded.sub);
    await auth.updateUser(uid, { password: newPassword });

    const passwordPurgedAt = new Date().toISOString();
    await profileSnap.ref.set({
      forcePasswordChange: false,
      passwordStored: false,
      passwordPurgedAt
    }, { merge: true });

    try {
      await db.collection('auditLogs').add({
        userId: uid,
        userEmail: norm(decoded.email || profile.email),
        action: 'FORCED_PASSWORD_CHANGE_COMPLETED',
        target: profileSnap.id,
        details: 'User completed the required password change through the protected server flow.',
        timestamp: passwordPurgedAt,
        restaurantId: clean(profile.restaurantId || profile.activeRestaurantId || 'system') || 'system',
        securityLevel: 'sensitive'
      });
    } catch (_) {}

    return res.status(200).json({ ok: true, passwordPurgedAt });
  } catch (error) {
    console.error('complete-forced-password failed', error?.code || '', error?.message || error);
    return res.status(statusForError(error)).json({
      ok: false,
      error: statusForError(error) === 500
        ? 'Your password could not be changed right now. Sign in again and retry.'
        : (error?.message || 'Your password could not be changed.')
    });
  }
};

module.exports._test = {
  authIsRecent,
  findUserProfile,
  passwordValidationError,
  statusForError
};
