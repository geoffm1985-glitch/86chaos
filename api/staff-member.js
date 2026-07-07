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
  const allowed = ['schedule', 'events', 'ops', 'inventory', 'prep', 'sales', 'team', 'labor', 'wageView', 'wageEdit'];
  return allowed.reduce((acc, key) => {
    acc[key] = perms?.[key] === true;
    return acc;
  }, {});
}
function masterEmails() {
  return [
    process.env.MASTER_ADMIN_EMAIL,
    process.env.MASTER_ADMIN_EMAILS,
    'geoffm1985@gmail.com',
    'geoffrm1985@gmail.com'
  ].filter(Boolean).flatMap(v => String(v).split(',')).map(norm).filter(Boolean);
}

async function verifyCaller(req, db, auth) {
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
  const restaurantId = cleanString(caller.restaurantId);
  if (!restaurantId) throw new Error('Your user profile is missing a restaurant ID.');

  const restSnap = await db.collection('restaurants').doc(restaurantId).get();
  const restaurant = restSnap.exists ? restSnap.data() : {};

  const isSuperAdmin = decoded.superAdmin === true || caller?.isSuperAdmin === true || masterEmails().includes(callerEmail);
  const isOwner = Boolean(
    isSuperAdmin ||
    caller?.isOwner === true ||
    caller?.accountOwner === true ||
    caller?.owner === true ||
    caller?.workspaceOwner === true ||
    norm(caller?.accountRole) === 'owner' ||
    norm(caller?.ownerEmail) === callerEmail ||
    restaurant.ownerUid === decoded.uid ||
    restaurant.ownerUserId === decoded.uid ||
    restaurant.ownerUserId === callerDocId ||
    norm(restaurant.ownerEmail) === callerEmail ||
    norm(restaurant.ownerEmailLower) === callerEmail ||
    norm(restaurant.ownerUserEmail) === callerEmail
  );

  const permissions = caller?.permissions || {};
  return {
    decoded,
    caller,
    callerDocId,
    callerEmail,
    restaurantId,
    restaurant,
    isSuperAdmin,
    isOwner,
    canManageStaff: Boolean(isSuperAdmin || isOwner || caller?.isAdmin === true || permissions.team === true),
    canEditWages: Boolean(isSuperAdmin || isOwner || permissions.wageEdit === true),
    canChooseWageAccess: Boolean(isSuperAdmin || isOwner)
  };
}

async function writeAudit(db, ctx, action, target, details) {
  try {
    await db.collection('auditLogs').add({
      userId: ctx.callerDocId || ctx.decoded.uid,
      userName: ctx.caller?.name || ctx.callerEmail || 'Admin',
      userEmail: ctx.callerEmail || '',
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
      restaurantId: ctx.restaurantId,
      securityLevel: action.includes('WAGE') || action.includes('STAFF') ? 'sensitive' : 'standard',
      whyThisMatters: action.includes('WAGE') ? 'Payroll fields affect private employee wage data.' : 'Staff records control employee app access.'
    });
  } catch (_) {}
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const app = initAdmin();
    const db = app.firestore();
    const auth = app.auth();
    const ctx = await verifyCaller(req, db, auth);
    if (!ctx.canManageStaff) return res.status(403).json({ error: 'Only an account owner, Super Admin, admin, or staff manager can manage staff.' });

    const body = req.body || {};
    const action = cleanString(body.action || (body.targetUid ? 'update' : 'create')).toLowerCase();
    const incomingPerms = cleanPerms(body.permissions || {});
    if (incomingPerms.wageEdit) incomingPerms.wageView = true;

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
        await auth.updateUser(authUser.uid, { password: tempPassword, displayName: name, disabled: false });
      }

      const targetRef = db.collection('users').doc(authUser.uid);
      const existingTarget = await targetRef.get();
      if (existingTarget.exists) {
        const targetData = existingTarget.data() || {};
        if (targetData.restaurantId && targetData.restaurantId !== ctx.restaurantId && !ctx.isSuperAdmin) {
          return res.status(403).json({ error: 'That email already belongs to another workspace.' });
        }
      }

      const permissions = ctx.canChooseWageAccess ? incomingPerms : { ...incomingPerms, wageView: false, wageEdit: false };
      const wage = ctx.canEditWages ? cleanMoney(body.wage) : 0;
      const payload = {
        name,
        email,
        phone,
        role: cleanString(body.role, 'Staff') || 'Staff',
        wage,
        isAdmin: ctx.canChooseWageAccess ? body.isAdmin === true : false,
        permissions,
        isActive: true,
        forcePasswordChange: true,
        passwordStored: false,
        passwordPurgedAt: new Date().toISOString(),
        photoURL: cleanString(body.photoURL),
        restaurantId: ctx.restaurantId,
        createdBy: ctx.callerDocId || ctx.decoded.uid,
        createdByEmail: ctx.callerEmail || '',
        createdAt: existingTarget.exists ? (existingTarget.data().createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        staffWriteSource: 'staff-member-api'
      };
      await targetRef.set(payload, { merge: true });
      await writeAudit(db, ctx, 'STAFF_CREATE', authUser.uid, `${name} (${email}) was ${reusedExistingAuth ? 'linked/repaired' : 'created'} by ${ctx.callerEmail}.`);
      return res.status(200).json({ ok: true, action: 'create', uid: authUser.uid, tempPassword, reusedExistingAuth, staff: { id: authUser.uid, ...payload } });
    }

    if (action === 'update') {
      const targetUid = cleanString(body.targetUid);
      if (!targetUid) return res.status(400).json({ error: 'targetUid is required.' });
      const targetRef = db.collection('users').doc(targetUid);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) return res.status(404).json({ error: 'Staff profile was not found.' });
      const current = targetSnap.data() || {};
      if (current.restaurantId !== ctx.restaurantId && !ctx.isSuperAdmin) return res.status(403).json({ error: 'That staff profile belongs to another workspace.' });

      const targetPerms = cleanPerms(current.permissions || {});
      const nextPerms = ctx.canChooseWageAccess ? incomingPerms : { ...targetPerms, ...incomingPerms, wageView: targetPerms.wageView, wageEdit: targetPerms.wageEdit };
      if (nextPerms.wageEdit) nextPerms.wageView = true;

      const payload = {
        name: cleanString(body.name, current.name),
        phone: cleanString(body.phone, current.phone || ''),
        role: cleanString(body.role, current.role || 'Staff'),
        photoURL: cleanString(body.photoURL, current.photoURL || ''),
        permissions: nextPerms,
        restaurantId: current.restaurantId || ctx.restaurantId,
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.callerDocId || ctx.decoded.uid,
        staffWriteSource: 'staff-member-api'
      };
      if (ctx.canChooseWageAccess) payload.isAdmin = body.isAdmin === true;
      if (ctx.canEditWages) payload.wage = cleanMoney(body.wage);

      await targetRef.set(payload, { merge: true });
      await writeAudit(db, ctx, payload.wage !== undefined ? 'STAFF_WAGE_UPDATE' : 'STAFF_UPDATE', targetUid, `${payload.name || targetUid} was updated by ${ctx.callerEmail}.`);
      return res.status(200).json({ ok: true, action: 'update', uid: targetUid, staff: { id: targetUid, ...current, ...payload } });
    }


    if (action === 'deactivate' || action === 'delete') {
      const targetUid = cleanString(body.targetUid);
      if (!targetUid) return res.status(400).json({ error: 'targetUid is required.' });
      const targetRef = db.collection('users').doc(targetUid);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) return res.status(404).json({ error: 'Staff profile was not found.' });
      const current = targetSnap.data() || {};
      if (current.restaurantId !== ctx.restaurantId && !ctx.isSuperAdmin) return res.status(403).json({ error: 'That staff profile belongs to another workspace.' });
      if (targetUid === ctx.decoded.uid || targetUid === ctx.callerDocId) {
        return res.status(400).json({ error: 'You cannot remove your own staff account from here. Use another owner/Super Admin account for ownership changes.' });
      }
      const targetEmail = norm(current.email);
      const targetIsOwner = Boolean(
        current?.isOwner === true ||
        current?.accountOwner === true ||
        current?.owner === true ||
        current?.workspaceOwner === true ||
        norm(current?.accountRole) === 'owner' ||
        targetUid === ctx.restaurant?.ownerUid ||
        targetUid === ctx.restaurant?.ownerUserId ||
        targetEmail && (
          targetEmail === norm(ctx.restaurant?.ownerEmail) ||
          targetEmail === norm(ctx.restaurant?.ownerEmailLower) ||
          targetEmail === norm(ctx.restaurant?.ownerUserEmail)
        )
      );
      if (targetIsOwner && !ctx.isSuperAdmin) {
        return res.status(403).json({ error: 'Only a Super Admin can remove an account-owner profile.' });
      }

      const now = new Date().toISOString();
      const payload = {
        isActive: false,
        deactivatedAt: now,
        deactivatedBy: ctx.callerDocId || ctx.decoded.uid,
        deactivatedByEmail: ctx.callerEmail || '',
        staffWriteSource: 'staff-member-api',
        updatedAt: now
      };
      await targetRef.set(payload, { merge: true });
      let authDisabled = false;
      try {
        await auth.updateUser(targetUid, { disabled: true });
        authDisabled = true;
      } catch (authErr) {
        console.warn('staff-member deactivate could not disable auth user:', authErr?.code || authErr?.message || authErr);
      }
      await writeAudit(db, ctx, 'STAFF_DEACTIVATE', targetUid, `${current.name || current.email || targetUid} was removed from the active roster by ${ctx.callerEmail}. Auth disabled: ${authDisabled ? 'yes' : 'no'}.`);
      return res.status(200).json({ ok: true, action: 'deactivate', uid: targetUid, authDisabled, staff: { id: targetUid, ...current, ...payload } });
    }

    return res.status(400).json({ error: 'Unsupported staff action.' });
  } catch (err) {
    console.error('staff-member API error:', err);
    const status = /permission|owner|admin|forbidden/i.test(err?.message || '') ? 403 : 500;
    return res.status(status).json({ error: err?.message || 'Staff save failed.' });
  }
};
