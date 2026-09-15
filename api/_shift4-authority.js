'use strict';

const {
  initAdmin, authorize, requireAppCheckIfEnforced, memberDocId, profileForWorkspace,
  userHasWorkspace, masterEmails, norm
} = require('./_chaos-admin');

const inactive = value => value?.isActive === false || ['inactive', 'revoked', 'disabled'].includes(String(value?.status || '').trim().toLowerCase());

async function canonicalMembershipState(db, uid, email, restaurantId) {
  const direct = await db.collection('workspaceMembers').doc(memberDocId(uid, restaurantId)).get();
  if (direct.exists) return { exists: true, member: { id: direct.id, ...direct.data() }, source: 'uid' };
  if (!email) return { exists: false, member: null, source: '' };
  const matches = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).where('email', '==', norm(email)).limit(10).get();
  if (matches.empty) return { exists: false, member: null, source: '' };
  const rows = matches.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const active = rows.find(row => !inactive(row));
  return { exists: true, member: active || rows[0], source: 'email', hasExplicitInactive: rows.some(inactive) && !active };
}

function requireActiveElevatedAccount({ accountUser, workspaceUser, memberState, isSuperAdmin }) {
  if (inactive(accountUser) || inactive(workspaceUser)) throw Object.assign(new Error('This account is inactive.'), { code: 'account_inactive', statusCode: 403 });
  if (!isSuperAdmin && memberState?.exists && (inactive(memberState.member) || memberState.hasExplicitInactive)) {
    throw Object.assign(new Error('Workspace membership is inactive or revoked.'), { code: 'membership_revoked', statusCode: 403 });
  }
  const permissions = workspaceUser?.permissions || {};
  const elevated = Boolean(isSuperAdmin || workspaceUser?.isAdmin === true || workspaceUser?.isOwner === true || workspaceUser?.accountOwner === true || workspaceUser?.workspaceOwner === true || permissions.settings === true || permissions.team === true);
  if (!elevated) throw Object.assign(new Error('Workspace owner or administrator approval is required.'), { code: 'permission_insufficient', statusCode: 403 });
}

async function verifyFirebaseAccount(app, uid, token = '') {
  if (token) await app.auth().verifyIdToken(token, true);
  const authUser = await app.auth().getUser(uid);
  if (authUser.disabled) throw Object.assign(new Error('Firebase authentication is disabled.'), { code: 'account_inactive', statusCode: 403 });
  return authUser;
}

async function authorizeShift4(req, restaurantId) {
  const targetRestaurantId = String(restaurantId || '').trim();
  if (!targetRestaurantId) throw Object.assign(new Error('A restaurant/workspace is required.'), { statusCode: 400 });
  const app = initAdmin(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId });
  if (!ctx.ok) throw Object.assign(new Error(ctx.error), { statusCode: ctx.status || 403 });
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  await verifyFirebaseAccount(ctx.app || app, ctx.uid, token);
  const memberState = await canonicalMembershipState(ctx.db, ctx.uid, ctx.email, targetRestaurantId);
  requireActiveElevatedAccount({ accountUser: ctx.accountUser, workspaceUser: ctx.user, memberState, isSuperAdmin: ctx.isSuperAdmin });
  if (ctx.restaurantId !== targetRestaurantId) throw Object.assign(new Error('Workspace authorization did not match.'), { code: 'restaurant_mismatch', statusCode: 403 });
  const appCheck = await requireAppCheckIfEnforced(ctx.app || app, req);
  if (!appCheck.ok) throw Object.assign(new Error(appCheck.error), { statusCode: appCheck.status || 401 });
  return { ...ctx, canonicalMembership: memberState.member || null };
}

async function revalidateShift4Initiator(app, { uid, restaurantId }) {
  const db = app.firestore();
  const authUser = await verifyFirebaseAccount(app, String(uid || ''));
  const email = norm(authUser.email || '');
  let userSnap = await db.collection('users').doc(uid).get();
  let userDocId = String(uid || '');
  let accountUser = userSnap.exists ? userSnap.data() : null;
  if (!accountUser && email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) { userSnap = byEmail.docs[0]; userDocId = userSnap.id; accountUser = userSnap.data(); }
  }
  if (!accountUser) throw Object.assign(new Error('The initiating 86 Chaos account no longer exists.'), { code: 'account_inactive', statusCode: 403 });
  const claims = authUser.customClaims || {};
  const isSuperAdmin = Boolean(claims.superAdmin === true || accountUser.isSuperAdmin === true || accountUser.systemAccess?.superAdmin === true || masterEmails().includes(email));
  const memberState = await canonicalMembershipState(db, uid, email, restaurantId);
  const mapped = accountUser?.memberships?.[restaurantId];
  const member = memberState.member || (mapped && !inactive(mapped) ? mapped : null);
  const workspaceUser = profileForWorkspace({ ...accountUser, id: userDocId }, member, restaurantId);
  if (!(isSuperAdmin || member || userHasWorkspace(accountUser, restaurantId))) throw Object.assign(new Error('Workspace access was removed during Shift4 authorization.'), { code: 'membership_revoked', statusCode: 403 });
  requireActiveElevatedAccount({ accountUser, workspaceUser, memberState, isSuperAdmin });
  return { uid, restaurantId, app, db, accountUser, user: workspaceUser, isSuperAdmin };
}

module.exports = { authorizeShift4, revalidateShift4Initiator, canonicalMembershipState, requireActiveElevatedAccount, verifyFirebaseAccount, inactive };
