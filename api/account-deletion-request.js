const { initAdmin, readBody, authorize, writeAudit } = require('./_chaos-admin');

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
    const app = initAdmin(req);
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

    if (action.startsWith('admin-')) {
      const adminAuth = await authorize(req, app, { allowTenantAdmin: false });
      if (!adminAuth.ok) return res.status(adminAuth.status || 403).json({ ok: false, error: adminAuth.error || 'System Administrator access is required.' });

      if (action === 'admin-list') {
        const snap = await db.collection('accountDeletionRequests').get();
        const requests = snap.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => new Date(b.updatedAt || b.requestedAt || 0) - new Date(a.updatedAt || a.requestedAt || 0))
          .slice(0, 250);
        return res.status(200).json({ ok: true, requests });
      }

      const targetUid = String(body.targetUid || body.uid || '').trim();
      if (!targetUid) return res.status(400).json({ ok: false, error: 'Choose the deletion request to review.' });

      const targetRequestRef = db.collection('accountDeletionRequests').doc(targetUid);
      const targetUserRef = db.collection('users').doc(targetUid);
      const targetRequestSnap = await targetRequestRef.get();
      if (!targetRequestSnap.exists) return res.status(404).json({ ok: false, error: 'Account deletion request not found.' });
      const targetUserSnap = await targetUserRef.get();
      const targetUser = targetUserSnap.exists ? targetUserSnap.data() : {};
      const targetRequest = targetRequestSnap.exists ? targetRequestSnap.data() : {};
      const targetRestaurantId = String(targetRequest.restaurantId || targetUser.restaurantId || targetUser.activeRestaurantId || targetUser.defaultRestaurantId || '').trim();
      const adminNotes = String(body.adminNotes || body.notes || '').trim().slice(0, 1600);
      const statusMap = {
        'admin-review': 'reviewing',
        'admin-complete': 'completed',
        'admin-deny': 'denied'
      };
      const nextStatus = statusMap[action];
      if (!nextStatus) return res.status(400).json({ ok: false, error: 'Unknown account deletion admin action.' });
      if (nextStatus === 'completed' && adminNotes.length < 8) return res.status(400).json({ ok: false, error: 'Add a short completion note before marking the request complete.' });
      if (nextStatus === 'denied' && adminNotes.length < 8) return res.status(400).json({ ok: false, error: 'Add a short reason before denying the request.' });

      const adminEmail = adminAuth.email || authz.email || '';
      const update = {
        uid: targetUid,
        email: targetRequest.email || targetUser.email || '',
        displayName: targetRequest.displayName || targetUser.name || '',
        restaurantId: targetRestaurantId,
        status: nextStatus,
        updatedAt: now,
        updatedBy: adminAuth.uid,
        updatedByEmail: adminEmail,
        adminNotes,
        needsAdminReview: nextStatus === 'requested' || nextStatus === 'reviewing'
      };
      if (nextStatus === 'reviewing') {
        update.reviewedAt = now;
        update.reviewedBy = adminAuth.uid;
        update.reviewedByEmail = adminEmail;
      }
      if (nextStatus === 'completed') {
        update.completedAt = now;
        update.completedBy = adminAuth.uid;
        update.completedByEmail = adminEmail;
        update.completionNote = adminNotes;
        update.needsAdminReview = false;
      }
      if (nextStatus === 'denied') {
        update.deniedAt = now;
        update.deniedBy = adminAuth.uid;
        update.deniedByEmail = adminEmail;
        update.denialReason = adminNotes;
        update.needsAdminReview = false;
      }

      await targetRequestRef.set(update, { merge: true });
      await targetUserRef.set({
        accountDeletionRequest: {
          status: nextStatus,
          updatedAt: now,
          updatedBy: adminAuth.uid,
          adminNotes
        }
      }, { merge: true });
      await db.collection('securityAlerts').add({
        type: `account_deletion_${nextStatus}`,
        severity: nextStatus === 'reviewing' ? 'medium' : 'high',
        userId: targetUid,
        userEmail: update.email,
        restaurantId: targetRestaurantId || 'system',
        title: `Account deletion ${nextStatus}`,
        message: `${update.email || targetUid} account deletion request was marked ${nextStatus} by ${adminEmail || 'System Administrator'}.`,
        createdAt: now,
        read: false
      });
      await writeAudit(db, adminAuth, `ACCOUNT_DELETION_${nextStatus.toUpperCase()}`, targetUid, adminNotes || `Account deletion request marked ${nextStatus}.`, targetRestaurantId || 'system');
      return res.status(200).json({ ok: true, status: nextStatus, request: { id: targetUid, ...targetRequest, ...update }, message: `Account deletion request marked ${nextStatus}.` });
    }

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
