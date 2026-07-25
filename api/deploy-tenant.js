import projectAdmin from './_firebase-project-admin.js';

const { verifyRequestToken } = projectAdmin;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const authContext = await verifyRequestToken(req, { requireProjectCredentials: true });
    const { app, decoded } = authContext;
    const requesterSnap = await app.firestore().collection('users').doc(decoded.uid).get();
    const requester = requesterSnap.exists ? requesterSnap.data() : {};
    const requesterEmail = (decoded.email || requester.email || '').toLowerCase();
    const chaosAdmin = await import('./_chaos-admin.js');
    const masterEmails = chaosAdmin.masterEmails || chaosAdmin.default?.masterEmails || (() => []);
    if (decoded.superAdmin !== true && requester.isSuperAdmin !== true && requester.systemAccess?.superAdmin !== true && !masterEmails().includes(requesterEmail)) {
      return res.status(403).json({ error: 'Super Admin required to deploy workspaces.' });
    }
    const requireMfaIfEnforced = chaosAdmin.requireMfaIfEnforced || chaosAdmin.default?.requireMfaIfEnforced;
    const mfaGate = requireMfaIfEnforced ? requireMfaIfEnforced(decoded, requester, true) : { ok: true };
    if (!mfaGate.ok) return res.status(mfaGate.status || 403).json({ error: mfaGate.error });

    const { rName, oName, oEmail, oPhone, rAddress, tPass } = req.body;

    // 1. Create User in Authentication Vault
    const userRecord = await app.auth().createUser({
       email: oEmail.toLowerCase().trim(),
       password: tPass,
       displayName: oName.trim()
    });

    const newAuthUid = userRecord.uid;

    // 2. Create Restaurant Workspace in Database
    const now = new Date();
    const betaEnds = new Date(now);
    betaEnds.setDate(betaEnds.getDate() + 90);
    const defaultFeatures = { schedule: true, prep: true, inventory: true, recipes: true, messages: true, sales: true, labor: true, maintenance: true, timesheets: true, events: true };
    const subscription = {
       planId: 'smart_kitchen',
       selectedFutureTier: 'smart_kitchen',
       status: 'beta',
       isFounderBeta: true,
       betaStartedAt: now.toISOString(),
       betaEndsAt: betaEnds.toISOString(),
       betaExtendedUntil: null,
       entitlementActive: true,
       entitlementStatus: 'active',
       entitlementReviewedAt: now.toISOString(),
       founderDiscountPercent: 50,
       founderDiscountEndsAt: null,
       billingProvider: 'none',
       billingNotes: 'New workspace defaulted to Founder Beta Smart Kitchen. Billing is not active yet.',
       integrationsLocked: true,
       createdAt: now.toISOString(),
       updatedAt: now.toISOString()
    };
    const newRestRef = app.firestore().collection('restaurants').doc();
    
    await newRestRef.set({
       name: rName.trim(),
       ownerName: oName.trim(),
       ownerEmail: oEmail.toLowerCase().trim(),
       ownerPhone: oPhone.trim(),
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
       createdAt: now.toISOString(),
       lastActive: now.toISOString(),
       systemSettings: { address: rAddress.trim(), geofenceRadius: 300 }
    });

    // 3. Create User Profile in Database
    await app.firestore().collection('users').doc(newAuthUid).set({
       name: oName.trim(),
       email: oEmail.toLowerCase().trim(),
       role: 'Owner',
       isAdmin: true,
       isActive: true,
       forcePasswordChange: true,
       restaurantId: newRestRef.id,
       restaurantName: rName.trim(),
       permissions: { schedule: true, inventory: true, prep: true, sales: true, team: true, labor: true, settings: true, wageView: true, wageEdit: true },
       passwordStored: false,
       passwordPurgedAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true, restaurantId: newRestRef.id, userId: newAuthUid, createdAt: new Date().toISOString() });

  } catch (error) {
    console.error("Deployment Error:", error);
    return res.status(500).json({ error: error.message || "Failed to deploy workspace." });
  }
}
