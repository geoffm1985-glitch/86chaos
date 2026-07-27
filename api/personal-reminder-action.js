'use strict';
const { getAdminAppForRequest, readBody, requireAppCheckIfEnforced, readWorkspaceMember, userHasWorkspace } = require('./_chaos-admin');
const { occurrenceKeyForReminder } = require('./_reminder-dispatch-logic');

const ALLOWED_ACTIONS = new Set(['complete', 'snooze', 'reopen', 'cancel', 'dismiss']);
function safeText(value, max = 180) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); }
function authToken(req) { return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function terminalUpdate(status, now) {
  const field = status === 'done' ? 'completedAt' : status === 'dismissed' ? 'dismissedAt' : 'cancelledAt';
  return { status, [field]: now, terminalAt: now, dispatchEligible: false, nextDispatchAt: null, dispatchLeaseUntil: null, updatedAt: now };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  try {
    const app = getAdminAppForRequest(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const token = authToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Authentication is required.' });
    const decoded = await app.auth().verifyIdToken(token);
    const db = app.firestore();
    const body = await readBody(req);
    const reminderId = safeText(body.reminderId, 180);
    const action = safeText(body.action, 40).toLowerCase();
    if (!reminderId || !ALLOWED_ACTIONS.has(action)) return res.status(400).json({ ok: false, error: 'A valid reminder action is required.' });

    const ref = db.collection('personalReminders').doc(reminderId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Reminder not found.' });
    const reminder = snap.data() || {};
    const participants = Array.isArray(reminder.participantUserIds) ? reminder.participantUserIds.map(String) : [reminder.createdBy, reminder.userId, reminder.assignedToUserId].filter(Boolean).map(String);
    if (!participants.includes(decoded.uid)) return res.status(403).json({ ok: false, error: 'You are not a participant in this reminder.' });

    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const user = userSnap.exists ? userSnap.data() || {} : {};
    const restaurantId = safeText(reminder.restaurantId, 160);
    const member = restaurantId ? await readWorkspaceMember(db, decoded.uid, decoded.email || '', restaurantId) : null;
    if (!restaurantId || (!userHasWorkspace(user, restaurantId) && !(member && member.isActive !== false && member.disabled !== true))) return res.status(403).json({ ok: false, error: 'This reminder is not in an active workspace for your account.' });

    const now = new Date().toISOString();
    let update;
    if (action === 'complete') update = terminalUpdate('done', now);
    else if (action === 'dismiss') update = terminalUpdate('dismissed', now);
    else if (action === 'cancel') {
      if (reminder.createdBy !== decoded.uid) return res.status(403).json({ ok: false, error: 'Only the reminder creator can cancel it.' });
      update = terminalUpdate('cancelled', now);
    } else if (action === 'snooze') {
      const minutes = Math.max(5, Math.min(24 * 60, Number(body.minutes || 30)));
      const next = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const occurrenceAt = reminder.occurrenceScheduledAt || reminder.scheduledAt || next;
      const occurrenceKey = reminder.currentOccurrenceKey || occurrenceKeyForReminder(reminderId, occurrenceAt);
      update = {
        status: 'scheduled', snoozedUntil: next, nextReminderAt: next,
        occurrenceScheduledAt: occurrenceAt, currentOccurrenceKey: occurrenceKey,
        dispatchKey: occurrenceKey, dispatchEligible: true, nextDispatchAt: next,
        dispatchAttemptAt: null, dispatchLeaseUntil: null, dispatchError: null,
        deliveryProblemAt: null, updatedAt: now
      };
    } else {
      const requested = new Date(body.scheduledAt || reminder.nextReminderAt || reminder.scheduledAt || now);
      const wakeAt = Number.isNaN(requested.getTime()) ? now : requested.toISOString();
      const occurrenceKey = occurrenceKeyForReminder(reminderId, wakeAt);
      update = {
        status: 'scheduled', completedAt: null, cancelledAt: null, dismissedAt: null,
        terminalAt: null, reopenedAt: now, reopenedBy: decoded.uid,
        scheduledAt: wakeAt, occurrenceScheduledAt: wakeAt, nextReminderAt: wakeAt,
        currentOccurrenceKey: occurrenceKey, lastSuccessfulOccurrenceKey: null,
        dispatchKey: occurrenceKey, dispatchEligible: true, nextDispatchAt: wakeAt,
        dispatchAttemptAt: null, dispatchLeaseUntil: null, dispatchedAt: null,
        dispatchError: null, deliveryProblemAt: null, updatedAt: now
      };
    }
    await ref.update(update);
    return res.status(200).json({ ok: true, reminderId, action, status: update.status, nextDispatchAt: update.nextDispatchAt || null, terminalAt: update.terminalAt || null });
  } catch (err) {
    const message = String(err?.message || 'Reminder action failed.').replace(/(token|secret|private[_ -]?key|authorization)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]').slice(0, 220);
    return res.status(500).json({ ok: false, error: message });
  }
};
