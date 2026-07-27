const { getAdminAppForRequest } = require('./_firebase-project-admin');
const { masterEmails, requireMfaIfEnforced } = require('./_chaos-admin');

function clean(value = '') {
  return String(value == null ? '' : value).trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const app = getAdminAppForRequest(req, { requireCredentials: true });
    const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.' });

    const decoded = await app.auth().verifyIdToken(token);
    const requesterSnap = await app.firestore().collection('users').doc(decoded.uid).get();
    const requester = requesterSnap.exists ? requesterSnap.data() : {};
    const requesterEmail = clean(decoded.email || requester.email).toLowerCase();
    const allowedMasterEmails = typeof masterEmails === 'function' ? masterEmails() : [];

    if (
      decoded.superAdmin !== true &&
      requester.isSuperAdmin !== true &&
      requester.systemAccess?.superAdmin !== true &&
      !allowedMasterEmails.includes(requesterEmail)
    ) {
      return res.status(403).json({ ok: false, error: 'System Administrator access is required to deploy workspaces.' });
    }

    const mfaGate = typeof requireMfaIfEnforced === 'function'
      ? requireMfaIfEnforced(decoded, requester, true)
      : { ok: true };
    if (!mfaGate.ok) {
      return res.status(mfaGate.status || 403).json({ ok: false, error: mfaGate.error || 'Multi-factor authentication is required.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rName = clean(body.rName);
    const oName = clean(body.oName);
    const oEmail = clean(body.oEmail).toLowerCase();
    const oPhone = clean(body.oPhone);
    const rAddress = clean(body.rAddress);
    const tPass = clean(body.tPass);

    if (![rName, oName, oEmail, oPhone, rAddress, tPass].every(Boolean)) {
      return res.status(400).json({ ok: false, error: 'All workspace deployment fields are required.' });
    }

    let userRecord = null;
    let newRestRef = null;
    let committed = false;
    try {
      userRecord = await app.auth().createUser({
        email: oEmail,
        password: tPass,
        displayName: oName
      });

      const now = new Date();
      const nowIso = now.toISOString();
      const betaEnds = new Date(now);
      betaEnds.setDate(betaEnds.getDate() + 90);
      const defaultFeatures = {
        schedule: true,
        prep: true,
        inventory: true,
        recipes: true,
        messages: true,
        sales: true,
        labor: true,
        maintenance: true,
        timesheets: true,
        events: true
      };
      const subscription = {
        planId: 'smart_kitchen',
        selectedFutureTier: 'smart_kitchen',
        status: 'beta',
        isFounderBeta: true,
        betaStartedAt: nowIso,
        betaEndsAt: betaEnds.toISOString(),
        betaExtendedUntil: null,
        entitlementActive: true,
        entitlementStatus: 'active',
        entitlementReviewedAt: nowIso,
        founderDiscountPercent: 50,
        founderDiscountEndsAt: null,
        billingProvider: 'none',
        billingNotes: 'New workspace defaulted to Founder Beta Smart Kitchen. Billing is not active yet.',
        integrationsLocked: true,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      newRestRef = app.firestore().collection('restaurants').doc();
      const batch = app.firestore().batch();
      batch.set(newRestRef, {
        name: rName,
        ownerName: oName,
        ownerEmail: oEmail,
        ownerPhone: oPhone,
        isActive: true,
        isReadOnly: false,
        features: defaultFeatures,
        labs: {},
        planId: 'smart_kitchen',
        selectedFutureTier: 'smart_kitchen',
        subscriptionStatus: 'beta',
        entitlementActive: true,
        isFounderBeta: true,
        integrationsLocked: true,
        subscription,
        createdAt: nowIso,
        lastActive: nowIso,
        systemSettings: { address: rAddress, geofenceRadius: 300 }
      });
      batch.set(app.firestore().collection('users').doc(userRecord.uid), {
        name: oName,
        email: oEmail,
        role: 'Owner',
        isAdmin: true,
        isOwner: true,
        accountOwner: true,
        workspaceOwner: true,
        isActive: true,
        forcePasswordChange: true,
        restaurantId: newRestRef.id,
        restaurantName: rName,
        activeRestaurantId: newRestRef.id,
        defaultRestaurantId: newRestRef.id,
        workspaceIds: [newRestRef.id],
        permissions: {
          schedule: true,
          inventory: true,
          prep: true,
          sales: true,
          team: true,
          labor: true,
          settings: true,
          wageView: true,
          wageEdit: true
        },
        passwordStored: false,
        passwordPurgedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      batch.set(app.firestore().collection('workspaceMembers').doc(`${userRecord.uid}_${newRestRef.id}`), {
        userId: userRecord.uid,
        uid: userRecord.uid,
        email: oEmail,
        name: oName,
        restaurantId: newRestRef.id,
        restaurantName: rName,
        role: 'Owner',
        isAdmin: true,
        isOwner: true,
        accountOwner: true,
        workspaceOwner: true,
        isActive: true,
        permissions: {
          schedule: true,
          inventory: true,
          prep: true,
          sales: true,
          team: true,
          labor: true,
          settings: true,
          wageView: true,
          wageEdit: true
        },
        createdAt: nowIso,
        updatedAt: nowIso
      });
      await batch.commit();
      committed = true;

      return res.status(200).json({
        ok: true,
        success: true,
        restaurantId: newRestRef.id,
        userId: userRecord.uid,
        createdAt: nowIso
      });
    } catch (creationError) {
      if (userRecord?.uid && !committed) {
        await app.auth().deleteUser(userRecord.uid).catch(() => {});
      }
      throw creationError;
    }
  } catch (error) {
    console.error('Deployment Error:', error);
    const code = String(error?.code || '');
    if (code.includes('auth/email-already-exists')) {
      return res.status(409).json({ ok: false, error: 'An account already exists for that owner email.' });
    }
    if (code.includes('auth/invalid-password') || code.includes('auth/invalid-email')) {
      return res.status(400).json({ ok: false, error: 'The owner email or temporary password is invalid.' });
    }
    return res.status(500).json({ ok: false, error: 'Failed to deploy workspace.' });
  }
};
