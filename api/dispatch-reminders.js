const { initAdmin } = require('./_chaos-admin');
const {
  collectEligibleTokens,
  occurrenceKeyForReminder: stableOccurrenceKey,
  getNextRecurringReminderAt: nextRecurringAt,
  buildRecurringSuccessUpdate,
  buildRetryUpdate,
  isRecipientSnapshotFresh
} = require('./_reminder-dispatch-logic');

function getCronSecret(req) {
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return auth || String(req.headers['x-cron-secret'] || '').trim();
}

function normalizeToken(token) {
  return String(token || '').trim();
}

function collectTokens(user = {}) {
  return collectEligibleTokens(user);
}


function norm(value = '') {
  return String(value || '').toLowerCase().trim();
}

function cleanId(value = '') {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);
}

function hashForNotificationTag(value = '') {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

function notificationTag(prefix, ...parts) {
  const clean = [prefix, ...parts]
    .map(part => cleanId(String(part || '')))
    .filter(Boolean)
    .join(':')
    .slice(0, 120);
  return clean || `${prefix}:${hashForNotificationTag(parts.join('|'))}`;
}

function webPushOptions(tag, link = '/') {
  return {
    notification: {
      tag,
      renotify: false,
      icon: '/app-icon.png',
      badge: '/notification-badge.png'
    },
    fcmOptions: { link }
  };
}



function occurrenceKeyForReminder(docId, dueAt) {
  return stableOccurrenceKey(docId, dueAt);
}
function makeOccurrenceFields(docId, effectiveDueAt) {
  const key = occurrenceKeyForReminder(docId, effectiveDueAt);
  return { currentOccurrenceKey: key, dispatchKey: key };
}
function addWrite(stats, key = 'documentsWritten') {
  stats[key] = Number(stats[key] || 0) + 1;
  stats.documentsWritten = Number(stats.documentsWritten || 0) + 1;
}

function memberDocId(uid, restaurantId) {
  return `${cleanId(uid)}_${cleanId(restaurantId)}`.slice(0, 240);
}

function mergeTokenSource(tokens, source) {
  collectTokens(source).forEach(token => tokens.add(token));
}

async function collectEventReminderTokens(db, reminder = {}) {
  const tokens = new Set();
  const resolutionErrors = [];
  const resolvedUsers = [];
  const snapshotDevices = Array.isArray(reminder.recipientDeviceSnapshot) ? reminder.recipientDeviceSnapshot : [];
  const snapshotFresh = isRecipientSnapshotFresh(reminder);

  if (snapshotFresh) {
    snapshotDevices.forEach(device => {
      const token = normalizeToken(device?.token || device?.fcmToken);
      if (token && require('./_reminder-dispatch-logic').isActivePushDevice(device)) tokens.add(token);
    });
  }

  // Direct reminder-owned device registrations remain supported, but modern device
  // eligibility rules are always applied.
  collectTokens(reminder).forEach(token => tokens.add(token));

  if (!snapshotFresh || tokens.size === 0) {
    const restaurantId = String(reminder.restaurantId || reminder.workspaceId || '').trim();
    const userIds = new Set();
    const emails = new Set();
    (Array.isArray(reminder.recipientUserIds) ? reminder.recipientUserIds : []).forEach(id => id && userIds.add(String(id)));
    (Array.isArray(reminder.recipientEmails) ? reminder.recipientEmails : []).forEach(email => email && emails.add(norm(email)));
    (Array.isArray(reminder.recipientUsers) ? reminder.recipientUsers : []).forEach(user => {
      if (user?.id) userIds.add(String(user.id));
      if (user?.uid) userIds.add(String(user.uid));
      if (user?.userId) userIds.add(String(user.userId));
      if (user?.email) emails.add(norm(user.email));
    });
    if (reminder.createdBy) userIds.add(String(reminder.createdBy));
    if (reminder.createdByEmail) emails.add(norm(reminder.createdByEmail));

    const refs = [...userIds].slice(0, 100).map(id => db.collection('users').doc(id));
    if (refs.length) {
      try {
        const docs = typeof db.getAll === 'function' ? await db.getAll(...refs) : await Promise.all(refs.map(ref => ref.get()));
        docs.forEach(snap => {
          if (!snap?.exists) return;
          const user = { id: snap.id, ...snap.data() };
          if (restaurantId && user.restaurantId && user.restaurantId !== restaurantId && !(Array.isArray(user.workspaceIds) && user.workspaceIds.includes(restaurantId))) return;
          resolvedUsers.push(user);
        });
      } catch (err) {
        resolutionErrors.push(`user-id batch: ${sanitizeDispatchError(err, 'recipient lookup failed')}`);
      }
    }

    for (const email of [...emails].slice(0, 25)) {
      try {
        const snap = await db.collection('users').where('email', '==', email).limit(2).get();
        if (snap.size > 1) { resolutionErrors.push(`ambiguous recipient email: ${email}`); continue; }
        if (!snap.empty) {
          const row = snap.docs[0];
          const user = { id: row.id, ...row.data() };
          if (!restaurantId || !user.restaurantId || user.restaurantId === restaurantId || (Array.isArray(user.workspaceIds) && user.workspaceIds.includes(restaurantId))) resolvedUsers.push(user);
        }
      } catch (err) {
        resolutionErrors.push(`email lookup: ${sanitizeDispatchError(err, 'recipient lookup failed')}`);
      }
    }

    const seenUsers = new Set();
    resolvedUsers.filter(user => { if (seenUsers.has(user.id)) return false; seenUsers.add(user.id); return true; }).forEach(user => collectTokens(user).forEach(token => tokens.add(token)));
  }

  const recipientDeviceSnapshot = [];
  const seenSnapshotTokens = new Set();
  resolvedUsers.forEach(user => {
    if (!user.pushDevices || typeof user.pushDevices !== 'object') return;
    Object.entries(user.pushDevices).forEach(([deviceId, device]) => {
      const token = normalizeToken(device?.token || device?.fcmToken);
      if (!token || seenSnapshotTokens.has(token) || !require('./_reminder-dispatch-logic').isActivePushDevice(device)) return;
      seenSnapshotTokens.add(token);
      recipientDeviceSnapshot.push({ deviceId, userId: user.id, token, active: true, permission: 'granted', lastVerifiedAt: device.lastVerifiedAt || device.updatedAt || new Date().toISOString() });
    });
  });

  return {
    tokens: [...tokens].filter(Boolean),
    resolvedUsers: [...new Map(resolvedUsers.map(user => [user.id, user])).values()].map(user => ({ id: user.id, email: user.email || '' })),
    resolutionErrors,
    recipientDeviceSnapshot,
    snapshotUsed: snapshotFresh && tokens.size > 0
  };
}


function isRetryableEventReminderStatus(status) {
  const key = String(status || 'scheduled').toLowerCase();
  return ['scheduled', 'no_push_token', 'delivery_problem', 'dispatching'].includes(key);
}

function isRetryablePersonalReminderStatus(status) {
  const key = String(status || 'scheduled').toLowerCase();
  return ['scheduled', 'no_push_token', 'delivery_problem', 'dispatching'].includes(key);
}

function minutesSinceIso(iso) {
  const t = new Date(iso || 0).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 60000;
}


function sanitizeDispatchError(err, fallback = 'Dispatch failed.') {
  const raw = String(err?.message || err || fallback);
  const scrubbed = raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/(token|private[_-]?key|client[_-]?email|authorization|secret)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]')
    .slice(0, 240);
  return scrubbed || fallback;
}

function safeInt(value, fallback, min, max) {
  const parsed = parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function retryAt(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function runWithConcurrency(items, limit, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || getCronSecret(req) !== expectedSecret) return res.status(401).json({ ok: false, error: 'Unauthorized cron request.' });

  let app;
  try {
    app = initAdmin(req);
  } catch (error) {
    const safeDiagnostics = {
      vercelEnv: process.env.VERCEL_ENV || '',
      host: String(req.headers.host || ''),
      activeProjectId: process.env.FIREBASE_ACTIVE_PROJECT_ID || '',
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
      hasGenericServiceAccountKey: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
      hasAdminCredentials: Boolean(process.env.FIREBASE_ADMIN_CREDENTIALS),
      hasSplitCredentialParts: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
    };
    console.error('[dispatch-reminders] Firebase Admin setup is missing or invalid:', error?.message || error, safeDiagnostics);
    return res.status(503).json({
      ok: false,
      code: 'firebase_admin_not_configured',
      error: 'Firebase server credentials are not configured for this Vercel environment.',
      details: sanitizeDispatchError(error, 'Firebase Admin setup failed.'),
      diagnostics: safeDiagnostics
    });
  }
  const db = app.firestore();
  const messaging = app.messaging();
  const nowIso = new Date().toISOString();
  const stats = { queried: 0, scanned: 0, claimed: 0, sent: 0, skipped: 0, failed: 0, noToken: 0, eventQueried: 0, eventScanned: 0, eventSent: 0, eventSkipped: 0, transactionReads: 0, documentsWritten: 0, claimWrites: 0, successWrites: 0, retryWrites: 0, noTokenWrites: 0, terminalWrites: 0, catchRecoveryWrites: 0, eventReminderWrites: 0, rateLimitWritesSkipped: 1, startedAt: nowIso };
  const limit = safeInt(process.env.REMINDER_DISPATCH_QUERY_LIMIT, 200, 1, 500);
  const concurrency = safeInt(process.env.REMINDER_DISPATCH_CONCURRENCY, 12, 1, 25);

  try {
    const snap = await db.collection('personalReminders')
      .where('dispatchEligible', '==', true)
      .where('nextDispatchAt', '<=', nowIso)
      .orderBy('nextDispatchAt', 'asc')
      .limit(limit)
      .get();
    stats.queried = snap.size;

    const processReminder = async (docSnap) => {
      stats.scanned += 1;
      const ref = db.collection('personalReminders').doc(docSnap.id);
      try {
        const claim = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists) return { claimed: false, reason: 'missing' };
          const reminder = fresh.data() || {};
          if (!isRetryablePersonalReminderStatus(reminder.status)) return { claimed: false, reason: 'not_retryable' };
          if (String(reminder.dispatchLeaseUntil || '') > nowIso) return { claimed: false, reason: 'already_dispatching' };
          if (['no_push_token', 'delivery_problem'].includes(String(reminder.status || '').toLowerCase()) && minutesSinceIso(reminder.dispatchAttemptAt) < 10) return { claimed: false, reason: 'retry_window' };
          const occurrenceAt = reminder.occurrenceScheduledAt || reminder.scheduledAt || reminder.recurrenceAnchorAt || reminder.nextReminderAt || reminder.nextDispatchAt || '';
          const effectiveDueAt = reminder.nextDispatchAt || reminder.snoozedUntil || reminder.nextReminderAt || occurrenceAt || '';
          if (effectiveDueAt && String(effectiveDueAt) > nowIso) return { claimed: false, reason: 'snoozed_or_not_due' };
          const dispatchKey = reminder.currentOccurrenceKey || occurrenceKeyForReminder(docSnap.id, occurrenceAt || effectiveDueAt || reminder.scheduledAt || '');
          if (reminder.lastSuccessfulOccurrenceKey && reminder.lastSuccessfulOccurrenceKey === dispatchKey) return { claimed: false, reason: 'already_dispatched' };
          tx.update(ref, {
            status: 'dispatching',
            dispatchAttemptAt: nowIso,
            dispatchKey,
            currentOccurrenceKey: dispatchKey,
            effectiveDueAt,
            dispatchAttemptCount: Number(reminder.dispatchAttemptCount || 0) + 1,
            dispatchLeaseUntil: retryAt(5),
            updatedAt: nowIso
          });
          return { claimed: true, reminder, dispatchKey, effectiveDueAt, occurrenceAt };
        });
        stats.transactionReads += 1;

        if (!claim.claimed) {
          stats.skipped += 1;
          return;
        }

        stats.claimed += 1;
        addWrite(stats, 'claimWrites');
        const reminder = claim.reminder || {};
        const dispatchKey = claim.dispatchKey;
        const userId = reminder.assignedToUserId || reminder.userId || reminder.createdBy || '';
        const userSnap = userId ? await db.collection('users').doc(userId).get() : null;
        const user = userSnap?.exists ? userSnap.data() : {};
        const tokens = collectTokens(user);

        if (!tokens.length) {
          stats.noToken += 1;
          const originalOccurrenceAt = claim.occurrenceAt || reminder.occurrenceScheduledAt || reminder.scheduledAt || nowIso;
          const nextScheduledAt = nextRecurringAt(originalOccurrenceAt, reminder.recurrence, reminder);
          await ref.update({
            ...buildRetryUpdate({
              reminder,
              occurrenceKey: dispatchKey,
              occurrenceAt: originalOccurrenceAt,
              nowIso,
              retryIso: retryAt(10),
              status: 'no_push_token',
              error: 'No saved push token for reminder recipient. Ask the user to open the app once and allow notifications, then the cron will retry.'
            }),
            recurrenceAnchorAt: reminder.recurrenceAnchorAt || originalOccurrenceAt,
            nextOccurrenceAt: nextScheduledAt || null,
            scheduledAt: reminder.scheduledAt || originalOccurrenceAt,
            previousDispatchKey: dispatchKey,
            lastNoTokenAt: nowIso
          });
          addWrite(stats, 'noTokenWrites');
          return;
        }

        const title = reminder.shared ? '86 Chaos Shared Reminder' : '86 Chaos Reminder';
        const body = reminder.shared && reminder.createdByName ? `${reminder.createdByName}: ${reminder.title || 'Reminder'}` : (reminder.title || 'Personal reminder');
        const tag = notificationTag('86chaos-reminder', docSnap.id, dispatchKey || reminder.scheduledAt || body);
        const payload = {
          notification: { title, body },
          data: {
            type: 'personal_reminder',
            reminderId: String(docSnap.id),
            restaurantId: String(reminder.restaurantId || ''),
            click_action: '/?tab=reminders',
            notificationTag: tag
          },
          webpush: webPushOptions(tag, '/?tab=reminders'),
          tokens
        };

        const result = await messaging.sendEachForMulticast(payload);
        if (result.successCount > 0) {
          stats.sent += 1;
          const nextScheduledAt = nextRecurringAt(reminder.occurrenceScheduledAt || reminder.scheduledAt, reminder.recurrence, reminder);
          if (nextScheduledAt) {
            await ref.update(buildRecurringSuccessUpdate({
              docId: docSnap.id,
              reminder,
              deliveredOccurrenceKey: dispatchKey,
              nextScheduledAt,
              nowIso,
              successCount: result.successCount,
              failureCount: result.failureCount || 0
            }));
            addWrite(stats, 'successWrites');
          } else {
            await ref.update({
              status: 'sent',
              dispatchedAt: nowIso,
              terminalAt: nowIso,
              lastSuccessfulDispatchAt: nowIso,
              lastSuccessfulOccurrenceKey: dispatchKey,
              dispatchEligible: false,
              nextDispatchAt: null,
              dispatchLeaseUntil: null,
              dispatchKey,
              pushSuccessCount: result.successCount,
              pushFailureCount: result.failureCount || 0
            });
            addWrite(stats, 'terminalWrites');
          }
        } else {
          stats.failed += 1;
          await ref.update(buildRetryUpdate({
            reminder,
            occurrenceKey: dispatchKey,
            occurrenceAt: claim.occurrenceAt || reminder.occurrenceScheduledAt || reminder.scheduledAt || nowIso,
            nowIso,
            retryIso: retryAt(10),
            status: 'delivery_problem',
            error: sanitizeDispatchError(result.responses?.[0]?.error, 'No push sends succeeded.'),
            failureCount: result.failureCount || tokens.length
          }));
          addWrite(stats, 'retryWrites');
        }
      } catch (err) {
        stats.failed += 1;
        const fallbackOccurrenceAt = docSnap.data()?.occurrenceScheduledAt || docSnap.data()?.scheduledAt || nowIso;
        const fallbackKey = docSnap.data()?.currentOccurrenceKey || occurrenceKeyForReminder(docSnap.id, fallbackOccurrenceAt);
        await ref.update(buildRetryUpdate({
          reminder: docSnap.data() || {},
          occurrenceKey: fallbackKey,
          occurrenceAt: fallbackOccurrenceAt,
          nowIso,
          retryIso: retryAt(10),
          status: 'delivery_problem',
          error: sanitizeDispatchError(err, 'Dispatch failed.')
        })).then(() => addWrite(stats, 'catchRecoveryWrites')).catch(() => {});
      }
    };

    await runWithConcurrency(snap.docs, concurrency, processReminder);

    const eventSnap = await db.collection('eventReminders')
      .where('dispatchEligible', '==', true)
      .where('nextDispatchAt', '<=', nowIso)
      .orderBy('nextDispatchAt', 'asc')
      .limit(limit)
      .get();
    stats.eventQueried = eventSnap.size;

    const processEventReminder = async (docSnap) => {
      stats.eventScanned += 1;
      const ref = db.collection('eventReminders').doc(docSnap.id);
      try {
        const claim = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists) return { claimed: false, reason: 'missing' };
          const reminder = fresh.data() || {};
          if (!isRetryableEventReminderStatus(reminder.status)) return { claimed: false, reason: 'not_retryable' };
          if (String(reminder.dispatchLeaseUntil || '') > nowIso) return { claimed: false, reason: 'already_dispatching' };
          if (['no_push_token', 'delivery_problem'].includes(String(reminder.status || '').toLowerCase()) && minutesSinceIso(reminder.dispatchAttemptAt) < 10) return { claimed: false, reason: 'retry_window' };
          const occurrenceAt = reminder.occurrenceScheduledAt || reminder.scheduledAt || reminder.recurrenceAnchorAt || reminder.nextReminderAt || reminder.nextDispatchAt || '';
          const effectiveDueAt = reminder.nextDispatchAt || reminder.snoozedUntil || reminder.nextReminderAt || occurrenceAt || '';
          if (effectiveDueAt && String(effectiveDueAt) > nowIso) return { claimed: false, reason: 'snoozed_or_not_due' };
          const dispatchKey = reminder.currentOccurrenceKey || occurrenceKeyForReminder(docSnap.id, occurrenceAt || effectiveDueAt || reminder.scheduledAt || '');
          if (reminder.lastSuccessfulOccurrenceKey && reminder.lastSuccessfulOccurrenceKey === dispatchKey) return { claimed: false, reason: 'already_sent' };
          tx.update(ref, {
            status: 'dispatching',
            dispatchAttemptAt: nowIso,
            dispatchKey,
            currentOccurrenceKey: dispatchKey,
            effectiveDueAt,
            dispatchAttemptCount: Number(reminder.dispatchAttemptCount || 0) + 1,
            dispatchLeaseUntil: retryAt(5),
            updatedAt: nowIso
          });
          return { claimed: true, reminder, dispatchKey, effectiveDueAt, occurrenceAt };
        });
        stats.transactionReads += 1;

        if (!claim.claimed) {
          stats.eventSkipped += 1;
          return;
        }

        addWrite(stats, 'claimWrites');
        const reminder = claim.reminder || {};
        const { tokens, resolvedUsers, resolutionErrors, recipientDeviceSnapshot, snapshotUsed } = await collectEventReminderTokens(db, reminder);

        if (!tokens.length) {
          stats.noToken += 1;
          await ref.update({
            ...buildRetryUpdate({
              reminder,
              occurrenceKey: claim.dispatchKey,
              occurrenceAt: claim.occurrenceAt || reminder.occurrenceScheduledAt || reminder.scheduledAt || nowIso,
              nowIso,
              retryIso: retryAt(10),
              status: 'no_push_token',
              error: 'No saved push token for event reminder recipients. Ask recipients to open the app once and allow notifications, then the cron will retry.'
            }),
            lastNoTokenAt: nowIso,
            resolvedRecipientCount: resolvedUsers.length,
            recipientResolutionErrors: resolutionErrors.slice(0, 10),
            recipientDeviceSnapshot,
            recipientSnapshotAt: recipientDeviceSnapshot.length ? nowIso : (reminder.recipientSnapshotAt || null),
            tokenSource: snapshotUsed ? 'fresh_snapshot' : 'none'
          });
          addWrite(stats, 'noTokenWrites');
          return;
        }

        const typeKey = String(reminder.reminderType || reminder.type || '').toLowerCase();
        const isOrder = typeKey === 'orderreminder' || typeKey === 'order_reminder';
        const title = isOrder ? '86 Chaos Order Reminder' : '86 Chaos Event Reminder';
        const body = isOrder ? `Order reminder for ${reminder.eventTitle || 'event'}` : `${reminder.eventTitle || 'Event'}${reminder.eventTime ? ` at ${reminder.eventTime}` : ''}`;
        const tag = notificationTag('86chaos-event-reminder', docSnap.id, claim.dispatchKey || reminder.scheduledAt || body);
        const payload = {
          notification: { title, body },
          data: {
            type: isOrder ? 'event_order_reminder' : 'event_reminder',
            eventReminderId: String(docSnap.id),
            eventId: String(reminder.eventId || ''),
            restaurantId: String(reminder.restaurantId || ''),
            click_action: '/?tab=events',
            notificationTag: tag
          },
          webpush: webPushOptions(tag, '/?tab=events'),
          tokens
        };

        const result = await messaging.sendEachForMulticast(payload);
        if (result.successCount > 0) {
          stats.eventSent += 1;
          await ref.update({
            status: 'sent',
            dispatchedAt: nowIso,
            terminalAt: nowIso,
            lastSuccessfulDispatchAt: nowIso,
            lastSuccessfulOccurrenceKey: claim.dispatchKey,
            dispatchEligible: false,
            dispatchLeaseUntil: null,
            nextDispatchAt: null,
            dispatchKey: claim.dispatchKey,
            pushSuccessCount: result.successCount,
            pushFailureCount: result.failureCount || 0,
            resolvedRecipientCount: resolvedUsers.length,
            recipientResolutionErrors: resolutionErrors.slice(0, 10),
            recipientDeviceSnapshot,
            recipientSnapshotAt: recipientDeviceSnapshot.length ? nowIso : (reminder.recipientSnapshotAt || null),
            recipientRegistryVersion: 1,
            tokenSource: snapshotUsed ? 'fresh_snapshot' : 'resolved_users',
            updatedAt: nowIso
          });
          addWrite(stats, 'eventReminderWrites');
        } else {
          stats.failed += 1;
          await ref.update({
            ...buildRetryUpdate({
              reminder,
              occurrenceKey: claim.dispatchKey,
              occurrenceAt: claim.occurrenceAt || reminder.occurrenceScheduledAt || reminder.scheduledAt || nowIso,
              nowIso,
              retryIso: retryAt(10),
              status: 'delivery_problem',
              error: sanitizeDispatchError(result.responses?.[0]?.error, 'No push sends succeeded.'),
              failureCount: result.failureCount || tokens.length
            }),
            resolvedRecipientCount: resolvedUsers.length,
            recipientResolutionErrors: resolutionErrors.slice(0, 10),
            recipientDeviceSnapshot,
            recipientSnapshotAt: recipientDeviceSnapshot.length ? nowIso : (reminder.recipientSnapshotAt || null),
            recipientRegistryVersion: 1,
            tokenSource: snapshotUsed ? 'fresh_snapshot' : 'resolved_users'
          });
          addWrite(stats, 'retryWrites');
        }
      } catch (err) {
        stats.failed += 1;
        const failedReminder = docSnap.data() || {};
        const failedOccurrenceAt = failedReminder.occurrenceScheduledAt || failedReminder.scheduledAt || nowIso;
        await ref.update(buildRetryUpdate({
          reminder: failedReminder,
          occurrenceKey: failedReminder.currentOccurrenceKey || occurrenceKeyForReminder(docSnap.id, failedOccurrenceAt),
          occurrenceAt: failedOccurrenceAt,
          nowIso,
          retryIso: retryAt(10),
          status: 'delivery_problem',
          error: sanitizeDispatchError(err, 'Event reminder dispatch failed.')
        })).then(() => addWrite(stats, 'catchRecoveryWrites')).catch(() => {});
      }
    };

    await runWithConcurrency(eventSnap.docs, concurrency, processEventReminder);
    return res.status(200).json({ ok: true, now: nowIso, limit, concurrency, ...stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: sanitizeDispatchError(err, 'Reminder dispatch failed.'), limit, concurrency, ...stats });
  }
};

module.exports._test = { collectTokens, collectEventReminderTokens, occurrenceKeyForReminder, nextRecurringAt, buildRecurringSuccessUpdate, buildRetryUpdate, sanitizeDispatchError };
