'use strict';
const { getAdminAppForRequest, readBody, requireAppCheckIfEnforced, readWorkspaceMember, userHasWorkspace, norm } = require('./_chaos-admin');
const { occurrenceKeyForReminder, getZonedParts } = require('./_reminder-dispatch-logic');

function clean(value = '', max = 800) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); }
function authToken(req) { return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function safeError(err) { return String(err?.message || err || 'Reminder save failed.').replace(/(token|secret|private[_ -]?key|authorization)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]').slice(0, 220); }
function activeUser(user = {}) {
  return Boolean(user.id && user.isActive !== false && user.disabled !== true && user.accountDisabled !== true && user.deleted !== true && user.archived !== true);
}
function authUidForUser(user = {}, fallback = '') {
  return clean(user.authUid || user.uid || user.userId || user.firebaseUid || fallback, 180);
}
function profileDocIdForUser(user = {}, fallback = '') {
  return clean(user.profileDocId || user.accountProfile?.id || user.accountProfileId || user.id || fallback, 180);
}
function profileMatchesDecoded(user = {}, decoded = {}) {
  const uid = clean(decoded.uid, 180);
  const email = norm(decoded.email || '');
  const ids = [user.id, user.authUid, user.uid, user.userId, user.firebaseUid].map(value => clean(value, 180)).filter(Boolean);
  const emails = [user.email, user.userEmail, user.accountEmail].map(norm).filter(Boolean);
  return Boolean((uid && ids.includes(uid)) || (email && emails.includes(email)));
}
async function readUserProfile(db, id = '') {
  const cleanId = clean(id, 180);
  if (!cleanId) return null;
  const snap = await db.collection('users').doc(cleanId).get();
  return snap.exists ? { ...(snap.data() || {}), id: snap.id } : null;
}
async function resolveCallerProfile(db, decoded = {}) {
  const direct = await readUserProfile(db, decoded.uid);
  if (direct && profileMatchesDecoded(direct, decoded)) return direct;
  const email = norm(decoded.email || '');
  if (!email) return null;
  if (email !== String(decoded.uid || '')) {
    const emailDoc = await readUserProfile(db, email);
    if (emailDoc && profileMatchesDecoded(emailDoc, decoded)) return emailDoc;
  }
  const byEmail = await db.collection('users').where('email', '==', email).limit(2).get();
  if (byEmail.size !== 1) return null;
  const match = byEmail.docs[0];
  const user = { ...(match.data() || {}), id: match.id };
  return profileMatchesDecoded(user, decoded) ? user : null;
}
async function activeMember(db, user, membershipUid, email, restaurantId) {
  const userEnabled = activeUser(user);
  if (userEnabled && userHasWorkspace(user, restaurantId)) return { ok: true, user, member: null };
  const member = await readWorkspaceMember(db, membershipUid, email || user?.email || '', restaurantId);
  const memberEnabled = Boolean(member && member.isActive !== false && member.disabled !== true);
  return { ok: userEnabled && memberEnabled, user, member };
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
    const requestedAssigneeId = clean(body.assignedToUserId || decoded.uid, 180);
    if (!restaurantId || !title || Number.isNaN(scheduledDate.getTime())) return res.status(400).json({ ok:false, error:'Restaurant, title, and valid scheduledAt are required.' });
    const callerProfile = await resolveCallerProfile(db, decoded);
    if (!callerProfile) return res.status(403).json({ ok:false, error:'Your active account profile could not be resolved.' });
    const callerMembership = await activeMember(db, callerProfile, decoded.uid, decoded.email || callerProfile.email || '', restaurantId);
    if (!callerMembership.ok) return res.status(403).json({ ok:false, error:'You do not have active access to this workspace.' });
    const callerIds = new Set([decoded.uid, callerProfile.id, callerProfile.authUid, callerProfile.uid, callerProfile.userId].map(value => clean(value, 180)).filter(Boolean));
    const assigningToCaller = callerIds.has(requestedAssigneeId);
    const assignee = assigningToCaller ? callerProfile : await readUserProfile(db, requestedAssigneeId);
    if (!assignee) return res.status(400).json({ ok:false, error:'Assigned teammate was not found.' });
    const assignedToUserId = assigningToCaller ? decoded.uid : authUidForUser(assignee, requestedAssigneeId);
    const recipientProfileId = profileDocIdForUser(assignee, assignee.id || requestedAssigneeId);
    const assigneeMembership = assigningToCaller
      ? callerMembership
      : await activeMember(db, assignee, assignedToUserId, assignee.email || '', restaurantId);
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
      recipientProfileId,
      assignedToName: assignee.name || assignee.displayName || assignee.email || 'Team member',
      assignedToEmail: assignee.email || '',
      participantUserIds: participants,
      participantSchemaVersion: 1,
      createdBy: existing.createdBy || decoded.uid,
      createdByName: existing.createdByName || callerProfile.name || decoded.name || decoded.email || '',
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

module.exports._test = { activeUser, authUidForUser, profileDocIdForUser, profileMatchesDecoded, readUserProfile, resolveCallerProfile, activeMember };
