const { getAdminAppForRequest } = require('./_firebase-project-admin');
const { cleanString, norm, memberDocId, isActiveMembership, canDeleteAvailabilityRecord } = require('./_availability-record-auth.cjs');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}
async function loadCallerContext(req, db, auth, restaurantId) {
  const token = cleanString(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('Missing Firebase ID token.'), { status: 401 });
  const decoded = await auth.verifyIdToken(token);
  const email = norm(decoded.email);
  let callerSnap = await db.collection('users').doc(decoded.uid).get();
  let callerDocId = decoded.uid;
  if (!callerSnap.exists && email) {
    const emailSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!emailSnap.empty) {
      callerSnap = emailSnap.docs[0];
      callerDocId = callerSnap.id;
    }
  }
  const caller = callerSnap.exists ? callerSnap.data() || {} : {};
  const memberSnap = await db.collection('workspaceMembers').doc(memberDocId(decoded.uid, restaurantId)).get().catch(() => null);
  let membership = memberSnap?.exists ? memberSnap.data() || {} : null;
  if (!membership && email) {
    const emailMemberSnap = await db.collection('workspaceMembers')
      .where('restaurantId', '==', restaurantId)
      .where('email', '==', email)
      .limit(1)
      .get()
      .catch(() => null);
    if (emailMemberSnap && !emailMemberSnap.empty) membership = emailMemberSnap.docs[0].data() || {};
  }
  const restaurantSnap = await db.collection('restaurants').doc(restaurantId).get().catch(() => null);
  const restaurant = restaurantSnap?.exists ? restaurantSnap.data() || {} : {};
  return { decoded, email, caller, callerDocId, membership: membership || {}, restaurant, restaurantId };
}
async function deleteAvailabilityRecord({ db, ctx, recordRef, record, recordId }) {
  await recordRef.delete();
  const now = new Date().toISOString();
  const actorName = cleanString(ctx.membership?.name || ctx.caller?.name || ctx.email || 'Manager');
  await db.collection('auditLogs').add({
    restaurantId: ctx.restaurantId,
    workspaceId: ctx.restaurantId,
    action: 'AVAILABILITY_DELETED',
    target: `availabilityRecords/${recordId}`,
    details: JSON.stringify({
      deletedRecordId: recordId,
      employeeName: record.employeeName || record.userName || record.name || '',
      employeeId: record.scheduleUserId || record.employeeId || record.userId || record.authUid || '',
      effectiveStartDate: record.effectiveStartDate || '',
      effectiveEndDate: record.effectiveEndDate || '',
      status: record.status || '',
      deletedBy: ctx.callerDocId || ctx.decoded.uid,
      deletedByEmail: ctx.email || ''
    }),
    userId: ctx.callerDocId || ctx.decoded.uid,
    userName: actorName,
    userEmail: ctx.email || '',
    timestamp: now,
    source: 'api/availability-record',
    securityLevel: 'sensitive',
    whyThisMatters: 'Availability history affects scheduling records and must be deleted only by authorized management.'
  });
  return { ok: true, action: 'delete', id: recordId };
}
async function handleAvailabilityRecordRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const admin = initAdmin(req);
    const db = admin.firestore();
    const auth = admin.auth();
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = norm(body.action || '');
    if (action !== 'delete') return res.status(400).json({ error: 'Unsupported availability record action.' });
    const recordId = cleanString(body.id || body.recordId || body.availabilityRecordId || '');
    if (!recordId) return res.status(400).json({ error: 'Availability record id is required.' });
    const recordRef = db.collection('availabilityRecords').doc(recordId);
    const recordSnap = await recordRef.get();
    if (!recordSnap.exists) return res.status(404).json({ error: 'Availability history entry was not found.' });
    const record = recordSnap.data() || {};
    const restaurantId = cleanString(record.restaurantId || record.workspaceId || body.restaurantId || '');
    if (!restaurantId) return res.status(400).json({ error: 'Availability record is missing a restaurant id.' });
    if (body.restaurantId && cleanString(body.restaurantId) !== restaurantId) return res.status(403).json({ error: 'Availability record belongs to a different restaurant.' });
    const ctx = await loadCallerContext(req, db, auth, restaurantId);
    if (!canDeleteAvailabilityRecord(ctx)) return res.status(403).json({ error: 'You do not have permission to delete availability history.' });
    const result = await deleteAvailabilityRecord({ db, ctx, recordRef, record, recordId });
    return res.status(200).json(result);
  } catch (err) {
    const status = Number(err?.status || err?.statusCode || 500);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: err?.message || 'Availability record action failed.' });
  }
}
module.exports = handleAvailabilityRecordRequest;
module.exports._test = { canDeleteAvailabilityRecord, isActiveMembership, memberDocId, deleteAvailabilityRecord };
