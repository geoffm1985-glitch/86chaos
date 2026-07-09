const { admin, initAdmin, readBody, norm, writeAudit } = require('./_chaos-admin');

async function verifyUser(req, app) {
  const token = String(req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Missing Firebase authorization token.' };
  try {
    const decoded = await app.auth().verifyIdToken(token);
    return { ok: true, decoded, uid: decoded.uid, email: decoded.email || '' };
  } catch (err) {
    return { ok: false, status: 401, error: `Invalid authorization token: ${err.message}` };
  }
}

module.exports = async (req, res) => {
  try {
    const app = initAdmin();
    const authz = await verifyUser(req, app);
    if (!authz.ok) return res.status(authz.status).json({ ok: false, error: authz.error });
    const db = app.firestore();
    const userRef = db.collection('users').doc(authz.uid);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? userSnap.data() : {};
    const requestRef = db.collection('accountDeletionRequests').doc(authz.uid);

    if (req.method === 'GET') {
      const snap = await requestRef.get();
      return res.status(200).json({ ok: true, request: snap.exists ? { id: snap.id, ...snap.data() } : null });
    }

    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    const body = await readBody(req);
    const action = String(body.action || 'request').toLowerCase();
    const now = new Date().toISOString();
    const restaurantId = String(user.restaurantId || user.activeRestaurantId || user.defaultRestaurantId || body.restaurantId || '').trim();

    if (action === 'cancel') {
      await requestRef.set({
        uid: authz.uid,
        email: authz.email || user.email || '',
        restaurantId,
        status: 'canceled',
        canceledAt: now,
        updatedAt: now,
        canceledBy: authz.uid,
        canceledByEmail: authz.email || ''
      }, { merge: true });
      await userRef.set({ accountDeletionRequest: { status: 'canceled', canceledAt: now, updatedAt: now } }, { merge: true });
      await writeAudit(db, { uid: authz.uid, userDocId: authz.uid, email: authz.email, user }, 'ACCOUNT_DELETION_REQUEST_CANCELED', authz.uid, 'User canceled account deletion request.', restaurantId || 'system');
      return res.status(200).json({ ok: true, status: 'canceled', message: 'Account deletion request canceled.' });
    }

    const reason = String(body.reason || '').trim().slice(0, 1200);
    const request = {
      uid: authz.uid,
      email: authz.email || user.email || '',
      displayName: user.name || authz.decoded.name || '',
      restaurantId,
      status: 'requested',
      reason,
      requestedAt: now,
      updatedAt: now,
      source: 'in_app_account_security',
      needsAdminReview: true,
      note: 'Store-ready deletion intake. This records the request; final deletion/export review is handled by an authorized administrator.'
    };
    await requestRef.set(request, { merge: true });
    await userRef.set({ accountDeletionRequest: { status: 'requested', requestedAt: now, updatedAt: now } }, { merge: true });
    await db.collection('securityAlerts').add({
      type: 'account_deletion_requested',
      severity: 'high',
      userId: authz.uid,
      userEmail: request.email,
      restaurantId: restaurantId || 'system',
      title: 'Account deletion requested',
      message: `${request.email || authz.uid} requested account deletion from inside the app. Review before deleting operational records.`,
      createdAt: now,
      read: false
    });
    await writeAudit(db, { uid: authz.uid, userDocId: authz.uid, email: authz.email, user }, 'ACCOUNT_DELETION_REQUESTED', authz.uid, reason || 'User requested account deletion from Account Security.', restaurantId || 'system');
    return res.status(200).json({ ok: true, status: 'requested', requestedAt: now, message: 'Account deletion request submitted for administrator review.' });
  } catch (err) {
    console.error('account-deletion-request failed', err);
    return res.status(500).json({ ok: false, error: err.message || 'Account deletion request failed.' });
  }
};
