'use strict';
const { getAdminAppForRequest, readBody, requireAppCheckIfEnforced, readWorkspaceMember, userHasWorkspace } = require('./_chaos-admin');

function clean(value = '', max = 400) { return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); }
function authToken(req = {}) { return String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function activeUser(user = {}) { return user && user.isActive !== false && user.disabled !== true && user.accountDisabled !== true && user.deleted !== true && user.archived !== true; }
function activeMember(member = {}) { return member && member.isActive !== false && member.disabled !== true && member.deleted !== true && member.archived !== true; }
function participantRowsOnly(rows = [], uid = '', restaurantId = '') {
  const safeUid = clean(uid, 180);
  return rows.filter(row => String(row.restaurantId || row.workspaceId || '') === restaurantId && Number(row.participantSchemaVersion || 0) === 1 && Array.isArray(row.participantUserIds) && row.participantUserIds.map(String).includes(safeUid));
}
function publicReminderShape(row = {}) {
  const participants = Array.isArray(row.participantUserIds) ? row.participantUserIds.map(value => clean(value, 180)).filter(Boolean).slice(0, 2) : [];
  return {
    id: clean(row.id || row.docId || '', 180),
    restaurantId: clean(row.restaurantId || row.workspaceId || '', 180),
    workspaceId: clean(row.workspaceId || row.restaurantId || '', 180),
    title: clean(row.title || row.message || 'Reminder', 300),
    notes: clean(row.notes || '', 1200),
    scheduledAt: clean(row.scheduledAt || '', 80),
    nextDispatchAt: clean(row.nextDispatchAt || row.nextReminderAt || row.scheduledAt || '', 80),
    nextReminderAt: clean(row.nextReminderAt || row.nextDispatchAt || row.scheduledAt || '', 80),
    snoozedUntil: clean(row.snoozedUntil || '', 80),
    terminalAt: clean(row.terminalAt || '', 80),
    createdAt: clean(row.createdAt || '', 80),
    updatedAt: clean(row.updatedAt || '', 80),
    completedAt: clean(row.completedAt || '', 80),
    dismissedAt: clean(row.dismissedAt || '', 80),
    cancelledAt: clean(row.cancelledAt || row.canceledAt || '', 80),
    status: clean(row.status || 'scheduled', 60),
    dispatchEligible: row.dispatchEligible !== false,
    recurrence: clean(row.recurrence || 'none', 40),
    timezone: clean(row.timezone || 'UTC', 100),
    visibility: clean(row.visibility || '', 80),
    shared: row.shared === true,
    assignedToUserId: clean(row.assignedToUserId || row.userId || '', 180),
    assignedToName: clean(row.assignedToName || row.userName || row.employeeName || '', 160),
    createdBy: clean(row.createdBy || '', 180),
    createdByName: clean(row.createdByName || '', 160),
    participantSchemaVersion: 1,
    participantUserIds: participants,
    source: clean(row.source || '', 100)
  };
}
async function verifyCaller({ db, decoded, restaurantId }) {
  const userSnap = await db.collection('users').doc(decoded.uid).get();
  const user = userSnap.exists ? { id: userSnap.id, ...(userSnap.data() || {}) } : null;
  const member = await readWorkspaceMember(db, decoded.uid, decoded.email || user?.email || '', restaurantId);
  if (!activeUser(user || {}) || (!userHasWorkspace(user || {}, restaurantId) && !activeMember(member || {}))) {
    const err = new Error('You do not have active access to this workspace.');
    err.status = 403; err.code = 'no-workspace-access';
    throw err;
  }
  return { user, member };
}
async function listPersonalReminders({ db, uid, restaurantId, limitCount = 80 }) {
  const boundedLimit = Math.max(1, Math.min(200, Number(limitCount || 80)));
  const snap = await db.collection('personalReminders')
    .where('restaurantId', '==', restaurantId)
    .where('participantSchemaVersion', '==', 1)
    .where('participantUserIds', 'array-contains', uid)
    .limit(boundedLimit)
    .get();
  const rows = [];
  snap.forEach(doc => rows.push({ id: doc.id, ...(doc.data() || {}) }));
  return participantRowsOnly(rows, uid, restaurantId).map(publicReminderShape);
}
function safeError(err) { return clean(err?.message || err || 'Personal reminders could not be loaded.', 220).replace(/(token|secret|private[_ -]?key|authorization)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]'); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  try {
    const app = getAdminAppForRequest(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error, code: 'app-check-required' });
    const token = authToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Authentication is required.', code: 'missing-token' });
    const decoded = await app.auth().verifyIdToken(token);
    const db = app.firestore();
    const body = await readBody(req);
    const restaurantId = clean(body.restaurantId || '', 180);
    if (!restaurantId) return res.status(400).json({ ok: false, error: 'Workspace is required.', code: 'missing-workspace' });
    await verifyCaller({ db, decoded, restaurantId });
    const reminders = await listPersonalReminders({ db, uid: decoded.uid, restaurantId, limitCount: body.limitCount });
    return res.status(200).json({ ok: true, action: 'list', restaurantId, reminders, count: reminders.length, querySignature: 'restaurantId==;participantSchemaVersion==1;participantUserIds array-contains auth.uid' });
  } catch (err) {
    const status = Number(err?.status || 500);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ ok: false, error: safeError(err), code: clean(err?.code || 'personal-reminder-list-failed', 80) });
  }
};
module.exports._test = { publicReminderShape, participantRowsOnly, listPersonalReminders, verifyCaller };
