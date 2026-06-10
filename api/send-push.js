import admin from 'firebase-admin';

// Initialize Firebase Admin securely using Vercel Environment Variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // This replace function prevents Vercel from breaking the secure line-breaks
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { title, body, tokens } = req.body;

  if (!tokens || tokens.length === 0) {
    return res.status(200).json({ message: "No tokens provided" });
  }

  try {
    // Send the notification blast to all provided device tokens
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Push Error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
}
