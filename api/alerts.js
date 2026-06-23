
const admin = require('firebase-admin');

// Initialize Firebase Admin securely using the Vercel keys
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The replace function fixes how Vercel scrambles line breaks in secure keys
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, title, body } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Missing user token' });
  }

  try {
    // Build the actual alert message
    const message = {
      notification: {
        title: title || '86 Chaos',
        body: body || 'Test alert triggered!',
      },
      token: token,
    };

    // Fire the message via Google's servers
    const response = await admin.messaging().send(message);
    res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
