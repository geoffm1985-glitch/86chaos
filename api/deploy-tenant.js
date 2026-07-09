import admin from 'firebase-admin';

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || 'cheers-34b8d',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/"/g, '')
  };
}

// 1. Truly Bulletproof Firebase Init
if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount.client_email || serviceAccount.clientEmail) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp({ projectId: serviceAccount.project_id || serviceAccount.projectId || 'cheers-34b8d' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // --- THE BOUNCER ---
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const authToken = authHeader.split('Bearer ')[1];

  try {
    // Verify the super admin requesting the deployment
    const decoded = await admin.auth().verifyIdToken(authToken);
    const requesterSnap = await admin.firestore().collection('users').doc(decoded.uid).get();
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
    const userRecord = await admin.auth().createUser({
       email: oEmail.toLowerCase().trim(),
       password: tPass,
       displayName: oName.trim()
    });

    const newAuthUid = userRecord.uid;

    // 2. Create Restaurant Workspace in Database
    const defaultFeatures = { schedule: true, prep: true, inventory: true, recipes: true, messages: true, sales: true, labor: true, maintenance: true, timesheets: true, events: true };
    const newRestRef = admin.firestore().collection('restaurants').doc();
    
    await newRestRef.set({
       name: rName.trim(),
       ownerName: oName.trim(),
       ownerEmail: oEmail.toLowerCase().trim(),
       ownerPhone: oPhone.trim(),
       isActive: true,
       isReadOnly: false,
       features: defaultFeatures,
       labs: {},
       planType: 'Trial',
       billingStatus: 'Paid',
       createdAt: new Date().toISOString(),
       lastActive: new Date().toISOString(),
       systemSettings: { address: rAddress.trim(), geofenceRadius: 300 }
    });

    // 3. Create User Profile in Database
    await admin.firestore().collection('users').doc(newAuthUid).set({
       name: oName.trim(),
       email: oEmail.toLowerCase().trim(),
       role: 'General Manager',
       isAdmin: true,
       isActive: true,
       forcePasswordChange: true,
       restaurantId: newRestRef.id,
       restaurantName: rName.trim(),
       permissions: { schedule: true, inventory: true, prep: true, sales: true, team: true },
       passwordStored: false,
       passwordPurgedAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true, restaurantId: newRestRef.id, userId: newAuthUid, createdAt: new Date().toISOString() });

  } catch (error) {
    console.error("Deployment Error:", error);
    return res.status(500).json({ error: error.message || "Failed to deploy workspace." });
  }
}
