const admin = require('firebase-admin');

// Use standard Node.js export instead of React's "export default"
module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!admin.apps.length) {
      if (!process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error("Vercel cannot see the FIREBASE_PRIVATE_KEY environment variable.");
      }

      // Strip any accidental quote marks and fix line breaks automatically
      const cleanKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: cleanKey,
        }),
      });
    }

    const { token, title, body } = req.body;

    if (!token) {
      throw new Error('Missing user token in request');
    }

    // Build the alert
    const message = {
      notification: {
        title: title || '86 Chaos',
        body: body || 'Test alert triggered!',
      },
      token: token,
    };

    // Fire the message
    const response = await admin.messaging().send(message);
    res.status(200).json({ success: true, messageId: response });

  } catch (error) {
    console.error('Backend Crash Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
