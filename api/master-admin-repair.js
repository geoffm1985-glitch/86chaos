const { initAdmin, requireAppCheckIfEnforced, readBody, masterEmails, norm, clean } = require('./_chaos-admin');

const CURRENT_VERSION = '15.0.35';

function displayNameFromEmail(email) {
  const prefix = String(email || '').split('@')[0] || 'System Administrator';
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim() || 'System Administrator';
}

function mergeMap(existing, patch) {
  return { ...((existing && typeof existing === 'object') ? existing : {}), ...patch };
}

async function findExistingProfile(db, uid, email) {
  const direct = uid ? await db.collection('users').doc(uid).get() : null;
  if (direct?.exists) return { id: direct.id, data: direct.data() || {}, source: 'uid' };
  if (email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) return { id: byEmail.docs[0].id, data: byEmail.docs[0].data() || {}, source: 'email' };
  }
  return null;
}

async function inferRestaurantId(db, existingData, email, requestedRestaurantId) {
  const explicit = clean(requestedRestaurantId || existingData?.restaurantId || existingData?.activeRestaurantId || existingData?.defaultRestaurantId || '');
  if (explicit) return explicit;
  if (email) {
    try {
      const ownerSnap = await db.collection('restaurants').where('ownerEmail', '==', email).limit(1).get();
      if (!ownerSnap.empty) return ownerSnap.docs[0].id;
    } catch (_) {}
  }
  return 'platform';
}

async function writeAudit(db, actor, action, target, details) {
  try {
    await db.collection('auditLogs').add({
      restaurantId: 'platform',
      action,
      target,
      details,
      userId: actor.uid || 'master-admin-repair',
      userName: actor.email || actor.uid || 'Master Admin Repair',
      userEmail: actor.email || '',
      timestamp: new Date().toISOString(),
      securityLevel: 'system'
    });
  } catch (_) {}
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Use GET or POST.' });
  try {
    const app = initAdmin();
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });

    const token = String(req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.' });

    const decoded = await app.auth().verifyIdToken(token);
    const callerEmail = norm(decoded.email);
    const configuredMasterEmails = Array.from(new Set(masterEmails()));
    const callerIsConfiguredMaster = !!callerEmail && configuredMasterEmails.includes(callerEmail);
    const callerHasClaim = decoded.superAdmin === true;
    if (!callerIsConfiguredMaster && !callerHasClaim) {
      return res.status(403).json({ ok: false, error: 'Only a signed-in email listed in MASTER_ADMIN_EMAIL(S), or a Firebase superAdmin custom claim, may run master admin repair.' });
    }

    const db = app.firestore();
    if (req.method === 'GET') {
      const profiles = [];
      for (const email of configuredMasterEmails) {
        let authUser = null;
        let authMissing = false;
        try { authUser = await app.auth().getUserByEmail(email); }
        catch (err) { authMissing = err?.code === 'auth/user-not-found'; }
        let profile = null;
        if (authUser?.uid) profile = await findExistingProfile(db, authUser.uid, email);
        profiles.push({
          email,
          authUserFound: !!authUser,
          authMissing,
          uid: authUser?.uid || '',
          firestoreProfileFound: !!profile,
          firestoreProfileId: profile?.id || '',
          firestoreProfileSource: profile?.source || '',
          firestoreSuperAdmin: !!(profile?.data?.isSuperAdmin === true || profile?.data?.systemAccess?.superAdmin === true),
          restaurantId: profile?.data?.restaurantId || profile?.data?.activeRestaurantId || profile?.data?.defaultRestaurantId || ''
        });
      }
      return res.status(200).json({ ok: true, version: CURRENT_VERSION, callerEmail: decoded.email || '', configuredMasterEmailCount: configuredMasterEmails.length, profiles });
    }

    const body = await readBody(req);
    const requestedRestaurantId = clean(body.restaurantId || body.defaultRestaurantId || '');
    const requestedEmails = Array.isArray(body.emails) ? body.emails.map(norm).filter(Boolean) : [];
    const emailsToRepair = requestedEmails.length
      ? requestedEmails.filter(email => configuredMasterEmails.includes(email))
      : configuredMasterEmails;

    if (!emailsToRepair.length) {
      return res.status(400).json({ ok: false, error: 'No configured master-admin emails were available to repair. Check MASTER_ADMIN_EMAIL or MASTER_ADMIN_EMAILS in Vercel.' });
    }

    const repairedAt = new Date().toISOString();
    const results = [];
    for (const email of Array.from(new Set(emailsToRepair))) {
      try {
        const authUser = await app.auth().getUserByEmail(email);
        const existingProfile = await findExistingProfile(db, authUser.uid, email);
        const existingData = existingProfile?.data || {};
        const restaurantId = await inferRestaurantId(db, existingData, email, requestedRestaurantId);
        const permissions = mergeMap(existingData.permissions, {
          admin: true,
          systemAdministrator: true,
          forensics: true,
          financials: true,
          inventoryEdit: true,
          scheduleEdit: true,
          staffEdit: true,
          recipeEdit: true,
          wageView: true,
          wageEdit: true,
          settings: true,
          team: true,
          labor: true
        });
        const systemAccess = mergeMap(existingData.systemAccess, {
          superAdmin: true,
          systemAdministrator: true,
          forensics: true,
          securityCenter: true,
          backupCenter: true,
          diagnostics: true
        });
        const profilePayload = {
          ...existingData,
          uid: authUser.uid,
          userId: authUser.uid,
          email,
          name: clean(existingData.name || authUser.displayName || displayNameFromEmail(email)),
          role: clean(existingData.role || 'Owner'),
          accountRole: clean(existingData.accountRole || 'owner'),
          restaurantId,
          activeRestaurantId: clean(existingData.activeRestaurantId || restaurantId),
          defaultRestaurantId: clean(existingData.defaultRestaurantId || restaurantId),
          isSuperAdmin: true,
          isAdmin: true,
          isOwner: existingData.isOwner === false ? false : true,
          accountOwner: existingData.accountOwner === false ? false : true,
          active: true,
          isActive: true,
          permissions,
          systemAccess,
          masterAdminRepair: {
            repairedAt,
            repairedBy: decoded.email || decoded.uid,
            source: 'api/master-admin-repair',
            version: CURRENT_VERSION,
            previousProfileId: existingProfile?.id || '',
            previousProfileSource: existingProfile?.source || 'missing'
          },
          updatedAt: repairedAt
        };

        await db.collection('users').doc(authUser.uid).set(profilePayload, { merge: true });

        const existingClaims = authUser.customClaims || {};
        const desiredClaims = { ...existingClaims, superAdmin: true };
        let customClaimUpdated = false;
        if (existingClaims.superAdmin !== true) {
          await app.auth().setCustomUserClaims(authUser.uid, desiredClaims);
          customClaimUpdated = true;
        }

        const duplicateProfileId = existingProfile && existingProfile.id !== authUser.uid ? existingProfile.id : '';
        results.push({
          email,
          uid: authUser.uid,
          status: existingProfile ? 'updated' : 'created',
          firestoreProfileId: authUser.uid,
          previousProfileId: existingProfile?.id || '',
          previousProfileSource: existingProfile?.source || 'missing',
          duplicateProfileId,
          restaurantId,
          customClaimSuperAdmin: true,
          customClaimUpdated
        });
      } catch (err) {
        results.push({
          email,
          status: err?.code === 'auth/user-not-found' ? 'auth-user-missing' : 'error',
          error: err?.message || String(err)
        });
      }
    }

    await writeAudit(db, { uid: decoded.uid, email: decoded.email || '' }, 'MASTER_ADMIN_PROFILE_REPAIR', 'users', `Repaired ${results.filter(r => ['created', 'updated'].includes(r.status)).length}/${results.length} configured master-admin profile(s).`);

    return res.status(200).json({
      ok: results.every(r => r.status === 'created' || r.status === 'updated'),
      version: CURRENT_VERSION,
      repairedAt,
      callerEmail: decoded.email || '',
      requestedRestaurantId,
      results,
      reloginRecommended: results.some(r => r.customClaimUpdated),
      note: 'If custom claims were updated, log out and back in to refresh the Firebase ID token before publishing hardened Firestore rules.'
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Master admin repair failed.' });
  }
};
