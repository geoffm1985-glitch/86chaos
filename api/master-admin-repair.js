const { admin, initAdmin, requireAppCheckIfEnforced, readBody, parseMasterEmailEnv, norm, clean, memberDocId } = require('./_chaos-admin');

const CURRENT_VERSION = '15.0.55';

function displayNameFromEmail(email) {
  const prefix = String(email || '').split('@')[0] || 'System Administrator';
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim() || 'System Administrator';
}

function mergeMap(existing, patch) {
  return { ...((existing && typeof existing === 'object' && !Array.isArray(existing)) ? existing : {}), ...patch };
}

function uniqueList(values) {
  return Array.from(new Set((values || []).map(v => clean(v)).filter(Boolean)));
}

function sanitizeFirestore(value) {
  if (value === undefined || typeof value === 'function') return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sanitizeFirestore).filter(v => v !== undefined);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function' || typeof value.isEqual === 'function') return value;
    const out = {};
    Object.entries(value).forEach(([key, child]) => {
      const next = sanitizeFirestore(child);
      if (next !== undefined) out[key] = next;
    });
    return out;
  }
  return value;
}

function getAuthClient(app) {
  if (app && typeof app.auth === 'function') return app.auth();
  return admin.auth(app);
}

function getDbClient(app) {
  if (app && typeof app.firestore === 'function') return app.firestore();
  return admin.firestore(app);
}

function getRuntimeProjectId(app) {
  const fromApp = clean(app?.options?.projectId || '');
  if (fromApp) return fromApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS || '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return clean(parsed.project_id || parsed.projectId || '');
    } catch (_) {}
  }
  return clean(process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '');
}

function getRuntimeEnv(app) {
  return {
    firebaseProjectId: getRuntimeProjectId(app),
    firebaseStorageBucket: clean(app?.options?.storageBucket || process.env.FIREBASE_STORAGE_BUCKET || ''),
    vercelEnv: clean(process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'),
    version: CURRENT_VERSION
  };
}

async function findExistingProfile(db, uid, email) {
  const direct = uid ? await db.collection('users').doc(uid).get() : null;
  if (direct?.exists) return { id: direct.id, ref: direct.ref, data: direct.data() || {}, source: 'uid' };
  if (email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) return { id: byEmail.docs[0].id, ref: byEmail.docs[0].ref, data: byEmail.docs[0].data() || {}, source: 'email' };
    const byEmailLower = await db.collection('users').where('emailLower', '==', email).limit(1).get().catch(() => null);
    if (byEmailLower && !byEmailLower.empty) return { id: byEmailLower.docs[0].id, ref: byEmailLower.docs[0].ref, data: byEmailLower.docs[0].data() || {}, source: 'emailLower' };
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
    try {
      const memberSnap = await db.collection('workspaceMembers').where('email', '==', email).limit(1).get();
      if (!memberSnap.empty) return clean(memberSnap.docs[0].data()?.restaurantId || '');
    } catch (_) {}
  }
  return 'platform';
}

async function writeAudit(db, actor, action, target, details, extra = {}) {
  try {
    await db.collection('auditLogs').add(sanitizeFirestore({
      restaurantId: extra.restaurantId || 'platform',
      action,
      target,
      details,
      userId: actor.uid || 'master-admin-repair',
      userName: actor.email || actor.uid || 'Master Admin Repair',
      userEmail: actor.email || '',
      timestamp: new Date().toISOString(),
      securityLevel: 'system',
      source: 'api/master-admin-repair',
      version: CURRENT_VERSION,
      ...extra
    }));
  } catch (_) {}
}

async function writeWorkspaceMemberIfNeeded(db, authUser, email, restaurantId, repairedAt, decoded) {
  if (!restaurantId || restaurantId === 'platform') return { attempted: false, status: 'skipped-platform' };
  const ref = db.collection('workspaceMembers').doc(memberDocId(authUser.uid, restaurantId));
  const payload = sanitizeFirestore({
    uid: authUser.uid,
    userId: authUser.uid,
    email,
    emailLower: email,
    name: clean(authUser.displayName || displayNameFromEmail(email)),
    role: 'Owner',
    restaurantId,
    isActive: true,
    active: true,
    isOwner: true,
    accountOwner: true,
    isAdmin: true,
    isSuperAdmin: true,
    permissions: {
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
    },
    systemAccess: {
      superAdmin: true,
      systemAdministrator: true,
      forensics: true,
      securityCenter: true,
      backupCenter: true,
      diagnostics: true
    },
    updatedAt: repairedAt,
    masterAdminRepair: {
      repairedAt,
      repairedBy: decoded.email || decoded.uid,
      source: 'api/master-admin-repair',
      version: CURRENT_VERSION
    }
  });
  await ref.set(payload, { merge: true });
  const verify = await ref.get();
  return { attempted: true, status: verify.exists ? 'verified' : 'write-not-verified', docPath: ref.path };
}

async function repairOne({ app, authClient, db, decoded, email, requestedRestaurantId, repairedAt }) {
  const authUser = await authClient.getUserByEmail(email);
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
  const existingWorkspaceIds = Array.isArray(existingData.workspaceIds) ? existingData.workspaceIds : [];
  const workspaceIds = uniqueList([...existingWorkspaceIds, restaurantId].filter(id => id && id !== 'platform'));
  const memberships = mergeMap(existingData.memberships, restaurantId && restaurantId !== 'platform' ? {
    [restaurantId]: mergeMap(existingData.memberships?.[restaurantId], {
      restaurantId,
      isActive: true,
      isOwner: true,
      accountOwner: true,
      isAdmin: true,
      isSuperAdmin: true,
      role: 'Owner',
      permissions,
      systemAccess,
      updatedAt: repairedAt
    })
  } : {});

  const profilePayload = sanitizeFirestore({
    ...existingData,
    uid: authUser.uid,
    authUid: authUser.uid,
    userId: authUser.uid,
    email,
    emailLower: email,
    name: clean(existingData.name || authUser.displayName || displayNameFromEmail(email)),
    role: clean(existingData.role || 'Owner'),
    accountRole: clean(existingData.accountRole || 'owner'),
    restaurantId,
    activeRestaurantId: clean(existingData.activeRestaurantId || restaurantId),
    defaultRestaurantId: clean(existingData.defaultRestaurantId || restaurantId),
    workspaceIds,
    memberships,
    isSuperAdmin: true,
    isAdmin: true,
    isOwner: existingData.isOwner === false ? false : true,
    accountOwner: existingData.accountOwner === false ? false : true,
    active: true,
    isActive: true,
    permissions,
    systemAccess,
    security: mergeMap(existingData.security, { elevatedAccount: true, masterAdmin: true }),
    createdAt: existingData.createdAt || repairedAt,
    updatedAt: repairedAt,
    masterAdminRepair: {
      repairedAt,
      repairedBy: decoded.email || decoded.uid,
      source: 'api/master-admin-repair',
      version: CURRENT_VERSION,
      previousProfileId: existingProfile?.id || '',
      previousProfileSource: existingProfile?.source || 'missing',
      runtimeProjectId: getRuntimeProjectId(app)
    }
  });

  const targetRef = db.collection('users').doc(authUser.uid);
  await targetRef.set(profilePayload, { merge: true });
  const verifySnap = await targetRef.get();
  const verifyData = verifySnap.exists ? (verifySnap.data() || {}) : null;
  const verified = Boolean(verifySnap.exists && verifyData?.email === email && (verifyData?.isSuperAdmin === true || verifyData?.systemAccess?.superAdmin === true));
  const workspaceMemberRepair = await writeWorkspaceMemberIfNeeded(db, authUser, email, restaurantId, repairedAt, decoded).catch(err => ({ attempted: true, status: 'error', error: err.message || String(err) }));

  const existingClaims = authUser.customClaims || {};
  const desiredClaims = { ...existingClaims, superAdmin: true };
  let customClaimUpdated = false;
  if (existingClaims.superAdmin !== true) {
    await authClient.setCustomUserClaims(authUser.uid, desiredClaims);
    customClaimUpdated = true;
  }

  const duplicateProfileId = existingProfile && existingProfile.id !== authUser.uid ? existingProfile.id : '';
  return {
    email,
    uid: authUser.uid,
    status: verified ? (existingProfile ? 'updated' : 'created') : 'write-not-verified',
    firestoreProfileId: authUser.uid,
    firestoreDocPath: targetRef.path,
    firestoreWriteVerified: verified,
    previousProfileId: existingProfile?.id || '',
    previousProfileSource: existingProfile?.source || 'missing',
    duplicateProfileId,
    restaurantId,
    workspaceMemberRepair,
    customClaimSuperAdmin: true,
    customClaimUpdated
  };
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Use GET or POST.' });
  try {
    const app = initAdmin(req);
    const runtime = getRuntimeEnv(app);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error, runtime });

    const authClient = getAuthClient(app);
    const db = getDbClient(app);
    try { db.settings({ ignoreUndefinedProperties: true }); } catch (_) {}

    const token = String(req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.', runtime });

    const decoded = await authClient.verifyIdToken(token);
    const callerEmail = norm(decoded.email);
    const masterEmailConfig = parseMasterEmailEnv();
    const configuredMasterEmails = masterEmailConfig.valid;
    const callerIsConfiguredMaster = !!callerEmail && configuredMasterEmails.includes(callerEmail);
    const callerHasClaim = decoded.superAdmin === true;
    if (!callerIsConfiguredMaster && !callerHasClaim) {
      return res.status(403).json({ ok: false, error: 'Only a signed-in email listed in MASTER_ADMIN_EMAIL(S), or a Firebase superAdmin custom claim, may run master admin repair.', runtime, masterAdminEmailCount: configuredMasterEmails.length, skippedMasterAdminEmails: masterEmailConfig.skipped });
    }

    if (req.method === 'GET') {
      const profiles = [];
      for (const email of configuredMasterEmails) {
        let authUser = null;
        let authMissing = false;
        let authError = '';
        try { authUser = await authClient.getUserByEmail(email); }
        catch (err) { authMissing = err?.code === 'auth/user-not-found'; authError = err?.message || String(err); }
        let profile = null;
        if (authUser?.uid) profile = await findExistingProfile(db, authUser.uid, email);
        profiles.push({
          email,
          authUserFound: !!authUser,
          authMissing,
          authError,
          uid: authUser?.uid || '',
          firestoreProfileFound: !!profile,
          firestoreProfileId: profile?.id || '',
          firestoreDocPath: profile?.id ? `users/${profile.id}` : '',
          firestoreProfileSource: profile?.source || '',
          firestoreSuperAdmin: !!(profile?.data?.isSuperAdmin === true || profile?.data?.systemAccess?.superAdmin === true),
          restaurantId: profile?.data?.restaurantId || profile?.data?.activeRestaurantId || profile?.data?.defaultRestaurantId || ''
        });
      }
      return res.status(200).json({ ok: true, version: CURRENT_VERSION, runtime, callerEmail: decoded.email || '', configuredMasterEmailCount: configuredMasterEmails.length, skippedMasterAdminEmails: masterEmailConfig.skipped, profiles });
    }

    const body = await readBody(req);
    const requestedRestaurantId = clean(body.restaurantId || body.defaultRestaurantId || '');
    const requestedEmails = Array.isArray(body.emails) ? body.emails.map(norm).filter(Boolean) : [];
    const emailsToRepair = requestedEmails.length
      ? requestedEmails.filter(email => configuredMasterEmails.includes(email))
      : configuredMasterEmails;

    if (!emailsToRepair.length) {
      return res.status(400).json({ ok: false, error: 'No valid configured master-admin emails were available to repair. Check MASTER_ADMIN_EMAIL or MASTER_ADMIN_EMAILS in Vercel and remove placeholders like SECOND_ADMIN_EMAIL_HERE.', runtime, skippedMasterAdminEmails: masterEmailConfig.skipped });
    }

    const repairedAt = new Date().toISOString();
    const results = [];
    for (const email of Array.from(new Set(emailsToRepair))) {
      try {
        results.push(await repairOne({ app, authClient, db, decoded, email, requestedRestaurantId, repairedAt }));
      } catch (err) {
        results.push({
          email,
          status: err?.code === 'auth/user-not-found' ? 'auth-user-missing' : 'error',
          error: err?.message || String(err)
        });
      }
    }

    const successCount = results.filter(r => ['created', 'updated'].includes(r.status) && r.firestoreWriteVerified === true).length;
    const ok = successCount > 0 && results.every(r => ['created', 'updated', 'auth-user-missing'].includes(r.status));
    await writeAudit(db, { uid: decoded.uid, email: decoded.email || '' }, 'MASTER_ADMIN_PROFILE_REPAIR', 'users', `Verified ${successCount}/${results.length} configured master-admin Firestore profile repair(s).`, { restaurantId: requestedRestaurantId || 'platform', successCount, resultCount: results.length });

    return res.status(200).json({
      ok,
      version: CURRENT_VERSION,
      runtime,
      repairedAt,
      callerEmail: decoded.email || '',
      requestedRestaurantId,
      configuredMasterEmailCount: configuredMasterEmails.length,
      skippedMasterAdminEmails: masterEmailConfig.skipped,
      successCount,
      results,
      reloginRecommended: results.some(r => r.customClaimUpdated),
      note: 'This route now verifies users/{authUid} after writing. If runtime.firebaseProjectId is not the Firebase project you are viewing in the console, fix the Vercel Firebase admin env vars and run repair again. Log out and back in after custom claims are updated.'
    });
  } catch (err) {
    return res.status(500).json({ ok: false, version: CURRENT_VERSION, error: err.message || 'Master admin repair failed.' });
  }
};
