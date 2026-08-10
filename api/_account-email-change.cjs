'use strict';

const crypto = require('crypto');
const { isProtectedRootAdminEmail } = require('./_protected-root-admin');

function cleanString(value = '') {
  return String(value == null ? '' : value).trim();
}
function normalizeEmail(value = '') {
  return cleanString(value).toLowerCase();
}
function validEmail(value = '') {
  const email = normalizeEmail(value);
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
function unique(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const v = cleanString(value);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
function uniqueEmails(values = []) {
  return unique(values.map(normalizeEmail).filter(Boolean));
}
function emailChanged(oldEmail = '', newEmail = '') {
  return normalizeEmail(oldEmail) !== normalizeEmail(newEmail);
}
function activeMembership(row = {}) {
  return Boolean(row && row.isActive !== false && row.deleted !== true && row.archived !== true && row.removed !== true && row.disabled !== true && row.status !== 'inactive' && row.membershipStatus !== 'inactive');
}
function collectIdentityCandidates(targetUid = '', targetUser = {}, currentMembership = {}, authUser = {}) {
  return unique([
    targetUid,
    targetUser?.id,
    targetUser?.uid,
    targetUser?.userId,
    targetUser?.authUid,
    targetUser?.accountUserId,
    currentMembership?.uid,
    currentMembership?.userId,
    currentMembership?.authUid,
    currentMembership?.accountUserId,
    authUser?.uid
  ]);
}
function collectEmailEvidence(targetUser = {}, currentMembership = {}, authUser = {}) {
  return uniqueEmails([
    targetUser?.email,
    targetUser?.emailLower,
    targetUser?.emailLowercase,
    targetUser?.normalizedEmail,
    targetUser?.authEmail,
    currentMembership?.email,
    currentMembership?.emailLower,
    currentMembership?.employeeEmail,
    currentMembership?.userEmail,
    authUser?.email
  ]);
}
function memberMatchesIdentity(row = {}, aliases = [], emails = [], docId = '') {
  const aliasSet = new Set(unique(aliases));
  const emailSet = new Set(uniqueEmails(emails));
  const idValues = [docId, row.id, row.membershipId, row.userId, row.uid, row.authUid, row.accountUserId].map(cleanString).filter(Boolean);
  if (idValues.some(value => aliasSet.has(value))) return true;
  const emailValues = [row.email, row.emailLower, row.employeeEmail, row.userEmail].map(normalizeEmail).filter(Boolean);
  if (emailValues.some(value => emailSet.has(value))) return true;
  return false;
}
function targetIsPrivileged(targetUser = {}, currentMembership = {}, ctx = {}) {
  const email = normalizeEmail(targetUser.email || targetUser.emailLower || currentMembership.email || currentMembership.emailLower || '');
  const restaurant = ctx.restaurant || {};
  const targetIds = new Set(collectIdentityCandidates(ctx.targetUid || targetUser.id || '', targetUser, currentMembership));
  const ownerEmails = uniqueEmails([restaurant.ownerEmail, restaurant.ownerEmailLower, restaurant.ownerUserEmail]);
  const ownerIds = unique([restaurant.ownerUid, restaurant.ownerUserId]);
  return Boolean(
    isProtectedRootAdminEmail(email) ||
    targetUser.isSuperAdmin === true ||
    targetUser.systemAccess?.superAdmin === true ||
    currentMembership.isSuperAdmin === true ||
    currentMembership.systemAccess?.superAdmin === true ||
    targetUser.isOwner === true || targetUser.accountOwner === true || targetUser.owner === true || targetUser.workspaceOwner === true ||
    currentMembership.isOwner === true || currentMembership.accountOwner === true || currentMembership.owner === true || currentMembership.workspaceOwner === true ||
    normalizeEmail(targetUser.accountRole || currentMembership.accountRole) === 'owner' ||
    (email && ownerEmails.includes(email)) ||
    ownerIds.some(id => targetIds.has(id))
  );
}
function profileEmailPatch(targetUser = {}, newEmail = '', now = new Date().toISOString()) {
  const email = normalizeEmail(newEmail);
  const patch = {
    email,
    updatedAt: now,
    forceLogout: true,
    forceLogoutAt: now,
    forceLogoutNonce: `${now}_${crypto.randomBytes(8).toString('hex')}`,
    forceLogoutReason: 'staff-email-changed'
  };
  for (const key of ['emailLower', 'emailLowercase', 'normalizedEmail', 'authEmail']) {
    if (Object.prototype.hasOwnProperty.call(targetUser || {}, key)) patch[key] = email;
  }
  if (Object.prototype.hasOwnProperty.call(targetUser || {}, 'emailVerified')) patch.emailVerified = false;
  if (targetUser?.accountSecurity && typeof targetUser.accountSecurity === 'object' && Object.prototype.hasOwnProperty.call(targetUser.accountSecurity, 'emailVerified')) {
    patch.accountSecurity = { ...targetUser.accountSecurity, emailVerified: false };
  }
  const memberships = targetUser?.memberships && typeof targetUser.memberships === 'object' ? targetUser.memberships : null;
  if (memberships) {
    const nextMemberships = { ...memberships };
    let changed = false;
    for (const [workspaceId, member] of Object.entries(memberships)) {
      if (!member || typeof member !== 'object') continue;
      const next = { ...member };
      let memberChanged = false;
      for (const key of ['email', 'emailLower', 'employeeEmail', 'userEmail']) {
        if (Object.prototype.hasOwnProperty.call(next, key)) { next[key] = email; memberChanged = true; }
      }
      if (memberChanged) { nextMemberships[workspaceId] = next; changed = true; }
    }
    if (changed) patch.memberships = nextMemberships;
  }
  return patch;
}
function membershipEmailPatch(current = {}, newEmail = '', now = new Date().toISOString()) {
  const email = normalizeEmail(newEmail);
  const patch = { email, emailLower: email, updatedAt: now };
  if (Object.prototype.hasOwnProperty.call(current || {}, 'employeeEmail')) patch.employeeEmail = email;
  if (Object.prototype.hasOwnProperty.call(current || {}, 'userEmail')) patch.userEmail = email;
  return patch;
}
function classifyAuthEmailError(err = {}) {
  const code = String(err.code || err.errorInfo?.code || '').toLowerCase();
  const message = String(err.message || err).toLowerCase();
  if (code.includes('email-already-exists') || message.includes('email-already-exists') || message.includes('already exists')) return { status: 409, code: 'email-conflict', message: 'That email is already assigned to another 86 Chaos login.' };
  if (code.includes('invalid-email') || message.includes('invalid email')) return { status: 400, code: 'invalid-email', message: 'Enter a valid email address.' };
  return { status: 500, code: 'auth-email-update-failed', message: 'Firebase Auth could not update this login email.' };
}
class AccountEmailChangeError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}
async function getOneByQuery(collectionRef, field, value) {
  if (!value) return [];
  const snap = await collectionRef.where(field, '==', value).limit(5).get();
  return snap.empty ? [] : snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }));
}
function pushUniqueDoc(map, row) {
  if (!row || !row.ref || !row.id) return;
  map.set(row.id, row);
}
async function collectUserConflictDocs(db, newEmail, targetDocId, authUid) {
  const rows = new Map();
  const direct = await db.collection('users').doc(newEmail).get().catch(() => null);
  if (direct?.exists) pushUniqueDoc(rows, { id: direct.id, ref: direct.ref, data: direct.data() || {} });
  for (const field of ['email', 'emailLower', 'emailLowercase', 'normalizedEmail', 'authEmail']) {
    const docs = await getOneByQuery(db.collection('users'), field, newEmail).catch(() => []);
    docs.forEach(row => pushUniqueDoc(rows, row));
  }
  return Array.from(rows.values()).filter(row => {
    const ids = collectIdentityCandidates(row.id, row.data || {});
    if (row.id === targetDocId) return false;
    if (authUid && ids.includes(authUid)) return false;
    return true;
  });
}
async function collectWorkspaceMemberConflictDocs(db, newEmail, aliases = [], targetEmails = []) {
  const rows = new Map();
  for (const field of ['email', 'emailLower', 'employeeEmail', 'userEmail']) {
    const docs = await getOneByQuery(db.collection('workspaceMembers'), field, newEmail).catch(() => []);
    docs.forEach(row => pushUniqueDoc(rows, row));
  }
  return Array.from(rows.values()).filter(row => activeMembership(row.data) && !memberMatchesIdentity(row.data, aliases, targetEmails, row.id));
}
async function collectTargetMembershipDocs(db, aliases = [], oldEmails = []) {
  const rows = new Map();
  const wm = db.collection('workspaceMembers');
  for (const alias of unique(aliases)) {
    for (const field of ['userId', 'uid', 'authUid', 'accountUserId']) {
      const docs = await getOneByQuery(wm, field, alias).catch(() => []);
      docs.forEach(row => { if (memberMatchesIdentity(row.data, aliases, oldEmails, row.id)) pushUniqueDoc(rows, row); });
    }
  }
  for (const email of uniqueEmails(oldEmails)) {
    for (const field of ['email', 'emailLower', 'employeeEmail', 'userEmail']) {
      const docs = await getOneByQuery(wm, field, email).catch(() => []);
      docs.forEach(row => { if (memberMatchesIdentity(row.data, aliases, oldEmails, row.id)) pushUniqueDoc(rows, row); });
    }
  }
  return Array.from(rows.values()).filter(row => activeMembership(row.data));
}
async function resolveAuthUser({ auth, targetUid, targetUser = {}, currentMembership = {}, currentEmail = '' }) {
  const initialAliases = collectIdentityCandidates(targetUid, targetUser, currentMembership);
  const initialEmails = uniqueEmails([currentEmail, ...collectEmailEvidence(targetUser, currentMembership)]);
  for (const candidate of initialAliases) {
    try {
      const authUser = await auth.getUser(candidate);
      const aliases = collectIdentityCandidates(targetUid, targetUser, currentMembership, authUser);
      const emails = uniqueEmails([...initialEmails, authUser.email]);
      if (aliases.includes(authUser.uid) || emails.includes(normalizeEmail(authUser.email))) return authUser;
    } catch (_) {}
  }
  if (currentEmail) {
    try {
      const authUser = await auth.getUserByEmail(currentEmail);
      const aliases = collectIdentityCandidates(targetUid, targetUser, currentMembership, authUser);
      const emails = uniqueEmails([...initialEmails, authUser.email]);
      if (aliases.includes(authUser.uid) || emails.includes(normalizeEmail(authUser.email))) return authUser;
    } catch (_) {}
  }
  for (const email of initialEmails) {
    try {
      const authUser = await auth.getUserByEmail(email);
      const aliases = collectIdentityCandidates(targetUid, targetUser, currentMembership, authUser);
      const emails = uniqueEmails([...initialEmails, authUser.email]);
      if (aliases.includes(authUser.uid) || emails.includes(normalizeEmail(authUser.email))) return authUser;
    } catch (_) {}
  }
  throw new AccountEmailChangeError(409, 'ambiguous-auth-identity', 'Could not safely resolve the Firebase Auth account for this employee.');
}
async function changeAccountLoginEmail(options = {}) {
  const { db, auth, ctx = {}, targetRef, targetDocId = '', targetUid = '', targetUser = {}, currentMembership = {}, submittedEmail = '', writeAudit } = options;
  if (!db || !auth || !targetRef) throw new AccountEmailChangeError(500, 'email-change-misconfigured', 'Email change service is not configured.');
  const newEmail = normalizeEmail(submittedEmail);
  if (!validEmail(newEmail)) throw new AccountEmailChangeError(400, 'invalid-email', 'Enter a valid email address.');
  const oldEmailEvidence = collectEmailEvidence(targetUser, currentMembership);
  const currentEmail = normalizeEmail(options.currentEmail || oldEmailEvidence[0] || '');
  if (!emailChanged(currentEmail, newEmail)) return { ok: true, emailChanged: false, oldEmail: currentEmail, newEmail };

  const ctxForPrivilege = { ...ctx, targetUid };
  if (targetIsPrivileged(targetUser, currentMembership, ctxForPrivilege)) {
    throw new AccountEmailChangeError(403, 'privileged-email-target', 'Owner, protected root, and System Administrator login emails cannot be changed from this staff support path.');
  }

  const authUser = await resolveAuthUser({ auth, targetUid, targetUser, currentMembership, currentEmail });
  const authUid = authUser.uid;
  const oldEmail = normalizeEmail(authUser.email || currentEmail);
  const aliases = collectIdentityCandidates(targetUid, targetUser, currentMembership, authUser);
  const oldEmails = uniqueEmails([oldEmail, currentEmail, ...oldEmailEvidence, authUser.email]);

  try {
    const existing = await auth.getUserByEmail(newEmail);
    if (existing?.uid && existing.uid !== authUid) {
      throw new AccountEmailChangeError(409, 'email-conflict', 'That email is already assigned to another 86 Chaos login.');
    }
  } catch (err) {
    if (err instanceof AccountEmailChangeError) throw err;
    const code = String(err?.code || '').toLowerCase();
    if (code && !code.includes('user-not-found')) throw err;
  }

  const userConflicts = await collectUserConflictDocs(db, newEmail, targetDocId || targetRef.id, authUid);
  if (userConflicts.length) throw new AccountEmailChangeError(409, 'firestore-email-conflict', 'That email is already assigned to another 86 Chaos profile.');
  const memberConflicts = await collectWorkspaceMemberConflictDocs(db, newEmail, aliases, oldEmails);
  if (memberConflicts.length) throw new AccountEmailChangeError(409, 'workspace-email-conflict', 'That email is already assigned to another active workspace member.');

  const memberships = await collectTargetMembershipDocs(db, aliases, oldEmails);
  const activeWorkspaceIds = unique([
    targetUser.restaurantId,
    targetUser.activeRestaurantId,
    targetUser.defaultRestaurantId,
    ...(Array.isArray(targetUser.workspaceIds) ? targetUser.workspaceIds : []),
    ...Object.entries(targetUser.memberships || {}).filter(([, v]) => activeMembership(v || {})).map(([k]) => k),
    ...memberships.map(row => row.data.restaurantId || row.data.workspaceId).filter(Boolean)
  ]);
  if (ctx.isSuperAdmin !== true && activeWorkspaceIds.length > 1) {
    throw new AccountEmailChangeError(403, 'multi-workspace-email-change-requires-system-admin', 'This employee uses the same login in multiple workspaces. A System Administrator must change their login email.');
  }
  if (ctx.isSuperAdmin !== true && ctx.restaurantId && !activeWorkspaceIds.includes(ctx.restaurantId)) {
    throw new AccountEmailChangeError(403, 'target-not-in-workspace', 'That employee is not part of this workspace.');
  }

  const originalEmailVerified = authUser.emailVerified === true;
  try {
    await auth.updateUser(authUid, { email: newEmail, emailVerified: false });
  } catch (err) {
    const mapped = classifyAuthEmailError(err);
    throw new AccountEmailChangeError(mapped.status, mapped.code, mapped.message);
  }

  const now = new Date().toISOString();
  const profilePatch = profileEmailPatch(targetUser, newEmail, now);
  const batch = db.batch();
  batch.set(targetRef, profilePatch, { merge: true });
  memberships.forEach(row => batch.set(row.ref, membershipEmailPatch(row.data, newEmail, now), { merge: true }));
  try {
    await batch.commit();
  } catch (err) {
    try {
      await auth.updateUser(authUid, { email: oldEmail, emailVerified: originalEmailVerified });
      throw new AccountEmailChangeError(500, 'firestore-email-sync-failed-rolled-back', 'Email update failed while synchronizing account records. Firebase Auth was rolled back.', { emailChanged: false, rolledBack: true });
    } catch (rollbackErr) {
      if (rollbackErr instanceof AccountEmailChangeError) throw rollbackErr;
      throw new AccountEmailChangeError(500, 'email-change-partial-failure', 'Email update partially failed after Firebase Auth changed. Contact support before trying again.', {
        emailChangePartialFailure: true,
        authEmailMayBeChanged: true,
        targetUid: targetUid || targetDocId,
        authUid,
        oldEmail,
        newEmail
      });
    }
  }

  let sessionsRevoked = true;
  let sessionWarning = '';
  try { await auth.revokeRefreshTokens(authUid); }
  catch (err) {
    sessionsRevoked = false;
    sessionWarning = 'Email changed, but Firebase refresh tokens could not be revoked immediately. The force logout signal was written.';
    console.error('account email change token revocation failed:', err?.message || err);
  }
  if (typeof writeAudit === 'function') {
    await writeAudit('STAFF_EMAIL_UPDATE', {
      authUid,
      targetUid: targetUid || targetDocId,
      oldEmail,
      newEmail,
      caller: ctx.callerEmail || ctx.email || ctx.uid || '',
      workspace: ctx.restaurantId || 'platform',
      membershipCount: memberships.length,
      sessionsRevoked
    }).catch(() => {});
  }
  return { ok: true, emailChanged: true, oldEmail, newEmail, authUid, membershipCount: memberships.length, sessionsRevoked, sessionWarning };
}
module.exports = {
  AccountEmailChangeError,
  normalizeEmail,
  emailChanged,
  validEmail,
  collectIdentityCandidates,
  targetIsPrivileged,
  membershipEmailPatch,
  profileEmailPatch,
  classifyAuthEmailError,
  changeAccountLoginEmail,
  _test: {
    activeMembership,
    memberMatchesIdentity,
    collectTargetMembershipDocs,
    collectUserConflictDocs,
    collectWorkspaceMemberConflictDocs,
    resolveAuthUser
  }
};
