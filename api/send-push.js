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
    const { restaurantId, title, body, type, authorName, isCritical, textContent } = req.body;
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

    const usersSnap = await db.collection('users').where('restaurantId', '==', restaurantId).get();
    
    // Grab today's shifts to calculate "Smart Mute: Days Off"
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).split('T')[0];
    const shiftsSnap = await db.collection('shifts')
      .where('restaurantId', '==', restaurantId)
      .where('date', '==', todayStr)
      .where('isPublished', '==', true)
      .get();
      
    const workingTodayIds = new Set();
    shiftsSnap.forEach(doc => workingTodayIds.add(doc.data().employeeId));

    // Calculate current time in Wisconsin (Central Time) for DND checks
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
    const currentTimeVal = now.getHours() + (now.getMinutes() / 60);

    const tokens = [];

    usersSnap.forEach(doc => {
      const u = doc.data();
      if (!u.fcmToken) return;

      const prefs = u.preferences || {};
      
      // 1. Basic Routing Toggles
      if (type === 'schedule' && prefs.notifSchedule === false) return;
      if (type === 'trade' && prefs.notifTrades === false) return;
      if (type === 'message' && prefs.notifMessages === false) return;

      // 2. Advanced Message Board Rules (Mentions & Keywords)
      if (type === 'message') {
         const level = prefs.notifLevel || 'all';
         if (level === 'critical' && !isCritical) return;
         if (level === 'mentions' && !isCritical) {
            let mentioned = false;
            const contentLower = (textContent || '').toLowerCase();
            const myNameLower = (u.name || '').split(' ')[0].toLowerCase();
            
            // Check for @Name
            if (contentLower.includes(`@${myNameLower}`)) mentioned = true;
            
            // Check custom keywords
            const keywords = (prefs.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(k => k);
            for (const kw of keywords) {
               if (contentLower.includes(kw)) mentioned = true;
            }
            if (!mentioned) return;
         }
      }

      // 3. Smart Mute: Days Off
      // (Never mute critical manager alerts or schedule publication drops)
      if (prefs.muteOnDaysOff && !isCritical && type !== 'schedule') {
         if (!workingTodayIds.has(doc.id)) return;
      }

      // 4. Do Not Disturb (Quiet Hours)
      if (prefs.dndEnabled && !isCritical) {
         const startStr = prefs.dndStart || '22:00';
         const endStr = prefs.dndEnd || '08:00';
         const startVal = parseInt(startStr.split(':')[0]) + (parseInt(startStr.split(':')[1])/60);
         const endVal = parseInt(endStr.split(':')[0]) + (parseInt(endStr.split(':')[1])/60);
         
         let inDnd = false;
         if (startVal < endVal) {
            if (currentTimeVal >= startVal && currentTimeVal <= endVal) inDnd = true;
         } else {
            // DND crosses midnight (e.g. 10PM to 8AM)
            if (currentTimeVal >= startVal || currentTimeVal <= endVal) inDnd = true;
         }
         if (inDnd) return;
      }

      tokens.push(u.fcmToken);
    });

    if (tokens.length === 0) return res.status(200).json({ message: 'No devices eligible to receive this alert.' });

    const messagePayload = {
      notification: { title, body },
      tokens: tokens,
    };

    const response = await getMessaging().sendEachForMulticast(messagePayload);
    return res.status(200).json({ success: true, sentCount: response.successCount });

  } catch (error) {
    console.error('Push Error:', error);
    return res.status(500).json({ error: 'Failed to send notifications' });
  }
}
