import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS)) });
}
const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { restaurantId, title, body, type, authorName, isCritical, textContent } = req.body;
    if (!restaurantId) return res.status(400).json({ error: 'Missing restaurant ID' });

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
