const admin = require('firebase-admin');
const { requireMfaIfEnforced } = require('./_chaos-admin');

function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) }), admin;
  admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
  return admin;
}

async function verifySuperAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase ID token.');
  const app = initAdmin();
  const decoded = await app.auth().verifyIdToken(token);
  const masterEmail = (process.env.MASTER_ADMIN_EMAIL || '').toLowerCase();
  if (decoded.superAdmin !== true && (decoded.email || '').toLowerCase() !== masterEmail) throw new Error('Super admin access required.');
  const mfa = requireMfaIfEnforced(decoded, {}, true);
  if (!mfa.ok) throw new Error(mfa.error);
  return decoded;
}

function normalizeEmails(raw) {
  const arr = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/);
  return [...new Set(arr.map(e => String(e || '').toLowerCase().trim()).filter(e => e.includes('@')))];
}

function normalizeIds(raw) {
  const arr = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/);
  return [...new Set(arr.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 250);
}

function isProtectedUser(profile, caller, protectedEmails) {
  const email = String(profile?.email || '').toLowerCase().trim();
  return protectedEmails.has(email) || profile?.id === caller.uid;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await verifySuperAdmin(req);
    const app = initAdmin();
    const db = app.firestore();
    const emails = normalizeEmails(req.body?.emails || req.body?.emailText);
    const userIds = normalizeIds(req.body?.userIds || req.body?.uids || req.body?.profileIds);
    const masterEmail = (process.env.MASTER_ADMIN_EMAIL || '').toLowerCase();
    const protectedEmails = new Set([masterEmail, (caller.email || '').toLowerCase()]);

    let authDeleted = 0;
    let profileDeleted = 0;
    const errors = [];
    const skippedProtected = [];

    if (userIds.length > 0) {
      const profileSnaps = await Promise.all(userIds.map(id => db.collection('users').doc(id).get()));
      const profiles = profileSnaps
        .filter(snap => snap.exists)
        .map(snap => ({ id: snap.id, ref: snap.ref, ...(snap.data() || {}) }));

      const targets = profiles.filter(profile => {
        if (isProtectedUser(profile, caller, protectedEmails)) {
          skippedProtected.push(profile.email || profile.id);
          return false;
        }
        return true;
      });

      if (!targets.length) return res.status(400).json({ error: 'No deletable selected profiles were supplied.', skippedProtected });

      for (const profile of targets) {
        const email = String(profile.email || '').toLowerCase().trim();
        try {
          try {
            const authUser = await app.auth().getUser(profile.id);
            if ((authUser.email || '').toLowerCase() === masterEmail || authUser.uid === caller.uid) throw new Error('Protected admin account.');
            await app.auth().deleteUser(authUser.uid);
            authDeleted++;
          } catch (err) {
            if (err.code !== 'auth/user-not-found') errors.push(`${email || profile.id}: auth ${err.message}`);
          }
          await profile.ref.delete();
          profileDeleted++;
        } catch (err) {
          errors.push(`${email || profile.id}: profile ${err.message}`);
        }
      }

      await db.collection('auditLogs').add({
        userId: caller.uid,
        userName: caller.email || 'System Admin',
        action: 'BULK_DELETE_USERS_SELECTED',
        target: 'users',
        details: `Bulk deleted selected user profiles: ${targets.map(u => `${u.email || 'no-email'}:${u.id}`).join(', ')}. Auth: ${authDeleted}. Profiles: ${profileDeleted}. Errors: ${errors.slice(0, 5).join(' | ') || 'none'}`,
        timestamp: new Date().toISOString(),
        restaurantId: 'system',
        isGhost: false
      }).catch(() => {});

      return res.status(200).json({ ok: true, mode: 'selected-profiles', requested: userIds.length, authDeleted, profileDeleted, skippedProtected, errors });
    }

    const targets = emails.filter(e => !protectedEmails.has(e));
    if (!targets.length) return res.status(400).json({ error: 'No deletable emails supplied.' });

    for (const email of targets) {
      let uidFromAuth = null;
      try {
        const user = await app.auth().getUserByEmail(email);
        uidFromAuth = user.uid;
        if ((user.email || '').toLowerCase() === masterEmail || user.uid === caller.uid) throw new Error('Protected admin account.');
        await app.auth().deleteUser(user.uid);
        authDeleted++;
      } catch (err) {
        if (err.code !== 'auth/user-not-found') errors.push(`${email}: auth ${err.message}`);
      }

      const profileQueries = [];
      profileQueries.push(db.collection('users').where('email', '==', email).get());
      if (uidFromAuth) profileQueries.push(db.collection('users').doc(uidFromAuth).get());
      const results = await Promise.all(profileQueries);
      const refs = new Map();
      results.forEach(result => {
        if (result && typeof result.forEach === 'function') result.forEach(doc => refs.set(doc.ref.path, doc.ref));
        else if (result && result.exists) refs.set(result.ref.path, result.ref);
      });
      for (const ref of refs.values()) {
        try { await ref.delete(); profileDeleted++; } catch (err) { errors.push(`${email}: profile ${err.message}`); }
      }
    }

    await db.collection('auditLogs').add({
      userId: caller.uid,
      userName: caller.email || 'System Admin',
      action: 'BULK_DELETE_USERS',
      target: 'users',
      details: `Bulk deleted emails: ${targets.join(', ')}. Auth: ${authDeleted}. Profiles: ${profileDeleted}. Errors: ${errors.slice(0, 5).join(' | ') || 'none'}`,
      timestamp: new Date().toISOString(),
      restaurantId: 'system',
      isGhost: false
    }).catch(() => {});

    res.status(200).json({ ok: true, mode: 'emails', requested: emails.length, authDeleted, profileDeleted, skippedProtected: emails.filter(e => protectedEmails.has(e)), errors });
  } catch (err) {
    res.status(403).json({ error: err.message || 'Bulk delete failed.' });
  }
};
