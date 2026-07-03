import admin from 'firebase-admin';

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
    // Dynamically initialize the app so it works in Test and Live modes
    if (!admin.apps.length) {
      const decodedUnverified = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString());
      const projectId = decodedUnverified.aud; 

      if (process.env.FIREBASE_PRIVATE_KEY) {
        const cleanKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '');
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: cleanKey,
          }),
        });
      } else {
        admin.initializeApp({ projectId: projectId });
      }
    }

    // Verify the admin requesting the deletion
    await admin.auth().verifyIdToken(authToken);

    // Get the UID of the user we want to nuke
    const { targetUid } = req.body;
    if (!targetUid) throw new Error("Missing target UID.");

    // NUKE THE AUTHENTICATION CREDENTIAL
    await admin.auth().deleteUser(targetUid);
    
    return res.status(200).json({ success: true, message: 'User permanently deleted from Auth.' });

  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(500).json({ error: error.message || "Failed to delete user." });
  }
}
