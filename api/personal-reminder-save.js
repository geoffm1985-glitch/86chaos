'use strict';
const { getAdminAppForRequest, readBody, requireAppCheckIfEnforced, readWorkspaceMember, userHasWorkspace } = require('./_chaos-admin');
const { occurrenceKeyForReminder, getZonedParts } = require('./_reminder-dispatch-logic');

function clean(value = '', max = 800) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); }
function authToken(req) { return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function safeError(err) { return String(err?.message || err || 'Reminder save failed.').replace(/(token|secret|private[_ -]?key|authorization)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]').slice(0, 220); }
async function activeMember(db, uid, email, restaurantId) {
  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const member = await readWorkspaceMember(db, uid, email || user.email || '', restaurantId);
  const userEnabled = userSnap.exists && user.isActive !== false && user.disabled !== true && user.accountDisabled !== true;
  const memberEnabled = Boolean(member && member.isActive !== false && member.disabled !== true);
  return { ok: userEnabled && (userHasWorkspace(user, restaurantId) || memberEnabled), user, member };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  try {
    const app = getAdminAppForRequest(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok:false, error:appCheck.error });
    const token = authToken(req);
    if (!token) return res.status(401).json({ ok:false, error:'Authentication is required.' });
    const decoded = await app.auth().verifyIdToken(token);
    const db = app.firestore();
    const body = await readBody(req);
    const restaurantId = clean(body.restaurantId, 160);
    const reminderId = clean(body.reminderId, 180);
    const title = clean(body.title, 300);
    const notes = clean(body.notes, 2000);
    const scheduledDate = new Date(body.scheduledAt || '');
    const assignedToUserId = clean(body.assignedToUserId || decoded.uid, 180);
    if (!restaurantId || !title || Number.isNaN(scheduledDate.getTime())) return res.status(400).json({ ok:false, error:'Restaurant, title, and valid scheduledAt are required.' });
    const callerMembership = await activeMember(db, decoded.uid, decoded.email || '', restaurantId);
    if (!callerMembership.ok) return res.status(403).json({ ok:false, error:'You do not have active access to this workspace.' });
    const assigneeSnap = await db.collection('users').doc(assignedToUserId).get();
    if (!assigneeSnap.exists) return res.status(400).json({ ok:false, error:'Assigned teammate was not found.' });
    const assignee = assigneeSnap.data() || {};
    const assigneeMembership = await activeMember(db, assignedToUserId, assignee.email || '', restaurantId);
    if (!assigneeMembership.ok) return res.status(403).json({ ok:false, error:'Assigned teammate is not an active member of this workspace.' });

    const ref = reminderId ? db.collection('personalReminders').doc(reminderId) : db.collection('personalReminders').doc();
    let existing = {};
    if (reminderId) {
      const existingSnap = await ref.get();
      if (!existingSnap.exists) return res.status(404).json({ ok:false, error:'Reminder not found.' });
      existing = existingSnap.data() || {};
      if (String(existing.createdBy || '') !== decoded.uid && decoded.superAdmin !== true && decoded.systemAdmin !== true) return res.status(403).json({ ok:false, error:'Only the reminder creator can edit it.' });
      if (String(existing.restaurantId || '') !== restaurantId) return res.status(409).json({ ok:false, error:'Reminder workspace cannot be changed.' });
    }
    const now = new Date().toISOString();
    const scheduledAt = scheduledDate.toISOString();
    const recurrence = clean(body.recurrence || existing.recurrence || 'none', 30).toLowerCase();
    const timezone = clean(body.timezone || existing.timezone || 'UTC', 100);
    const occurrenceKey = occurrenceKeyForReminder(ref.id, scheduledAt);
    const participants = [...new Set([decoded.uid, assignedToUserId])].slice(0,2);
    const zoned = getZonedParts(scheduledDate, timezone);
    const payload = {
      restaurantId,
      workspaceId: restaurantId,
      userId: assignedToUserId,
      userEmail: assignee.email || '',
      assignedToUserId,
      assignedToName: assignee.name || assignee.displayName || assignee.email || 'Team member',
      assignedToEmail: assignee.email || '',
      participantUserIds: participants,
      participantSchemaVersion: 1,
      createdBy: existing.createdBy || decoded.uid,
      createdByName: existing.createdByName || callerMembership.user.name || decoded.name || decoded.email || '',
      createdByEmail: existing.createdByEmail || decoded.email || '',
      shared: assignedToUserId !== decoded.uid,
      visibility: assignedToUserId !== decoded.uid ? 'shared_reminder' : 'private_reminder',
      title,
      notes,
      scheduledAt,
      occurrenceScheduledAt: scheduledAt,
      recurrenceAnchorAt: scheduledAt,
      recurrenceAnchorDay: zoned.day,
      localScheduledDay: zoned.day,
      localScheduledClockTime: `${String(zoned.hour).padStart(2,'0')}:${String(zoned.minute).padStart(2,'0')}`,
      timezone,
      recurrence,
      currentOccurrenceKey: occurrenceKey,
      dispatchKey: occurrenceKey,
      lastSuccessfulOccurrenceKey: null,
      dispatchedAt: null,
      terminalAt: null,
      completedAt: null,
      cancelledAt: null,
      dismissedAt: null,
      snoozedUntil: null,
      dispatchEligible: true,
      nextDispatchAt: scheduledAt,
      dispatchAttemptAt: null,
      dispatchLeaseUntil: null,
      dispatchError: null,
      deliveryProblemAt: null,
      status: 'scheduled',
      updatedAt: now,
      source: reminderId ? 'manual_update' : (assignedToUserId !== decoded.uid ? 'manual_shared_reminder' : 'manual_private_reminder')
    };
    if (!reminderId) payload.createdAt = now;
    await ref.set(payload, { merge: Boolean(reminderId) });
    return res.status(200).json({ ok:true, reminderId:ref.id, created:!reminderId, scheduledAt, status:'scheduled' });
  } catch (err) {
    return res.status(500).json({ ok:false, error:safeError(err) });
  }
};
