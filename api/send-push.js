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
    const { restaurantId, targetUserId, targetUserIds, title, body, type, authorName, isCritical, textContent } = req.body;
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
    const pushUserMap = new Map();
    usersSnap.forEach(doc => pushUserMap.set(doc.id, { id: doc.id, ...doc.data() }));

    // Multi-workspace support: employees may belong to this restaurant through workspaceMembers
    // even when their legacy users.restaurantId points at another job. Pull their account doc
    // so the saved FCM token can still receive this workspace's alerts.
    try {
      const membersSnap = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).get();
      const memberIds = [];
      const memberEmails = [];
      membersSnap.forEach(memberDoc => {
        const m = memberDoc.data() || {};
        if (m.isActive === false) return;
        if (m.userId || m.uid) memberIds.push(m.userId || m.uid);
        if (m.email) memberEmails.push(String(m.email).toLowerCase().trim());
      });
      const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))].slice(0, 200);
      await Promise.all(uniqueMemberIds.map(async id => {
        if (pushUserMap.has(id)) return;
        const snap = await db.collection('users').doc(id).get();
        if (snap.exists) pushUserMap.set(snap.id, { id: snap.id, ...snap.data(), restaurantId });
      }));
      const uniqueEmails = [...new Set(memberEmails.filter(Boolean))].slice(0, 50);
      await Promise.all(uniqueEmails.map(async email => {
        const snap = await db.collection('users').where('email', '==', email).limit(1).get();
        snap.forEach(doc => { if (!pushUserMap.has(doc.id)) pushUserMap.set(doc.id, { id: doc.id, ...doc.data(), restaurantId }); });
      }));
    } catch (membershipErr) {
      console.warn('Push route workspaceMembers lookup skipped:', membershipErr?.message || membershipErr);
    }
    const allPushUsers = [...pushUserMap.values()];
    const targetSet = new Set([...(Array.isArray(targetUserIds) ? targetUserIds : []), targetUserId].filter(Boolean));
    
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

    const tokenRecords = [];

    allPushUsers.forEach(u => {
      if (targetSet.size && !targetSet.has(u.id)) return;
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

      tokenRecords.push({ userId: u.id, token: u.fcmToken });
    });

    if (tokenRecords.length === 0) return res.status(200).json({ success: false, sentCount: 0, failedCount: 0, missingTokens: true, message: 'No devices eligible to receive this alert.' });

    const messagePayload = {
      notification: { title, body },
      tokens: tokenRecords.map(t => t.token),
    };

    const response = await getMessaging().sendEachForMulticast(messagePayload);
    const staleCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument'
    ]);
    const cleanup = [];
    const failures = [];
    response.responses.forEach((r, idx) => {
      if (r.success) return;
      const record = tokenRecords[idx];
      const code = r.error?.code || 'unknown';
      failures.push({ userId: record?.userId, code, message: r.error?.message || '' });
      if (record?.userId && staleCodes.has(code)) {
        cleanup.push(db.collection('users').doc(record.userId).set({ fcmToken: null, pushNeedsRepair: true, pushRepairFlaggedAt: new Date().toISOString(), lastPushFailureCode: code }, { merge: true }));
      }
    });
    await Promise.allSettled(cleanup);
    await db.collection('system').doc('backupStatus').set({
      lastPushResult: `${response.successCount} sent / ${response.failureCount} failed`,
      lastPushAt: new Date().toISOString(),
      lastPushTargetRestaurantId: restaurantId,
      lastPushFailures: failures.slice(0, 25)
    }, { merge: true }).catch(() => {});
    return res.status(200).json({ success: response.successCount > 0, sentCount: response.successCount, failedCount: response.failureCount, staleTokensCleaned: cleanup.length, failures });

  } catch (error) {
    console.error('Push Error:', error);
    return res.status(500).json({ error: 'Failed to send notifications' });
  }
}
