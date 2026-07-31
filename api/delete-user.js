const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');
const { requireMfaIfEnforced, masterEmails } = require('./_chaos-admin');
const { isProtectedRootAdminEmail, protectedRootAdminError } = require('./_protected-root-admin');
const { normalizeEmail, cleanString, canonicalMembershipDocId, isActiveWorkspaceMembership, buildTargetIdentity, membershipMatchesTargetIdentity, targetWorkspaceIds } = require('./_delete-user-cleanup-logic.cjs');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}

async function collectTargetWorkspaceMembershipDocs(db, targetUid = '', targetEmail = '', targetProfile = {}) {
  const identity = buildTargetIdentity(targetUid, targetEmail, targetProfile);
  const byPath = new Map();
  const collectionRef = db.collection('workspaceMembers');

  const addSnapshotDoc = (docSnap) => {
    if (!docSnap?.exists) return;
    const data = docSnap.data() || {};
    const id = docSnap.id || data.id || data.membershipId || '';
    if (!membershipMatchesTargetIdentity({ ...data, id }, identity, id)) return;
    byPath.set(docSnap.ref.path, { ref: docSnap.ref, id, data });
  };

  const candidateDocIds = new Set([cleanString(targetUid)].filter(Boolean));
  targetWorkspaceIds(targetUid, targetProfile).forEach(restaurantId => {
    const docId = canonicalMembershipDocId(targetUid, restaurantId);
    if (docId) candidateDocIds.add(docId);
  });

  await Promise.all(Array.from(candidateDocIds).map(async (docId) => {
    try {
      const snap = await collectionRef.doc(docId).get();
      addSnapshotDoc(snap);
    } catch (_) {}
  }));

  const querySpecs = [];
  Array.from(identity.ids || []).forEach(value => {
    ['userId', 'uid', 'authUid', 'accountUserId'].forEach(field => querySpecs.push({ field, value }));
  });
  Array.from(identity.emails || []).forEach(value => {
    ['email', 'emailLower', 'employeeEmail', 'userEmail'].forEach(field => querySpecs.push({ field, value }));
  });

  for (const spec of querySpecs) {
    try {
      const snap = await collectionRef.where(spec.field, '==', spec.value).get();
      snap.forEach(addSnapshotDoc);
    } catch (err) {
      console.warn(`[86chaos] workspaceMembers lookup failed for ${spec.field}`, err?.message || err);
    }
  }

  return Array.from(byPath.values());
}

async function deactivateAndDeleteTargetMemberships(db, membershipDocs = [], caller = {}) {
  const nowIso = new Date().toISOString();
  const tombstonePayload = {
    isActive: false,
    deleted: true,
    isDeleted: true,
    recordStatus: 'deleted',
    status: 'deleted',
    deletedAt: nowIso,
    deactivatedAt: nowIso,
    removedAt: nowIso,
    deletedBy: caller.uid || caller.email || 'system-admin',
    deletedByEmail: caller.email || '',
    deletionSource: 'api/delete-user-global',
    updatedAt: nowIso
  };

  const deactivateResults = await Promise.allSettled(membershipDocs.map(({ ref }) => ref.set(tombstonePayload, { merge: true })));
  const deleteResults = await Promise.allSettled(membershipDocs.map(({ ref }) => ref.delete()));

  return {
    matched: membershipDocs.length,
    deactivated: deactivateResults.filter(result => result.status === 'fulfilled').length,
    deleted: deleteResults.filter(result => result.status === 'fulfilled').length,
    failed: membershipDocs.filter((_, index) => deactivateResults[index]?.status === 'rejected' && deleteResults[index]?.status === 'rejected').length,
    errors: [...deactivateResults, ...deleteResults]
      .filter(result => result.status === 'rejected')
      .map(result => result.reason?.message || String(result.reason || 'membership cleanup failed'))
      .slice(0, 5)
  };
}

async function cleanupTargetWorkspaceMemberships(db, targetUid = '', targetEmail = '', targetProfile = {}, caller = {}) {
  const before = await collectTargetWorkspaceMembershipDocs(db, targetUid, targetEmail, targetProfile);
  const cleanup = await deactivateAndDeleteTargetMemberships(db, before, caller);
  const after = await collectTargetWorkspaceMembershipDocs(db, targetUid, targetEmail, targetProfile);
  const activeRemaining = after.filter(({ data }) => isActiveWorkspaceMembership(data));
  if (activeRemaining.length) {
    const ids = activeRemaining.map(({ id }) => id).filter(Boolean).slice(0, 6).join(', ');
    const err = new Error(`Employee account cleanup is incomplete. ${activeRemaining.length} active workspace membership(s) still exist${ids ? `: ${ids}` : ''}.`);
    err.cleanup = { ...cleanup, activeRemaining: activeRemaining.length };
    throw err;
  }
  return { ...cleanup, activeRemaining: 0 };
}

async function verifySuperAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase ID token.');
  const app = initAdmin(req);
  const decoded = await app.auth().verifyIdToken(token);
  const db = app.firestore();
  const email = normalizeEmail(decoded.email || '');
  let profileSnap = await db.collection('users').doc(decoded.uid).get();
  let profile = profileSnap.exists ? (profileSnap.data() || {}) : {};
  if (!profileSnap.exists && email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) profile = byEmail.docs[0].data() || {};
  }
  const isSuperAdmin = decoded.superAdmin === true || profile.isSuperAdmin === true || profile.systemAccess?.superAdmin === true || masterEmails().includes(email);
  if (!isSuperAdmin) throw new Error('Super admin access required.');
  const mfa = requireMfaIfEnforced(decoded, profile, true);
  if (!mfa.ok) throw new Error(mfa.error);
  return decoded;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await verifySuperAdmin(req);
    const app = initAdmin(req);
    const db = app.firestore();
    const { targetUid } = req.body || {};
    if (!targetUid) return res.status(400).json({ error: 'targetUid is required.' });
    if (targetUid === caller.uid) return res.status(400).json({ error: 'Refusing to delete the signed-in admin account.' });

    const protectedEmails = new Set(masterEmails());
    const profileRef = db.collection('users').doc(targetUid);
    const profileSnap = await profileRef.get();
    const targetProfile = profileSnap.exists ? (profileSnap.data() || {}) : {};
    let targetEmail = normalizeEmail(targetProfile.email || targetProfile.employeeEmail || targetProfile.userEmail || '');
    let authDeleted = false;
    let authAlreadyMissing = false;
    let authUser = null;

    try {
      authUser = await app.auth().getUser(targetUid);
      targetEmail = normalizeEmail(authUser.email || targetEmail);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') throw authErr;
      authAlreadyMissing = true;
    }

    const targetIsProtectedAdmin = isProtectedRootAdminEmail(targetEmail) || protectedEmails.has(targetEmail) || authUser?.customClaims?.superAdmin === true || targetProfile?.isSuperAdmin === true || targetProfile?.systemAccess?.superAdmin === true;
    if (isProtectedRootAdminEmail(targetEmail)) throw protectedRootAdminError();
    if (targetIsProtectedAdmin) return res.status(400).json({ error: 'Refusing to delete a protected administrator. Revoke administrator access first, then review again.' });

    const membershipCleanup = await cleanupTargetWorkspaceMemberships(db, targetUid, targetEmail, targetProfile, caller);

    if (!authAlreadyMissing) {
      await app.auth().deleteUser(targetUid);
      authDeleted = true;
    }

    await profileRef.delete();
    const profileDeleted = true;

    await db.collection('auditLogs').add({
      userId: caller.uid,
      userName: caller.email || 'System Admin',
      action: 'DELETE_USER',
      target: targetUid,
      details: `Deleted auth/profile and ${membershipCleanup.matched} workspace membership(s) for ${targetEmail || targetUid}`,
      timestamp: new Date().toISOString(),
      restaurantId: 'system',
      isGhost: false,
      cleanup: {
        authDeleted,
        authAlreadyMissing,
        profileDeleted,
        membershipsMatched: membershipCleanup.matched,
        membershipsDeactivated: membershipCleanup.deactivated,
        membershipsDeleted: membershipCleanup.deleted,
        membershipsActiveRemaining: membershipCleanup.activeRemaining
      }
    }).catch(() => {});

    res.status(200).json({
      ok: true,
      deletedUid: targetUid,
      email: targetEmail,
      authDeleted,
      authAlreadyMissing,
      profileDeleted,
      membershipsMatched: membershipCleanup.matched,
      membershipsDeactivated: membershipCleanup.deactivated,
      membershipsDeleted: membershipCleanup.deleted,
      membershipsActiveRemaining: membershipCleanup.activeRemaining,
      cleanup: membershipCleanup
    });
  } catch (err) {
    const status = err?.cleanup ? 409 : 403;
    res.status(status).json({ error: err.message || 'Delete failed.', cleanup: err.cleanup || null });
  }
}

module.exports = handler;
module.exports._test = {
  normalizeEmail,
  canonicalMembershipDocId,
  isActiveWorkspaceMembership,
  buildTargetIdentity,
  membershipMatchesTargetIdentity,
  targetWorkspaceIds
};
