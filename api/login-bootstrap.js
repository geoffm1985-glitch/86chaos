const { getAdminAppForRequest } = require('./_firebase-project-admin');

function clean(value = '') {
  return String(value == null ? '' : value).trim();
}
function norm(value = '') {
  return clean(value).toLowerCase();
}
function bool(value) {
  return value === true;
}
function memberDocId(uid, restaurantId) {
  return `${clean(uid).replace(/[^A-Za-z0-9_-]/g, '_')}_${clean(restaurantId).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
}
function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function publicUserFromDoc(docId, data, decoded) {
  const raw = safeObject(data);
  const out = { ...raw };
  delete out.password;
  delete out.tempPassword;
  delete out.temporaryPassword;
  delete out.passwordHash;
  delete out.resetToken;
  delete out.inviteToken;
  out.id = decoded.uid;
  out.uid = decoded.uid;
  out.profileDocId = docId;
  out.email = norm(decoded.email || out.email);
  out.authEmail = norm(decoded.email || '');
  out.profileDocMatchedBy = docId === decoded.uid ? 'uid' : 'email';
  return out;
}
async function getUserProfile(db, decoded) {
  const uid = clean(decoded.uid);
  const email = norm(decoded.email);
  const rawEmail = clean(decoded.email);
  const diagnostics = {
    authUid: uid,
    authEmail: email,
    profileDocId: '',
    profileMatchedBy: '',
    uidDocExists: false,
    emailDocExists: false,
    uidMismatch: false
  };

  if (uid) {
    const snap = await db.collection('users').doc(uid).get();
    diagnostics.uidDocExists = snap.exists;
    if (snap.exists) {
      diagnostics.profileDocId = snap.id;
      diagnostics.profileMatchedBy = 'uid';
      return { user: publicUserFromDoc(snap.id, snap.data(), decoded), diagnostics };
    }
  }

  const candidates = Array.from(new Set([email, rawEmail].filter(Boolean)));
  for (const candidate of candidates) {
    const snap = await db.collection('users').where('email', '==', candidate).limit(2).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      diagnostics.emailDocExists = true;
      diagnostics.profileDocId = doc.id;
      diagnostics.profileMatchedBy = 'email';
      diagnostics.uidMismatch = doc.id !== uid;
      return { user: publicUserFromDoc(doc.id, doc.data(), decoded), diagnostics };
    }
  }

  return { user: null, diagnostics };
}
function pickWorkspaceName(rest = {}, raw = {}) {
  return clean(raw.restaurantName || raw.name || rest.name || rest.businessName || rest.restaurantName || rest.displayName || raw.restaurantId || rest.id || '86 Chaos Workspace');
}
function cleanPerms(perms = {}) {
  if (!perms || typeof perms !== 'object') return {};
  return Object.fromEntries(Object.entries(perms).filter(([key, value]) => /^[A-Za-z0-9_-]{1,40}$/.test(key) && typeof value === 'boolean'));
}
function safeMembership(raw = {}, rest = {}, decoded = {}, source = '') {
  const uid = clean(decoded.uid);
  const email = norm(decoded.email);
  const restaurantId = clean(raw.restaurantId || raw.id);
  if (!restaurantId) return null;
  return {
    id: clean(raw.membershipId || raw.id || memberDocId(uid, restaurantId)),
    membershipId: clean(raw.membershipId || raw.id || memberDocId(uid, restaurantId)),
    userId: clean(raw.userId || raw.uid || uid),
    uid: clean(raw.uid || raw.userId || uid),
    email: norm(raw.email || email),
    name: clean(raw.name || raw.displayName || decoded.name || ''),
    phone: clean(raw.phone || ''),
    photoURL: clean(raw.photoURL || ''),
    restaurantId,
    restaurantName: pickWorkspaceName(rest, raw),
    planId: clean((rest.subscription && rest.subscription.planId) || rest.planId || raw.planId || 'smart_kitchen'),
    subscriptionStatus: clean((rest.subscription && rest.subscription.status) || rest.subscriptionStatus || raw.subscriptionStatus || 'beta'),
    role: clean(raw.role || 'Staff') || 'Staff',
    permissions: cleanPerms(raw.permissions || {}),
    isAdmin: bool(raw.isAdmin),
    isOwner: bool(raw.isOwner) || bool(raw.accountOwner) || bool(raw.workspaceOwner),
    accountOwner: bool(raw.accountOwner),
    workspaceOwner: bool(raw.workspaceOwner),
    isActive: raw.isActive !== false && rest.isActive !== false && rest.archived !== true,
    membershipSource: clean(raw.membershipSource || raw.source || source || 'login-bootstrap')
  };
}
async function getRestaurantMap(db, restaurantIds = []) {
  const out = new Map();
  for (const restaurantId of Array.from(new Set(restaurantIds.filter(Boolean)))) {
    try {
      const snap = await db.collection('restaurants').doc(restaurantId).get();
      out.set(restaurantId, snap.exists ? { id: snap.id, ...snap.data() } : { id: restaurantId });
    } catch (_) {
      out.set(restaurantId, { id: restaurantId });
    }
  }
  return out;
}
function addRawWorkspace(options, raw = {}, source = '') {
  const restaurantId = clean(raw.restaurantId || raw.id);
  if (!restaurantId) return;
  const current = options.get(restaurantId) || {};
  options.set(restaurantId, { ...current, ...raw, restaurantId, membershipSource: clean(raw.membershipSource || source || current.membershipSource) });
}
async function addWorkspaceQuery(db, options, queryRef, source) {
  const snap = await queryRef.get();
  snap.forEach((doc) => addRawWorkspace(options, { id: doc.id, ...doc.data() }, source));
  return snap.size;
}
async function buildWorkspaces(db, decoded, user, diagnostics) {
  const uid = clean(decoded.uid);
  const email = norm(decoded.email || user?.email);
  const rawEmail = clean(decoded.email || user?.email);
  const options = new Map();
  const counts = {};

  if (user?.restaurantId) addRawWorkspace(options, { ...user, restaurantId: user.restaurantId, restaurantName: user.restaurantName }, 'user-restaurantId');
  if (user?.memberships && typeof user.memberships === 'object') {
    Object.entries(user.memberships).forEach(([restaurantId, membership]) => {
      if (membership && typeof membership === 'object') addRawWorkspace(options, { ...membership, restaurantId }, 'user-memberships-map');
    });
  }
  if (Array.isArray(user?.workspaceIds)) {
    user.workspaceIds.forEach((restaurantId) => addRawWorkspace(options, { restaurantId }, 'user-workspaceIds'));
  }

  if (uid) {
    counts.workspaceMembersUserId = await addWorkspaceQuery(db, options, db.collection('workspaceMembers').where('userId', '==', uid), 'workspaceMembers-userId');
    counts.workspaceMembersUid = await addWorkspaceQuery(db, options, db.collection('workspaceMembers').where('uid', '==', uid), 'workspaceMembers-uid');
  }
  if (email) counts.workspaceMembersEmail = await addWorkspaceQuery(db, options, db.collection('workspaceMembers').where('email', '==', email), 'workspaceMembers-email');
  if (rawEmail && rawEmail !== email) counts.workspaceMembersRawEmail = await addWorkspaceQuery(db, options, db.collection('workspaceMembers').where('email', '==', rawEmail), 'workspaceMembers-email-raw');

  diagnostics.membershipQueryCounts = counts;
  const restMap = await getRestaurantMap(db, Array.from(options.keys()));
  return Array.from(options.keys())
    .map((restaurantId) => safeMembership(options.get(restaurantId), restMap.get(restaurantId) || { id: restaurantId }, decoded, options.get(restaurantId)?.membershipSource))
    .filter(Boolean)
    .filter((workspace) => workspace.isActive !== false)
    .sort((a, b) => a.restaurantName.localeCompare(b.restaurantName));
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const app = getAdminAppForRequest(req, { requireCredentials: true });
    const db = app.firestore();
    const auth = app.auth();
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.' });

    const decoded = await auth.verifyIdToken(token);
    const { user, diagnostics } = await getUserProfile(db, decoded);
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'Firebase Auth accepted the login, but no Firestore user profile was found for this UID or email.',
        hint: 'Create users/{auth uid}, or set the Firestore user email to match the Firebase Auth email.',
        diagnostics
      });
    }

    const workspaces = await buildWorkspaces(db, decoded, user, diagnostics);
    diagnostics.workspaceCount = workspaces.length;

    if (!workspaces.length) {
      return res.status(403).json({
        ok: false,
        error: 'Firebase Auth and the user profile are valid, but no active workspace membership was found.',
        hint: 'Add a workspaceMembers record by this UID or email, or add restaurantId/memberships/workspaceIds to the user profile.',
        user,
        workspaces,
        diagnostics
      });
    }

    return res.status(200).json({ ok: true, user, workspaces, diagnostics });
  } catch (err) {
    console.error('login-bootstrap API error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Login bootstrap check failed.' });
  }
};
