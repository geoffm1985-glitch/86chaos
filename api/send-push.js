import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import projectAdmin from './_firebase-project-admin.js';

const { verifyRequestToken } = projectAdmin;

async function requireAppCheckIfEnforced(req, res, app) {
  const enforced = ['true', '1', 'yes', 'enforce'].includes(String(process.env.APP_CHECK_ENFORCE || '').toLowerCase().trim());
  if (!enforced) return true;
  const token = String(req.headers['x-firebase-appcheck'] || req.headers['X-Firebase-AppCheck'] || '').trim();
  if (!token) {
    res.status(401).json({ error: 'App Check verification is required. Refresh the app after deployment and try again.' });
    return false;
  }
  try {
    const { getAppCheck } = await import('firebase-admin/app-check');
    await getAppCheck(app).verifyToken(token);
    return true;
  } catch (err) {
    res.status(401).json({ error: `App Check verification failed: ${err.message}` });
    return false;
  }
}



async function enforceRouteRateLimit(db, req, res, decoded, routeName, limit = 30, windowMs = 60 * 1000) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const key = `${routeName}:${decoded?.uid || decoded?.email || ip || 'unknown'}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180);
  const ref = db.collection('apiRateLimits').doc(`${key}:${windowStart}`);
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data().count || 0) : 0;
    const count = current + 1;
    tx.set(ref, { key, routeName, count, limit, windowMs, windowStart: new Date(windowStart).toISOString(), updatedAt: new Date(now).toISOString(), expiresAt: new Date(windowStart + windowMs * 3).toISOString() }, { merge: true });
    return { ok: count <= limit, count, resetAt: new Date(windowStart + windowMs).toISOString() };
  });
  if (!result.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000)));
    res.status(429).json({ error: 'Too many requests. Wait a minute and try again.', rateLimited: true, resetAt: result.resetAt });
    return false;
  }
  return true;
}

const norm = (value = '') => String(value || '').toLowerCase().trim();
const cleanId = (value = '') => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);
const memberDocId = (uid, restaurantId) => `${cleanId(uid)}_${cleanId(restaurantId)}`.slice(0, 240);
const masterEmails = () => [process.env.MASTER_ADMIN_EMAIL, process.env.MASTER_ADMIN_EMAILS]
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

async function getCaller(db, decoded) {
  const direct = await db.collection('users').doc(decoded.uid).get();
  if (direct.exists) return { id: direct.id, ...direct.data() };
  const email = norm(decoded.email);
  if (!email) return { id: decoded.uid, email: '' };
  const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
  return { id: decoded.uid, email };
}

async function readWorkspaceMember(db, uid, email, restaurantId) {
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

async function loadPushUsersForRestaurant(db, restaurantId) {
  const pushUserMap = new Map();
  const usersSnap = await db.collection('users').where('restaurantId', '==', restaurantId).get();
  usersSnap.forEach(doc => pushUserMap.set(doc.id, { id: doc.id, ...doc.data() }));

  try {
    const membersSnap = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).get();
    const memberIds = [];
    const memberEmails = [];
    membersSnap.forEach(memberDoc => {
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
  } catch (membershipErr) {
    console.warn('Push route workspaceMembers lookup skipped:', membershipErr?.message || membershipErr);
  }

  return [...pushUserMap.values()];
}

function callerCanSendForRestaurant(caller, decoded, member, restaurantId) {
  const email = norm(decoded.email || caller.email);
  return Boolean(
    decoded.superAdmin === true ||
    caller?.isSuperAdmin === true ||
    caller?.systemAccess?.superAdmin === true ||
    masterEmails().includes(email) ||
    userHasWorkspace(caller, restaurantId) ||
    member
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let authContext;
  try {
    authContext = await verifyRequestToken(req, { requireProjectCredentials: true });
  } catch (error) {
    return res.status(403).json({ error: `Push authorization failed: ${error.message}` });
  }

  const { app, decoded, projectId } = authContext;
  const db = getFirestore(app);
  const messaging = getMessaging(app);
  if (!await requireAppCheckIfEnforced(req, res, app)) return;
  if (!await enforceRouteRateLimit(db, req, res, decoded, 'send-push', Number(process.env.PUSH_ROUTE_RATE_LIMIT || 40), 60 * 1000)) return;

  try {
    const { restaurantId, targetUserId, targetUserIds, title, body, type, authorName, isCritical, textContent } = req.body;
    if (!restaurantId) return res.status(400).json({ error: 'Missing restaurant ID' });

    const caller = await getCaller(db, decoded);
    const member = await readWorkspaceMember(db, decoded.uid, decoded.email || caller.email, restaurantId);
    const canSendForRestaurant = callerCanSendForRestaurant(caller, decoded, member, restaurantId);

    if (!canSendForRestaurant) {
      return res.status(403).json({ error: 'Forbidden: You can only send notifications for your own workspace.' });
    }

    const allPushUsers = await loadPushUsersForRestaurant(db, restaurantId);
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
         if (!workingTodayIds.has(u.id)) return;
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

      if (!tokenRecords.some(record => record.token === u.fcmToken)) tokenRecords.push({ userId: u.id, token: u.fcmToken });
    });

    if (tokenRecords.length === 0) return res.status(200).json({ success: false, sentCount: 0, failedCount: 0, missingTokens: true, message: 'No devices eligible to receive this alert.' });

    const messagePayload = {
      notification: { title, body },
      tokens: tokenRecords.map(t => t.token),
    };

    const response = await messaging.sendEachForMulticast(messagePayload);
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
    return res.status(500).json({ error: error.message || 'Failed to send notifications', firebaseProject: projectId });
  }
}
