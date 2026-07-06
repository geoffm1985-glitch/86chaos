import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';

function getMasterEmails() {
  const raw = [process.env.MASTER_ADMIN_EMAILS, process.env.MASTER_ADMIN_EMAIL, 'geoffrm1985@gmail.com', 'geoffm1985@gmail.com'].filter(Boolean).join(',');
  return new Set(String(raw).split(/[\s,;]+/).map(e => e.toLowerCase().trim()).filter(Boolean));
}
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

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/mismatched-credential'
]);

function collectTokensForUser(userId, userData, tokenOwners) {
  const found = [];
  const addToken = (token, key = null, legacy = false) => {
    if (typeof token !== 'string' || !token.trim()) return;
    const clean = token.trim();
    found.push(clean);
    if (!tokenOwners.has(clean)) tokenOwners.set(clean, []);
    tokenOwners.get(clean).push({ userId, key, legacy });
  };

  addToken(userData.fcmToken, null, true);

  if (userData.fcmTokens && typeof userData.fcmTokens === 'object') {
    Object.entries(userData.fcmTokens).forEach(([key, value]) => {
      if (typeof value === 'string') addToken(value, key, false);
      else addToken(value?.token, key, false);
    });
  }

  return [...new Set(found)];
}

async function cleanupBadToken(token, code, tokenOwners) {
  const owners = tokenOwners.get(token) || [];
  const nowIso = new Date().toISOString();
  await Promise.all(owners.map(({ userId, key, legacy }) => {
    const update = {
      lastPushFailureAt: nowIso,
      lastPushFailureCode: code
    };
    if (legacy) update.fcmToken = FieldValue.delete();
    if (key) update[`fcmTokens.${key}`] = FieldValue.delete();
    return db.collection('users').doc(userId).set(update, { merge: true }).catch(() => null);
  }));
}

async function sendTokenBatches(basePayload, tokens, tokenOwners) {
  let successCount = 0;
  let failureCount = 0;
  let invalidRemoved = 0;
  const failureCodes = {};
  const batches = [];
  for (let i = 0; i < tokens.length; i += 500) batches.push(tokens.slice(i, i + 500));

  for (const batch of batches) {
    const response = await getMessaging().sendEachForMulticast({ ...basePayload, tokens: batch });
    successCount += response.successCount || 0;
    failureCount += response.failureCount || 0;

    await Promise.all((response.responses || []).map(async (r, idx) => {
      if (r.success) return;
      const code = r.error?.code || 'unknown';
      failureCodes[code] = (failureCodes[code] || 0) + 1;
      if (INVALID_TOKEN_CODES.has(code)) {
        invalidRemoved++;
        await cleanupBadToken(batch[idx], code, tokenOwners);
      }
    }));
  }

  return { successCount, failureCount, invalidRemoved, failureCodes };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
  }

  const authToken = authHeader.split('Bearer ')[1];
  let decoded = null;

  try {
    decoded = await getAuth().verifyIdToken(authToken);
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Fake or expired token.' });
  }

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
    const masterEmails = getMasterEmails();
    const callerEmail = (decoded.email || caller.email || '').toLowerCase().trim();
    const canSendForRestaurant =
      decoded.superAdmin === true ||
      masterEmails.has(callerEmail) ||
      caller?.isSuperAdmin === true ||
      caller?.restaurantId === restaurantId;

    if (!canSendForRestaurant) {
      return res.status(403).json({ error: 'Forbidden: You can only send notifications for your own workspace.' });
    }

    const usersSnap = await db.collection('users')
      .where('restaurantId', '==', restaurantId)
      .get();

    const tokenOwners = new Map();
    const tokens = [];
    let missingTokenCount = 0;
    let mutedCount = 0;

    usersSnap.forEach(userDoc => {
      const userData = userDoc.data();
      const userTokens = collectTokensForUser(userDoc.id, userData, tokenOwners);
      if (userTokens.length === 0) { missingTokenCount++; return; }
      if (userData.preferences?.notifSchedule === false) { mutedCount++; return; }
      tokens.push(...userTokens);
    });

    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No devices registered for schedule notifications yet.',
        totalUsers: usersSnap.size,
        missingTokenCount,
        mutedCount,
        tokenCount: 0
      });
    }

    const basePayload = {
      notification: {
        title: 'New Schedule Published! 🗓️',
        body: `${restaurantName || 'Your restaurant'} just posted a new schedule. Check your shifts now.`
      },
      webpush: {
        notification: {
          icon: '/app-icon.png',
          badge: '/app-icon.png',
          requireInteraction: true
        },
        fcmOptions: { link: 'https://app.86chaos.com?tab=published' }
      },
      data: {
        restaurantId: String(restaurantId || ''),
        type: 'schedule',
        isCritical: 'true'
      }
    };

    const sendResult = await sendTokenBatches(basePayload, uniqueTokens, tokenOwners);
    return res.status(200).json({
      success: sendResult.successCount > 0,
      sentCount: sendResult.successCount,
      failedCount: sendResult.failureCount,
      invalidRemoved: sendResult.invalidRemoved,
      failureCodes: sendResult.failureCodes,
      totalUsers: usersSnap.size,
      missingTokenCount,
      mutedCount,
      tokenCount: uniqueTokens.length
    });

  } catch (error) {
    console.error('Push Error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to send notifications' });
  }
}
