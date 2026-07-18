const { initAdmin } = require('./_chaos-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');

function getCronSecret(req) {
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return auth || String(req.headers['x-cron-secret'] || '').trim();
}

function collectTokens(user = {}) {
  const tokens = new Set();
  if (user.fcmToken) tokens.add(user.fcmToken);
  if (Array.isArray(user.fcmTokens)) user.fcmTokens.forEach(t => t && tokens.add(t));
  if (Array.isArray(user.pushTokens)) user.pushTokens.forEach(t => t && tokens.add(typeof t === 'string' ? t : t?.token));
  if (user.pushDevices && typeof user.pushDevices === 'object') {
    Object.values(user.pushDevices).forEach(device => {
      if (typeof device === 'string') tokens.add(device);
      if (device?.token) tokens.add(device.token);
      if (device?.fcmToken) tokens.add(device.fcmToken);
    });
  }
  return [...tokens].filter(Boolean);
}

function safeInt(value, fallback, min, max) {
  const parsed = parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function getNextRecurringReminderAt(scheduledAt, recurrence) {
  const mode = String(recurrence || 'none').toLowerCase();
  if (!['daily', 'weekly', 'monthly'].includes(mode)) return '';
  const base = new Date(scheduledAt || Date.now());
  if (Number.isNaN(base.getTime())) return '';
  const next = new Date(base.getTime());
  const now = Date.now();
  let guard = 0;
  while (next.getTime() <= now && guard < 36) {
    if (mode === 'daily') next.setDate(next.getDate() + 1);
    if (mode === 'weekly') next.setDate(next.getDate() + 7);
    if (mode === 'monthly') next.setMonth(next.getMonth() + 1);
    guard += 1;
  }
  return Number.isNaN(next.getTime()) ? '' : next.toISOString();
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
    console.error('[dispatch-reminders] Firebase Admin setup is missing or invalid:', error?.message || error);
    return res.status(503).json({
      ok: false,
      code: 'firebase_admin_not_configured',
      error: 'Firebase server credentials are not configured for this Vercel environment.',
      details: error?.message || String(error || 'Unknown Firebase Admin setup error')
    });
  }
  const db = app.firestore();
  const cronRate = await enforceRateLimit({ db, req, routeName: 'dispatch-reminders', limit: Number(process.env.REMINDER_ROUTE_RATE_LIMIT || 12), windowMs: 60 * 1000 });
  if (!cronRate.ok) return sendRateLimited(res, cronRate);
  const messaging = app.messaging();
  const nowIso = new Date().toISOString();
  const stats = { scanned: 0, claimed: 0, sent: 0, skipped: 0, failed: 0, noToken: 0, eventScanned: 0, eventSent: 0, eventSkipped: 0 };
  const limit = safeInt(process.env.REMINDER_DISPATCH_QUERY_LIMIT, 200, 1, 500);
  const concurrency = safeInt(process.env.REMINDER_DISPATCH_CONCURRENCY, 12, 1, 25);

  try {
    const snap = await db.collection('personalReminders')
      .where('scheduledAt', '<=', nowIso)
      .limit(limit)
      .get();

    const processReminder = async (docSnap) => {
      stats.scanned += 1;
      const ref = db.collection('personalReminders').doc(docSnap.id);
      try {
        const claim = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists) return { claimed: false, reason: 'missing' };
          const reminder = fresh.data() || {};
          if (reminder.status !== 'scheduled') return { claimed: false, reason: 'not_scheduled' };
          const dispatchKey = `${docSnap.id}:${reminder.scheduledAt || ''}`;
          if (reminder.dispatchKey === dispatchKey || reminder.dispatchedAt) return { claimed: false, reason: 'already_dispatched' };
          tx.update(ref, { status: 'dispatching', dispatchAttemptAt: nowIso, dispatchKey });
          return { claimed: true, reminder, dispatchKey };
        });

        if (!claim.claimed) {
          stats.skipped += 1;
          return;
        }

        stats.claimed += 1;
        const reminder = claim.reminder || {};
        const dispatchKey = claim.dispatchKey;
        const userId = reminder.assignedToUserId || reminder.userId || reminder.createdBy || '';
        const userSnap = userId ? await db.collection('users').doc(userId).get() : null;
        const user = userSnap?.exists ? userSnap.data() : {};
        const tokens = collectTokens(user);

        if (!tokens.length) {
          stats.noToken += 1;
          await ref.update({ status: 'no_push_token', dispatchKey, dispatchedAt: nowIso, dispatchError: 'No saved push token for reminder recipient.' });
          return;
        }

        const payload = {
          notification: {
            title: reminder.shared ? '86 Chaos Shared Reminder' : '86 Chaos Reminder',
            body: reminder.shared && reminder.createdByName ? `${reminder.createdByName}: ${reminder.title || 'Reminder'}` : (reminder.title || 'Personal reminder')
          },
          data: {
            type: 'personal_reminder',
            reminderId: docSnap.id,
            restaurantId: reminder.restaurantId || '',
            click_action: '/?tab=reminders'
          },
          tokens
        };

        const result = await messaging.sendEachForMulticast(payload);
        if (result.successCount > 0) {
          stats.sent += 1;
          const nextScheduledAt = getNextRecurringReminderAt(reminder.scheduledAt, reminder.recurrence);
          if (nextScheduledAt) {
            await ref.update({
              status: 'scheduled',
              scheduledAt: nextScheduledAt,
              lastDispatchedAt: nowIso,
              dispatchedAt: null,
              previousDispatchKey: dispatchKey,
              dispatchKey: '',
              pushSuccessCount: result.successCount,
              pushFailureCount: result.failureCount || 0,
              updatedAt: nowIso
            });
          } else {
            await ref.update({
              status: 'sent',
              dispatchedAt: nowIso,
              dispatchKey,
              pushSuccessCount: result.successCount,
              pushFailureCount: result.failureCount || 0
            });
          }
        } else {
          stats.failed += 1;
          await ref.update({
            status: 'delivery_problem',
            dispatchedAt: nowIso,
            dispatchKey,
            pushFailureCount: result.failureCount || tokens.length,
            dispatchError: result.responses?.[0]?.error?.message || 'No push sends succeeded.'
          });
        }
      } catch (err) {
        stats.failed += 1;
        await ref.update({
          status: 'delivery_problem',
          dispatchedAt: nowIso,
          dispatchError: err.message || 'Dispatch failed.'
        }).catch(() => {});
      }
    };

    await runWithConcurrency(snap.docs, concurrency, processReminder);

    const eventSnap = await db.collection('eventReminders')
      .where('scheduledAt', '<=', nowIso)
      .limit(limit)
      .get();

    const processEventReminder = async (docSnap) => {
      stats.eventScanned += 1;
      const ref = db.collection('eventReminders').doc(docSnap.id);
      try {
        const claim = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists) return { claimed: false };
          const reminder = fresh.data() || {};
          if (reminder.status !== 'scheduled') return { claimed: false, reason: 'not_scheduled' };
          const dispatchKey = `${docSnap.id}:${reminder.scheduledAt || ''}`;
          if (reminder.dispatchKey === dispatchKey || reminder.dispatchedAt) return { claimed: false, reason: 'already_dispatched' };
          tx.update(ref, { status: 'dispatching', dispatchAttemptAt: nowIso, dispatchKey });
          return { claimed: true, reminder, dispatchKey };
        });
        if (!claim.claimed) { stats.eventSkipped += 1; return; }
        const reminder = claim.reminder || {};
        const recipientIds = Array.isArray(reminder.recipientUserIds) ? reminder.recipientUserIds.filter(Boolean) : [];
        const tokens = new Set();
        await Promise.all(recipientIds.map(async (userId) => {
          const userSnap = await db.collection('users').doc(userId).get();
          if (userSnap.exists) collectTokens(userSnap.data()).forEach(t => tokens.add(t));
        }));
        if (!tokens.size) {
          stats.noToken += 1;
          await ref.update({ status: 'no_push_token', dispatchedAt: nowIso, dispatchKey: claim.dispatchKey, dispatchError: 'No saved push token for event reminder recipients.' });
          return;
        }
        const isOrder = String(reminder.reminderType || reminder.type || '').toLowerCase() === 'orderreminder';
        const payload = {
          notification: {
            title: isOrder ? '86 Chaos Order Reminder' : '86 Chaos Event Reminder',
            body: isOrder ? `Order reminder for ${reminder.eventTitle || 'event'}` : `${reminder.eventTitle || 'Event'}${reminder.eventTime ? ` at ${reminder.eventTime}` : ''}`
          },
          data: { type: isOrder ? 'event_order_reminder' : 'event_reminder', eventReminderId: docSnap.id, eventId: reminder.eventId || '', restaurantId: reminder.restaurantId || '', click_action: '/?tab=events' },
          tokens: [...tokens]
        };
        const result = await messaging.sendEachForMulticast(payload);
        if (result.successCount > 0) {
          stats.eventSent += 1;
          await ref.update({ status: 'sent', dispatchedAt: nowIso, dispatchKey: claim.dispatchKey, pushSuccessCount: result.successCount, pushFailureCount: result.failureCount || 0 });
        } else {
          stats.failed += 1;
          await ref.update({ status: 'delivery_problem', dispatchedAt: nowIso, dispatchKey: claim.dispatchKey, pushFailureCount: result.failureCount || tokens.size, dispatchError: result.responses?.[0]?.error?.message || 'No push sends succeeded.' });
        }
      } catch (err) {
        stats.failed += 1;
        await ref.update({ status: 'delivery_problem', dispatchedAt: nowIso, dispatchError: err.message || 'Event reminder dispatch failed.' }).catch(() => {});
      }
    };

    await runWithConcurrency(eventSnap.docs, concurrency, processEventReminder);
    return res.status(200).json({ ok: true, now: nowIso, limit, concurrency, ...stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Reminder dispatch failed.', limit, concurrency, ...stats });
  }
};
