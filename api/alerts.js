import admin from 'firebase-admin';

// Safely initialize Firebase Admin for Vercel at the top level
// Note: Sending push notifications DOES require the private keys, so we keep your original setup here!
if (!admin.apps.length) {
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error("Vercel cannot see the FIREBASE_PRIVATE_KEY environment variable.");
  } else {
    // Strip accidental quotes and fix line breaks automatically
    const cleanKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: cleanKey,
      }),
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // --- THE BOUNCER: VERIFY FIREBASE AUTH TOKEN ---
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token. Bots get bounced.' });
  }

  // We call this 'authToken' so it doesn't conflict with the device 'token' below!
  const authToken = authHeader.split('Bearer ')[1];

  try {
    // This checks with Google's servers to guarantee the user is actually logged into 86chaos
    await admin.auth().verifyIdToken(authToken);
    // The user is verified. The velvet rope opens.
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Fake or expired token.' });
  }
  // --- END OF BOUNCER ---

  try {
    // 'token' here is the specific device token for push notifications
    const { token, title, body } = req.body;

    if (!token) {
      throw new Error('Missing user device token in request body');
    }

    const message = {
      notification: {
        title: title || '86 Chaos',
        body: body || 'Test alert triggered!',
      },
      token: token,
    };

    const response = await admin.messaging().send(message);
    res.status(200).json({ success: true, messageId: response });

  } catch (error) {
    // This will print the EXACT error directly into the Vercel logs you are looking at
    console.error('Backend Crash Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
