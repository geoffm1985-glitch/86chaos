const { getAdminAppForRequest, authorize, readBody, writeAudit, clean } = require('../_chaos-admin');
const { isProtectedRootAdminEmail } = require('../_protected-root-admin');
const { changeAccountLoginEmail, normalizeEmail: normalizeAccountEmail } = require('../_account-email-change.cjs');
const { buildTargetIdentity, membershipMatchesTargetIdentity, isActiveWorkspaceMembership, canonicalMembershipDocId } = require('../_delete-user-cleanup-logic.cjs');
async function requireSystemAdmin(req) {
  const app = getAdminAppForRequest(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) return { ok: false, status: ctx.status || 403, error: ctx.error || 'System Administrator access is required.' };
  return { ok: true, app, ctx, db: ctx.db || app.firestore() };
}
function safeId(value = '') { return clean(value).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180); }
function bool(value) { return value === true; }
const PERMISSION_KEYS = new Set(['schedule','events','ops','inventory','prep','sales','team','labor']);
function safePermissions(raw = {}) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([key, value]) => { if (PERMISSION_KEYS.has(key)) out[key] = value === true; });
  }
  return out;
}

function normalizeEmail(value = '') { return String(value || '').toLowerCase().trim(); }
function cleanString(value = '') { return String(value == null ? '' : value).trim(); }
function isInactiveMembership(raw = {}) {
  if (!raw || typeof raw !== 'object') return false;
  const status = String(raw.status || raw.recordStatus || raw.membershipStatus || '').toLowerCase().trim();
  return raw.isActive === false || raw.disabled === true || raw.deleted === true || raw.removed === true || raw.archived === true || ['inactive', 'disabled', 'deleted', 'removed', 'deactivated'].includes(status);
}
function identityFromMember(row = {}) {
  const uid = cleanString(row.uid || row.userId || row.authUid || row.accountUserId || row.membershipUserId || row.id || '');
  const email = normalizeEmail(row.email || row.emailLower || row.employeeEmail || row.userEmail || '');
  return { uid, email };
}
const PURGE_PAGE_SIZE = 500;
function orderQueryByDocumentId(query) {
  if (!query || typeof query.orderBy !== 'function') return query;
  try {
    return query.orderBy('__name__');
  } catch (_) {
    return query;
  }
}
async function getAllQueryDocs(query, pageSize = PURGE_PAGE_SIZE) {
  const docs = [];
  let cursor = null;
  let base = orderQueryByDocumentId(query);
  for (let guard = 0; guard < 200; guard += 1) {
    let pageQuery = base;
    if (cursor && typeof pageQuery.startAfter === 'function') pageQuery = pageQuery.startAfter(cursor);
    if (typeof pageQuery.limit === 'function') pageQuery = pageQuery.limit(pageSize);
    const snap = await pageQuery.get();
    const pageDocs = Array.from(snap?.docs || []);
    if (pageDocs.length === 0) break;
    docs.push(...pageDocs);
    if (pageDocs.length < pageSize) break;
    if (typeof base.startAfter !== 'function') break;
    cursor = pageDocs[pageDocs.length - 1];
  }
  return docs;
}
async function collectWorkspacePurgeCandidates(db, restaurantId) {
  const candidates = new Map();
  const add = (raw = {}, docId = '', ref = null, source = '') => {
    const row = { ...(raw || {}), id: raw.id || docId, membershipId: raw.membershipId || docId };
    if (cleanString(row.restaurantId || row.workspaceId) !== restaurantId) return;
    const { uid, email } = identityFromMember(row);
    if (!uid && !email) return;
    const key = uid ? `uid:${uid}` : `email:${email}`;
    const current = candidates.get(key) || { uid, email, memberships: [] };
    if (!current.uid && uid) current.uid = uid;
    if (!current.email && email) current.email = email;
    current.memberships.push({ id: docId, ref, data: row, source });
    candidates.set(key, current);
  };
  const memberDocs = await getAllQueryDocs(db.collection('workspaceMembers').where('restaurantId', '==', restaurantId));
  memberDocs.forEach(doc => add(doc.data() || {}, doc.id, doc.ref, 'workspaceMembers'));
  const legacyDocs = await getAllQueryDocs(db.collection('users').where('restaurantId', '==', restaurantId)).catch(() => []);
  legacyDocs.forEach(doc => add({ ...(doc.data() || {}), uid: doc.id, userId: doc.id }, doc.id, null, 'legacy-users'));
  return Array.from(candidates.values());
}
async function loadTargetUser(db, candidate) {
  if (candidate.uid) {
    const snap = await db.collection('users').doc(candidate.uid).get();
    if (snap.exists) return { id: snap.id, ref: snap.ref, data: snap.data() || {} };
  }
  if (candidate.email) {
    const snap = await db.collection('users').where('email', '==', candidate.email).limit(1).get();
    if (!snap.empty) return { id: snap.docs[0].id, ref: snap.docs[0].ref, data: snap.docs[0].data() || {} };
  }
  return { id: candidate.uid || '', ref: candidate.uid ? db.collection('users').doc(candidate.uid) : null, data: {} };
}
async function collectTargetWorkspaceMembershipDocs(db, targetUid, targetEmail, targetUser, restaurantId) {
  const identity = buildTargetIdentity(targetUid, targetEmail, targetUser || {});
  const seen = new Map();
  const addSnap = (snap) => snap.forEach((doc) => {
    const data = doc.data() || {};
    if (String(data.restaurantId || '') !== String(restaurantId || '')) return;
    if (!membershipMatchesTargetIdentity(data, identity, doc.id)) return;
    seen.set(doc.id, { ref: doc.ref, id: doc.id, data });
  });
  const queries = [];
  if (targetUid) {
    queries.push(db.collection('workspaceMembers').where('userId', '==', targetUid).get());
    queries.push(db.collection('workspaceMembers').where('uid', '==', targetUid).get());
    queries.push(db.collection('workspaceMembers').where('authUid', '==', targetUid).get());
    queries.push(db.collection('workspaceMembers').where('accountUserId', '==', targetUid).get());
  }
  if (targetEmail) {
    queries.push(db.collection('workspaceMembers').where('email', '==', targetEmail).get());
    queries.push(db.collection('workspaceMembers').where('emailLower', '==', targetEmail).get());
    queries.push(db.collection('workspaceMembers').where('employeeEmail', '==', targetEmail).get());
    queries.push(db.collection('workspaceMembers').where('userEmail', '==', targetEmail).get());
  }
  await Promise.all(queries.map(p => p.then(addSnap).catch(() => {})));
  const canonicalId = canonicalMembershipDocId(targetUid, restaurantId);
  if (canonicalId) {
    const canonicalSnap = await db.collection('workspaceMembers').doc(canonicalId).get().catch(() => null);
    if (canonicalSnap?.exists) seen.set(canonicalSnap.id, { ref: canonicalSnap.ref, id: canonicalSnap.id, data: canonicalSnap.data() || {} });
  }
  return Array.from(seen.values());
}
async function collectRemainingActiveMemberships(db, targetUid, targetEmail, targetUser, removedRestaurantId) {
  const identity = buildTargetIdentity(targetUid, targetEmail, targetUser || {});
  const seen = new Map();
  const consider = (doc) => {
    const data = doc.data() || {};
    const restaurantId = cleanString(data.restaurantId || '');
    if (!restaurantId || restaurantId === removedRestaurantId) return;
    if (!membershipMatchesTargetIdentity(data, identity, doc.id)) return;
    if (!isActiveWorkspaceMembership(data)) return;
    seen.set(`${restaurantId}:${doc.id}`, { id: doc.id, ...data });
  };
  const queries = [];
  const idFields = ['userId', 'uid', 'authUid', 'accountUserId', 'membershipUserId'];
  const emailFields = ['email', 'emailLower', 'employeeEmail', 'userEmail'];
  for (const id of Array.from(identity.ids || [])) {
    for (const field of idFields) queries.push(db.collection('workspaceMembers').where(field, '==', id));
  }
  for (const email of Array.from(identity.emails || [])) {
    for (const field of emailFields) queries.push(db.collection('workspaceMembers').where(field, '==', email));
  }
  await Promise.all(queries.map(q => getAllQueryDocs(q).then(docs => docs.forEach(consider)).catch(() => {})));
  const memberships = targetUser?.memberships && typeof targetUser.memberships === 'object' ? targetUser.memberships : {};
  Object.entries(memberships).forEach(([restaurantId, member]) => {
    if (restaurantId !== removedRestaurantId && isActiveWorkspaceMembership(member || {})) seen.set(`map:${restaurantId}`, { id: member?.membershipId || restaurantId, restaurantId, ...(member || {}) });
  });
  return Array.from(seen.values());
}

function isProtectedPurgeTarget(candidate, targetUser, authCtx, restaurantData = {}) {
  const email = normalizeEmail(targetUser.email || targetUser.emailLower || targetUser.employeeEmail || targetUser.userEmail || candidate.email || '');
  const uid = cleanString(targetUser.uid || targetUser.authUid || targetUser.userId || targetUser.accountUserId || candidate.uid || '');
  const identity = buildTargetIdentity(uid, email, { ...(targetUser || {}), uid, id: uid, email });
  if (uid && (uid === authCtx.ctx.uid || uid === authCtx.ctx.callerDocId)) return true;
  if (email && email === normalizeEmail(authCtx.ctx.email || authCtx.ctx.callerEmail || '')) return true;
  if (isProtectedRootAdminEmail(email)) return true;
  const ownerIds = [restaurantData.ownerUid, restaurantData.ownerUserId]
    .map(cleanString)
    .filter(Boolean);
  const ownerEmails = [restaurantData.ownerEmail, restaurantData.ownerEmailLower, restaurantData.ownerUserEmail]
    .map(normalizeEmail)
    .filter(Boolean);
  if (ownerIds.some(id => identity.ids?.has(id))) return true;
  if (ownerEmails.some(ownerEmail => identity.emails?.has(ownerEmail))) return true;
  if (targetUser.isSuperAdmin === true || targetUser.systemAccess?.superAdmin === true || targetUser.platformAdmin === true) return true;
  if (targetUser.isOwner === true || targetUser.accountOwner === true || targetUser.owner === true || targetUser.workspaceOwner === true || normalizeEmail(targetUser.accountRole) === 'owner') return true;
  return false;
}

async function removeWorkspaceMembershipForPurge(auth, candidate, targetUserRow, restaurantId, now, restaurantData = {}) {
  const db = auth.db;
  const targetUser = targetUserRow.data || {};
  const targetUid = cleanString(candidate.uid || targetUserRow.id || targetUser.uid || targetUser.userId || '');
  const targetEmail = normalizeEmail(candidate.email || targetUser.email || targetUser.emailLower || '');
  if (!targetUid && !targetEmail) return { ok: false, failed: true, error: 'Target identity has no durable uid or email.' };
  if (isProtectedPurgeTarget(candidate, targetUser, auth, restaurantData)) return { ok: true, protectedSkipped: true };
  const memberDocs = await collectTargetWorkspaceMembershipDocs(db, targetUid, targetEmail, targetUser, restaurantId);
  const remainingActive = await collectRemainingActiveMemberships(db, targetUid, targetEmail, targetUser, restaurantId);
  const inactiveMemberDocs = memberDocs.filter(row => isInactiveMembership(row.data || {}));
  const activeOrUnknownDocs = memberDocs.filter(row => !isInactiveMembership(row.data || {}));
  if (!activeOrUnknownDocs.length && targetUser.restaurantId !== restaurantId && targetUser.activeRestaurantId !== restaurantId && targetUser.defaultRestaurantId !== restaurantId) return { ok: true, alreadyInactive: true };
  const userPatch = {
    [`memberships.${restaurantId}`]: {
      restaurantId,
      isActive: false,
      disabled: true,
      removed: true,
      status: 'inactive',
      membershipStatus: 'inactive',
      deactivatedAt: now,
      deactivatedBy: auth.ctx.uid || auth.ctx.callerDocId || '',
      deactivatedByEmail: auth.ctx.email || auth.ctx.callerEmail || '',
      membershipSource: 'system-admin-workspace-purge'
    },
    updatedAt: now,
    staffWriteSource: 'system-admin-workspace-purge',
    forceLogout: true,
    forceLogoutAt: now,
    forceLogoutNonce: `${now}_${Math.random().toString(36).slice(2)}`,
    forceLogoutReason: 'system-admin-workspace-user-purge'
  };
  let authDisableAttempted = false;
  let authDisabled = false;
  let authWasAlreadyDisabled = false;
  let authChangedByThisOperation = false;
  if (remainingActive.length === 0) {
    userPatch.isActive = false;
    if (targetUid) {
      let authUser = null;
      try { authUser = await auth.app.auth().getUser(targetUid); }
      catch (authErr) { return { ok: false, failed: true, authLookupFailed: true, error: authErr?.code || authErr?.message || String(authErr || 'Auth lookup failed') }; }
      authWasAlreadyDisabled = authUser?.disabled === true;
      if (!authWasAlreadyDisabled) {
        authDisableAttempted = true;
        try { await auth.app.auth().updateUser(targetUid, { disabled: true }); authDisabled = true; authChangedByThisOperation = true; }
        catch (authErr) { return { ok: false, failed: true, authDisableAttempted, authDisableFailed: true, error: authErr?.code || authErr?.message || String(authErr || 'Auth disable failed') }; }
      }
    }
  } else if (targetUser.restaurantId === restaurantId || targetUser.activeRestaurantId === restaurantId || targetUser.defaultRestaurantId === restaurantId) {
    const next = remainingActive[0];
    userPatch.isActive = true;
    userPatch.restaurantId = next.restaurantId;
    userPatch.activeRestaurantId = next.restaurantId;
    userPatch.defaultRestaurantId = next.restaurantId;
  }
  const batch = db.batch();
  const deactivationPatch = {
    userId: targetUid || undefined,
    uid: targetUid || undefined,
    authUid: targetUid || undefined,
    email: targetEmail || undefined,
    emailLower: targetEmail || undefined,
    restaurantId,
    isActive: false,
    disabled: true,
    removed: true,
    status: 'inactive',
    membershipStatus: 'inactive',
    deactivatedAt: now,
    deactivatedBy: auth.ctx.uid || auth.ctx.callerDocId || '',
    deactivatedByEmail: auth.ctx.email || auth.ctx.callerEmail || '',
    updatedAt: now,
    membershipSource: 'system-admin-workspace-purge'
  };
  const docsToPatch = memberDocs.length ? memberDocs : (targetUid ? [{ ref: db.collection('workspaceMembers').doc(canonicalMembershipDocId(targetUid, restaurantId)), id: canonicalMembershipDocId(targetUid, restaurantId), data: {} }] : []);
  docsToPatch.forEach(row => batch.set(row.ref || db.collection('workspaceMembers').doc(row.id), { ...(row.data || {}), ...deactivationPatch, membershipId: row.id, id: row.id }, { merge: true }));
  if (targetUserRow.ref) batch.set(targetUserRow.ref, userPatch, { merge: true });
  try {
    await batch.commit();
  } catch (firestoreErr) {
    const result = {
      ok: false,
      failed: true,
      firestoreCommitted: false,
      authDisableAttempted,
      authDisabled,
      authWasAlreadyDisabled,
      authRollbackAttempted: false,
      authRollbackSucceeded: false,
      partialFailure: authChangedByThisOperation === true,
      error: firestoreErr?.message || String(firestoreErr || 'Firestore membership removal failed')
    };
    if (authChangedByThisOperation && targetUid) {
      result.authRollbackAttempted = true;
      try {
        await auth.app.auth().updateUser(targetUid, { disabled: false });
        result.authRollbackSucceeded = true;
        result.authDisabled = false;
        result.error = `${result.error}; Firebase Auth disable was rolled back.`;
      } catch (rollbackErr) {
        result.authRollbackSucceeded = false;
        result.partialFailure = true;
        result.rollbackError = rollbackErr?.code || rollbackErr?.message || String(rollbackErr || 'Auth rollback failed');
        result.error = `${result.error}; Firebase Auth rollback failed: ${result.rollbackError}`;
      }
    }
    return result;
  }
  return { ok: true, firestoreCommitted: true, targetMembershipsDeactivated: docsToPatch.length, authDisableAttempted, authDisabled, authWasAlreadyDisabled, multiWorkspacePreserved: remainingActive.length > 0, alreadyInactive: inactiveMemberDocs.length > 0 && activeOrUnknownDocs.length === 0 };
}
async function purgeWorkspaceUsers(auth, body) {
  const restaurantId = safeId(body.restaurantId || body.targetRestaurantId || '');
  if (!restaurantId) return { status: 400, body: { ok: false, error: 'restaurantId is required.' } };
  if (body.confirmation !== `PURGE_WORKSPACE_USERS:${restaurantId}`) return { status: 400, body: { ok: false, error: 'Destructive confirmation is required.' } };
  const restSnap = await auth.db.collection('restaurants').doc(restaurantId).get().catch(() => null);
  if (restSnap && restSnap.exists === false) return { status: 404, body: { ok: false, error: 'Target workspace was not found.' } };
  const restaurantData = restSnap?.exists ? (restSnap.data() || {}) : {};
  const now = new Date().toISOString();
  const candidates = await collectWorkspacePurgeCandidates(auth.db, restaurantId);
  const counts = { considered: candidates.length, targetMembershipsDeactivated: 0, authDisabled: 0, multiWorkspacePreserved: 0, protectedSkipped: 0, alreadyInactive: 0, partialFailure: 0, failed: 0 };
  const failures = [];
  for (const candidate of candidates) {
    const targetUserRow = await loadTargetUser(auth.db, candidate);
    const result = await removeWorkspaceMembershipForPurge(auth, candidate, targetUserRow, restaurantId, now, restaurantData).catch(error => ({ ok: false, failed: true, error: error?.message || String(error) }));
    if (result.protectedSkipped) counts.protectedSkipped += 1;
    if (result.alreadyInactive) counts.alreadyInactive += 1;
    counts.targetMembershipsDeactivated += Number(result.targetMembershipsDeactivated || 0);
    if (result.authDisabled) counts.authDisabled += 1;
    if (result.multiWorkspacePreserved) counts.multiWorkspacePreserved += 1;
    if (result.partialFailure) counts.partialFailure += 1;
    if (!result.ok || result.failed) { counts.failed += 1; failures.push({ uid: candidate.uid || '', email: candidate.email || '', error: String(result.error || 'failed').slice(0, 200), partialFailure: result.partialFailure === true, authRollbackAttempted: result.authRollbackAttempted === true, authRollbackSucceeded: result.authRollbackSucceeded === true }); }
  }
  await writeAudit(auth.db, auth.ctx, 'SYSTEM_ADMIN_PURGE_WORKSPACE_USERS', `restaurants/${restaurantId}`, `System Administrator purged workspace user memberships. Considered ${counts.considered}; deactivated ${counts.targetMembershipsDeactivated}; auth disabled ${counts.authDisabled}; multi-workspace preserved ${counts.multiWorkspacePreserved}; protected skipped ${counts.protectedSkipped}; partial failures ${counts.partialFailure}; failed ${counts.failed}.`, restaurantId);
  return { status: counts.failed ? 207 : 200, body: { ok: counts.failed === 0, action: 'purge-workspace-users', restaurantId, ...counts, failures } };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  const auth = await requireSystemAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, code: 'system-admin-required', error: auth.error });
  const body = await readBody(req);
  const action = clean(body.action || '');
  if (action === 'purge-workspace-users') {
    try {
      const result = await purgeWorkspaceUsers(auth, body);
      return res.status(result.status).json(result.body);
    } catch (error) {
      return res.status(Number(error?.status || error?.httpStatus || 500)).json({ ok: false, code: 'system-admin-workspace-user-purge-failed', error: String(error?.message || error).slice(0, 300) });
    }
  }
  const userId = safeId(body.userId || body.id || '');
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required.' });
  const ref = auth.db.collection('users').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: 'User was not found.' });
  const current = snap.data() || {};
  const email = clean(current.email || body.email || '').toLowerCase();
  const protectedRoot = isProtectedRootAdminEmail(email);
  const now = new Date().toISOString();
  try {
    if (action === 'support-update') {
      const input = body.updates || {};
      const restaurantId = clean(input.restaurantId || '');
      if (!clean(input.name || '')) return res.status(400).json({ ok: false, error: 'name is required.' });
      if (!restaurantId) return res.status(400).json({ ok: false, error: 'restaurantId is required.' });
      const restSnap = await auth.db.collection('restaurants').doc(restaurantId).get();
      if (!restSnap.exists) return res.status(400).json({ ok: false, error: 'Target workspace was not found.' });
      if (protectedRoot && restaurantId !== clean(current.restaurantId || '')) return res.status(403).json({ ok: false, error: 'Protected root administrator cannot be moved.' });
      if (protectedRoot && input.email && clean(input.email).toLowerCase() !== email) return res.status(403).json({ ok: false, error: 'Protected root administrator email cannot be changed.' });
      if (protectedRoot && input.isActive === false) return res.status(403).json({ ok: false, error: 'Protected root administrator cannot be disabled.' });
      const rest = restSnap.data() || {};
      const patch = {
        name: clean(input.name).slice(0, 160),
        phone: clean(input.phone || '').slice(0, 60),
        role: clean(input.role || 'Staff').slice(0, 80),
        wage: Number.isFinite(Number(input.wage)) ? Number(input.wage) : 0,
        restaurantId,
        restaurantName: clean(rest.name || input.restaurantName || restaurantId).slice(0, 200),
        isAdmin: bool(input.isAdmin),
        isActive: input.isActive !== false,
        forcePasswordChange: bool(input.forcePasswordChange),
        permissions: safePermissions(input.permissions || {}),
        supportEditedAt: now,
        supportEditedBy: auth.ctx.email || auth.ctx.uid || 'System Administrator'
      };
      const submittedEmail = normalizeAccountEmail(input.email || '');
      const currentEmail = normalizeAccountEmail(current.email || current.emailLower || email || '');
      let emailChangeResult = { emailChanged: false, newEmail: currentEmail || submittedEmail };
      if (submittedEmail && submittedEmail !== currentEmail) {
        emailChangeResult = await changeAccountLoginEmail({
          db: auth.db,
          auth: auth.app.auth(),
          ctx: { ...auth.ctx, isSuperAdmin: true, restaurantId, restaurant: rest },
          targetRef: ref,
          targetDocId: userId,
          targetUid: userId,
          targetUser: current,
          currentMembership: {},
          currentEmail,
          submittedEmail,
          writeAudit: (actionName, detail) => writeAudit(
            auth.db,
            auth.ctx,
            actionName,
            `users/${userId}`,
            `Support login email changed from ${detail.oldEmail} to ${detail.newEmail}. Memberships synchronized: ${detail.membershipCount}. Sessions revoked: ${detail.sessionsRevoked ? 'yes' : 'no'}.`,
            restaurantId || 'platform'
          )
        });
      } else if (submittedEmail) {
        patch.email = submittedEmail.slice(0, 180);
      }
      await ref.set(patch, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'SUPPORT_USER_EDIT', `users/${userId}`, `Support edited ${emailChangeResult.newEmail || currentEmail || userId}; workspace=${patch.restaurantName}; role=${patch.role}; admin=${patch.isAdmin}; active=${patch.isActive}.`, patch.restaurantId || 'platform');
      return res.status(200).json({ ok: true, action, user: { id: userId, ...patch, email: emailChangeResult.newEmail || patch.email || currentEmail }, emailChanged: emailChangeResult.emailChanged === true, sessionsRevoked: emailChangeResult.sessionsRevoked, sessionWarning: emailChangeResult.sessionWarning || '' });
    }
    if (action === 'force-logout') {
      const patch = { forceLogout: true, forceLogoutAt: now, forceLogoutReason: clean(body.reason || 'system-admin-user-cache-clear').slice(0, 160) };
      await ref.set(patch, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'SUPPORT_USER_FORCE_LOGOUT', `users/${userId}`, 'System Administrator sent a force logout signal.', current.restaurantId || 'platform');
      return res.status(200).json({ ok: true, action, userId });
    }
    if (action === 'force-password-change') {
      if (protectedRoot) return res.status(403).json({ ok: false, error: 'Protected root administrator cannot be forced through this support path.' });
      await ref.set({ forcePasswordChange: true, forcePasswordChangeAt: now }, { merge: true });
      await writeAudit(auth.db, auth.ctx, 'SUPPORT_USER_FORCE_PASSWORD_CHANGE', `users/${userId}`, 'System Administrator required a password change.', current.restaurantId || 'platform');
      return res.status(200).json({ ok: true, action, userId });
    }
    return res.status(400).json({ ok: false, error: `Unsupported user action: ${action}` });
  } catch (error) {
    return res.status(Number(error?.status || error?.httpStatus || 400)).json({ ok: false, code: error?.code || 'system-admin-user-action-failed', error: String(error?.message || error).slice(0, 300), emailChangePartialFailure: error?.emailChangePartialFailure === true, authEmailMayBeChanged: error?.authEmailMayBeChanged === true, targetUid: error?.targetUid || undefined, authUid: error?.authUid || undefined, oldEmail: error?.oldEmail || undefined, newEmail: error?.newEmail || undefined });
  }
};
module.exports._test = { safePermissions, purgeWorkspaceUsers, collectWorkspacePurgeCandidates, loadTargetUser, collectTargetWorkspaceMembershipDocs, collectRemainingActiveMemberships, removeWorkspaceMembershipForPurge, isProtectedPurgeTarget, getAllQueryDocs };
