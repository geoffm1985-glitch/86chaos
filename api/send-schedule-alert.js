import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (raw) {
    try { return JSON.parse(raw); }
    catch (_) { throw new Error('Firebase service account JSON is invalid. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.'); }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
}

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}
const db = getFirestore();

export default async function handler(req, res) {
  // Only accept POST requests from your app
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // --- THE BOUNCER: VERIFY FIREBASE AUTH TOKEN ---
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token. Bots get bounced.' });
  }

  const authToken = authHeader.split('Bearer ')[1];
  let decoded = null;

  try {
    // This checks with Google's servers to guarantee the user is actually logged into 86chaos
    decoded = await getAuth().verifyIdToken(authToken);
    // The user is verified. The velvet rope opens.
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Fake or expired token.' });
  }
  // --- END OF BOUNCER ---

  try {
    const { restaurantId, restaurantName } = req.body;

    if (!restaurantId) return res.status(400).json({ error: 'Missing restaurant ID' });

    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    let caller = callerSnap.exists ? callerSnap.data() : {};
    if (!callerSnap.exists && decoded.email) {
      const emailCandidates = [...new Set([decoded.email.toLowerCase(), decoded.email])];
      for (const email of emailCandidates) {
        const emailSnap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!emailSnap.empty) { caller = emailSnap.docs[0].data(); break; }
      }
    }
    const masterEmail = (process.env.MASTER_ADMIN_EMAIL || 'geoffm1985@gmail.com').toLowerCase();
    const callerEmail = (decoded.email || caller.email || '').toLowerCase();
    const canSendForRestaurant =
      decoded.superAdmin === true ||
      callerEmail === masterEmail ||
      caller?.isSuperAdmin === true ||
      caller?.restaurantId === restaurantId;

    if (!canSendForRestaurant) {
      return res.status(403).json({ error: 'Forbidden: You can only send notifications for your own workspace.' });
    }

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
