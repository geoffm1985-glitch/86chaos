import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin using the secure Vercel environment variable
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS))
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  // Only accept POST requests from your app
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { restaurantId, restaurantName } = req.body;

    if (!restaurantId) return res.status(400).json({ error: 'Missing restaurant ID' });

    // 1. Fetch all staff members for this specific restaurant
    const usersSnap = await db.collection('users')
      .where('restaurantId', '==', restaurantId)
      .get();

    const tokens = [];
    
    // 2. Loop through staff. If they have a token AND didn't turn off schedule alerts, add them to the blast list
    usersSnap.forEach(doc => {
      const userData = doc.data();
      // Check if they have a token and haven't explicitly disabled schedule alerts in their preferences
      if (userData.fcmToken && userData.preferences?.notifSchedule !== false) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res.status(200).json({ message: 'No devices registered for notifications yet.' });
    }

    // 3. Build the actual push notification payload
    const message = {
      notification: {
        title: 'New Schedule Published! 🗓️',
        body: `${restaurantName || 'Your restaurant'} just posted a new schedule. Check your shifts now.`,
      },
      tokens: tokens, // Send to everyone in the array at once
    };

    // 4. Fire the cannon
    const response = await getMessaging().sendEachForMulticast(message);
    
    return res.status(200).json({ success: true, sentCount: response.successCount });

  } catch (error) {
    console.error('Push Error:', error);
    return res.status(500).json({ error: 'Failed to send notifications' });
  }
}
