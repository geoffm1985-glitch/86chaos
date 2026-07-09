const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
      })
    });
  }
  return admin;
}

function norm(v) { return String(v || '').toLowerCase().trim(); }
function cleanString(v, fallback = '') { return String(v == null ? fallback : v).trim(); }
function cleanMoney(v) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
}
function cleanPerms(perms = {}) {
  const allowed = ['schedule', 'events', 'ops', 'inventory', 'prep', 'sales', 'team', 'labor', 'settings', 'branding', 'integrations', 'menuIntelligence', 'wageView', 'wageEdit'];
  return allowed.reduce((acc, key) => {
    acc[key] = perms?.[key] === true;
    return acc;
  }, {});
}
function masterEmails() {
  return [
    process.env.MASTER_ADMIN_EMAIL,
    process.env.MASTER_ADMIN_EMAILS
  ].filter(Boolean).flatMap(v => String(v).split(',')).map(norm).filter(Boolean);
}
function memberDocId(uid, restaurantId) {
  return `${cleanString(uid).replace(/[^A-Za-z0-9_-]/g, '_')}_${cleanString(restaurantId).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
}
function membershipFromUserMap(user, restaurantId) {
  const m = user?.memberships?.[restaurantId];
  return m && typeof m === 'object' ? m : null;
}
async function loadWorkspaceMember(db, uid, email, restaurantId) {
  if (!restaurantId) return null;
  if (uid) {
    const byId = await db.collection('workspaceMembers').doc(memberDocId(uid, restaurantId)).get();
    if (byId.exists) return { id: byId.id, ...byId.data() };
  }
  if (email) {
    const snap = await db.collection('workspaceMembers')
      .where('restaurantId', '==', restaurantId)
      .where('email', '==', norm(email))
      .limit(1)
      .get();
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
}
function resolveRoleProfile(user, membership, restaurantId) {
  const legacyMatch = user?.restaurantId === restaurantId || user?.defaultRestaurantId === restaurantId || user?.activeRestaurantId === restaurantId;
  const source = membership || (legacyMatch ? user : {});
  return {
    name: cleanString(source.name || user?.name || ''),
    email: norm(source.email || user?.email || ''),
    phone: cleanString(source.phone || user?.phone || ''),
    role: cleanString(source.role || user?.role || 'Staff') || 'Staff',
    wage: cleanMoney(source.wage ?? user?.wage ?? 0),
    photoURL: cleanString(source.photoURL || user?.photoURL || ''),
    isAdmin: source.isAdmin === true || (legacyMatch && user?.isAdmin === true),
    isOwner: source.isOwner === true || source.accountOwner === true || (legacyMatch && (user?.isOwner === true || user?.accountOwner === true || user?.owner === true || user?.workspaceOwner === true || norm(user?.accountRole) === 'owner')),
    permissions: cleanPerms({ ...(legacyMatch ? (user?.permissions || {}) : {}), ...(source.permissions || {}) }),
    isActive: source.isActive !== false && user?.isActive !== false
  };
}

async function verifyCaller(req, body, db, auth) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase ID token. Log out and back in, then try again.');
  const decoded = await auth.verifyIdToken(token);
  const callerEmail = norm(decoded.email);

  let callerSnap = await db.collection('users').doc(decoded.uid).get();
  let callerDocId = decoded.uid;
  let caller = callerSnap.exists ? callerSnap.data() : null;

  if (!caller && callerEmail) {
    const emailSnap = await db.collection('users').where('email', '==', callerEmail).limit(1).get();
    if (!emailSnap.empty) {
      callerSnap = emailSnap.docs[0];
      callerDocId = callerSnap.id;
      caller = callerSnap.data();
    }
  }

  if (!caller) throw new Error('Your user profile could not be found in Firestore.');
  const requestedRestaurantId = cleanString(body.restaurantId || body.targetRestaurantId || caller.activeRestaurantId || caller.restaurantId || caller.defaultRestaurantId);
  if (!requestedRestaurantId) throw new Error('Missing restaurant ID for staff management. Switch to a workspace and try again.');

  const restSnap = await db.collection('restaurants').doc(requestedRestaurantId).get();
  const restaurant = restSnap.exists ? restSnap.data() : {};
  const callerMembership = membershipFromUserMap(caller, requestedRestaurantId) || await loadWorkspaceMember(db, decoded.uid, callerEmail, requestedRestaurantId);
  const callerProfile = resolveRoleProfile(caller, callerMembership, requestedRestaurantId);

  const isSuperAdmin = decoded.superAdmin === true || caller?.isSuperAdmin === true || caller?.systemAccess?.superAdmin === true || masterEmails().includes(callerEmail);
  const isOwner = Boolean(
    isSuperAdmin ||
    callerProfile.isOwner ||
    restaurant.ownerUid === decoded.uid ||
    restaurant.ownerUserId === decoded.uid ||
    restaurant.ownerUserId === callerDocId ||
    norm(restaurant.ownerEmail) === callerEmail ||
    norm(restaurant.ownerEmailLower) === callerEmail ||
    norm(restaurant.ownerUserEmail) === callerEmail
  );
  const isMember = Boolean(isSuperAdmin || isOwner || callerMembership || caller.restaurantId === requestedRestaurantId || caller.workspaceIds?.includes?.(requestedRestaurantId) || caller.memberships?.[requestedRestaurantId]);
  if (!isMember) throw new Error('Your login is not a member of this workspace.');

  const permissions = callerProfile.permissions || {};
  return {
    decoded,
    caller,
    callerDocId,
    callerEmail,
    callerMembership,
    callerProfile,
    restaurantId: requestedRestaurantId,
    restaurant,
    isSuperAdmin,
    isOwner,
    canManageStaff: Boolean(isSuperAdmin || isOwner || callerProfile.isAdmin === true || permissions.team === true),
    canEditWages: Boolean(isSuperAdmin || isOwner || permissions.wageEdit === true),
    canChooseWageAccess: Boolean(isSuperAdmin || isOwner)
  };
}

async function writeAudit(db, ctx, action, target, details) {
  try {
    await db.collection('auditLogs').add({
      userId: ctx.callerDocId || ctx.decoded.uid,
      userName: ctx.callerProfile?.name || ctx.caller?.name || ctx.callerEmail || 'Admin',
      userEmail: ctx.callerEmail || '',
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
      restaurantId: ctx.restaurantId,
      securityLevel: action.includes('WAGE') || action.includes('STAFF') ? 'sensitive' : 'standard',
      whyThisMatters: action.includes('WAGE') ? 'Payroll fields affect private employee wage data.' : 'Workspace memberships control employee app access.'
    });
  } catch (_) {}
}

function buildMembershipPayload(ctx, uid, base = {}, existing = {}) {
  const incomingPerms = cleanPerms(base.permissions || {});
  if (incomingPerms.wageEdit) incomingPerms.wageView = true;
  const currentPerms = cleanPerms(existing.permissions || {});
  const ownerOnlyPermissionKeys = ['wageView', 'wageEdit', 'settings', 'branding', 'integrations', 'menuIntelligence'];
  const permissions = ctx.canChooseWageAccess ? incomingPerms : { ...currentPerms, ...incomingPerms };
  if (!ctx.canChooseWageAccess) ownerOnlyPermissionKeys.forEach((key) => { permissions[key] = currentPerms[key] === true; });
  if (permissions.wageEdit) permissions.wageView = true;

  const payload = {
    userId: uid,
    uid,
    restaurantId: ctx.restaurantId,
    restaurantName: cleanString(ctx.restaurant?.name || ctx.restaurant?.businessName || ctx.restaurantId),
    name: cleanString(base.name, existing.name || 'Staff'),
    email: norm(base.email || existing.email),
    phone: cleanString(base.phone, existing.phone || ''),
    role: cleanString(base.role, existing.role || 'Staff') || 'Staff',
    photoURL: cleanString(base.photoURL, existing.photoURL || ''),
    permissions,
    isAdmin: ctx.canChooseWageAccess ? base.isAdmin === true : existing.isAdmin === true,
    isOwner: existing.isOwner === true,
    accountOwner: existing.accountOwner === true,
    workspaceOwner: existing.workspaceOwner === true,
    isActive: base.isActive === false ? false : true,
    membershipSource: 'staff-member-api',
    updatedAt: new Date().toISOString(),
    updatedBy: ctx.callerDocId || ctx.decoded.uid,
    updatedByEmail: ctx.callerEmail || ''
  };
  if (ctx.canEditWages && Object.prototype.hasOwnProperty.call(base, 'wage')) payload.wage = cleanMoney(base.wage);
  else payload.wage = cleanMoney(existing.wage || 0);
  return payload;
}

async function upsertAccountAndMembership(db, uid, accountBase, membershipPayload, { newAccount = false, setForcePasswordChange = false } = {}) {
  const now = new Date().toISOString();
  const userRef = db.collection('users').doc(uid);
  const currentSnap = await userRef.get();
  const current = currentSnap.exists ? currentSnap.data() || {} : {};
  const restId = membershipPayload.restaurantId;
  const docId = memberDocId(uid, restId);

  const membershipForMap = {
    restaurantId: restId,
    restaurantName: membershipPayload.restaurantName,
    role: membershipPayload.role,
    permissions: membershipPayload.permissions || {},
    isAdmin: membershipPayload.isAdmin === true,
    isOwner: membershipPayload.isOwner === true || membershipPayload.accountOwner === true || membershipPayload.workspaceOwner === true,
    isActive: membershipPayload.isActive !== false,
    wage: membershipPayload.wage || 0,
    updatedAt: now,
    membershipId: docId
  };

  const baseUpdate = {
    name: cleanString(accountBase.name || current.name || membershipPayload.name),
    email: norm(accountBase.email || current.email || membershipPayload.email),
    phone: cleanString(accountBase.phone || current.phone || membershipPayload.phone || ''),
    photoURL: cleanString(accountBase.photoURL || current.photoURL || membershipPayload.photoURL || ''),
    isActive: current.isActive === false && membershipPayload.isActive !== false ? true : (current.isActive !== false),
    workspaceIds: admin.firestore.FieldValue.arrayUnion(restId),
    [`memberships.${restId}`]: membershipForMap,
    updatedAt: now,
    staffWriteSource: 'staff-member-api-v14-multi-workspace'
  };

  if (!current.restaurantId) baseUpdate.restaurantId = restId;
  if (!current.defaultRestaurantId) baseUpdate.defaultRestaurantId = current.restaurantId || restId;
  if (!current.activeRestaurantId) baseUpdate.activeRestaurantId = current.restaurantId || restId;
  if (newAccount || setForcePasswordChange) {
    baseUpdate.forcePasswordChange = true;
    baseUpdate.passwordStored = false;
    baseUpdate.passwordPurgedAt = now;
    baseUpdate.createdAt = current.createdAt || now;
    if (!current.restaurantId || current.restaurantId === restId) {
      baseUpdate.role = membershipPayload.role;
      baseUpdate.wage = membershipPayload.wage || 0;
      baseUpdate.isAdmin = membershipPayload.isAdmin === true;
      baseUpdate.permissions = membershipPayload.permissions || {};
    }
  } else if (!current.restaurantId || current.restaurantId === restId) {
    baseUpdate.role = membershipPayload.role;
    baseUpdate.wage = membershipPayload.wage || 0;
    baseUpdate.isAdmin = membershipPayload.isAdmin === true;
    baseUpdate.permissions = membershipPayload.permissions || {};
  }

  const batch = db.batch();
  batch.set(db.collection('workspaceMembers').doc(docId), { ...membershipPayload, id: docId, membershipId: docId }, { merge: true });
  batch.set(userRef, baseUpdate, { merge: true });
  await batch.commit();
  return { membershipId: docId, userUpdate: baseUpdate };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const app = initAdmin();
    const db = app.firestore();
    const auth = app.auth();
    const body = req.body || {};
    const ctx = await verifyCaller(req, body, db, auth);
    if (!ctx.canManageStaff) return res.status(403).json({ error: 'Only an account owner, Super Admin, admin, or staff manager can manage staff.' });

    const action = cleanString(body.action || (body.targetUid ? 'update' : 'create')).toLowerCase();

    if (action === 'create') {
      const email = norm(body.email);
      const name = cleanString(body.name);
      const phone = cleanString(body.phone);
      if (!email || !name || !phone) return res.status(400).json({ error: 'Name, email, and phone are required.' });
      const tempPassword = cleanString(body.tempPassword) || Math.random().toString(36).slice(-8) + 'A1!';

      let authUser = null;
      let reusedExistingAuth = false;
      try {
        authUser = await auth.createUser({ email, password: tempPassword, displayName: name, disabled: false });
      } catch (err) {
        if (err?.code !== 'auth/email-already-exists') throw err;
        reusedExistingAuth = true;
        authUser = await auth.getUserByEmail(email);
        if (authUser.disabled) await auth.updateUser(authUser.uid, { disabled: false, displayName: name });
      }

      const memberId = memberDocId(authUser.uid, ctx.restaurantId);
      const existingMember = await db.collection('workspaceMembers').doc(memberId).get();
      const existing = existingMember.exists ? existingMember.data() || {} : {};
      if (existingMember.exists && existing.isActive !== false) {
        return res.status(409).json({ error: 'That employee is already active in this workspace.' });
      }

      const membershipPayload = buildMembershipPayload(ctx, authUser.uid, { ...body, name, email, phone, isActive: true }, existing);
      membershipPayload.createdAt = existing.createdAt || new Date().toISOString();
      membershipPayload.createdBy = ctx.callerDocId || ctx.decoded.uid;
      membershipPayload.createdByEmail = ctx.callerEmail || '';
      const { membershipId } = await upsertAccountAndMembership(db, authUser.uid, { name, email, phone, photoURL: body.photoURL }, membershipPayload, { newAccount: !reusedExistingAuth, setForcePasswordChange: !reusedExistingAuth });
      await writeAudit(db, ctx, reusedExistingAuth ? 'STAFF_LINK_WORKSPACE' : 'STAFF_CREATE', `${authUser.uid}/${ctx.restaurantId}`, `${name} (${email}) was ${reusedExistingAuth ? 'linked to this workspace with their existing login' : 'created'} by ${ctx.callerEmail}.`);
      return res.status(200).json({ ok: true, action: 'create', uid: authUser.uid, membershipId, tempPassword: reusedExistingAuth ? '' : tempPassword, reusedExistingAuth, staff: { id: authUser.uid, ...membershipPayload } });
    }

    if (action === 'update') {
      const targetUid = cleanString(body.targetUid || body.userId || body.uid);
      if (!targetUid) return res.status(400).json({ error: 'targetUid is required.' });
      const targetRef = db.collection('users').doc(targetUid);
      const targetSnap = await targetRef.get();
      const targetUser = targetSnap.exists ? targetSnap.data() || {} : {};
      const memberId = memberDocId(targetUid, ctx.restaurantId);
      const memberSnap = await db.collection('workspaceMembers').doc(memberId).get();
      const legacyMatch = targetUser.restaurantId === ctx.restaurantId;
      if (!memberSnap.exists && !legacyMatch && !ctx.isSuperAdmin) return res.status(404).json({ error: 'That staff member is not part of this workspace.' });
      const current = memberSnap.exists ? memberSnap.data() || {} : targetUser;
      const membershipPayload = buildMembershipPayload(ctx, targetUid, { ...body, email: current.email || targetUser.email || body.email }, current);
      const { membershipId } = await upsertAccountAndMembership(db, targetUid, { name: membershipPayload.name, email: membershipPayload.email, phone: membershipPayload.phone, photoURL: membershipPayload.photoURL }, membershipPayload);
      await writeAudit(db, ctx, membershipPayload.wage !== undefined ? 'STAFF_WAGE_UPDATE' : 'STAFF_UPDATE', `${targetUid}/${ctx.restaurantId}`, `${membershipPayload.name || targetUid} was updated by ${ctx.callerEmail}.`);
      return res.status(200).json({ ok: true, action: 'update', uid: targetUid, membershipId, staff: { id: targetUid, ...membershipPayload } });
    }

    if (action === 'deactivate' || action === 'delete') {
      const targetUid = cleanString(body.targetUid || body.userId || body.uid);
      if (!targetUid) return res.status(400).json({ error: 'targetUid is required.' });
      if (targetUid === ctx.decoded.uid || targetUid === ctx.callerDocId) {
        return res.status(400).json({ error: 'You cannot remove your own staff account from here. Use another owner/Super Admin account for ownership changes.' });
      }
      const targetRef = db.collection('users').doc(targetUid);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) return res.status(404).json({ error: 'Staff account was not found.' });
      const targetUser = targetSnap.data() || {};
      const targetEmail = norm(targetUser.email);
      const memberId = memberDocId(targetUid, ctx.restaurantId);
      const memberSnap = await db.collection('workspaceMembers').doc(memberId).get();
      const current = memberSnap.exists ? memberSnap.data() || {} : (targetUser.restaurantId === ctx.restaurantId ? targetUser : null);
      if (!current && !ctx.isSuperAdmin) return res.status(404).json({ error: 'That staff member is not part of this workspace.' });

      const targetIsOwner = Boolean(
        current?.isOwner === true || current?.accountOwner === true || current?.owner === true || current?.workspaceOwner === true ||
        norm(current?.accountRole) === 'owner' ||
        targetUid === ctx.restaurant?.ownerUid || targetUid === ctx.restaurant?.ownerUserId ||
        (targetEmail && (targetEmail === norm(ctx.restaurant?.ownerEmail) || targetEmail === norm(ctx.restaurant?.ownerEmailLower) || targetEmail === norm(ctx.restaurant?.ownerUserEmail)))
      );
      if (targetIsOwner && !ctx.isSuperAdmin) return res.status(403).json({ error: 'Only a Super Admin can remove an account-owner profile.' });

      const now = new Date().toISOString();
      const deactivatedMember = {
        ...(current || {}),
        userId: targetUid,
        uid: targetUid,
        restaurantId: ctx.restaurantId,
        isActive: false,
        deactivatedAt: now,
        deactivatedBy: ctx.callerDocId || ctx.decoded.uid,
        deactivatedByEmail: ctx.callerEmail || '',
        updatedAt: now,
        membershipSource: 'staff-member-api-v14-multi-workspace'
      };

      const activeMemberSnap = await db.collection('workspaceMembers').where('userId', '==', targetUid).where('isActive', '==', true).get().catch(() => null);
      const remainingActive = [];
      if (activeMemberSnap) {
        activeMemberSnap.forEach(doc => {
          const m = doc.data() || {};
          if (m.restaurantId !== ctx.restaurantId) remainingActive.push({ id: doc.id, ...m });
        });
      }
      const mapPatch = {
        restaurantId: ctx.restaurantId,
        restaurantName: deactivatedMember.restaurantName || ctx.restaurant?.name || ctx.restaurantId,
        role: deactivatedMember.role || 'Staff',
        permissions: deactivatedMember.permissions || {},
        isAdmin: deactivatedMember.isAdmin === true,
        isActive: false,
        deactivatedAt: now,
        membershipId: memberId
      };
      const userPatch = {
        [`memberships.${ctx.restaurantId}`]: mapPatch,
        updatedAt: now,
        staffWriteSource: 'staff-member-api-v14-multi-workspace'
      };
      let authDisabled = false;
      if (remainingActive.length === 0) {
        userPatch.isActive = false;
        try { await auth.updateUser(targetUid, { disabled: true }); authDisabled = true; }
        catch (authErr) { console.warn('staff-member deactivate could not disable auth user:', authErr?.code || authErr?.message || authErr); }
      } else if (targetUser.restaurantId === ctx.restaurantId || targetUser.activeRestaurantId === ctx.restaurantId || targetUser.defaultRestaurantId === ctx.restaurantId) {
        const next = remainingActive[0];
        userPatch.isActive = true;
        userPatch.restaurantId = next.restaurantId;
        userPatch.activeRestaurantId = next.restaurantId;
        userPatch.defaultRestaurantId = next.restaurantId;
      }

      const batch = db.batch();
      batch.set(db.collection('workspaceMembers').doc(memberId), deactivatedMember, { merge: true });
      batch.set(targetRef, userPatch, { merge: true });
      await batch.commit();
      await writeAudit(db, ctx, 'STAFF_REMOVE_FROM_WORKSPACE', `${targetUid}/${ctx.restaurantId}`, `${current?.name || targetUser.email || targetUid} was removed from this workspace by ${ctx.callerEmail}. Auth disabled: ${authDisabled ? 'yes, no other active workspaces' : 'no, other active workspace remains'}.`);
      return res.status(200).json({ ok: true, action: 'deactivate', uid: targetUid, membershipId: memberId, authDisabled, remainingWorkspaces: remainingActive.length });
    }

    return res.status(400).json({ error: 'Unsupported staff action.' });
  } catch (err) {
    console.error('staff-member API error:', err);
    const status = /permission|owner|admin|forbidden|member|workspace|already active/i.test(err?.message || '') ? 403 : 500;
    return res.status(status).json({ error: err?.message || 'Staff save failed.' });
  }
};
