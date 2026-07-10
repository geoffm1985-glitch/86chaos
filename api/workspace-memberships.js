const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}
function norm(v) { return String(v || '').toLowerCase().trim(); }
function clean(v, fallback = '') { return String(v == null ? fallback : v).trim(); }
function safeBool(v) { return v === true; }
function memberDocId(uid, restaurantId) {
  return `${clean(uid).replace(/[^A-Za-z0-9_-]/g, '_')}_${clean(restaurantId).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
}
function pickWorkspaceName(rest = {}, raw = {}) {
  return clean(raw.restaurantName || raw.name || rest.name || rest.businessName || rest.restaurantName || rest.displayName || raw.restaurantId || rest.id || '86 Chaos Workspace');
}
function cleanPerms(perms = {}) {
  if (!perms || typeof perms !== 'object') return {};
  return Object.fromEntries(Object.entries(perms).filter(([k, v]) => /^[A-Za-z0-9_-]{1,40}$/.test(k) && typeof v === 'boolean'));
}
function safeMembership(raw = {}, rest = {}, uid = '', email = '') {
  const restaurantId = clean(raw.restaurantId || raw.id);
  if (!restaurantId) return null;
  const membershipId = clean(raw.membershipId || raw.id || memberDocId(uid, restaurantId));
  return {
    id: membershipId,
    membershipId,
    userId: clean(raw.userId || raw.uid || uid),
    uid: clean(raw.uid || raw.userId || uid),
    email: norm(raw.email || email),
    name: clean(raw.name || raw.displayName || ''),
    phone: clean(raw.phone || ''),
    photoURL: clean(raw.photoURL || ''),
    restaurantId,
    restaurantName: pickWorkspaceName(rest, raw),
    planType: clean(rest.planType || raw.planType || 'Pro'),
    role: clean(raw.role || 'Staff') || 'Staff',
    permissions: cleanPerms(raw.permissions || {}),
    isAdmin: safeBool(raw.isAdmin),
    isOwner: safeBool(raw.isOwner) || safeBool(raw.accountOwner) || safeBool(raw.workspaceOwner),
    accountOwner: safeBool(raw.accountOwner),
    workspaceOwner: safeBool(raw.workspaceOwner),
    isActive: raw.isActive !== false && rest.isActive !== false && rest.archived !== true,
    membershipSource: clean(raw.membershipSource || raw.source || 'workspace-memberships-api')
  };
}
async function getUserDoc(db, uid, email, rawEmail = '') {
  const direct = uid ? await db.collection('users').doc(uid).get() : null;
  if (direct?.exists) return { id: direct.id, ...direct.data() };
  const candidates = Array.from(new Set([norm(email), clean(rawEmail)].filter(Boolean)));
  for (const candidate of candidates) {
    const snap = await db.collection('users').where('email', '==', candidate).limit(1).get();
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
}
async function getRestaurantMap(db, restaurantIds) {
  const out = new Map();
  const ids = Array.from(new Set((restaurantIds || []).filter(Boolean)));
  for (const restaurantId of ids) {
    try {
      const snap = await db.collection('restaurants').doc(restaurantId).get();
      out.set(restaurantId, snap.exists ? { id: snap.id, ...snap.data() } : { id: restaurantId });
    } catch (_) {
      out.set(restaurantId, { id: restaurantId });
    }
  }
  return out;
}
async function addWorkspaceMembersByQuery(db, options, queryRef, uid, email, source) {
  const snap = await queryRef.get();
  snap.forEach(doc => {
    const raw = { id: doc.id, ...doc.data(), membershipSource: doc.data()?.membershipSource || source };
    const restaurantId = clean(raw.restaurantId);
    if (!restaurantId) return;
    const current = options.get(restaurantId) || {};
    options.set(restaurantId, { ...current, ...raw, restaurantId });
  });
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const app = initAdmin(req);
    const db = app.firestore();
    const auth = app.auth();
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.' });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const rawEmail = clean(decoded.email);
    const email = norm(rawEmail);
    const user = await getUserDoc(db, uid, email, rawEmail);
    if (!user) return res.status(404).json({ ok: false, error: 'Your user profile could not be found in Firestore.' });

    const options = new Map();
    const addRaw = (raw = {}, source = '') => {
      const restaurantId = clean(raw.restaurantId || raw.id);
      if (!restaurantId) return;
      const current = options.get(restaurantId) || {};
      options.set(restaurantId, { ...current, ...raw, restaurantId, membershipSource: clean(raw.membershipSource || source || current.membershipSource) });
    };

    // Legacy user fields are still valid memberships for older restaurants.
    if (user.restaurantId) addRaw({ ...user, restaurantId: user.restaurantId, restaurantName: user.restaurantName, membershipSource: 'legacy-user-restaurantId' });
    if (user.defaultRestaurantId && user.defaultRestaurantId !== user.restaurantId) addRaw({ restaurantId: user.defaultRestaurantId, membershipSource: 'legacy-defaultRestaurantId' });
    if (user.activeRestaurantId && user.activeRestaurantId !== user.restaurantId) addRaw({ restaurantId: user.activeRestaurantId, membershipSource: 'legacy-activeRestaurantId' });

    // New multi-workspace map on the account profile.
    if (user.memberships && typeof user.memberships === 'object') {
      Object.entries(user.memberships).forEach(([restaurantId, membership]) => {
        if (!membership || typeof membership !== 'object') return;
        addRaw({ ...membership, restaurantId, membershipSource: membership.membershipSource || 'user-memberships-map' });
      });
    }
    if (Array.isArray(user.workspaceIds)) {
      user.workspaceIds.forEach(restaurantId => addRaw({ restaurantId, membershipSource: 'user-workspaceIds' }));
    }

    // Canonical workspaceMembers collection. Use Admin SDK so browser rules/query shape can never hide valid choices from the login picker.
    if (uid) {
      await addWorkspaceMembersByQuery(db, options, db.collection('workspaceMembers').where('userId', '==', uid), uid, email, 'workspaceMembers-userId');
      await addWorkspaceMembersByQuery(db, options, db.collection('workspaceMembers').where('uid', '==', uid), uid, email, 'workspaceMembers-uid');
    }
    if (email) {
      await addWorkspaceMembersByQuery(db, options, db.collection('workspaceMembers').where('email', '==', email), uid, email, 'workspaceMembers-email');
    }
    if (rawEmail && rawEmail !== email) {
      await addWorkspaceMembersByQuery(db, options, db.collection('workspaceMembers').where('email', '==', rawEmail), uid, email, 'workspaceMembers-email-raw');
    }

    const restaurantIds = Array.from(options.keys());
    const restMap = await getRestaurantMap(db, restaurantIds);
    const workspaces = restaurantIds
      .map(restaurantId => safeMembership(options.get(restaurantId), restMap.get(restaurantId) || { id: restaurantId }, uid, email))
      .filter(Boolean)
      .filter(w => w.isActive !== false)
      .sort((a, b) => a.restaurantName.localeCompare(b.restaurantName));

    return res.status(200).json({
      ok: true,
      uid,
      email,
      activeRestaurantId: clean(user.activeRestaurantId || user.restaurantId || ''),
      defaultRestaurantId: clean(user.defaultRestaurantId || user.restaurantId || ''),
      workspaceCount: workspaces.length,
      workspaces
    });
  } catch (err) {
    console.error('workspace-memberships API error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Could not load workspace memberships.' });
  }
};
