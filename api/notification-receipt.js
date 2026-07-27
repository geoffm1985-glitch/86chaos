const { admin, initAdmin, requireAppCheckIfEnforced, readBody, clean, norm, masterEmails } = require('./_chaos-admin');
const { getBearerToken } = require('./_firebase-project-admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.' });
    const app = initAdmin(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const decoded = await app.auth().verifyIdToken(token);
    const db = app.firestore();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const callerEmail = norm(decoded.email || user.email || '');
    const isSuperAdmin = decoded.superAdmin === true || user.isSuperAdmin === true || user.systemAccess?.superAdmin === true || masterEmails().includes(callerEmail);
    if (!isSuperAdmin) return res.status(403).json({ ok: false, error: 'Super Admin notification receipt required.' });

    const body = await readBody(req);
    const reportId = clean(body.reportId || '').slice(0, 160);
    const action = clean(body.action || '').toLowerCase();
    if (!reportId || !['received', 'opened'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'A valid reportId and receipt action are required.' });
    }

    const reportRef = db.collection('crashReports').doc(reportId);
    const receiptRef = db.collection('notificationReceipts').doc(`${reportId}_${decoded.uid}_${action}`);
    const now = new Date().toISOString();
    const result = await db.runTransaction(async tx => {
      const [reportSnap, receiptSnap] = await Promise.all([tx.get(reportRef), tx.get(receiptRef)]);
      if (!reportSnap.exists) return { missing: true };
      if (receiptSnap.exists) return { duplicate: true };
      const receipt = {
        reportId,
        userId: decoded.uid,
        userEmail: decoded.email || user.email || '',
        action,
        notificationTag: clean(body.notificationTag || '').slice(0, 180),
        receivedAt: action === 'received' ? clean(body.receivedAt || now) : '',
        openedAt: action === 'opened' ? clean(body.openedAt || now) : '',
        createdAt: now
      };
      tx.set(receiptRef, receipt);
      tx.set(reportRef, action === 'received'
        ? {
            supportPushDeliveryConfirmedCount: admin.firestore.FieldValue.increment(1),
            supportPushLastReceivedAt: receipt.receivedAt || now
          }
        : {
            supportPushOpenedCount: admin.firestore.FieldValue.increment(1),
            supportPushLastOpenedAt: receipt.openedAt || now
          }, { merge: true });
      return { saved: true };
    });
    if (result.missing) return res.status(404).json({ ok: false, error: 'Crash report was not found.' });
    return res.status(200).json({ ok: true, reportId, action, duplicate: result.duplicate === true });
  } catch (error) {
    const message = String(error?.message || 'Notification receipt failed.');
    const status = /token|auth|unauthorized/i.test(message) ? 401 : /permission|forbidden|app check|super admin/i.test(message) ? 403 : 500;
    return res.status(status).json({ ok: false, error: status >= 500 ? 'Notification receipt could not be saved.' : message });
  }
};
