const { initAdmin } = require('./_chaos-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');

function getCronSecret(req) {
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return auth || String(req.headers['x-cron-secret'] || '').trim();
}

function normalizeToken(token) {
  return String(token || '').trim();
}

function collectLegacyTokens(user = {}) {
  const tokens = new Set();
  if (Array.isArray(user.fcmTokens)) user.fcmTokens.forEach(t => {
    const token = normalizeToken(t);
    if (token) tokens.add(token);
  });
  if (Array.isArray(user.pushTokens)) user.pushTokens.forEach(t => {
    const token = normalizeToken(typeof t === 'string' ? t : t?.token);
    if (token) tokens.add(token);
  });
  if (user.pushDevices && typeof user.pushDevices === 'object') {
    Object.values(user.pushDevices).forEach(device => {
      const token = normalizeToken(typeof device === 'string' ? device : (device?.token || device?.fcmToken));
      if (token) tokens.add(token);
    });
  }
  return [...tokens].filter(Boolean);
}

function collectTokens(user = {}) {
  // 15.0.98 duplicate-push guard:
  // The app now treats users.fcmToken as the current canonical device token.
  // Older fields like fcmTokens/pushTokens/pushDevices can contain stale tokens from prior browser installs
  // or service-worker repairs. Sending every historical token can create duplicate desktop/browser alerts.
  const primary = normalizeToken(user.fcmToken);
  if (primary) return [primary];
  return collectLegacyTokens(user);
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
      badge: '/app-icon.png'
    },
    fcmOptions: { link }
  };
}


function memberDocId(uid, restaurantId) {
  return `${cleanId(uid)}_${cleanId(restaurantId)}`.slice(0, 240);
}

function mergeTokenSource(tokens, source) {
  collectTokens(source).forEach(token => tokens.add(token));
}

async function lookupUserByIdOrEmail(db, idOrEmail, restaurantId = '') {
  const value = String(idOrEmail || '').trim();
  if (!value) return null;
  try {
    const direct = await db.collection('users').doc(value).get();
    if (direct.exists) return { id: direct.id, ...direct.data() };
  } catch (_) {}
  const email = norm(value);
  if (email && email.includes('@')) {
    try {
      const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
    } catch (_) {}
  }
  if (restaurantId) {
    try {
      const member = await db.collection('workspaceMembers').doc(memberDocId(value, restaurantId)).get();
      if (member.exists) {
        const data = member.data() || {};
        const userId = data.userId || data.uid || '';
        if (userId && userId !== value) return lookupUserByIdOrEmail(db, userId, restaurantId);
        if (data.email) return lookupUserByIdOrEmail(db, data.email, restaurantId);
      }
    } catch (_) {}
  }
  return null;
}

async function collectEventReminderTokens(db, reminder = {}) {
  const tokens = new Set();
  mergeTokenSource(tokens, reminder);
  if (Array.isArray(reminder.recipientPushTokens)) reminder.recipientPushTokens.forEach(token => token && tokens.add(token));
  if (Array.isArray(reminder.pushTokenSnapshot)) reminder.pushTokenSnapshot.forEach(token => token && tokens.add(token));

  const restaurantId = reminder.restaurantId || reminder.workspaceId || '';
  const lookups = new Set();
  (Array.isArray(reminder.recipientUserIds) ? reminder.recipientUserIds : []).forEach(id => id && lookups.add(String(id)));
  (Array.isArray(reminder.recipientEmails) ? reminder.recipientEmails : []).forEach(email => email && lookups.add(String(email)));
  (Array.isArray(reminder.recipientUsers) ? reminder.recipientUsers : []).forEach(user => {
    if (user?.id) lookups.add(String(user.id));
    if (user?.uid) lookups.add(String(user.uid));
    if (user?.userId) lookups.add(String(user.userId));
    if (user?.email) lookups.add(String(user.email));
  });
  if (reminder.createdBy) lookups.add(String(reminder.createdBy));
  if (reminder.createdByEmail) lookups.add(String(reminder.createdByEmail));

  const resolvedUsers = [];
  await Promise.all([...lookups].slice(0, 100).map(async (idOrEmail) => {
    const user = await lookupUserByIdOrEmail(db, idOrEmail, restaurantId);
    if (user) {
      resolvedUsers.push({ id: user.id, email: user.email || '' });
      mergeTokenSource(tokens, user);
    }
  }));
  return { tokens: [...tokens].filter(Boolean), resolvedUsers };
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

function safeInt(value, fallback, min, max) {
  const parsed = parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function daysInUtcMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addUtcMonthsClamped(date, months, anchorDay) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const day = Math.min(anchorDay || date.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    day,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ));
}

function getNextRecurringReminderAt(scheduledAt, recurrence) {
  const mode = String(recurrence || 'none').toLowerCase();
  if (!['daily', 'weekly', 'monthly'].includes(mode)) return '';
  const base = new Date(scheduledAt || Date.now());
  if (Number.isNaN(base.getTime())) return '';
  let next = new Date(base.getTime());
  const anchorDay = base.getUTCDate();
  const now = Date.now();
  let guard = 0;
  while (next.getTime() <= now && guard < 400) {
    if (mode === 'daily') next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
    if (mode === 'weekly') next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (mode === 'monthly') next = addUtcMonthsClamped(next, 1, anchorDay);
    guard += 1;
  }
  return Number.isNaN(next.getTime()) ? '' : next.toISOString();
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
      details: error?.message || String(error || 'Unknown Firebase Admin setup error'),
      diagnostics: safeDiagnostics
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
      .orderBy('scheduledAt', 'asc')
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
          if (!isRetryablePersonalReminderStatus(reminder.status)) return { claimed: false, reason: 'not_retryable' };
          if (String(reminder.status || '').toLowerCase() === 'dispatching' && minutesSinceIso(reminder.dispatchAttemptAt) < 5) return { claimed: false, reason: 'already_dispatching' };
          if (['no_push_token', 'delivery_problem'].includes(String(reminder.status || '').toLowerCase()) && minutesSinceIso(reminder.dispatchAttemptAt || reminder.dispatchedAt) < 10) return { claimed: false, reason: 'retry_window' };
          const effectiveDueAt = reminder.snoozedUntil || reminder.nextReminderAt || reminder.scheduledAt || '';
          if (effectiveDueAt && String(effectiveDueAt) > nowIso) return { claimed: false, reason: 'snoozed_or_not_due' };
          const dispatchKey = `${docSnap.id}:${effectiveDueAt || reminder.scheduledAt || ''}`;
          if ((String(reminder.status || '').toLowerCase() === 'sent' || Number(reminder.pushSuccessCount || 0) > 0) && (reminder.dispatchKey === dispatchKey || reminder.dispatchedAt)) return { claimed: false, reason: 'already_dispatched' };
          tx.update(ref, {
            status: 'dispatching',
            dispatchAttemptAt: nowIso,
            dispatchKey,
            effectiveDueAt,
            dispatchAttemptCount: Number(reminder.dispatchAttemptCount || 0) + 1,
            updatedAt: nowIso
          });
          return { claimed: true, reminder, dispatchKey, effectiveDueAt };
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
          const nextScheduledAt = getNextRecurringReminderAt(reminder.scheduledAt, reminder.recurrence);
          const nextRetryAt = nextScheduledAt || retryAt(10);
          await ref.update({
            status: nextScheduledAt ? 'scheduled' : 'no_push_token',
            scheduledAt: nextScheduledAt || reminder.scheduledAt || null,
            nextDispatchAt: nextRetryAt,
            dispatchAttemptAt: nowIso,
            dispatchedAt: null,
            previousDispatchKey: dispatchKey,
            dispatchKey: nextScheduledAt ? '' : dispatchKey,
            lastNoTokenAt: nowIso,
            dispatchError: 'No saved push token for reminder recipient. Ask the user to open the app once and allow notifications, then the cron will retry.',
            updatedAt: nowIso
          });
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
          const nextScheduledAt = getNextRecurringReminderAt(reminder.scheduledAt, reminder.recurrence);
          if (nextScheduledAt) {
            await ref.update({
              status: 'scheduled',
              scheduledAt: nextScheduledAt,
              nextDispatchAt: nextScheduledAt,
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
              nextDispatchAt: null,
              dispatchKey,
              pushSuccessCount: result.successCount,
              pushFailureCount: result.failureCount || 0
            });
          }
        } else {
          stats.failed += 1;
          await ref.update({
            status: 'delivery_problem',
            dispatchAttemptAt: nowIso,
            nextDispatchAt: retryAt(10),
            dispatchedAt: nowIso,
            dispatchKey,
            pushFailureCount: result.failureCount || tokens.length,
            dispatchError: result.responses?.[0]?.error?.message || 'No push sends succeeded.',
            updatedAt: nowIso
          });
        }
      } catch (err) {
        stats.failed += 1;
        await ref.update({
          status: 'delivery_problem',
          dispatchAttemptAt: nowIso,
          nextDispatchAt: retryAt(10),
          dispatchedAt: nowIso,
          dispatchError: err.message || 'Dispatch failed.',
          updatedAt: nowIso
        }).catch(() => {});
      }
    };

    await runWithConcurrency(snap.docs, concurrency, processReminder);

    const eventSnap = await db.collection('eventReminders')
      .where('scheduledAt', '<=', nowIso)
      .orderBy('scheduledAt', 'asc')
      .limit(limit)
      .get();

    const processEventReminder = async (docSnap) => {
      stats.eventScanned += 1;
      const ref = db.collection('eventReminders').doc(docSnap.id);
      try {
        const claim = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists) return { claimed: false, reason: 'missing' };
          const reminder = fresh.data() || {};
          if (!isRetryableEventReminderStatus(reminder.status)) return { claimed: false, reason: 'not_retryable' };
          if (String(reminder.status || '').toLowerCase() === 'dispatching' && minutesSinceIso(reminder.dispatchAttemptAt) < 5) return { claimed: false, reason: 'already_dispatching' };
          if (['no_push_token', 'delivery_problem'].includes(String(reminder.status || '').toLowerCase()) && minutesSinceIso(reminder.dispatchAttemptAt || reminder.dispatchedAt) < 10) return { claimed: false, reason: 'retry_window' };
          const effectiveDueAt = reminder.snoozedUntil || reminder.nextReminderAt || reminder.scheduledAt || '';
          if (effectiveDueAt && String(effectiveDueAt) > nowIso) return { claimed: false, reason: 'snoozed_or_not_due' };
          const dispatchKey = `${docSnap.id}:${effectiveDueAt || reminder.scheduledAt || ''}`;
          if ((reminder.status === 'sent' || Number(reminder.pushSuccessCount || 0) > 0) && (reminder.dispatchKey === dispatchKey || reminder.dispatchedAt)) return { claimed: false, reason: 'already_sent' };
          tx.update(ref, {
            status: 'dispatching',
            dispatchAttemptAt: nowIso,
            dispatchKey,
            effectiveDueAt,
            dispatchAttemptCount: Number(reminder.dispatchAttemptCount || 0) + 1,
            updatedAt: nowIso
          });
          return { claimed: true, reminder, dispatchKey, effectiveDueAt };
        });

        if (!claim.claimed) {
          stats.eventSkipped += 1;
          return;
        }

        const reminder = claim.reminder || {};
        const { tokens, resolvedUsers } = await collectEventReminderTokens(db, reminder);

        if (!tokens.length) {
          stats.noToken += 1;
          await ref.update({
            status: 'no_push_token',
            dispatchAttemptAt: nowIso,
            nextDispatchAt: retryAt(10),
            lastNoTokenAt: nowIso,
            dispatchKey: claim.dispatchKey,
            dispatchError: 'No saved push token for event reminder recipients. Ask recipients to open the app once and allow notifications, then the cron will retry.',
            resolvedRecipientCount: resolvedUsers.length,
            tokenSource: 'none',
            updatedAt: nowIso
          });
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
            lastSuccessfulDispatchAt: nowIso,
            dispatchKey: claim.dispatchKey,
            pushSuccessCount: result.successCount,
            pushFailureCount: result.failureCount || 0,
            resolvedRecipientCount: resolvedUsers.length,
            tokenSource: reminder.recipientPushTokens?.length ? 'snapshot+user_lookup' : 'user_lookup',
            updatedAt: nowIso
          });
        } else {
          stats.failed += 1;
          await ref.update({
            status: 'delivery_problem',
            dispatchAttemptAt: nowIso,
            nextDispatchAt: retryAt(10),
            dispatchKey: claim.dispatchKey,
            pushFailureCount: result.failureCount || tokens.length,
            resolvedRecipientCount: resolvedUsers.length,
            tokenSource: reminder.recipientPushTokens?.length ? 'snapshot+user_lookup' : 'user_lookup',
            dispatchError: result.responses?.[0]?.error?.message || 'No push sends succeeded.',
            updatedAt: nowIso
          });
        }
      } catch (err) {
        stats.failed += 1;
        await ref.update({
          status: 'delivery_problem',
          dispatchAttemptAt: nowIso,
          nextDispatchAt: retryAt(10),
          dispatchError: err.message || 'Event reminder dispatch failed.',
          updatedAt: nowIso
        }).catch(() => {});
      }
    };

    await runWithConcurrency(eventSnap.docs, concurrency, processEventReminder);
    return res.status(200).json({ ok: true, now: nowIso, limit, concurrency, ...stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Reminder dispatch failed.', limit, concurrency, ...stats });
  }
};
