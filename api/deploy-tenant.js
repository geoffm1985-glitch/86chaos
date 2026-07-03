const admin = require('firebase-admin');

// 1. Bulletproof Firebase Init
if (!admin.apps.length) {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    const cleanKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID, // FIXED: Forces the correct Project ID
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: cleanKey,
      }),
    });
  } else {
    // Fallback
    admin.initializeApp({ projectId: 'cheers-34b8d' });
  }
}

module.exports = async function handler(req, res) {
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
    // Verify the admin requesting the deployment
    await admin.auth().verifyIdToken(authToken);

    const { rName, oName, oEmail, oPhone, rAddress, tPass } = req.body;

    // 1. Create User in Authentication Vault
    const userRecord = await admin.auth().createUser({
       email: oEmail.toLowerCase().trim(),
       password: tPass,
       displayName: oName.trim()
    });

    const newAuthUid = userRecord.uid;

    // 2. Create Restaurant Workspace in Database
    const defaultFeatures = { schedule: true, prep: true, inventory: true, recipes: true, messages: true, sales: true, maintenance: true, timesheets: true, events: true };
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
       password: tPass,
       role: 'General Manager',
       isAdmin: true,
       isActive: true,
       forcePasswordChange: true,
       restaurantId: newRestRef.id,
       restaurantName: rName.trim(),
       permissions: { schedule: true, inventory: true, prep: true, sales: true, team: true }
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Deployment Error:", error);
    return res.status(500).json({ error: error.message || "Failed to deploy workspace." });
  }
};
