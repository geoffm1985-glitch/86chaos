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

const norm = (value = '') => String(value || '').toLowerCase().trim();
const cleanId = (value = '') => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);
const memberDocId = (uid, restaurantId) => `${cleanId(uid)}_${cleanId(restaurantId)}`.slice(0, 240);
const masterEmails = () => [process.env.MASTER_ADMIN_EMAIL, process.env.MASTER_ADMIN_EMAILS, 'geoffm1985@gmail.com', 'geoffrm1985@gmail.com']
  .filter(Boolean)
  .flatMap(v => String(v).split(','))
  .map(norm)
  .filter(Boolean);

function userHasWorkspace(user, restaurantId) {
  return Boolean(
    user?.restaurantId === restaurantId ||
    user?.activeRestaurantId === restaurantId ||
    user?.defaultRestaurantId === restaurantId ||
    user?.workspaceIds?.includes?.(restaurantId) ||
    user?.memberships?.[restaurantId]?.isActive === true
  );
}

async function getCaller(decoded) {
  const direct = await db.collection('users').doc(decoded.uid).get();
  if (direct.exists) return { id: direct.id, ...direct.data() };
  const email = norm(decoded.email);
  if (!email) return { id: decoded.uid, email: '' };
  const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
  return { id: decoded.uid, email };
}

async function readWorkspaceMember(uid, email, restaurantId) {
  if (!restaurantId) return null;
  const direct = await db.collection('workspaceMembers').doc(memberDocId(uid, restaurantId)).get();
  if (direct.exists && direct.data()?.isActive !== false) return { id: direct.id, ...direct.data() };
  if (email) {
    const byEmail = await db.collection('workspaceMembers')
      .where('restaurantId', '==', restaurantId)
      .where('email', '==', norm(email))
      .limit(1)
      .get();
    if (!byEmail.empty && byEmail.docs[0].data()?.isActive !== false) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
  }
  return null;
}

async function loadPushUsersForRestaurant(restaurantId) {
  const pushUserMap = new Map();
  const usersSnap = await db.collection('users').where('restaurantId', '==', restaurantId).get();
  usersSnap.forEach(doc => pushUserMap.set(doc.id, { id: doc.id, ...doc.data() }));

  const membersSnap = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).get().catch(() => null);
  const memberIds = [];
  const memberEmails = [];
  membersSnap?.forEach(memberDoc => {
    const m = memberDoc.data() || {};
    if (m.isActive === false) return;
    if (m.userId || m.uid) memberIds.push(m.userId || m.uid);
    if (m.email) memberEmails.push(norm(m.email));
  });
  await Promise.all([...new Set(memberIds.filter(Boolean))].slice(0, 200).map(async id => {
    if (pushUserMap.has(id)) return;
    const snap = await db.collection('users').doc(id).get();
    if (snap.exists) pushUserMap.set(snap.id, { id: snap.id, ...snap.data(), restaurantId });
  }));
  await Promise.all([...new Set(memberEmails.filter(Boolean))].slice(0, 50).map(async email => {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    snap.forEach(doc => { if (!pushUserMap.has(doc.id)) pushUserMap.set(doc.id, { id: doc.id, ...doc.data(), restaurantId }); });
  }));

  return [...pushUserMap.values()];
}

function callerCanSendForRestaurant(caller, decoded, member, restaurantId) {
  const email = norm(decoded.email || caller.email);
  return Boolean(
    decoded.superAdmin === true ||
    caller?.isSuperAdmin === true ||
    masterEmails().includes(email) ||
    userHasWorkspace(caller, restaurantId) ||
    member
  );
}

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

    const caller = await getCaller(decoded);
    const member = await readWorkspaceMember(decoded.uid, decoded.email || caller.email, restaurantId);
    const canSendForRestaurant = callerCanSendForRestaurant(caller, decoded, member, restaurantId);

    if (!canSendForRestaurant) {
      return res.status(403).json({ error: 'Forbidden: You can only send notifications for your own workspace.' });
    }

    // 1. Fetch all staff members for this specific restaurant, including
    // multi-workspace employees linked through workspaceMembers.
    const users = await loadPushUsersForRestaurant(restaurantId);
    const tokens = [];
    
    // 2. Loop through staff. If they have a token AND didn't turn off schedule alerts, add them to the blast list
    users.forEach(userData => {
      // Check if they have a token and haven't explicitly disabled schedule alerts in their preferences
      if (userData.fcmToken && userData.preferences?.notifSchedule !== false && !tokens.includes(userData.fcmToken)) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res.status(200).json({ message: 'No devices registered for notifications yet.' });
    }

    // 3. Build the actual push notification payload
    const message = {
      notification: {
        title: 'New Schedule Published!',
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
